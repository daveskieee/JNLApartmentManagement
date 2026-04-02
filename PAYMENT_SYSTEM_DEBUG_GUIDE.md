# Payment System Debugging Guide

## Issue: "Payment Failed" Error

If you're seeing "Payment failed" when trying to submit a payment, follow this step-by-step debugging guide.

---

## Step 1: Verify Backend is Running

**Open Terminal and run:**
```powershell
netstat -ano | findstr ":5000"
```

**Expected Output:** Should show a LISTENING process on port 5000
```
TCP    0.0.0.0:5000           0.0.0.0:0              LISTENING       12345
```

**If NOT running:** 
```powershell
cd "e:\Downloads HDD\CAPSTONE1\login-page\backend"
npm start
```

---

## Step 2: Verify Frontend is Running

**Open another terminal and run:**
```powershell
netstat -ano | findstr ":3000"
```

**Expected Output:** Should show a LISTENING process on port 3000

**If NOT running:**
```powershell
cd "e:\Downloads HDD\CAPSTONE1\login-page\frontend"
npm start
```

---

## Step 3: Check Browser Console for Errors

1. **Open Payment Page**
   - Go to http://localhost:3000
   - Login with your tenant account
   - Click "Pay Bills" button

2. **Open Developer Tools**
   - Press `F12` in your browser
   - Go to **Console** tab
   - Look for any red error messages

3. **Check Network Tab**
   - Click **Network** tab
   - Try to submit a payment
   - Look for requests to `/api/payment/submit`
   - Click on that request and check:
     - **Request body** - Should have: billId, amount, paymentMethod, referenceNumber
     - **Response** - Check what error the backend returns

---

## Step 4: Check If You Have Pending Bills

1. **In the Payment Page**, check the left panel:
   - Do you see a list of pending bills?
   - If empty, you need to add bills to your account

2. **Add Test Bills** - Run this in terminal:
   ```powershell
   cd "e:\Downloads HDD\CAPSTONE1\login-page\backend"
   node -e "
   const db = require('sqlite3').verbose();
   const sqlite = new db.Database('../../apartment.db');
   
   // Add 2 test bills
   sqlite.run('INSERT INTO rent_payments (tenant_id, apartment_id, amount, due_date, status) VALUES (?, 1, 5000, ?, \"pending\")', 
     [1, '2026-02-28'], (err) => console.log(err ? 'Error: ' + err : 'Bill added'));
   sqlite.run('INSERT INTO rent_payments (tenant_id, apartment_id, amount, due_date, status) VALUES (?, 1, 5000, ?, \"pending\")', 
     [1, '2026-03-31'], (err) => {
       console.log(err ? 'Error: ' + err : 'Bill added');
       sqlite.close();
     });
   "
   ```

---

## Step 5: Verify Your Tenant ID

**Common Issue:** Payment fails because the bill doesn't belong to your tenant account.

1. **Find your tenant ID**:
   ```powershell
   cd "e:\Downloads HDD\CAPSTONE1\login-page\backend"
   node -e "
   const db = require('sqlite3').verbose();
   const sqlite = new db.Database('../../apartment.db');
   
   sqlite.all('SELECT id, email, full_name, role FROM users WHERE role = \"tenant\" LIMIT 10', (err, rows) => {
     console.log('Tenant Accounts:');
     rows?.forEach(r => console.log(\`  ID: \${r.id}, Email: \${r.email}, Name: \${r.full_name}\`));
     sqlite.close();
   });
   "
   ```

2. **Find bills for your tenant**:
   ```powershell
   cd "e:\Downloads HDD\CAPSTONE1\login-page\backend"
   node -e "
   const db = require('sqlite3').verbose();
   const sqlite = new db.Database('../../apartment.db');
   
   // Replace TENANT_ID with your actual tenant ID
   sqlite.all('SELECT id, tenant_id, amount, due_date, status FROM rent_payments WHERE tenant_id = ? AND status = \"pending\"', 
     [1], (err, rows) => {
       console.log('Your pending bills:');
       rows?.forEach(r => console.log(\`  ID: \${r.id}, Amount: ₱\${r.amount}, Due: \${r.due_date}, Status: \${r.status}\`));
       sqlite.close();
     });
   "
   ```

---

## Step 6: Test Payment Submission Manually

If you want to test the API directly without the frontend:

```powershell
cd "e:\Downloads HDD\CAPSTONE1\login-page\backend"
node -e "
const axios = require('axios');

// 1. Get your token by logging in (this is from localStorage in browser)
// For testing, we'll create a JWT manually - replace with your actual token
const token = 'YOUR_JWT_TOKEN_HERE';

const payload = {
  billId: 1,          // Change to your actual bill ID
  amount: 2500,       // Must not exceed bill amount
  paymentMethod: 'bank_transfer',
  referenceNumber: 'TEST123',
  notes: 'Test payment'
};

axios.post('http://localhost:5000/api/payment/submit', payload, {
  headers: { Authorization: \`Bearer \${token}\` }
})
.then(res => console.log('Success:', res.data))
.catch(err => {
  console.log('Error:', err.response?.status);
  console.log('Message:', err.response?.data?.message);
  console.log('Details:', err.response?.data?.error);
});
"
```

