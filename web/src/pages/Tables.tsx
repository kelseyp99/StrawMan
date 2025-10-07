
import React from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';

const Tables: React.FC = () => {
	const [history, setHistory] = React.useState<any[]>([]);
	const [loading, setLoading] = React.useState(true);
	const [error, setError] = React.useState<string | null>(null);

	React.useEffect(() => {
		const fetchHistory = async () => {
			try {
				// Example: fetch from 'candidateResultHistory' collection, order by timestamp desc
				const q = query(collection(db, 'candidateResultHistory'), orderBy('timestamp', 'desc'));
				const querySnapshot = await getDocs(q);
				const data: any[] = [];
				querySnapshot.forEach(doc => {
					const d = doc.data();
					data.push({ id: doc.id, ...d });
				});
				setHistory(data);
				setLoading(false);
			} catch (e) {
				setError('Failed to load voting history');
				setLoading(false);
			}
		};
		fetchHistory();
	}, []);

	if (loading) return <div>Loading...</div>;
	if (error) return <div style={{ color: 'red' }}>{error}</div>;

	return (
		<div style={{ maxWidth: 800, margin: '2rem auto' }}>
			<h2>Voting History</h2>
			<table style={{ width: '100%', borderCollapse: 'collapse' }}>
				<thead>
					<tr>
						<th style={{ border: '1px solid #ccc', padding: 8 }}>Date</th>
						<th style={{ border: '1px solid #ccc', padding: 8 }}>User</th>
						<th style={{ border: '1px solid #ccc', padding: 8 }}>Candidate</th>
						<th style={{ border: '1px solid #ccc', padding: 8 }}>Result</th>
					</tr>
				</thead>
				<tbody>
					{history.map((row) => (
						<tr key={row.id}>
							<td style={{ border: '1px solid #ccc', padding: 8 }}>
								{row.timestamp && row.timestamp.seconds
									? new Date(row.timestamp.seconds * 1000).toLocaleString()
									: ''}
							</td>
							<td style={{ border: '1px solid #ccc', padding: 8 }}>{row.userId || ''}</td>
							<td style={{ border: '1px solid #ccc', padding: 8 }}>{row.candidateName || ''}</td>
							<td style={{ border: '1px solid #ccc', padding: 8 }}>{row.result || ''}</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
};

export default Tables;
