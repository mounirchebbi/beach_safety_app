# Changelog: Ensure users.center_id is set when center admin creates a lifeguard

## Summary
This patch updates the center admin lifeguard creation logic so that when a lifeguard is created, the center_id is always set in the users table as well as the lifeguards table. This ensures that lifeguards created by center admins appear in the System Admin dashboard and are correctly associated with their center.

## Details
- The backend controller for lifeguard creation (lifeguardController.js, createLifeguard) now:
  - Sets center_id in the users table for new lifeguards.
  - Continues to set center_id in the lifeguards table as before.
- This resolves issues where lifeguards created by center admins would not appear in the System Admin dashboard or would show center: N/A.

## How to Revert
1. In `backend/src/controllers/lifeguardController.js`, revert the createLifeguard logic to:
   - Not set center_id in the users table for lifeguards (set to NULL or leave out of insert statement).
2. Remove or update this changelog file as appropriate.

## Patch Date
2025-07-03

## Author
AI Assistant 