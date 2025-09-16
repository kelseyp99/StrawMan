import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { saveVoteAndUpdateTotals } from '../../src/services/dbServicesLocal';

interface Discussion {
  id: string;
  discussionId: string;
  description: string;
  timestamp: Date | string;
  typeSay: string;
  cleared?: boolean;
  uid?: string;
}

function AskJanet() {
  // Two-person vote state
  const [vote, setVote] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Simulate a fixed electionId for baseline test
  const electionId = '2025_presidential';

  // Save vote and update totals in Realm
  const handleVote = async (candidate: string) => {
    setVote(candidate);
    setMessage(null);
    try {
      await saveVoteAndUpdateTotals({
        electionId,
        candidateId: candidate,
        uid: undefined, // Use default local user for baseline
      });
      setMessage('Vote saved locally and totals updated!');
    } catch (err) {
      setMessage('Error saving vote: ' + (err as Error).message);
    }
  };

  // Two-person vote UI
  const renderVote = () => (
    <View style={styles.voteContainer}>
      <Text style={styles.voteTitle}>Who do you support?</Text>
      <View style={styles.voteButtons}>
        <TouchableOpacity
          style={[styles.voteButton, vote === 'Byron Donalds' && styles.selectedButton]}
          onPress={() => handleVote('Byron Donalds')}
        >
          <Text style={styles.voteButtonText}>Byron Donalds</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.voteButton, vote === 'Other Candidate' && styles.selectedButton]}
          onPress={() => handleVote('Other Candidate')}
        >
          <Text style={styles.voteButtonText}>Other Candidate</Text>
        </TouchableOpacity>
      </View>
      {vote && <Text style={styles.voteResult}>You voted: {vote}</Text>}
      {message && <Text style={{ color: message.startsWith('Error') ? 'red' : 'green', marginTop: 8 }}>{message}</Text>}
    </View>
  );

  // Main render
  return (
    <View style={styles.container}>
      {renderVote()}
      {/* TODO: Add Firebase CRUD UI here */}
      {/* TODO: Add table display here */}
      {/* TODO: Add report tab here */}
      {/* TODO: Add about box here */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 20 },
  voteContainer: { marginBottom: 30, alignItems: 'center' },
  voteTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 10 },
  voteButtons: { flexDirection: 'row', gap: 16 },
  voteButton: { backgroundColor: '#eee', padding: 16, borderRadius: 8, marginHorizontal: 8 },
  selectedButton: { backgroundColor: '#007AFF' },
  voteButtonText: { fontSize: 16, color: '#333' },
  voteResult: { marginTop: 12, fontSize: 16, color: '#007AFF' },
});

export default AskJanet;


