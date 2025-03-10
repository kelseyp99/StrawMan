import React, { useEffect, useState } from 'react';
import { addOrUpdateDiscussion, getDiscussions } from '../services/databaseService';
import { Text, View, StyleSheet, ScrollView, TextInput, TouchableWithoutFeedback } from 'react-native';

interface Discussion {
  id: number;
  timestamp: Date;
  description: string;
  cleared: boolean;
}

interface ThProps {
  children: React.ReactNode;
}

interface Props {
  discussions: any[];
}

const DiscussionTable = () => {
  const [discussions, setDiscussions] = useState<Discussion[]>([]);

  useEffect(() => {
    const fetchDiscussions = async () => {
      try {
        const discussions = await getDiscussions();
        setDiscussions(discussions.map(d => ({ ...d, id: Number(d.id), timestamp: new Date(d.timestamp), cleared: d.cleared ?? false })));
      } catch (error) {
        console.error('Error fetching discussions:', error);
      }
    };

    fetchDiscussions();
    
/*     // Listen for changes in the underlying Discussion table
    const subscription = addDiscussionListener((newDiscussion) => {
      setDiscussions((prevDiscussions) => [...prevDiscussions, newDiscussion]);
    });

    return () => {
      subscription.unsubscribe();
    };
 */
    
  }, []);
const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#000000',
    height: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
row: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
},
  thContainer: {
    // Add styles for thContainer here
  },
  text: {  
    color: '#FFFFFF',
  },
});

  function setDiscussionDescription(key: number, description: string): void {
  //  console.log(`Setting description for key ${key} to ${description}`);
    addOrUpdateDiscussion(description, 'tell', String(key))
  }

function deleteDiscussion(key: number): void {
    console.log(`Deleting discussion with key ${key}`);
    addOrUpdateDiscussion('', 'tell', String(key))
  }


// Now you can use the styles variable
return (
  <ScrollView style={styles.container}>
    <View style={styles.headerRow}>
      {/*  <View style={styles.thContainer}>
        <Text style={styles.text}>ID</Text>
      </View> */}
      {/*       <View style={styles.thContainer}>
        <Text style={styles.text}>Timestamp</Text>
      </View> */}
      <View style={styles.thContainer}>
      <Text style={[styles.text, { textDecorationLine: 'underline' }]} >Description</Text>
      </View>
      {/* <View style={styles.thContainer}>
        <Text style={styles.text}>Cleared</Text>
      </View> */}
    </View>
    {discussions && discussions.map((discussion) => (
      <View key={discussion.id} style={styles.row}>
        {/* <Text style={styles.text}>{discussion.id}</Text> */}
        {/*  <Text style={styles.text}>{discussion.timestamp.toLocaleString()}</Text> */}
        <TouchableWithoutFeedback onLongPress={() => {
          deleteDiscussion(discussion.id);
        }}>
          <TextInput
            style={[styles.text, { flexWrap: 'wrap' }]}
            value={discussion.description}
            onChangeText={(text) => {
              setDiscussionDescription(discussion.id, text);
            }}
            multiline={true}
          />
        </TouchableWithoutFeedback>
        {/* <Text style={styles.text}>{discussion.cleared ? 'Yes' : 'No'}</Text> */}
      </View>
    ))}
  </ScrollView>
);
};
export default DiscussionTable;

// ...

async function addDiscussion(description: string): Promise<any> {
  // ...

  // After adding the new discussion, emit an event to notify the DiscussionTable component
//  window.dispatchEvent(new CustomEvent('addDiscussion', { detail: newDiscussion }));

  // ...s
}

// ...

// Listen for the addDiscussion event in the DiscussionTable component
//window.addEventListener('addDiscussion', (event) => {
//  const newDiscussion = event.detail;
  // Call the addDiscussionListener function with the new discussion
 // addDiscussionListener(newDiscussion);
;

// ...