# UTILITY DASHBOARD REAL-TIME UPDATE FIX

## Issues Identified and Fixed

### Issue #1: Column Name Mismatch in Admin Utility Submission
**File**: `backend/routes/admin.js` (lines 146-174)

**Problem**: 
The `/api/admin/submit-utility` endpoint was using incorrect column names when inserting utility data:
- Using `meter_type` instead of `utility_type`
- Using `reading` instead of `reading_value`

These columns don't exist in the database schema, causing the utility data insertion to fail or insert NULL values.

**Fix Applied**:
- Changed `meter_type` → `utility_type`
- Changed `reading` → `reading_value`
- Added proper `unit` values:
  - Water: `m³` (cubic meters)
  - Electricity: `kWh` (kilowatt-hours)

### Issue #2: Missing Polling for Utilities
**File**: `frontend/src/pages/TenantDashboard.js` (lines 190-240, 86-95)

**Problem**: 
The tenant dashboard had a polling mechanism (every 15 seconds) for bills, but NOT for utilities. This means:
- If SSE (Server-Sent Events) connection failed, utilities would never auto-update
- Only initial load and SSE events would trigger utility updates
- Users uploading utility data would not see real-time updates unless they manually refreshed

**Fix Applied**:
1. Added `fetchUtilitiesQuiet()` function that:
   - Fetches latest utilities from `/api/utility/latest/:userId`
   - Detects changes and shows toast notification
   - Updates the UI with new utility data

2. Updated polling interval to call both:
   - `fetchBillsQuiet()` - for bills
   - `fetchUtilitiesQuiet()` - for utilities
   - Frequency: Every 15 seconds

## How Real-Time Updates Now Work

### Primary Path (Ideal):
1. Admin uploads utility data via `/api/admin/submit-utility`
2. Backend sends SSE event `utility_update` to tenant
3. Frontend receives event and calls `fetchDashboardData()`
4. Dashboard updates with new utilities

### Fallback Path (If SSE Fails):
1. Admin uploads utility data via `/api/admin/submit-utility`
2. Frontend polling runs every 15 seconds
3. `fetchUtilitiesQuiet()` detects new data
4. Dashboard updates with new utilities (+ toast notification)

## Files Modified

1. **backend/routes/admin.js** 
   - Fixed `/api/admin/submit-utility` endpoint
   - Lines 160-176: Fixed INSERT statement column names

2. **frontend/src/pages/TenantDashboard.js**
   - Lines 190-195: Updated polling interval
   - Lines 240-293: Added `fetchUtilitiesQuiet()` function

## Testing

Run the test script to verify the fix:
```bash
node backend/test-utility-realtime.js
```

This tests:
1. Admin login and tenant fetching
2. Utility data submission with correct column names
3. Tenant fetching utilities and verifying data matches

## Expected Behavior After Fix

- ✅ Admin submits utility data → Data stored correctly in database
- ✅ Tenant sees utility update notification (via SSE or polling)
- ✅ Utility dashboard displays water/electricity usage and costs
- ✅ Data updates in real-time within 15 seconds (polling interval)
- ✅ Proper units displayed (m³ for water, kWh for electricity)

## Verification

You can verify the fix works by:

1. **Via Admin Dashboard**:
   - Navigate to Bills & Utilities tab
   - Select a tenant
   - Submit water/electricity usage data
   - Open tenant dashboard to see updates

2. **Via Test Script**:
   - Run `test-utility-realtime.js`
   - Check database directly using debug endpoint

3. **Manual Verification**:
   - Check browser console for any errors
   - Check network tab for API calls to `/api/utility/latest`
   - Verify utilities update within 15 seconds after submission
