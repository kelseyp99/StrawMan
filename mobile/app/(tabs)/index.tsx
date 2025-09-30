import React, { useState } from 'react';
import { useVoteHistory } from '../context/VoteHistoryContext';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { appendCandidateResultHistory } from '../../src/services/dbServices';

const candidates = [
	{ id: 'byron', name: 'Byron Donalds' },
	{ id: 'ham', name: 'Ham San Which' },
];


const electionId = 'strawman2025'; // Use a real electionId for cloud function

const HomeScreen: React.FC = () => {
	const [vote, setVote] = useState<string | null>(null);
	const [lastVoteTime, setLastVoteTime] = useState<number | null>(null);
	const [message, setMessage] = useState<string | null>(null);
	const [menuVisible, setMenuVisible] = useState(false);
	const { history, addVote } = useVoteHistory();
	const router = useRouter();

	const handleVote = async (candidateId: string) => {
		// If voting for the same candidate, check for cooldown
		if (vote === candidateId && lastVoteTime) {
			const now = Date.now();
			if (now - lastVoteTime < 3000) { // 3 seconds cooldown
				setMessage('Please wait a few seconds before voting for the same candidate again.');
				return;
			}
		}
		setVote(candidateId);
		setLastVoteTime(Date.now());
		setMessage(`You voted for ${candidates.find(c => c.id === candidateId)?.name}!`);
		addVote(candidateId);
		try {
			await appendCandidateResultHistory(candidateId, electionId);
		} catch (e) {
			setMessage('Failed to record vote.');
		}
	};

	const openMenu = () => setMenuVisible(true);
	const closeMenu = () => setMenuVisible(false);
	const handleLogin = () => {
		closeMenu();
		router.push('/login');
	};
	const handleReturn = () => {
		closeMenu();
		// Optionally, add logic for 'Return to menu' if needed
	};

	return (
		<View style={styles.container}>
			{/* Hamburger icon in top left */}
			<TouchableOpacity style={styles.hamburger} onPress={openMenu} accessibilityLabel="Open menu">
				<Icon name="menu" size={32} color="#333" />
			</TouchableOpacity>

			<Text style={styles.title}>StrawMan Election</Text>
			<Text style={styles.subtitle}>Please vote for your candidate:</Text>
			<View style={styles.buttonRow}>
				{candidates.map(candidate => (
					<TouchableOpacity
						key={candidate.id}
						style={styles.voteButton}
						onPress={() => handleVote(candidate.id)}
						// Only disable if voting for the same candidate and cooldown is active
						disabled={!!(vote === candidate.id && lastVoteTime && Date.now() - lastVoteTime < 3000)}
					>
						<Text style={styles.buttonText}>{candidate.name}</Text>
					</TouchableOpacity>
				))}
			</View>
			{message && <Text style={styles.confirm}>{message}</Text>}

			{/* Show local vote history for this session */}
			<View style={{ marginTop: 30, width: '100%' }}>
				<Text style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 8 }}>Vote History (this session):</Text>
				{history.length === 0 ? (
					<Text style={{ color: '#888' }}>No votes yet.</Text>
				) : (
					history.map((entry, idx) => (
						<Text key={idx} style={{ color: '#333' }}>
							{new Date(entry.timestamp).toLocaleTimeString()}: {candidates.find(c => c.id === entry.candidateId)?.name || entry.candidateId}
						</Text>
					))
				)}
			</View>

			{/* Modal for menu options */}
			<Modal
				visible={menuVisible}
				animationType="slide"
				transparent
				onRequestClose={closeMenu}
			>
				<View style={styles.modalOverlay}>
					<View style={styles.menuModal}>
						<Text style={styles.menuTitle}>Menu</Text>
						<TouchableOpacity style={styles.menuButton} onPress={handleLogin}>
							<Text style={styles.menuButtonText}>Log in</Text>
						</TouchableOpacity>
						<TouchableOpacity style={styles.menuButton} onPress={handleReturn}>
							<Text style={styles.menuButtonText}>Return to menu</Text>
						</TouchableOpacity>
						<TouchableOpacity style={styles.menuCancel} onPress={closeMenu}>
							<Text style={styles.menuCancelText}>Cancel</Text>
						</TouchableOpacity>
					</View>
				</View>
			</Modal>
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
	hamburger: {
		position: 'absolute',
		top: 40,
		left: 20,
		zIndex: 10,
		backgroundColor: 'transparent',
		padding: 8,
	},
	title: {
		fontSize: 24,
		fontWeight: 'bold',
		marginBottom: 10,
		marginTop: 20,
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
	modalOverlay: {
		flex: 1,
		backgroundColor: 'rgba(0,0,0,0.3)',
		justifyContent: 'center',
		alignItems: 'center',
	},
	menuModal: {
		backgroundColor: '#fff',
		borderRadius: 12,
		padding: 24,
		width: 280,
		alignItems: 'center',
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.2,
		shadowRadius: 8,
		elevation: 5,
	},
	menuTitle: {
		fontSize: 20,
		fontWeight: 'bold',
		marginBottom: 16,
	},
	menuButton: {
		backgroundColor: '#007AFF',
		borderRadius: 8,
		paddingVertical: 10,
		paddingHorizontal: 24,
		marginVertical: 8,
		width: '100%',
		alignItems: 'center',
	},
	menuButtonText: {
		color: '#fff',
		fontSize: 16,
		fontWeight: 'bold',
	},
	menuCancel: {
		marginTop: 12,
		padding: 8,
	},
	menuCancelText: {
		color: '#007AFF',
		fontSize: 16,
	},
});

export default HomeScreen;
