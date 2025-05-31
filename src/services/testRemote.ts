import { getActivityLogs, getDiscussions } from './dbServicesRemote';

const testRemote = async (uid: string) => {
  try {
    const activityLogs = await getActivityLogs();
    console.log('ActivityLogs:', activityLogs);
    const discussions = await getDiscussions(undefined, uid);
    console.log('Discussions:', discussions);
    const discussionCounts = discussions.length;
    console.log('DiscussionCounts:', discussionCounts);
  } catch (error) {
    console.error('Test failed:', error);
  }
};

testRemote('test-user'); // Replace with actual UID
