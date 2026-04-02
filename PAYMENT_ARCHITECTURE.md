# Payment System - Visual Debugging & Architecture

## The Issue: Database Path Problem

```
❌ BEFORE (BROKEN)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

server.js (backend/server.js)
   ↓
database.js (backend/config/database.js)
   ↓
path.join(__dirname, '../../apartment.db')
         │                          │
         └─ __dirname = backend/config/
            ../../ goes to = PROJECT ROOT
   ↓
Creates: e:\Downloads HDD\CAPSTONE1\apartment.db ← WRONG LOCATION!
   ↓
Database empty, tables not accessible
   ↓
❌ Payment fails: "no such table: users"


✅ AFTER (FIXED)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

server.js (backend/server.js)
   ↓
database.js (backend/config/database.js)
   ↓
path.join(__dirname, '../apartment.db')
         │                      │
         └─ __dirname = backend/config/
            ../ goes to = backend/
   ↓
Creates: e:\Downloads HDD\CAPSTONE1\login-page\backend\apartment.db ✓ CORRECT!
   ↓
Database initialized with all tables
   ↓
✅ Payment works: Tables accessible
```

---

## Payment Flow Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        PAYMENT SYSTEM FLOW                      │
└─────────────────────────────────────────────────────────────────┘

┌──────────────┐
│   FRONTEND   │
│   (Browser)  │
└──────┬───────┘
       │
       │ 1. Tenant clicks "Pay Bills"
       ↓
┌──────────────────────────────────┐
│     PaymentPage Component         │
│                                  │
│  Left Panel:                     │
│  - Fetch pending bills           │
│  - Display bill list             │
│                                  │
│  Right Panel:                    │
│  - Bill selection dropdown       │
│  - Amount input                  │
│  - Payment method select         │
│  - Reference number input        │
│  - Notes textarea                │
└──────┬───────────────────────────┘
       │
       │ 2. Submit form
       │ POST /api/payment/submit
       │ {billId, amount, paymentMethod, ...}
       ↓
┌──────────────────────────────────┐
│      BACKEND (Express)           │
│  routes/payment.js               │
│                                  │
│  POST /submit endpoint:          │
│  - Check auth token              │
│  - Validate bill ownership       │
│  - Validate amount ≤ bill        │
│  - Log payment details           │
└──────┬───────────────────────────┘
       │
       │ 3. Update database
       ↓
┌──────────────────────────────────┐
│     SQLite Database              │
│                                  │
│  Update rent_payments:           │
│  - status → "paid"               │
│  - paid_date → today's date      │
│  - payment_method → selected     │
│                                  │
│  Insert payment_history:         │
│  - tenant_id, amount, method     │
│  - transaction_id (reference)    │
│  - status → "submitted"          │
└──────┬───────────────────────────┘
       │
       │ 4. Return success
       ↓
┌──────────────────────────────────┐
│      BACKEND Response            │
│                                  │
│  {                               │
│    success: true,                │
│    message: "Submitted!",        │
│    data: {                       │
│      billId: 1,                  │
│      status: "paid",             │
│      paymentDate: "2026-01-28"   │
│    }                             │
│  }                               │
└──────┬───────────────────────────┘
       │
       │ 5. Update frontend
       ↓
┌──────────────────────────────────┐
│      FRONTEND Update             │
│                                  │
│  - Show success toast            │
│  - Reset form                    │
│  - Refresh bills list            │
│  - Return to dashboard           │
└──────┬───────────────────────────┘
       │
       │ 6. Admin verification
       ↓
┌──────────────────────────────────┐
│    AdminDashboard Component      │
│                                  │
│  Payments tab shows:             │
│  - Tenant name                   │
│  - Bill amount                   │
│  - Status badge (green = paid)   │
│  - Payment date                  │
└──────────────────────────────────┘
```

---

## Database Schema (What's Now Created)

```
┌─────────────────────────────────────────────┐
│              SQLite Database                │
│        apartment.db (in backend/)           │
├─────────────────────────────────────────────┤
│                                             │
│  users table                                │
│  ├─ id (PRIMARY KEY)                       │
│  ├─ email                                  │
│  ├─ password (hashed)                      │
│  ├─ full_name                              │
│  ├─ role (tenant/admin/maintenance_staff)  │
│  ├─ phone                                  │
│  └─ created_at                             │
│                                             │
│  rent_payments table ✓ UPDATED             │
│  ├─ id (PRIMARY KEY)                       │
│  ├─ tenant_id (FK → users)                │
│  ├─ apartment_id                           │
│  ├─ amount                                 │
│  ├─ due_date                               │
│  ├─ paid_date ← NEW for tracking          │
│  ├─ status (pending/paid/overdue)          │
│  ├─ payment_method ← ADDED ✓               │
│  ├─ created_at                             │
│  └─ updated_at ← ADDED ✓                   │
│                                             │
│  payment_history table ✓ NEW               │
│  ├─ id (PRIMARY KEY)                       │
│  ├─ tenant_id (FK → users)                │
│  ├─ rent_id (FK → rent_payments)          │
│  ├─ amount                                 │
│  ├─ payment_method                         │
│  ├─ transaction_id (reference number)      │
│  ├─ status (submitted/verified/failed)     │
│  └─ created_at                             │
│                                             │
│  [Other tables: apartments, complaints,    │
│   utility_readings, notifications, etc.]   │
│                                             │
└─────────────────────────────────────────────┘
```

---

## Component Interaction Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     PAYMENT SYSTEM COMPONENTS               │
└─────────────────────────────────────────────────────────────┘

                         App.js
                            │
                            │ Routes
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ↓                   ↓                   ↓
  TenantDashboard    PaymentPage         AdminDashboard
   "Pay Bills"         Form Page            Payments Tab
    Button ─────────────→│←──────────────── Shows status
        │                │                    & date
        │          ┌──────┴──────┐            │
        │          │             │            │
        └──────────→ Quick        │            │
                  Actions        │            │
                  Section        │            │
                                 │            │
                   ┌─────────────→│←──────────┘
                   │              │
                   ↓              ↓
              Axios POST    Axios GET
                   │              │
              /api/payment   /api/payment
              /submit        /history
                   │              │
                   ↓              ↓
            Backend Routes   Backend Routes
            (payment.js)     (payment.js)
                   │              │
                   ↓              ↓
             Validate &      Query &
             Update DB       Return Data
                   │              │
                   └──────────────┘
                        │
                        ↓
                   SQLite DB
                   (apartment.db)
```

