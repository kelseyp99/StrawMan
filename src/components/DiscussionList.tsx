import React, { useState, useEffect } from 'react';
import { getDiscussions } from '../services/databaseService';
import { Text, View } from 'react-native';


const DiscussionTable = () => {
  // ...
};
export interface Discussion {
    type: any;
    id: number;
    timestamp: Date;
    description: string;
    cleared: boolean;
  }
const DiscussionList = () => {
  const [discussions, setDiscussions] = useState<Discussion[]>([]);

  useEffect(() => {
    // @ts-ignore
    getDiscussions().then((discussions: Discussion[]) => {
      setDiscussions(discussions);
    }).catch((error) => {
      console.error('Error getting discussions:', error);
    });
  }, []);

  return (
    <View>
      {discussions.map((discussion: Discussion) => (
        <View key={discussion.id}>
          <Text>{discussion.description}</Text>
        </View>
      ))}
    </View>
  );
};

export default DiscussionTable;