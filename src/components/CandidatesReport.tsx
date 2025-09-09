import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

const CandidatesReport: React.FC = () => {
  const [candidates, setCandidates] = useState<any[]>([]);
  const [electionsMap, setElectionsMap] = useState<Record<string, { name: string; description: string }>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCandidatesAndElections = async () => {
      if (!db) {
        setLoading(false);
        return;
      }
      try {
        // Fetch all candidates
        const candidatesSnap = await getDocs(collection(db, 'Candidates'));
        const candidatesData = candidatesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setCandidates(candidatesData);

        // Fetch all elections and build a map of id to { name, description }
        const electionsSnap = await getDocs(collection(db, 'Elections'));
        const electionsData = electionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const map: Record<string, { name: string; description: string }> = {};
        electionsData.forEach(e => {
          map[e.id] = {
            name: (e && typeof (e as any).name === 'string') ? (e as any).name : e.id,
            description: (e && typeof (e as any).description === 'string') ? (e as any).description : '',
          };
        });
        setElectionsMap(map);
      } catch (e) {
        console.error('Error fetching Candidates/Elections:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchCandidatesAndElections();
  }, []);

  if (loading) return <Text>Loading report...</Text>;
  if (candidates.length === 0) return <Text>No candidates found.</Text>;

  // Group candidates by election
  const grouped: Record<string, any[]> = {};
  candidates.forEach(candidate => {
    const fk = candidate.elections_FK || candidate.elections_fk;
    if (!grouped[fk]) grouped[fk] = [];
    grouped[fk].push(candidate);
  });

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Elections & Candidates Summary</Text>
      {Object.keys(grouped).map(electionId => {
        const election = electionsMap[electionId] || { name: electionId, description: '' };
        return (
          <View key={electionId} style={styles.electionBlock}>
            <Text style={styles.electionTitle}>{election.name}</Text>
            <Text style={styles.electionDesc}>{election.description || 'N/A'}</Text>
            <Text style={styles.subHeader}>Candidates:</Text>
            {grouped[electionId].map(candidate => (
              <View key={candidate.id} style={styles.item}>
                <Text style={styles.title}>{candidate.name || candidate.id}</Text>
                <Text>Vote Tally: {candidate.voteTally || 0}</Text>
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  header: { fontSize: 22, fontWeight: 'bold', marginBottom: 12 },
  electionBlock: { marginBottom: 28, padding: 12, backgroundColor: '#e8f0fe', borderRadius: 10 },
  electionTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 4 },
  electionDesc: { fontSize: 16, color: '#555', marginBottom: 8 },
  subHeader: { fontSize: 16, fontWeight: '600', marginBottom: 6, marginTop: 8 },
  item: { marginBottom: 10, padding: 10, backgroundColor: '#f5f5f5', borderRadius: 8 },
  title: { fontSize: 18, fontWeight: 'bold' },
});

export default CandidatesReport;