---

## Data Flow for a Single Payment

```
Step 1: Select Bill
┌──────────────────────────────────────┐
│ rent_payments table                  │
│ id  tenant_id  amount  status        │
│ 1   1          5000    pending       │ ← User selects this
│ 2   1          5000    pending       │
└──────────────────────────────────────┘

Step 2: Submit Payment Form
Frontend sends:
{
  billId: 1,
  amount: 5000,
  paymentMethod: "bank_transfer",
  referenceNumber: "TXN123",
  notes: "Test"
}

Step 3: Backend Validation
✓ Check if bill exists: SELECT * FROM rent_payments WHERE id=1
✓ Check if owns bill: AND tenant_id = (from JWT)
✓ Check amount: parseFloat(5000) ≤ parseFloat(5000) ✓

Step 4: Database Updates
UPDATE rent_payments 
SET status="paid",
    payment_method="bank_transfer",
    paid_date="2026-01-28",
    updated_at=NOW()
WHERE id=1

INSERT INTO payment_history
VALUES (NULL, 1, 1, 5000, "bank_transfer", "TXN123", "submitted", NOW())

Step 5: Frontend Shows Result
Tenant Dashboard now displays:
┌──────────────────────────────────────┐
│ Bill 1                               │
│ Amount: ₱5000                        │
│ Status: PAID ✓                       │
│ Date: 2026-01-28                     │
└──────────────────────────────────────┘

Step 6: Admin Verification
Admin Dashboard Payments tab shows:
┌──────────────────────────────────────┐
│ Tenant: John Doe                     │
│ Amount: ₱5000                        │
│ Status: PAID ✓ (green)               │
│ Date: 2026-01-28                     │
└──────────────────────────────────────┘
```

---

## Error Handling Flow

```
Payment Submission
       │
       ↓
   Validation
       │
   ┌───┴───┬──────────┬──────────┐
   │       │          │          │
   ↓       ↓          ↓          ↓
  NO     NO        AMOUNT      INVALID
 BILL   OWNER      TOO HIGH      FIELDS
   │       │          │          │
   ↓       ↓          ↓          ↓
ERROR    ERROR       ERROR      ERROR
 403      403         400         400
   │       │          │          │
   └───────┴──────────┴──────────┘
           │
           ↓
    Toast Error Message
    on Frontend
           │
           ↓
    User sees:
    "Bill not found" or
    "Amount exceeds bill" or
    "Required field missing"
```

---

## File Locations

```
Project Root: e:\Downloads HDD\CAPSTONE1\login-page\

├── backend/
│   ├── npm start ← Start here (Terminal 1)
│   ├── apartment.db ← Database is HERE ✓ (fixed)
│   │
│   ├── routes/
│   │   ├── payment.js ← Payment endpoints
│   │   ├── admin.js ← Bill tracking
│   │   └── [other routes]
│   │
│   ├── config/
│   │   └── database.js ← FIXED path ✓
│   │
│   └── server.js
│
├── frontend/
│   ├── npm start ← Start here (Terminal 2)
│   └── src/
│       ├── pages/
│       │   ├── PaymentPage.js ← Payment form
│       │   ├── TenantDashboard.js ← Quick Actions
│       │   └── AdminDashboard.js ← Verify payments
│       └── App.js ← Routes registered ✓
│
└── [Documentation files]
    ├── PAYMENT_SYSTEM_IMPLEMENTATION.md
    ├── PAYMENT_SYSTEM_DEBUG_GUIDE.md
    ├── PAYMENT_TEST_GUIDE.md
    ├── PAYMENT_FIX_SUMMARY.md
    └── PAYMENT_QUICK_REFERENCE.md ← You are here
```

---

## Server Ports

```
Frontend:  http://localhost:3000
Backend:   http://localhost:5000

Database:  e:\Downloads HDD\CAPSTONE1\login-page\backend\apartment.db
```

---

## Summary

✅ **Database path fixed** - Now uses correct location
✅ **Tables created** - payment_history and updated rent_payments
✅ **Endpoints ready** - /api/payment/submit and /history
✅ **Frontend updated** - PaymentPage and quick actions
✅ **Admin integration** - Can verify payments

**System is ready to use!**
