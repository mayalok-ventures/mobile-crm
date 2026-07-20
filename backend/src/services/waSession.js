const makeWASocket = require('@whiskeysockets/baileys').default;
const { useMultiFileAuthState, DisconnectReason, Browsers } = require('@whiskeysockets/baileys');
const path = require('path');
const fs = require('fs');

// In-memory sockets store
const sessions = {};
// Store connection status and pending pairing codes
const sessionStates = {};
// Track reconnect attempts to prevent infinite loops
const reconnectAttempts = {};
// Track which users are actively in the pairing window (waiting for user to enter code)
// Reconnect MUST NOT fire during this window or it kills the pairing code
const pairingInProgress = {};
// In-memory object for user cooldowns keyed by userId
const userCooldowns = {};

// MAX_SESSIONS: Hard cap on concurrent Baileys connections.
// Each socket consumes 10–50MB RAM. At 15 sessions = up to 750MB.
// Exceeding this causes Node.js heap exhaustion and server crash.
// DO NOT raise this limit without adding a session microservice or worker process.
const MAX_SESSIONS = 15;

const getSessionDir = (userId) => {
  const dir = path.join(__dirname, '..', '..', 'uploads', 'wa-sessions', userId.toString());
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
};

const getStatus = (userId) => {
  return sessionStates[userId] || { status: 'disconnected', phone: null, pairingCode: null };
};

const disconnect = async (userId, clearAuth = true) => {
  // Clear pairing flag on explicit disconnect
  delete pairingInProgress[userId];

  const session = sessions[userId];
  if (session) {
    try {
      // Only attempt logout if the WebSocket is actually OPEN (readyState 1).
      // Calling logout() on a closed socket throws, which we want to avoid
      // because disconnect() is often called from the 'close' event handler.
      if (session.ws && session.ws.readyState === 1) {
        await Promise.race([
          session.logout().catch(() => {}),
          new Promise(r => setTimeout(r, 2000)) // 2s max for logout
        ]);
      }
    } catch (e) {}
    try { session.end(); } catch (e) {}
    delete sessions[userId];
  }

  if (clearAuth) {
    const dir = path.join(__dirname, '..', '..', 'uploads', 'wa-sessions', userId.toString());
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
  }

  // Fire-and-forget: pause active campaigns. Do NOT await — disconnect must be fast.
  // Wrapping in try/catch because MongoDB may be temporarily unreachable.
  try {
    const mongoose = require('mongoose');
    const Group = mongoose.model('Group');
    Group.updateMany(
      { userId, campaignStatus: 'sending' },
      { campaignStatus: 'paused' }
    ).catch(e => console.warn('[WA] Could not pause campaigns on disconnect:', e.message));
  } catch (e) {}

  sessionStates[userId] = { status: 'disconnected', phone: null, pairingCode: null };
};

