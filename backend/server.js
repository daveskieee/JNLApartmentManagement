const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const rateLimit = require('express-rate-limit');

dotenv.config();

// Initialize database
const db = require('./config/database');
const { dbReady } = require('./config/database');

const app = express();

console.log('[INIT] Express app created');

// Middleware
app.use(helmet());
console.log('[INIT] Helmet middleware added');

// Configure CORS - permissive in development, restricted in production
app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests (Postman, server-to-server) when origin is undefined
    if (!origin) return callback(null, true);
    
    // In development, allow all origins
    if (process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }
    
    // In production, check against allowed origins
    const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000').split(',').map(o => o.trim());
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    }
    console.warn(`[CORS] Blocked origin: ${origin}`);
    return callback(new Error('CORS not allowed by server'));
  },
  credentials: true
}));
console.log('[INIT] CORS middleware added - NODE_ENV:', process.env.NODE_ENV);

app.use(express.json());
console.log('[INIT] JSON parser added');

app.use(express.urlencoded({ limit: '10mb', extended: true }));
console.log('[INIT] URL parser added');

// Add request logging middleware
app.use((req, res, next) => {
  console.log(`[REQUEST] ${req.method} ${req.path} from ${req.ip}`);
  next();
});

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Rate limiting - disabled for development
// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   max: 100
// });
// app.use('/api/', limiter);

// Import routes with error handling
console.log('[INIT] Loading routes...');
const authRoutes = require('./routes/auth');
console.log('[INIT] Auth routes loaded');
const tenantRoutes = require('./routes/tenant');
console.log('[INIT] Tenant routes loaded');
const rentRoutes = require('./routes/rent');
console.log('[INIT] Rent routes loaded');
const utilityRoutes = require('./routes/utility');
console.log('[INIT] Utility routes loaded');
const complaintRoutes = require('./routes/complaint');
console.log('[INIT] Complaint routes loaded');
const adminRoutes = require('./routes/admin');
console.log('[INIT] Admin routes loaded');
const paymentRoutes = require('./routes/payment');
console.log('[INIT] Payment routes loaded');
const chatbotRoutes = require('./routes/chatbot');
console.log('[INIT] Chatbot routes loaded');
const notificationsRoutes = require('./routes/notifications');
console.log('[INIT] Notifications routes loaded');
console.log('[INIT] All routes loaded successfully');

// API Routes
console.log('[INIT] Registering routes...');
app.use('/api/auth', authRoutes);
console.log('[INIT] Auth routes registered');
app.use('/api/tenant', tenantRoutes);
console.log('[INIT] Tenant routes registered');
app.use('/api/rent', rentRoutes);
console.log('[INIT] Rent routes registered');
app.use('/api/utility', utilityRoutes);
console.log('[INIT] Utility routes registered');
app.use('/api/complaint', complaintRoutes);
console.log('[INIT] Complaint routes registered');
app.use('/api/admin', adminRoutes);
console.log('[INIT] Admin routes registered');
app.use('/api/payment', paymentRoutes);
console.log('[INIT] Payment routes registered');
app.use('/api/chatbot', chatbotRoutes);
console.log('[INIT] Chatbot routes registered');
app.use('/api/notifications', notificationsRoutes);
console.log('[INIT] Notifications routes registered');

// Health check
app.get('/api/health', (req, res) => {
  console.log('[ROUTE] GET /api/health called');
  res.json({ status: 'API is running', timestamp: new Date().toISOString() });
});

// Test endpoint
app.get('/test', (req, res) => {
  console.log('[ROUTE] GET /test called');
  res.json({ test: 'OK' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Express error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

// Start server only after database is ready
console.log('[INIT] Waiting for database promise...');
dbReady.then(() => {
  console.log('[INIT] Database ready promise resolved!');
  const PORT = process.env.PORT || 5000;
  try {
    console.log(`[INIT] About to call app.listen(${PORT})`);
    // Listen on all interfaces (both IPv4 and IPv6)
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`[SUCCESS] Server running on port ${PORT} on all interfaces`);
      console.log('[SUCCESS] Server is ready to accept connections');
    });
    
    server.on('error', (err) => {
      console.error('[ERROR] Server error:', err);
      process.exit(1);
    });
    
    server.on('listening', () => {
      console.log('[EVENT] Server is now listening');
    });
  } catch (err) {
    console.error('[ERROR] Failed to start server:', err);
    process.exit(1);
  }
}).catch((err) => {
  console.error('[ERROR] Failed to start server due to database error:', err);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
