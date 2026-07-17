const makeWASocket = require('@whiskeysockets/baileys').default;
const { useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const path = require('path');
const fs = require('fs');

// In-memory sockets store
const sessions = {};
// Store connection status and pending pairing codes
const sessionStates = {};
// Track reconnect attempts to prevent infinite loops
const reconnectAttempts = {};

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

const disconnect = async (userId) => {
  const session = sessions[userId];
  if (session) {
    try {
      session.logout();
      session.end();
    } catch (e) {}
    delete sessions[userId];
  }
  
  // Clear the auth session files
  const dir = getSessionDir(userId);
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch (e) {}

  // Pause active campaigns on disconnect
  try {
    const mongoose = require('mongoose');
    const Group = mongoose.model('Group');
    await Group.updateMany(
      { userId, campaignStatus: 'sending' },
      { campaignStatus: 'paused' }
    );
  } catch (e) {}

  sessionStates[userId] = { status: 'disconnected', phone: null, pairingCode: null };
};

const connect = async (userId, phoneNumber) => {
  // Normalize phone number (E.164 without + or spaces)
  const cleanPhone = phoneNumber.replace(/\D/g, '');
  if (!cleanPhone) throw new Error('Invalid phone number');

  // Enforce session cap to prevent RAM exhaustion
  const activeCount = Object.keys(sessions).filter(id => id !== userId.toString()).length;
  if (activeCount >= MAX_SESSIONS && !sessions[userId]) {
    throw new Error(`Server session limit reached (${MAX_SESSIONS} active sessions). Please try again later or contact admin.`);
  }

  // If already running or connected, disconnect first
  if (sessions[userId]) {
    await disconnect(userId);
  }

  sessionStates[userId] = { status: 'connecting', phone: cleanPhone, pairingCode: null };

  const authDir = getSessionDir(userId);
  const { state, saveCreds } = await useMultiFileAuthState(authDir);

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
  });

  sessions[userId] = sock;

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;
    
    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log(`Connection closed for user ${userId}. Reconnecting? ${shouldReconnect}`);
      
      // Safely pause active campaigns on close
      try {
        const mongoose = require('mongoose');
        const Group = mongoose.model('Group');
        const Campaign = mongoose.model('Campaign');
        
        Group.updateMany(
          { userId, campaignStatus: 'sending' },
          { campaignStatus: 'paused' }
        ).catch(err => console.error('Failed to update group campaigns on close:', err));

        Campaign.updateMany(
          { userId, status: 'running' },
          { status: 'paused', pausedAt: new Date() }
        ).catch(err => console.error('Failed to pause running campaigns on close:', err));
      } catch (err) {}

      if (shouldReconnect) {
        const attempts = (reconnectAttempts[userId] || 0) + 1;
        reconnectAttempts[userId] = attempts;
        if (attempts > 5) {
          console.error(`WhatsApp reconnect attempts exceeded limit (5) for user ${userId}. Disconnecting.`);
          disconnect(userId).catch(console.error);
        } else {
          console.log(`Scheduling reconnect attempt ${attempts}/5 for user ${userId} in 5s...`);
          setTimeout(() => {
            if (!sessions[userId] || getStatus(userId).status !== 'connected') {
              connect(userId, cleanPhone).catch(console.error);
            }
          }, 5000);
        }
      } else {
        disconnect(userId).catch(console.error);
      }
    } else if (connection === 'open') {
      console.log(`WhatsApp connection opened for user ${userId}`);
      sessionStates[userId] = { status: 'connected', phone: cleanPhone, pairingCode: null };
      reconnectAttempts[userId] = 0; // Reset attempts on successful connection
    }
  });

  // Request pairing code if not registered
  if (!sock.authState.creds.registered) {
    try {
      // Delay slightly to allow socket connection
      await new Promise(r => setTimeout(r, 1500));
      const code = await sock.requestPairingCode(cleanPhone);
      sessionStates[userId] = { status: 'connecting', phone: cleanPhone, pairingCode: code };
      return code;
    } catch (err) {
      console.error('Failed to get pairing code:', err);
      sessionStates[userId] = { status: 'disconnected', phone: null, pairingCode: null };
      throw new Error('Failed to generate pairing code. Please try again.');
    }
  }

  return null;
};

// Auto-restore sessions on server start
const initSessions = async () => {
  const baseDir = path.join(__dirname, '..', '..', 'uploads', 'wa-sessions');
  if (!fs.existsSync(baseDir)) return;

  const users = fs.readdirSync(baseDir);
  let consecutiveFailures = 0;
  for (const userId of users) {
    try {
      // Read saved creds to check if we can restore
      const credsPath = path.join(baseDir, userId, 'creds.json');
      if (fs.existsSync(credsPath)) {
        const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
        const phone = creds.me?.id?.split(':')[0];
        if (phone) {
          console.log(`Restoring WhatsApp session for user ${userId} (${phone})`);
          await connect(userId, phone);
          consecutiveFailures = 0; // Reset on success
        }
      }
      // Non-blocking delay of 1s between connections to avoid server spikes
      await new Promise(r => setTimeout(r, 1000));
    } catch (e) {
      console.error(`Failed to restore session for ${userId}:`, e);
      consecutiveFailures++;
      if (consecutiveFailures >= 3) {
        console.error(`[waSession] Too many consecutive session restore failures (${consecutiveFailures}). Aborting remaining restores.`);
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
  // Format destination (e.g. 918796475107@s.whatsapp.net)
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

  // Baileys accepts Buffer or URL or Local Path
  if (image) {
    await sock.sendMessage(jid, { image: { url: image }, caption: text });
  } else if (video) {
    await sock.sendMessage(jid, { video: { url: video }, caption: text });
  } else if (document) {
    // Need a filename for doc
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
        console.log(`[waSession] Notification sent to ${to} from user session ${userId}`);
        return true;
      } catch (e) {
        console.warn(`[waSession] Failed to send from active session of user ${userId}:`, e);
      }
    }
  }
  return false;
};

module.exports = {
  connect,
  getStatus,
  disconnect,
  sendText,
  sendMedia,
  initSessions,
  sendFromAnyActiveSession
};
