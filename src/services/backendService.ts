export interface ActivityLog {
  id: number;
  discussionId: string;
  description: string;
  category: string;
  timestamp: string;
  cleared: boolean;
  uid: string;
  lockedCategory: boolean;
  lockedDescription: boolean;
}

const BASE_URL = 'http://localhost:5000';

const backendService = {
  getAllActivityLogs: async (): Promise<ActivityLog[]> => {
    const response = await fetch(`${BASE_URL}/api/ActivityLog`);

    if (!response.ok) {
      throw new Error(
        `Failed to fetch Activity Logs. Status: ${response.status}`
      );
    }

    const data: ActivityLog[] = await response.json();
    return data;
  },
};

export default backendService;
