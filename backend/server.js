require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

const connectDB = require('./src/config/db');
const { apiLimiter } = require('./src/middleware/rateLimiter');
const { startFollowUpCron } = require('./src/utils/cron');

// Route imports
const authRoutes = require('./src/routes/auth');
const leadsRoutes = require('./src/routes/leads');
const templatesRoutes = require('./src/routes/templates');
const recordingsRoutes = require('./src/routes/recordings');
const groupsRoutes = require('./src/routes/groups');
const analyticsRoutes = require('./src/routes/analytics');
const adminRoutes = require('./src/routes/admin');
const shareRoutes = require('./src/routes/share');
const whatsappRoutes = require('./src/routes/whatsapp');
const campaignRoutes = require('./src/routes/campaigns');
const paymentRoutes = require('./src/routes/payments');
const waSession = require('./src/services/waSession');
const campaignWorker = require('./src/services/campaignWorker');

const app = express();

// Connect DB
connectDB();

// Security
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    callback(null, true);
  },
  credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve recordings statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Rate limiting
app.use('/api', apiLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/leads', leadsRoutes);
app.use('/api/templates', templatesRoutes);
app.use('/api/recordings', recordingsRoutes);
app.use('/api/groups', groupsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api', shareRoutes);

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// 404
app.use((req, res) => res.status(404).json({ message: 'Route not found' }));

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ message: err.message || 'Internal server error' });
});

// Start cron jobs
startFollowUpCron();

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n🚀 Mobile CRM Backend running on http://localhost:${PORT}`);
  console.log(`📦 Environment: ${process.env.NODE_ENV || 'development'}\n`);
  
  // Auto-restore saved WhatsApp sessions
  waSession.initSessions().catch(console.error);

  // Start campaign background worker
  campaignWorker.startWorker();
});
