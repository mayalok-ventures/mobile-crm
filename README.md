# Mobile CRM — Sales Tool 🚀

A lightweight, **mobile-first** sales web app for individual sales professionals. Built with Next.js + Express + MongoDB.

## ✨ Features

- 🔐 **Flexible Auth** — Login with Email OR Phone number
- 📇 **Lead Management** — Add/edit/delete leads with notes history & tags
- 💬 **WhatsApp Templates** — 20 preset templates, merge with lead data, one-tap send
- 📂 **Group Bulk Send** — Tag-based & manual groups, sequential WA sending with 2–5s delays
- 🛡️ **Anti-Spam** — Max 50/batch, block >100 sends in 10 min, warning banners
- 📊 **Analytics Dashboard** — Conversion rate, status charts, 7-day trend
- 🎙️ **Voice Recordings** — Record & playback audio notes per lead (MediaRecorder API)
- 🔔 **Notifications** — Cron-based follow-up reminders
- 📱 **PWA** — Installable on mobile (Add to Home Screen)
- 🔗 **Share Dashboard** — Read-only shareable link via secure token
- 🛠️ **Admin Panel** — Manually assign plans, activate/deactivate users

## 🚀 Quick Start

### 1. Backend

```bash
cd backend
cp .env.example .env
# Edit .env with your MongoDB URI and JWT secret
npm install
npm run dev
```

### 2. Frontend

```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```

### 3. Open app

```
http://localhost:3000
```

## ⚙️ Environment Variables

### Backend (`backend/.env`)

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/mobile-crm
JWT_SECRET=your_super_secret_key_here_change_in_production
NODE_ENV=development
WA_BUSINESS_NUMBER=918796475107
```

### Frontend (`frontend/.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_WA_NUMBER=918796475107
```

## 📦 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router) + Tailwind CSS |
| Backend | Node.js + Express |
| Database | MongoDB + Mongoose |
| Auth | JWT (30-day tokens) |
| WhatsApp | wa.me deep links only |
| Charts | Recharts |
| Notifications | Toast (react-hot-toast) |
| Storage | Local disk (`/uploads/recordings`) |
| Scheduler | node-cron (follow-up reminders) |

## 📁 Project Structure

```
mobile-crm/
├── backend/
│   ├── src/
│   │   ├── config/db.js
│   │   ├── controllers/      # auth, leads, templates, recordings, groups, analytics, admin, share
│   │   ├── middleware/        # auth.js, rateLimiter.js, upload.js
│   │   ├── models/           # User, Lead, Template, Recording, Group, Notification
│   │   ├── routes/           # all route files
│   │   └── utils/cron.js     # follow-up scheduler
│   ├── uploads/recordings/   # audio files stored here
│   └── server.js
│
└── frontend/
    ├── src/
    │   ├── app/
    │   │   ├── dashboard/    # Lead list
    │   │   ├── leads/[id]/   # Lead detail (all-in-one screen)
    │   │   ├── templates/    # Template CRUD
    │   │   ├── groups/       # Group + bulk send
    │   │   ├── analytics/    # Charts & metrics
    │   │   ├── plans/        # WA purchase flow
    │   │   ├── profile/      # User settings + share link
    │   │   ├── admin/        # Admin user management
    │   │   ├── share/[token]/# Read-only share view
    │   │   └── notifications/
    │   ├── components/
    │   │   └── BottomNav.js
    │   └── lib/
    │       ├── api.js         # Axios instance
    │       └── auth.js        # Auth helpers + WA link builder
    └── public/
        ├── manifest.json      # PWA manifest
        └── sw.js              # Service worker
```

## 🛡️ Anti-Spam Rules

- Max **50 leads** per bulk send batch
- **Random 2–5 second** delay between each WhatsApp open
- **Yellow warning** at 20+ recipients
- **Red warning** at 40+ recipients
- Block if user sends **>100 messages in 10 minutes**

## 💳 Plan Purchase Flow

Plans page → Click plan card → Opens WhatsApp to **+91 8796475107** with pre-filled message including user name, email/phone, and selected plan. Admin manually activates via `/admin/users`.

## 📱 PWA Installation

On mobile Chrome/Safari: tap **"Add to Home Screen"** from the browser menu. App launches full-screen without browser UI.

## 🧪 Making Yourself Admin

In MongoDB, set `isAdmin: true` for your user:
```js
db.users.updateOne({ email: "you@example.com" }, { $set: { isAdmin: true } })
```

Then access `/admin` from the Profile page.
