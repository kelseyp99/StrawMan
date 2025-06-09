# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

- Initial changelog created.

## [2025-06-06]

- Unified all ID types to use string for id and discussionId fields across all code, schemas, and interfaces.
- Fixed all related type errors, especially those involving ActivityLog, Discussion, and related database operations in both local (Realm) and remote (Firestore) services.
- Ensured all object creation, function calls, and interface definitions use string IDs.
- Addressed all TypeScript errors related to ID type mismatches, Realm initialization, and import/require cycles.
- Ensured Realm and Firestore work without runtime or type errors.
- Migrated or cleared local Realm data so only Firestore data (with string IDs) is used.
- Ensured Firestore-to-Realm sync stringifies all IDs, and debugged why data is not displaying after sync.
- UI (Tables.tsx) renders the date as "Today" for today's entries and handles errors gracefully.
- Added debug and test utilities for data validation.
