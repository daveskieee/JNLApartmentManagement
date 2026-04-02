# Apartment Management System - Backend

## Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Database Setup
- Install PostgreSQL
- Create a database: `CREATE DATABASE apartment_management;`
- Run the schema: `psql -U postgres -d apartment_management -f config/schema.sql`

### 3. Environment Configuration
Copy `.env.example` to `.env` and configure:
```bash
cp .env.example .env
```

Edit the `.env` file with your credentials:
- Database credentials
- JWT secret key
- Email configuration
- Payment gateway keys
- API endpoints

### 4. Start the Server

Development mode with auto-reload:
```bash
npm run dev
```

Production mode:
```bash
npm start
```

The server will run on `http://localhost:5000`

## Project Structure

```
backend/
├── routes/           # API endpoint definitions
├── controllers/      # Business logic
├── models/          # Data models
├── middleware/      # Custom middleware (auth, validation)
├── config/          # Configuration files and database connection
├── utils/           # Utility functions
├── ml-service/      # Machine learning service integration
└── server.js        # Main server file
```

## API Routes

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login

### Tenant Routes
- `GET /api/tenant/dashboard` - Get tenant dashboard data
- `GET /api/tenant/complaints` - Get tenant complaints

### Rent Routes
- `GET /api/rent/status/:tenantId` - Get rent status
- `GET /api/rent/all` - Get all rent records (Admin)

### Utility Routes
- `GET /api/utility/history/:tenantId` - Get utility history
- `GET /api/utility/forecast/:tenantId` - Get forecasted bills

### Complaint Routes
- `POST /api/complaint/submit` - Submit complaint
- `GET /api/complaint/my-complaints` - Get user's complaints
- `GET /api/complaint/all` - Get all complaints (Admin)

### Admin Routes
- `GET /api/admin/dashboard` - Admin dashboard stats
- `GET /api/admin/tenants` - Get all tenants

### Payment Routes
- `POST /api/payment/process` - Process payment

### Chatbot Routes
- `POST /api/chatbot/query` - Send query to chatbot

## Key Features

### 1. Authentication & Authorization
- JWT-based authentication
- Role-based access control (Tenant, Admin, Maintenance Staff)
- Password hashing with bcrypt

### 2. Real-time Notifications
- Socket.io integration for live alerts
- Notifications for rent reminders, complaints, anomalies

### 3. Database
- PostgreSQL with indexed tables for performance
- Comprehensive schema with relationships

### 4. Security
- Helmet for HTTP headers security
- Rate limiting to prevent abuse
- Input validation with express-validator
- CORS configuration

### 5. Integration Ready
- Payment gateway integration points (Stripe, PayPal, GCash)
- Email notification system
- ML service integration for forecasting
- Chatbot integration (Rasa/Dialogflow)

## Middleware

- `auth.js` - JWT authentication and role authorization
- Error handling middleware for consistent error responses

## Environment Variables

See `.env.example` for complete list of required variables.

## Database Schema

The schema includes tables for:
- Users
- Apartments
- Rent Payments
- Utility Readings
- Utility Forecasts
- Anomaly Alerts
- Complaints
- Notifications
- Payment History
- Audit Logs
- Chatbot Conversations

All tables have proper indexes for query optimization.
