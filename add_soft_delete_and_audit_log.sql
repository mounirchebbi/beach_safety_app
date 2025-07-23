-- Migration: Add soft delete columns and audit log table
-- Date: 2024-07-22

-- 1. Add soft delete columns to users, centers, lifeguards
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL;

ALTER TABLE centers
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL;

ALTER TABLE lifeguards
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL;

-- 2. Create audit_log table
CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY,
  action VARCHAR(32) NOT NULL, -- 'soft_delete', 'restore', 'hard_delete'
  entity_type VARCHAR(32) NOT NULL, -- 'user', 'center', 'lifeguard', etc.
  entity_id UUID NOT NULL,
  performed_by UUID NOT NULL, -- user id
  performed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  details JSONB -- optional: store extra info (reason, previous values, etc.)
);

-- 3. (Optional) Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_centers_is_active ON centers(is_active);
CREATE INDEX IF NOT EXISTS idx_lifeguards_is_active ON lifeguards(is_active);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity_type_id ON audit_log(entity_type, entity_id); 