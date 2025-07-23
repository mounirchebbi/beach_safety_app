# SOFT/HARD DELETE & AUDIT LOG MIGRATION CHANGELOG

**Date:** 2024-07-22

## Summary
- Added `is_active` and `deleted_at` columns to `users`, `centers`, and `lifeguards` tables for soft delete support.
- Created `audit_log` table to track all delete, restore, and hard delete actions.
- Added indexes for efficient querying.

## Rationale
- Enables consistent soft/hard delete logic across all major entities.
- Supports auditability and recoverability for compliance and safety.
- Aligns with role-based permissions for System Admin and Center Admin.

## Migration Steps
1. **Backup database:**
   - File: `db_backup_before_soft_delete_migration.dump`
2. **Apply migration:**
   - File: `add_soft_delete_and_audit_log.sql`
3. **Verify schema:**
   - Check for new columns and `audit_log` table.

## Revert Instructions
- Restore from backup if needed:
  ```bash
  pg_restore -h localhost -U myapp_user -d myapp_db -c db_backup_before_soft_delete_migration.dump
  ```
- Or manually drop `audit_log` and remove `deleted_at`/`is_active` columns if required.

## Backend Logic Updates (Users)
- Soft delete (deactivate) user: `DELETE /api/v1/auth/users/:id` (System Admin or Center Admin)
- Restore user: `POST /api/v1/auth/users/:id/restore` (System Admin only)
- Hard delete user: `DELETE /api/v1/auth/users/:id/hard` (System Admin only)
- All actions are logged in `audit_log` with who, what, and when.
- Center Admin can only soft delete users in their own center.
- System Admin can perform all actions on any user.

## Backend Logic Updates (Lifeguards)
- Soft delete (deactivate) lifeguard: `DELETE /api/v1/lifeguards/:id` (System Admin or Center Admin)
- Restore lifeguard: `POST /api/v1/lifeguards/:id/restore` (System Admin only)
- Hard delete lifeguard: `DELETE /api/v1/lifeguards/:id/hard` (System Admin only)
- All actions are logged in `audit_log` with who, what, and when.
- Center Admin can only soft delete lifeguards in their own center.
- System Admin can perform all actions on any lifeguard.

## Backend Logic Updates (Centers)
- Soft delete (deactivate) center: `DELETE /api/v1/centers/:id` (System Admin only)
- Restore center: `POST /api/v1/centers/:id/restore` (System Admin only)
- Hard delete center: `DELETE /api/v1/centers/:id/hard` (System Admin only)
- All actions are logged in `audit_log` with who, what, and when.
- System Admin can perform all actions on any center.

## Next Steps
- Test all flows and permissions.

---
**Contact:** DevOps/Backend Team 