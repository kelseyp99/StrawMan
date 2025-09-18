import { getActivityLogs, getDiscussions } from './dbServicesRemote';

const testRemote = async (uid: string) => {
  try {
    const activityLogs = await getActivityLogs();
    const discussions = await getDiscussions(undefined, uid);
    const discussionCounts = discussions.length;
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Test failed:', error);
    }
  }
};

testRemote('test-user'); // Replace with actual UID
