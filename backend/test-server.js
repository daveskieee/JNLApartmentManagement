const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

console.log('Loading all routes...');
try {
  const authRoutes = require('./routes/auth');
  console.log('✓ Auth routes loaded');
  
  const tenantRoutes = require('./routes/tenant');
  console.log('✓ Tenant routes loaded');
  
  const utilityRoutes = require('./routes/utility');
  console.log('✓ Utility routes loaded');
  
  const complaintRoutes = require('./routes/complaint');
  console.log('✓ Complaint routes loaded');
  
  const paymentRoutes = require('./routes/payment');
  console.log('✓ Payment routes loaded');
  
  const adminRoutes = require('./routes/admin');
  console.log('✓ Admin routes loaded');
  
  const chatbotRoutes = require('./routes/chatbot');
  console.log('✓ Chatbot routes loaded');
  
  console.log('All routes loaded successfully!\n');
  
  app.use('/api/auth', authRoutes);
  app.use('/api/tenant', tenantRoutes);
  app.use('/api/utility', utilityRoutes);
  app.use('/api/complaint', complaintRoutes);
  app.use('/api/payment', paymentRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/chatbot', chatbotRoutes);
  
} catch (err) {
  console.error('ERROR loading routes:', err.message);
  console.error(err.stack);
  process.exit(1);
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK' });
});

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Test server running on port ${PORT}`);
  console.log('Server is ready to accept connections!');
});

server.on('error', (err) => {
  console.error('Server error:', err);
  process.exit(1);
});

// Keep process alive
setInterval(() => {}, 1000);
