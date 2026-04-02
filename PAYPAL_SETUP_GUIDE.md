# PayPal Integration Setup Guide

## Overview
This document explains how to set up and test PayPal integration for the Apartment Management System.

## Prerequisites
- PayPal Developer Account (free)
- Node.js backend running
- React frontend running

## Step 1: Create PayPal Developer Account

1. Go to [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/)
2. Sign up or log in with your PayPal account
3. Create a new app:
   - Click "Apps & Credentials" in the left menu
   - Make sure you're on the "Sandbox" tab
   - Click "Create App" button under REST API apps
   - Enter a name like "Apartment Management System"
   - Click "Create App"

## Step 2: Get Your Credentials

1. In the PayPal Developer Dashboard:
   - Go to "Apps & Credentials" → "Sandbox"
   - Under "REST API apps", click on your app name
   - You'll see two sections:

### Business Account (For the Backend Server)
```
Client ID: [Your Business Client ID]
Secret: [Your Business Secret]
```

### Test Buyer Account (For Testing Payments)
- Go to "Accounts" in the left menu
- Find "Buyer Account" (email usually starts with "buyer-")
- Note the email and password

## Step 3: Configure Your Backend

### Update .env file
Create or update your `.backend/.env` file with:

```
# PayPal Configuration
PAYPAL_MODE=sandbox
PAYPAL_CLIENT_ID=your_business_client_id_here
PAYPAL_CLIENT_SECRET=your_business_secret_here
SERVER_URL=http://localhost:5000
```

**Example:**
```
PAYPAL_MODE=sandbox
PAYPAL_CLIENT_ID=AQrEo7XqFZVVx2q1234567890-1234567890123456789012345
PAYPAL_CLIENT_SECRET=EDr5VWgxx1234567890AbCdEfGhIj1234567890
SERVER_URL=http://localhost:5000
```

## Step 4: Configure Your Frontend

### Update .env file
Create or update your `frontend/.env` file with:

```
REACT_APP_PAYPAL_CLIENT_ID=your_business_client_id_here
REACT_APP_API_URL=http://localhost:5000
```

## Step 5: Install Dependencies

### Backend
```powershell
cd login-page/backend
npm install
```

### Frontend
```powershell
cd login-page/frontend
npm install
```

## Step 6: Start the Application

### Terminal 1 - Backend
```powershell
cd login-page/backend
npm run dev
```

### Terminal 2 - Frontend
```powershell
cd login-page/frontend
npm start
```

## Step 7: Test PayPal Payment

### Create Test Data
1. Log in with a test tenant account
2. Or run the create-test-accounts.js script to generate test data:
   ```powershell
   cd login-page/backend
   node create-test-accounts.js
   ```

### Make a Test Payment

1. Go to http://localhost:3000
2. Log in as a tenant
3. Navigate to "Payments" page
4. Select a pending bill
5. Choose "PayPal" as the payment method
6. Enter an amount (must be less than or equal to bill amount)
7. Click "Pay with PayPal"

### Approve Payment in Sandbox
1. You'll be redirected to PayPal Sandbox
2. Log in with your **Buyer Account** credentials:
   - Email: `buyer-test@example.com` (from your PayPal sandbox account)
   - Password: Your test buyer password
3. Review the payment details
4. Click "Pay Now" or "Approve"
5. You'll be redirected back to your app with success message

## Database Updates

The PayPal integration automatically:
- Creates entries in `payment_history` table
- Updates `rent_payments` status to "paid" upon successful transaction
- Stores the PayPal transaction ID for reference

## Payment Flow Diagram

```
User selects bill → Chooses PayPal → Frontend calls /api/payment/paypal/create 
→ Backend creates PayPal payment → User redirected to PayPal 
→ User approves payment → PayPal redirects back with paymentId & payerId 
→ Frontend calls /api/payment/paypal/execute 
→ Backend verifies & captures payment → Database updated → Success
```

## Troubleshooting

### Payment redirect not working
- Check that `REACT_APP_API_URL` and `SERVER_URL` are correctly set
- Verify PayPal Client ID is correct in frontend .env
- Check browser console for errors

### "Failed to create PayPal payment" error
- Verify `PAYPAL_MODE=sandbox`
- Check that `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` are correct
- Ensure backend is running and accessible
- Check backend console for detailed error messages

### Payment showing as pending but not approved
- Verify you logged in with the test BUYER account (not business account)
- Check payment_history table in database for transaction status
- Review backend logs for PayPal API responses

### CORS Issues
- Make sure backend CORS is configured to accept frontend URL
- Check that `FRONTEND_URL` is set correctly in backend .env

## Moving to Production

When ready for production:

1. Create live PayPal Business Account credentials
2. Change settings in .env:
   ```
   PAYPAL_MODE=live
   PAYPAL_CLIENT_ID=your_live_client_id
   PAYPAL_CLIENT_SECRET=your_live_client_secret
   ```

3. Update frontend API URL to your production server
4. Test thoroughly with small amounts

## API Endpoints

### Create Payment
```
POST /api/payment/paypal/create
Authorization: Bearer {token}
{
  "billId": 1,
  "amount": 5000.00
}
```

### Execute Payment
```
POST /api/payment/paypal/execute
Authorization: Bearer {token}
{
  "paymentId": "PAYID-123456",
  "payerId": "PAYER123",
  "billId": 1
}
```

## Security Notes

- Never commit .env files to version control
- Keep PayPal secrets safe and secure
- Use HTTPS in production
- Validate amounts on both frontend and backend
- Log all payment transactions for audit purposes

## Support

For PayPal API issues, visit:
- [PayPal Developer Docs](https://developer.paypal.com/docs/)
- [PayPal SDK Reference](https://developer.paypal.com/sdk/js/)
- [REST API Payments](https://developer.paypal.com/docs/api/overview/)
