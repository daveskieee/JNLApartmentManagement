# Quick Reference Guide - Apartment Management System

## 📱 System Overview

This is a complete **Apartment Management System** designed to handle:
- Tenant management and authentication
- Utility tracking and forecasting
- Rent payment tracking
- Complaint management
- Staff coordination
- Admin reporting

## 🎯 Key Features At a Glance

| Feature | Status | Module |
|---------|--------|--------|
| User Authentication | ✅ | Core |
| Role-Based Access | ✅ | Core |
| Tenant Dashboard | ✅ | Dashboard |
| Admin Dashboard | ✅ | Dashboard |
| Rent Tracking | ✅ | Rent Module |
| Utility History | ✅ | Utility Module |
| Complaint System | ✅ | Complaint Module |
| Payment Gateway | 🔄 | Payment Module |
| Chatbot | 🔄 | Support Module |
| ML Forecasting | 🔄 | ML Module |

✅ = Implemented | 🔄 = Ready for Integration | ❌ = Not Started

## 🔐 Credentials (For Testing)

### Admin
```
Email: admin@example.com
Password: admin123
```

### Tenant
```
Email: tenant@example.com
Password: tenant123
```

### Maintenance Staff
```
Email: staff@example.com
Password: staff123
```

## 🚀 Running the System

### Terminal 1 - Backend
```bash
cd backend
npm install
npm run dev
# Runs on http://localhost:5000
```

### Terminal 2 - Frontend
```bash
cd frontend
npm install
npm start
# Opens at http://localhost:3000
```

## 📁 File Locations - Important Files

### Configuration Files
- Backend config: `backend/config/database.js`
- Database schema: `backend/config/schema.sql`
- Environment template: `backend/.env.example`
- Tailwind config: `frontend/tailwind.config.js`

### Authentication
- Auth routes: `backend/routes/auth.js`
- Auth middleware: `backend/middleware/auth.js`
- Auth context: `frontend/src/context/AuthContext.js`

### Main Pages
- Login: `frontend/src/pages/LoginPage.js`
- Register: `frontend/src/pages/RegisterPage.js`
- Tenant Dashboard: `frontend/src/pages/TenantDashboard.js`
- Admin Dashboard: `frontend/src/pages/AdminDashboard.js`

### API Routes
- Auth: `backend/routes/auth.js`
- Tenant: `backend/routes/tenant.js`
- Rent: `backend/routes/rent.js`
- Utilities: `backend/routes/utility.js`
- Complaints: `backend/routes/complaint.js`
- Admin: `backend/routes/admin.js`
- Payments: `backend/routes/payment.js`
- Chatbot: `backend/routes/chatbot.js`

## 🗄️ Database Setup

### Windows (PowerShell)
```powershell
# Create database
$pgPath = "C:\Program Files\PostgreSQL\15\bin"
& "$pgPath\createdb.exe" -U postgres apartment_management

# Load schema
& "$pgPath\psql.exe" -U postgres -d apartment_management -f backend/config/schema.sql
```

### macOS/Linux
```bash
createdb apartment_management
psql -U postgres -d apartment_management -f backend/config/schema.sql
```

## 🔌 API Quick Reference

### Authentication
```
POST /api/auth/login
POST /api/auth/register
```

### Tenant Data
```
GET  /api/tenant/dashboard
GET  /api/rent/status/:tenantId
GET  /api/utility/history/:tenantId
GET  /api/complaint/my-complaints
```

### Admin Data
```
GET  /api/admin/dashboard
GET  /api/admin/tenants
GET  /api/complaint/all
GET  /api/rent/all
```

### Submit Data
```
POST /api/complaint/submit
POST /api/payment/process
POST /api/chatbot/query
```

## 📊 Component Tree

```
App
├── LoginPage
├── RegisterPage
├── PrivateRoute
│   ├── Navbar
│   ├── TenantDashboard
│   │   ├── StatCard
│   │   ├── LineChart (Recharts)
│   │   └── BarChart (Recharts)
│   ├── AdminDashboard
│   │   └── StatCard
│   └── MaintenanceDashboard
```

## 🔗 Important Hooks & Contexts

### AuthContext
```javascript
import AuthContext from '../context/AuthContext';

const { user, token, login, register, logout } = useContext(AuthContext);
```

### API Calls
```javascript
import axios from 'axios';

const token = localStorage.getItem('token');
const config = { headers: { Authorization: `Bearer ${token}` } };

axios.get('/api/endpoint', config);
```