// ─────────────────────────────────────────────────────────────────────────────
// setupSocketListeners: Attaches connection.update and creds.update handlers.
// Used by both connect() and restoreSession() to avoid duplication.
// ─────────────────────────────────────────────────────────────────────────────
const setupSocketListeners = (sock, userId, cleanPhone, saveCreds, isRestore = false) => {
  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log(`[WA] Connection closed for user ${userId}. Status: ${statusCode}. Reconnect? ${shouldReconnect}`);

      if (statusCode === 401 || statusCode === 428) {
        console.log(`[WA] Setting 30-minute pairing cooldown for user ${userId} due to close status ${statusCode}`);
        userCooldowns[userId.toString()] = Date.now() + 30 * 60 * 1000;
      }

      // ─── CRITICAL: Do NOT reconnect while pairing code is active ───────────
      // If the socket closes during the pairing window, a reconnect would start
      // a brand-new session and invalidate the code the user is trying to enter.
      if (pairingInProgress[userId]) {
        console.log(`[WA] Suppressing reconnect for user ${userId} — pairing code is active.`);
        return;
      }
      // ────────────────────────────────────────────────────────────────────────

      // Safely pause active campaigns on close
      try {
        const mongoose = require('mongoose');
        const Group = mongoose.model('Group');
        const Campaign = mongoose.model('Campaign');

        Group.updateMany(
          { userId, campaignStatus: 'sending' },
          { campaignStatus: 'paused' }
        ).catch(err => console.error('Failed to pause group campaigns on WA close:', err));

        Campaign.updateMany(
          { userId, status: 'running' },
          { status: 'paused', pausedAt: new Date() }
        ).catch(err => console.error('Failed to pause running campaigns on WA close:', err));
      } catch (err) {}

      if (shouldReconnect) {
        const attempts = (reconnectAttempts[userId] || 0) + 1;
        reconnectAttempts[userId] = attempts;
        if (attempts > 5) {
          console.error(`[WA] Reconnect limit (5) exceeded for user ${userId}. Giving up.`);
          disconnect(userId).catch(console.error);
        } else {
          console.log(`[WA] Scheduling reconnect attempt ${attempts}/5 for user ${userId} in 5s...`);
          setTimeout(() => {
            if (!pairingInProgress[userId] && (!sessions[userId] || getStatus(userId).status !== 'connected')) {
              // Use restoreSession for reconnects — creds already exist, no new pairing needed
              restoreSession(userId, cleanPhone).catch(console.error);
            }
          }, 5000);
        }
      } else {
        // Logged out — wipe everything
        disconnect(userId, true).catch(console.error);
      }
    } else if (connection === 'open') {
      console.log(`[WA] Connection opened for user ${userId} (${cleanPhone})`);
      sessionStates[userId] = { status: 'connected', phone: cleanPhone, pairingCode: null };
      pairingInProgress[userId] = false;
      reconnectAttempts[userId] = 0;
    }
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// restoreSession: Reconnect using EXISTING, fully-registered credentials.
// NEVER requests a pairing code. Only call this when creds.registered === true.
// ─────────────────────────────────────────────────────────────────────────────
const restoreSession = async (userId, cleanPhone) => {
  // Enforce session cap
  const activeCount = Object.keys(sessions).filter(id => id !== userId.toString()).length;
  if (activeCount >= MAX_SESSIONS && !sessions[userId]) {
    throw new Error(`Session limit reached (${MAX_SESSIONS}). Cannot restore.`);
  }

  // Clean up any existing socket for this user
  if (sessions[userId]) {
    const old = sessions[userId];
    try { old.end(); } catch (e) {}
    delete sessions[userId];
  }

  sessionStates[userId] = { status: 'connecting', phone: cleanPhone, pairingCode: null };

  const authDir = getSessionDir(userId);
  const { state, saveCreds } = await useMultiFileAuthState(authDir);

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    browser: Browsers.ubuntu('Chrome'),
    connectTimeoutMs: 60000,
    syncFullHistory: false,
    markOnlineOnConnect: false,
  });

  sessions[userId] = sock;
  setupSocketListeners(sock, userId, cleanPhone, saveCreds, true);
  // No pairing code — this is a restore. Socket will go open automatically.
};

