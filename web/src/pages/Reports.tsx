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
		<div style={{
			minHeight: '100vh',
			background: 'linear-gradient(135deg, #e0eafc 0%, #cfdef3 100%)',
			display: 'flex',
			flexDirection: 'row',
			alignItems: 'stretch',
			justifyContent: 'center',
			padding: '2rem',
		}}>
			{/* Left AdSense ads */}
			<div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', width: 120, minWidth: 120, marginRight: 24 }}>
				<div style={{ width: 120, height: 300, background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px #0001', marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
					<span style={{ color: '#bbb', fontSize: 14 }}>AdSense Ad 1</span>
				</div>
				<div style={{ width: 120, height: 300, background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px #0001', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
					<span style={{ color: '#bbb', fontSize: 14 }}>AdSense Ad 2</span>
				</div>
			</div>
			{/* Main content */}
			<div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
				<div style={{ maxWidth: 400, margin: '2rem auto', textAlign: 'center' }}>
					<h2>Vote Totals</h2>
					{candidates.map((c, i) => (
						<div key={i} style={{ margin: '1rem 0' }}>
							<strong>{c.name}:</strong> {c.votes}
						</div>
					))}
				</div>
			</div>
		</div>
	);
};

export default Reports;
