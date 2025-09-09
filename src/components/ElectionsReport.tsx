import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebaseConfig';

const ElectionsReport: React.FC = () => {
  const [elections, setElections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchElections = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'Elections'));
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setElections(data);
      } catch (e) {
        console.error('Error fetching Elections:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchElections();
  }, []);

  if (loading) return <Text>Loading report...</Text>;
  if (elections.length === 0) return <Text>No elections found.</Text>;

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Elections Summary</Text>
      <FlatList
        data={elections}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <Text style={styles.title}>{item.name || item.id}</Text>
            <Text>Date: {item.date ? new Date(item.date.seconds * 1000).toLocaleDateString() : 'N/A'}</Text>
            <Text>Description: {item.description || 'N/A'}</Text>
            <Text>Vote Tally: {item.voteTally || 0}</Text>
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  header: { fontSize: 22, fontWeight: 'bold', marginBottom: 12 },
  item: { marginBottom: 16, padding: 12, backgroundColor: '#f5f5f5', borderRadius: 8 },
  title: { fontSize: 18, fontWeight: 'bold' },
});

export default ElectionsReport;
