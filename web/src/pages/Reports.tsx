

import React from 'react';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';

const Reports: React.FC = () => {
	const [candidates, setCandidates] = React.useState<Array<{ name: string; voteTally: number }>>([]);
	const [loading, setLoading] = React.useState(true);
	const [error, setError] = React.useState<string | null>(null);

	React.useEffect(() => {
		const fetchCandidates = async () => {
			try {
				const querySnapshot = await getDocs(collection(db, 'candidates'));
				const data: Array<{ name: string; voteTally: number }> = [];
				querySnapshot.forEach(doc => {
					const d = doc.data();
					data.push({ name: d.name || doc.id, voteTally: d.voteTally ?? 0 });
				});
				setCandidates(data);
				setLoading(false);
			} catch (e) {
				setError('Failed to load candidates');
				setLoading(false);
			}
		};
		fetchCandidates();
	}, []);

	if (loading) return <div>Loading...</div>;
	if (error) return <div style={{ color: 'red' }}>{error}</div>;

	return (
		<div style={{ maxWidth: 500, margin: '2rem auto', textAlign: 'center' }}>
			<h2>Vote Totals</h2>
			<table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 24 }}>
				<thead>
					<tr>
						<th style={{ border: '1px solid #ccc', padding: 8 }}>Candidate</th>
						<th style={{ border: '1px solid #ccc', padding: 8 }}>Votes</th>
					</tr>
				</thead>
				<tbody>
					{candidates.length === 0 ? (
						<tr><td colSpan={2} style={{ padding: 16 }}>No votes yet.</td></tr>
					) : (
						candidates.map((c, i) => (
							<tr key={i}>
								<td style={{ border: '1px solid #ccc', padding: 8 }}>{c.name}</td>
								<td style={{ border: '1px solid #ccc', padding: 8 }}>{c.voteTally}</td>
							</tr>
						))
					)}
				</tbody>
			</table>
		</div>
	);
};


export default Reports;
