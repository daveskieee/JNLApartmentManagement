# Utility Submission Fix Summary

## Problem
Utility data submission was failing with error:
```
SQLITE_ERROR: table utility_readings has no column named utility_type
```

## Root Cause
The database schema uses different column names than what was being used in the code:
- Database uses: `meter_type` (not `utility_type`)
- Database uses: `reading` (not `reading_value`)
- Database has NO `unit` column (column doesn't exist)

## Solution
Updated two endpoint files to use the correct database column names:

### 1. `/api/admin/submit-utility` - backend/routes/admin.js
**Changed:**
- `INSERT INTO utility_readings (tenant_id, utility_type, reading_value, ...)` 
- **To:** `INSERT INTO utility_readings (tenant_id, meter_type, reading, ...)`
- Removed `unit` parameter (column doesn't exist in database)
- Uses column format: `meter_type`, `reading`, `reading_date`, `estimated_cost`, `currency`

### 2. `/api/utility/assign` - backend/routes/utility.js
**Changed:**
- Same column name fixes as above
- Now inserts with: `meter_type`, `reading` instead of `utility_type`, `reading_value`
- Adds default `'PHP'` currency value

## Actual Database Schema
```
utility_readings table columns:
- id (INTEGER PRIMARY KEY)
- tenant_id (INTEGER)
- apartment_id (INTEGER)
- meter_type (TEXT)          ← Use this, NOT utility_type
- reading (REAL)             ← Use this, NOT reading_value
- reading_date (TEXT)
- created_at (DATETIME)
- currency (TEXT)
- estimated_cost (REAL)
- [NO unit column]
```

## Frontend Handling
The frontend already has fallback units in TenantDashboard.js:
```javascript
unit: latest.water?.unit || 'cu.m'      // Falls back to cu.m if empty
unit: latest.electricity?.unit || 'kWh' // Falls back to kWh if empty
```

## Test Results
✅ Utility submission now successful
✅ Data correctly stored in database
✅ Retrieval endpoint returns proper format
✅ Frontend can display water and electricity usage/cost

## Files Modified
1. `backend/routes/admin.js` - Fixed `/api/admin/submit-utility` endpoint
2. `backend/routes/utility.js` - Fixed `/api/utility/assign` endpoint

## Data Flow (After Fix)
1. Admin submits utility → Data stored with correct columns
2. Frontend polls every 15 seconds → Fetches latest utilities
3. Dashboard displays water and electricity data → Works correctly
