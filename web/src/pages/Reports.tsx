import React from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';


interface ReportsProps {
	electionId: string;
}

const Reports: React.FC<ReportsProps> = ({ electionId }) => {
	const [candidates, setCandidates] = React.useState<Array<{ name: string; votes: number }>>([]);
	const [loading, setLoading] = React.useState(true);
	const [error, setError] = React.useState<string | null>(null);

	React.useEffect(() => {
		if (!electionId) return;
		const fetchCandidates = async () => {
			try {
				const q = query(collection(db, 'Candidates'), where('electionId', '==', electionId));
				const querySnapshot = await getDocs(q);
				const data: Array<{ name: string; votes: number }> = [];
				querySnapshot.forEach(doc => {
					const d = doc.data();
					data.push({ name: d.name, votes: d.votes ?? 0 });
				});
				setCandidates(data);
				setLoading(false);
			} catch (e) {
				setError('Failed to load candidates');
				setLoading(false);
			}
		};
		fetchCandidates();
	}, [electionId]);

	if (loading) return <div>Loading...</div>;
	if (error) return <div style={{ color: 'red' }}>{error}</div>;

	return (
		<div style={{ maxWidth: 400, margin: '2rem auto', textAlign: 'center' }}>
			<h2>Vote Totals</h2>
			{candidates.map((c, i) => (
				<div key={i} style={{ margin: '1rem 0' }}>
					<strong>{c.name}:</strong> {c.votes}
				</div>
			))}
		</div>
	);
};

export default Reports;
