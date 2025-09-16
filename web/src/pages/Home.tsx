import React from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc, updateDoc, increment } from 'firebase/firestore';

const Home: React.FC = () => {
		const [votes, setVotes] = React.useState({
			"Brian Donaldson": 0,
			"Ham San Which": 0
		});
		const [loading, setLoading] = React.useState(true);
		const [error, setError] = React.useState<string | null>(null);

		React.useEffect(() => {
			// Load votes from Firestore
			const fetchVotes = async () => {
				try {
					const docRef = doc(db, 'votes', 'totals');
					const docSnap = await getDoc(docRef);
							if (docSnap.exists()) {
								const data = docSnap.data() as { [key: string]: number };
								setVotes(v => ({
									"Brian Donaldson": data["Brian Donaldson"] ?? 0,
									"Ham San Which": data["Ham San Which"] ?? 0
								}));
							}
					setLoading(false);
				} catch (e) {
					setError('Failed to load votes');
					setLoading(false);
				}
			};
			fetchVotes();
		}, []);

		const vote = async (candidate: "Brian Donaldson" | "Ham San Which") => {
			try {
				const docRef = doc(db, 'votes', 'totals');
				await setDoc(docRef, { [candidate]: increment(1) }, { merge: true });
				// Re-fetch votes
				const docSnap = await getDoc(docRef);
						if (docSnap.exists()) {
							const data = docSnap.data() as { [key: string]: number };
							setVotes(v => ({
								"Brian Donaldson": data["Brian Donaldson"] ?? 0,
								"Ham San Which": data["Ham San Which"] ?? 0
							}));
						}
			} catch (e) {
				setError('Failed to save vote');
			}
		};

		if (loading) return <div>Loading...</div>;
		if (error) return <div style={{ color: 'red' }}>{error}</div>;

		return (
			<div style={{ maxWidth: 400, margin: '2rem auto', textAlign: 'center' }}>
				<h2>Vote for Your Candidate</h2>
				<div style={{ margin: '1rem 0' }}>
					<button onClick={() => vote("Brian Donaldson")}>Brian Donaldson</button>
					<span style={{ margin: '0 1rem' }}>{votes["Brian Donaldson"] ?? 0}</span>
				</div>
				<div style={{ margin: '1rem 0' }}>
					<button onClick={() => vote("Ham San Which")}>Ham San Which</button>
					<span style={{ margin: '0 1rem' }}>{votes["Ham San Which"] ?? 0}</span>
				</div>
			</div>
		);
	};

export default Home;
