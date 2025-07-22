# Changelog: Fix user pagination in getAllUsers endpoint

## Summary
This patch updates the getAllUsers endpoint in authController.js to always return the correct pagination.total and pagination.pages values in the API response. This ensures that frontend pagination works correctly and all users can be browsed across multiple pages.

## Details
- The backend controller for user listing (authController.js, getAllUsers) now:
  - Always calculates the total number of users matching the filters.
  - Always returns the correct total and pages in the pagination object.
- This resolves issues where the frontend pagination would only show one page, even if there were more users.

## How to Revert
1. In `backend/src/controllers/authController.js`, revert the getAllUsers logic to its previous state (where pagination.total and pagination.pages could be null).
2. Remove or update this changelog file as appropriate.

## Patch Date
2025-07-03

## Author
AI Assistant 