// ─────────────────────────────────────────────────────────────────────────────
// connect: Start a FRESH pairing flow for a new device.
// Clears any existing auth, creates a new socket, returns the 8-digit code.
// ─────────────────────────────────────────────────────────────────────────────
const connect = async (userId, phoneNumber) => {
  // Normalize phone number (E.164 without + or spaces)
  const cleanPhone = phoneNumber.replace(/\D/g, '');
  if (!cleanPhone) throw new Error('Invalid phone number');

  // Enforce session cap to prevent RAM exhaustion
  const activeCount = Object.keys(sessions).filter(id => id !== userId.toString()).length;
  if (activeCount >= MAX_SESSIONS && !sessions[userId]) {
    throw new Error(`Server session limit reached (${MAX_SESSIONS} active sessions). Please try again later or contact admin.`);
  }

  // Always start fresh — kill any existing socket and wipe stale creds.
  // This ensures the user gets a clean pairing attempt every time.
  if (sessions[userId]) {
    const old = sessions[userId];
    delete sessions[userId];
    delete pairingInProgress[userId];
    try { old.end(); } catch (e) {}
  }

  // Wipe the auth directory so Baileys starts from zero
  const authDir = getSessionDir(userId);
  try { fs.rmSync(authDir, { recursive: true, force: true }); } catch (e) {}
  // Recreate the (now empty) directory
  fs.mkdirSync(authDir, { recursive: true });

  sessionStates[userId] = { status: 'connecting', phone: cleanPhone, pairingCode: null };
  pairingInProgress[userId] = false;

  const { state, saveCreds } = await useMultiFileAuthState(authDir);

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    browser: Browsers.ubuntu('Chrome'),
    connectTimeoutMs: 60000,
    syncFullHistory: false,
    markOnlineOnConnect: false,
  });

  sessions[userId] = sock;
  setupSocketListeners(sock, userId, cleanPhone, saveCreds, false);

  // ─── Request pairing code ─────────────────────────────────────────────────
  // How phone-number pairing works in Baileys:
  //   1. Socket connects to WhatsApp WS → fires connection:'connecting'
  //   2. We call requestPairingCode(phone) → WhatsApp returns an 8-char code
  //   3. User enters code in WhatsApp Settings > Linked Devices > Link with phone number
  //   4. WhatsApp confirms → socket fires connection:'open'
  //
  // NOTE: Baileys does NOT fire 'qr' for phone pairing. The 'connecting' state
  // (not 'open') is when requestPairingCode() is ready to be called.
  // ─────────────────────────────────────────────────────────────────────────
  try {
    const code = await new Promise((resolve, reject) => {
      let requested = false;

      // Hard timeout — 30 seconds for the WS to complete handshake
      const timeout = setTimeout(() => {
        if (!requested) {
          reject(new Error('Timed out waiting for WhatsApp. Check your internet connection and try again.'));
        }
      }, 30000);

      const tryRequest = async () => {
        if (requested) return;
        requested = true;
        clearTimeout(timeout);
        try {
          console.log(`[WA] Requesting pairing code for ${cleanPhone}...`);
          const pairingCode = await sock.requestPairingCode(cleanPhone);
          resolve(pairingCode);
        } catch (err) {
          reject(err);
        }
      };

      // PRIMARY: fire on 'connecting' — this is the correct trigger for pairing code
      sock.ev.on('connection.update', (update) => {
        if ((update.connection === 'connecting' || update.qr) && !requested) {
          // 500ms grace period for Baileys internal state to settle
          setTimeout(() => tryRequest(), 500);
        }
      });

      // FALLBACK: attempt after 3s if no event fires (rare but possible on slow networks)
      setTimeout(() => tryRequest(), 3000);
    });

    // Mark pairing window as active — suppresses reconnect handler
    pairingInProgress[userId] = true;

    sessionStates[userId] = { status: 'connecting', phone: cleanPhone, pairingCode: code };
    console.log(`[WA] Pairing code generated for user ${userId}: ${code}`);

    // Auto-expire after 110s (WhatsApp's timeout is 120s)
    setTimeout(() => {
      const currentState = sessionStates[userId];
      if (currentState && currentState.pairingCode === code && currentState.status === 'connecting') {
        console.log(`[WA] Pairing code expired for user ${userId}. Cleaning up.`);
        pairingInProgress[userId] = false;
        // Wipe the incomplete session so next attempt is truly fresh
        disconnect(userId, true).catch(console.error);
      }
    }, 110000);

    return code;
  } catch (err) {
    console.error('[WA] Failed to get pairing code:', err.message);
    pairingInProgress[userId] = false;
    sessionStates[userId] = { status: 'disconnected', phone: null, pairingCode: null };
    // Wipe incomplete auth files
    try { fs.rmSync(authDir, { recursive: true, force: true }); } catch (e) {}
    throw new Error(`Failed to generate pairing code: ${err.message}`);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// initSessions: Auto-restore FULLY REGISTERED sessions on server startup.
//
// KEY INVARIANT: Only restores sessions where creds.registered === true.
// If creds.registered is false it means a previous pairing attempt was never
// completed (user never entered the code). These stale dirs are deleted so
// they don't cause requestPairingCode() to fire on every restart.
// ─────────────────────────────────────────────────────────────────────────────
const initSessions = async () => {
  const baseDir = path.join(__dirname, '..', '..', 'uploads', 'wa-sessions');
  if (!fs.existsSync(baseDir)) return;

  const users = fs.readdirSync(baseDir);
  let consecutiveFailures = 0;

  for (const userId of users) {
    const credsPath = path.join(baseDir, userId, 'creds.json');

    // Skip if no creds file
    if (!fs.existsSync(credsPath)) continue;

    let creds;
    try {
      creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
    } catch (e) {
      console.warn(`[WA] Corrupt creds for user ${userId}, deleting.`);
      try { fs.rmSync(path.join(baseDir, userId), { recursive: true, force: true }); } catch (e2) {}
      continue;
    }

    // ── CRITICAL CHECK ────────────────────────────────────────────────────────
    // creds.registered is only true after a successful pairing + first connection.
    // If false → pairing was never completed → delete stale dir and skip.
    // Without this check, every server restart calls requestPairingCode() which
    // creates an infinite restart loop when using nodemon.
    // ─────────────────────────────────────────────────────────────────────────
    if (!creds.registered) {
      console.log(`[WA] Stale/incomplete session for user ${userId} (never paired). Deleting.`);
      try { fs.rmSync(path.join(baseDir, userId), { recursive: true, force: true }); } catch (e) {}
      continue;
    }

    const phone = creds.me?.id?.split(':')[0];
    if (!phone) {
      // Registered but no phone — corrupted state. Clean up.
      console.warn(`[WA] Registered creds but no phone for user ${userId}. Deleting.`);
      try { fs.rmSync(path.join(baseDir, userId), { recursive: true, force: true }); } catch (e) {}
      continue;
    }

    try {
      console.log(`[WA] Restoring registered session for user ${userId} (${phone})`);
      await restoreSession(userId, phone);
      consecutiveFailures = 0;
      // 1s delay between connections to avoid server spikes
      await new Promise(r => setTimeout(r, 1000));
    } catch (e) {
      console.error(`[WA] Failed to restore session for ${userId}:`, e.message);
      consecutiveFailures++;
      if (consecutiveFailures >= 3) {
        console.error(`[WA] Too many consecutive restore failures. Aborting init.`);
        break;
      }
    }
  }
};

const sendText = async (userId, to, text) => {
  const sock = sessions[userId];
  const state = getStatus(userId);
  if (!sock || state.status !== 'connected') {
    throw new Error('WhatsApp not connected');
  }
  const cleanTo = to.replace(/\D/g, '');
  const jid = `${cleanTo}@s.whatsapp.net`;
  await sock.sendMessage(jid, { text });
};

const sendMedia = async (userId, to, { text, image, video, document }) => {
  const sock = sessions[userId];
  const state = getStatus(userId);
  if (!sock || state.status !== 'connected') {
    throw new Error('WhatsApp not connected');
  }
  const cleanTo = to.replace(/\D/g, '');
  const jid = `${cleanTo}@s.whatsapp.net`;

  if (image) {
    await sock.sendMessage(jid, { image: { url: image }, caption: text });
  } else if (video) {
    await sock.sendMessage(jid, { video: { url: video }, caption: text });
  } else if (document) {
    const filename = path.basename(document);
    await sock.sendMessage(jid, { document: { url: document }, fileName: filename, caption: text });
  } else if (text) {
    await sock.sendMessage(jid, { text });
  }
};

const sendFromAnyActiveSession = async (to, text) => {
  const activeIds = Object.keys(sessions);
  for (const userId of activeIds) {
    const state = getStatus(userId);
    if (state.status === 'connected' && sessions[userId]) {
      try {
        await sendText(userId, to, text);
        console.log(`[WA] Notification sent to ${to} from user session ${userId}`);
        return true;
      } catch (e) {
        console.warn(`[WA] Failed to send from session of user ${userId}:`, e.message);
      }
    }
  }
  return false;
};

module.exports = {
  connect,
  restoreSession,
  getStatus,
  disconnect,
  sendText,
  sendMedia,
  initSessions,
  sendFromAnyActiveSession,
  userCooldowns
};
