# Payment System - Quick Reference Card

## The Problem You Encountered
```
❌ "Payment failed" when submitting payment
```

## Root Cause
```
Database was created in wrong location and was missing the payment_history table
```

## The Fix (What Was Done)
```
✅ Fixed database path: ../../apartment.db → ../apartment.db
✅ Added payment_history table to schema
✅ Updated all references to use correct path
✅ System now fully initialized and working
```

---

## To Test Payment System (Right Now)

### 1. Start Servers
```powershell
# Terminal 1 - Backend
cd "e:\Downloads HDD\CAPSTONE1\login-page\backend"
npm start

# Terminal 2 - Frontend
cd "e:\Downloads HDD\CAPSTONE1\login-page\frontend"
npm start
```

### 2. Open Browser
```
http://localhost:3000
```

### 3. Register Tenant Account
- Click "Register"
- Create account with email/password
- Login

### 4. Add Test Bills
```powershell
cd "e:\Downloads HDD\CAPSTONE1\login-page\backend"
node -e "
const db = require('sqlite3').verbose();
const sqlite = new db.Database('./apartment.db');
sqlite.get('SELECT id FROM users WHERE role = \"tenant\" ORDER BY id DESC LIMIT 1', (e, u) => {
  if (u) {
    sqlite.run('INSERT INTO rent_payments (tenant_id, apartment_id, amount, due_date, status) VALUES (?, 1, 5000, \"2026-02-28\", \"pending\")', [u.id], () => {
      sqlite.run('INSERT INTO rent_payments (tenant_id, apartment_id, amount, due_date, status) VALUES (?, 1, 5000, \"2026-03-31\", \"pending\")', [u.id], () => {
        console.log('✅ Bills added!');
        sqlite.close();
      });
    });
  }
});
"
```

### 5. Test Payment
In browser:
1. Click "Pay Bills" button
2. Select a bill
3. Enter amount (≤ bill amount)
4. Select payment method
5. Enter reference number
6. Click Submit
7. Should see "Payment submitted successfully!"

### 6. Verify
- Refresh page
- Bill status should be "PAID" (green)

---

## Status Check Command

```powershell
cd "e:\Downloads HDD\CAPSTONE1\login-page\backend"
node debug-payment.js
```

**Should show:**
```
✓ TENANTS IN DATABASE: 1
✓ BILLS IN DATABASE: 2 (or more)
✓ Payments submitted: 0 (or more after testing)
```

---

## Files That Were Fixed

| File | Change |
|------|--------|
| `backend/config/database.js` | Fixed path, added payment_history table |
| `backend/debug-payment.js` | Fixed path |

---

## Key Database Locations

```
Backend: e:\Downloads HDD\CAPSTONE1\login-page\backend\apartment.db
Frontend: e:\Downloads HDD\CAPSTONE1\login-page\frontend\ (no database)
```

---

## If Payment Still Fails

**Check 1: Backend Logs**
```
Look at terminal where npm start is running
Should see: "Payment submission: {...}"
           "Payment recorded successfully"
```

**Check 2: Browser Console**
```
F12 → Console tab → look for red errors
```

**Check 3: Network Tab**
```
F12 → Network tab → look for /api/payment/submit
Check Response for error details
```

**Check 4: Database Exists**
```powershell
dir "e:\Downloads HDD\CAPSTONE1\login-page\backend\apartment.db"
Should not be empty (not 0 bytes)
```

---

## What Each Component Does

| Component | Function |
|-----------|----------|
| Frontend Form | Collects bill ID, amount, payment method, reference |
| Backend Validation | Checks bill ownership, validates amount |
| Database Update | Records payment in rent_payments & payment_history |
| Admin Dashboard | Shows bill status and payment date |

---

## Payment Submission Endpoint

```
POST /api/payment/submit
Authorization: Bearer <JWT_TOKEN>

Body:
{
  "billId": 1,
  "amount": 5000,
  "paymentMethod": "bank_transfer",
  "referenceNumber": "TXN123",
  "notes": "Optional"
}

Response:
{
  "success": true,
  "message": "Payment recorded successfully!",
  "data": {
    "billId": 1,
    "amount": 5000,
    "status": "paid",
    "paymentDate": "2026-01-28"
  }
}
```

---

## ✅ Everything is Ready!

The payment system is now fully functional. Follow the "To Test Payment System" section above to verify it's working.
