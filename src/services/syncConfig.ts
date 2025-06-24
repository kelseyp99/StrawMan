// src/services/syncConfig.ts
// Central config for sync feature flags

// Discussion sync: Legacy app continues to write new rows, so ongoing sync needed
export const ENABLE_DISCUSSION_SYNC = true;

// ActivityLog sync: Legacy app does NOT write to this table, so one-time import only
// Safe to run multiple times due to timestamp deduplication, but not necessary
export const ENABLE_ACTIVITYLOG_SYNC = true;

// Category sync: New app feature, syncs user-created categories
export const ENABLE_CATEGORY_SYNC = true;

// Optional: Set to false to skip ActivityLog import after first successful run
export const ACTIVITYLOG_ONE_TIME_IMPORT = true;
