
import React from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc, updateDoc, increment, collection } from 'firebase/firestore';

const CIVIC_API_BASE = 'https://us-central1-strawman-42.cloudfunctions.net/ballot'; // Adjust if your function URL is different


const Home: React.FC = () => {
	const [votes, setVotes] = React.useState({
		"Brian Donaldson": 0,
		"Ham San Which": 0
	});
	const [loading, setLoading] = React.useState(true);
	const [error, setError] = React.useState<string | null>(null);
	const [saving, setSaving] = React.useState(false);
	const [saveMsg, setSaveMsg] = React.useState<string | null>(null);

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

	// Button to fetch ballot for 34786 and save to Firestore
	const fetchAndSaveBallot = async () => {
		setSaving(true);
		setSaveMsg(null);
		try {
			// You may want to set electionId dynamically; here is a placeholder
			const electionId = '2000'; // Replace with a real electionId as needed
			const address = '34786';
			const url = `${CIVIC_API_BASE}?address=${encodeURIComponent(address)}&electionId=${encodeURIComponent(electionId)}`;
			const res = await fetch(url);
			if (!res.ok) throw new Error('Failed to fetch ballot');
			const ballot = await res.json();
			// Save to Firestore in a new collection for testing
			const docRef = doc(collection(db, 'test_ballots'));
			await setDoc(docRef, {
				zip: address,
				electionId,
				ballot,
				createdAt: new Date().toISOString(),
			});
			setSaveMsg('Ballot saved to Firestore!');
		} catch (e: any) {
			setSaveMsg('Error: ' + (e?.message || 'Unknown error'));
		} finally {
			setSaving(false);
		}
	};

	if (loading) return <div>Loading...</div>;
	if (error) return <div style={{ color: 'red' }}>{error}</div>;

		return (
			<div style={{ maxWidth: 400, margin: '2rem auto', textAlign: 'center', border: '2px solid #333', borderRadius: 8, padding: 24, background: '#fafafa' }}>
				<h1>StrawMan Voting Portal</h1>
				<h2>Vote for Your Candidate</h2>
				<div style={{ margin: '2rem 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
					<button style={{ fontSize: 18, padding: '12px 24px' }} onClick={() => vote("Brian Donaldson")}>Brian Donaldson</button>
					<span style={{ fontWeight: 'bold' }}>Votes: {votes["Brian Donaldson"] ?? 0}</span>
					<button style={{ fontSize: 18, padding: '12px 24px' }} onClick={() => vote("Ham San Which")}>Ham San Which</button>
					<span style={{ fontWeight: 'bold' }}>Votes: {votes["Ham San Which"] ?? 0}</span>
				</div>
				<div style={{ margin: '2rem 0' }}>
					<button onClick={fetchAndSaveBallot} disabled={saving}>
						{saving ? 'Saving...' : 'Fetch & Save Ballot for 34786'}
					</button>
					{saveMsg && <div style={{ marginTop: 8, color: saveMsg.startsWith('Error') ? 'red' : 'green' }}>{saveMsg}</div>}
				</div>
			</div>
		);
};

export default Home;
