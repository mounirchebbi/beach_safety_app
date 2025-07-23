-- Migration: Add per-center emergency alert rate limiting setting
-- Adds a boolean column to the centers table to enable/disable rate limiting for emergency alerts

ALTER TABLE centers
ADD COLUMN IF NOT EXISTS emergency_alert_rate_limit_enabled BOOLEAN DEFAULT FALSE;

-- Optionally, set all existing centers to disabled (FALSE)
UPDATE centers SET emergency_alert_rate_limit_enabled = FALSE WHERE emergency_alert_rate_limit_enabled IS NULL;

-- To rollback (if needed):
-- ALTER TABLE centers DROP COLUMN IF EXISTS emergency_alert_rate_limit_enabled; 