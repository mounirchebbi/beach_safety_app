# CHANGELOG: Emergency Alert Rate Limiting Setting Migration

**Date:** $(date)

## Migration Applied
- Added column `emergency_alert_rate_limit_enabled` (BOOLEAN, DEFAULT TRUE) to `centers` table.
- Set all existing centers to `emergency_alert_rate_limit_enabled = TRUE` if NULL.

### SQL Applied
```sql
ALTER TABLE centers
ADD COLUMN IF NOT EXISTS emergency_alert_rate_limit_enabled BOOLEAN DEFAULT TRUE;

UPDATE centers SET emergency_alert_rate_limit_enabled = TRUE WHERE emergency_alert_rate_limit_enabled IS NULL;
```

## Rollback Instructions
To revert this migration, run:
```sql
ALTER TABLE centers DROP COLUMN IF EXISTS emergency_alert_rate_limit_enabled;
``` 

---

## [Step 2] Install express-rate-limit

**Action:**
- Installed the `express-rate-limit` npm package in the backend to enable user/IP-based rate limiting for emergency alerts.

**Command:**
```bash
cd backend
npm install express-rate-limit
```

**Reason:**
- Required for implementing middleware to prevent spam and unwanted emergency alerts. 