// Centralized types to break import cycles

export interface ActivityLog {
  id: string;
  discussionId: string;
  category: string;
  description: string;
  timestamp: Date | string;
  cleared: boolean;
  responseType?: string;
  uid: string;
  lockedCategory: boolean;
  lockedDescription: boolean;
  synced?: boolean;
  syncTimestamp?: Date;
}

export interface Discussion {
  id: string;
  discussionId: string;
  description: string;
  timestamp: Date | string;
  typeSay: string;
  cleared: boolean;
  synced?: boolean;
  syncTimestamp?: Date;
  uid?: string;
}

// Add other shared types/interfaces here as needed
