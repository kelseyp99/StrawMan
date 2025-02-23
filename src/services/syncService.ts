//src\services\syncService.ts
//https://chatgpt.com/share/678d0e33-7f7c-8001-bdb9-516bb8b67e4a
export interface ActivityLog {
    id: number;
    description: string;
    // Adjust field types as needed:
    // If your .NET model has a `DateTime` for timestamp, you can store it as a string or parse it into a Date.
    timestamp: string;
  }
  
  // 1. Update BASE_URL to point to your .NET server’s root address
  //    This might be http://localhost:5000 if running locally, or something else in production.
  const BASE_URL = 'http://localhost:5000';
  
  const backendService = {
    /**
     * Fetch all activity logs from the .NET API (ActivityLogController).
     */
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
  
    // You can add more methods here if you have additional endpoints,
    // for example createActivityLog, getActivityLogById, etc.
  };
  
  export default backendService;
  