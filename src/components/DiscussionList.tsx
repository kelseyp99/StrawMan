// src/components/DiscussionList.tsx
import { useState, useEffect } from 'react';
import { getDiscussions } from '../services/dbServices';

interface Discussion {
  id: string;
  discussionId?: string;
  description: string;
  timestamp: Date | string;
  typeSay?: string;
  cleared: boolean;
  uid?: string;
}

const DiscussionList = () => {
  const [discussions, setDiscussions] = useState<Discussion[]>([]);

  useEffect(() => {
    getDiscussions()
      .then((discussions: Discussion[]) => {
        setDiscussions(discussions);
      })
      .catch((error) => console.error('Error fetching discussions:', error));
  }, []);

  return (
    <div>
      {discussions.map((d) => (
        <div key={d.id}>
          {d.description} ({d.typeSay || 'unknown'})
        </div>
      ))}
    </div>
  );
};

export default DiscussionList;