## 📦 Dependencies Installed

### Frontend
- react@18.2.0
- react-router-dom@6.10.0
- axios@1.3.0
- tailwindcss@3.2.7
- recharts@2.5.0
- react-hot-toast@2.4.0
- react-icons@4.7.1

### Backend
- express@4.18.2
- cors@2.8.5
- pg@8.9.0
- bcryptjs@2.4.3
- jsonwebtoken@9.0.0
- socket.io@4.6.0
- helmet@7.0.0

## 🛠️ Common Commands

### Start Services
```bash
# Backend development
npm run dev

# Frontend development
npm start

# Production backend
npm start
```

### Database Operations
```bash
# Login to PostgreSQL
psql -U postgres

# Connect to database
\c apartment_management

# List tables
\dt

# Exit PostgreSQL
\q
```

### Node Operations
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Install specific package
npm install package-name

# Uninstall package
npm uninstall package-name
```

## 🐛 Troubleshooting Quick Fixes

### "Cannot find module" Error
```bash
cd [frontend/backend]
rm -rf node_modules package-lock.json
npm install
```

### Port 5000 Already in Use (Backend)
```bash
# Change PORT in .env or use different port
PORT=5001 npm run dev
```

### Port 3000 Already in Use (Frontend)
```bash
# React will prompt to use port 3001
# Or kill the process
# Windows: taskkill /F /IM node.exe
# macOS/Linux: pkill node
```

### Database Connection Failed
1. Verify PostgreSQL is running
2. Check .env credentials
3. Ensure database exists: `createdb apartment_management`
4. Verify schema loaded: `psql -d apartment_management -c "\dt"`

### CORS Error
- Check `FRONTEND_URL` in backend `.env`
- Ensure it matches your frontend URL exactly
- Verify frontend URL has correct port (3000 or 3001)

### JWT Token Invalid
1. Clear localStorage: `localStorage.clear()`
2. Log out and log back in
3. Check JWT_SECRET in `.env` is set
4. Verify token hasn't expired

## 📊 Data Flow

```
User Login
    ↓
Auth API (/api/auth/login)
    ↓
JWT Token Generated & Stored
    ↓
Private Route Check
    ↓
Role-Based Dashboard Display
    ↓
Fetch Dashboard Data (/api/[role]/dashboard)
    ↓
Render Components with Data
```

## 🔒 Security Checklist

- ✅ JWT token stored in localStorage
- ✅ Token sent in Authorization header
- ✅ Password hashed with bcryptjs
- ✅ CORS configured
- ✅ Rate limiting enabled
- ✅ Input validation implemented
- ✅ Helmet security headers
- 🔄 2FA ready for implementation
- 🔄 Encryption ready for implementation

## 📈 Next Actions

1. **Setup Database**
   - Install PostgreSQL
   - Create database
   - Load schema

2. **Configure Environment**
   - Create backend .env
   - Create frontend .env
   - Update credentials

3. **Install Dependencies**
   - `npm install` in both directories

4. **Start Services**
   - Backend on port 5000
   - Frontend on port 3000

5. **Test Login**
   - Use test credentials
   - Navigate dashboards
   - Verify API connections

## 📞 Files to Read First

1. `README.md` - Project overview
2. `SETUP_GUIDE.md` - Detailed setup instructions
3. `IMPLEMENTATION_ROADMAP.md` - What to build next
4. `backend/README.md` - Backend-specific info
5. `frontend/README.md` - Frontend-specific info

## 🎓 Learning Resources

### React/Frontend
- React Hooks: https://react.dev/reference/react/hooks
- React Router: https://reactrouter.com/
- Tailwind CSS: https://tailwindcss.com/docs
- Axios: https://axios-http.com/docs

### Backend/Node.js
- Express.js: https://expressjs.com/
- PostgreSQL: https://www.postgresql.org/docs/
- JWT: https://jwt.io/
- bcryptjs: https://github.com/kelektiv/node.bcrypt.js

## 📞 Support Resources

- Backend Error Logs: Check console output
- Database Issues: Check PostgreSQL logs
- Frontend Errors: Check browser console (F12)
- Network Issues: Check browser Network tab
- API Testing: Use Postman or Insomnia

---

**Remember**: Keep terminals open and running for both backend and frontend!

**Version**: 0.1.0
**Last Updated**: January 26, 2026