---

## Step 7: Common Error Messages & Solutions

### Error: "Bill not found"
- **Cause:** The billId doesn't exist or doesn't belong to your tenant account
- **Solution:** 
  - Check that you selected a bill from the list on the left
  - Verify the bill ID matches your account (step 5)
  - Add more test bills if needed

### Error: "Unauthorized - Bill not found"
- **Cause:** The authentication token is invalid or expired
- **Solution:**
  - Refresh the page (F5)
  - Logout and login again
  - Check that browser allows localStorage (not in private/incognito mode)

### Error: "Payment amount exceeds bill amount"
- **Cause:** You entered an amount larger than the bill
- **Solution:**
  - Enter an amount less than or equal to the bill amount
  - The form should prevent this, but the backend also validates

### Error: "payment failed. Please try again"
- **Cause:** Backend API error (check backend logs)
- **Solution:**
  - Check terminal where backend is running for error messages
  - Restart backend: `npm start`
  - Check if database file exists: `ls ../../apartment.db`

### Error: "Failed to fetch bills"
- **Cause:** Can't load pending bills on Payment Page
- **Solution:**
  - Check network in browser (F12 > Network tab)
  - Verify `/api/tenant/dashboard` endpoint is working
  - Check backend logs for errors

---

## Step 8: Backend Logs Analysis

When you submit a payment, the backend should log:

```
Payment submission: { billId: 1, amount: 2500, paymentMethod: 'bank_transfer', tenantId: 1 }
Payment recorded successfully
```

**Check your terminal where `npm start` is running** - Look for these logs.

If you see errors like:
```
Error processing payment: [Error message]
```

Copy the exact error message and check section **Step 7** above.

---

## Step 9: Full Restart (Nuclear Option)

If nothing works, do a complete fresh start:

```powershell
# Kill all Node processes
taskkill /IM node.exe /F 2>&1

# Wait a moment
Start-Sleep -Seconds 2

# Delete old database
Remove-Item "e:\Downloads HDD\CAPSTONE1\apartment.db" -Force -ErrorAction SilentlyContinue

# Start fresh backend (will recreate database)
cd "e:\Downloads HDD\CAPSTONE1\login-page\backend"
npm start
```

Then in another terminal:
```powershell
cd "e:\Downloads HDD\CAPSTONE1\login-page\frontend"
npm start
```

---

## Step 10: Test Checklist

Before trying to pay, verify:

- [ ] Backend running on http://localhost:5000
- [ ] Frontend running on http://localhost:3000
- [ ] Database file exists: `e:\Downloads HDD\CAPSTONE1\apartment.db`
- [ ] You're logged in as a tenant user
- [ ] You can see pending bills on the Payment Page
- [ ] Selected bill shows correct amount
- [ ] Payment amount is ≤ bill amount
- [ ] All form fields are filled

---

## API Endpoint Details

### POST /api/payment/submit

**Request:**
```json
{
  "billId": 1,
  "amount": 2500,
  "paymentMethod": "bank_transfer",
  "referenceNumber": "TXN123456",
  "notes": "Payment for January"
}
```

**Required Headers:**
```
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json
```

**Success Response (201):**
```json
{
  "success": true,
  "message": "Payment recorded successfully!",
  "data": {
    "billId": 1,
    "amount": 2500,
    "status": "paid",
    "paymentMethod": "bank_transfer",
    "paymentDate": "2026-01-28"
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "message": "Error message here",
  "error": "Detailed error if available"
}
```

---

## Getting Help

If you still can't figure it out:

1. **Check backend logs** - Most errors are logged there
2. **Check browser console** (F12 > Console) - Frontend errors shown there
3. **Check Network tab** - See actual API requests and responses
4. **Database queries** - Use the commands above to check what data exists

Run this for a complete status report:

```powershell
# Terminal 1 - Check servers
"=== SERVER STATUS ===";
"Backend (5000): $(if (netstat -ano | findstr ':5000' -q) { 'RUNNING' } else { 'NOT RUNNING' })";
"Frontend (3000): $(if (netstat -ano | findstr ':3000' -q) { 'RUNNING' } else { 'NOT RUNNING' })";

# Terminal 2 - Check database
cd "e:\Downloads HDD\CAPSTONE1\login-page\backend"
node -e "
const db = require('sqlite3').verbose();
const sqlite = new db.Database('../../apartment.db');
sqlite.all('SELECT COUNT(*) as count FROM users WHERE role = \"tenant\"', (e, r) => 
  console.log('Tenants in DB: ' + r[0].count)
);
sqlite.all('SELECT COUNT(*) as count FROM rent_payments WHERE status = \"pending\"', (e, r) => 
  console.log('Pending bills: ' + r[0].count)
);
sqlite.close();
"
```

Once you have these details, the issue should be clear!
