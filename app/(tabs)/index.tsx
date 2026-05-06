import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

const candidates = [
	{ id: 'byron', name: 'Byron Donalds' },
	{ id: 'ham', name: 'Ham San Which' },
];

const HomeScreen: React.FC = () => {
	const [vote, setVote] = useState<string | null>(null);
	const [message, setMessage] = useState<string | null>(null);

	const handleVote = (candidateId: string) => {
		setVote(candidateId);
		setMessage(`You voted for ${candidates.find(c => c.id === candidateId)?.name}!`);
		// TODO: Save vote to local DB or Firebase if needed
	};

	return (
		<View style={styles.container}>
			<Text style={styles.title}>StrawMan Election</Text>
			<Text style={styles.subtitle}>Please vote for your candidate:</Text>
			<View style={styles.buttonRow}>
				{candidates.map(candidate => (
					<TouchableOpacity
						key={candidate.id}
						style={styles.voteButton}
						onPress={() => handleVote(candidate.id)}
						disabled={vote !== null}
					>
						<Text style={styles.buttonText}>{candidate.name}</Text>
					</TouchableOpacity>
				))}
			</View>
			{message && <Text style={styles.confirm}>{message}</Text>}
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: '#fff',
		padding: 20,
	},
	title: {
		fontSize: 24,
		fontWeight: 'bold',
		marginBottom: 10,
	},
	subtitle: {
		fontSize: 16,
		color: '#666',
		marginBottom: 20,
	},
	buttonRow: {
		flexDirection: 'row',
		marginBottom: 20,
	},
	voteButton: {
		backgroundColor: '#007AFF',
		paddingVertical: 12,
		paddingHorizontal: 24,
		borderRadius: 8,
		marginHorizontal: 10,
	},
	buttonText: {
		color: '#fff',
		fontSize: 18,
		fontWeight: 'bold',
	},
	confirm: {
		fontSize: 16,
		color: 'green',
		marginTop: 20,
	},
});

export default HomeScreen;
