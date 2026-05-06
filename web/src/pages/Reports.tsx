import React from 'react';
import { db, auth } from '../firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';

interface ReportsProps {
	electionId: string;
}

type CandidateDoc = {
	id: string;
	name: string;
	office?: string;
	party?: string;
	tally?: number;
};

const Reports: React.FC<ReportsProps> = ({ electionId }) => {
	const [view, setView] = React.useState<'summary' | 'ballot' | 'voted'>('summary');
	const [user, setUser] = React.useState<User | null>(null);
	const [loading, setLoading] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);

	const [ballotContests, setBallotContests] = React.useState<any[] | null>(null);
	const [summaryByOffice, setSummaryByOffice] = React.useState<Record<string, CandidateDoc[]>>({});
	const [votedCandidates, setVotedCandidates] = React.useState<CandidateDoc[]>([]);

	// Auth listener
	React.useEffect(() => {
		const unsub = onAuthStateChanged(auth, (u) => setUser(u));
		return () => unsub();
	}, []);

	// Load data depending on view
	React.useEffect(() => {
		if (!electionId) return;
		setError(null);
		const load = async () => {
			setLoading(true);
			try {
				// Summary: group candidates by office and tally
				if (view === 'summary') {
					const q = query(collection(db, 'candidates'), where('electionId', '==', electionId));
					const snap = await getDocs(q);
					const byOffice: Record<string, CandidateDoc[]> = {};
					snap.docs.forEach(d => {
						const data = d.data() as any;
						const office = data.office || data.district || data.roles || data.contestType || 'General';
						const cd: CandidateDoc = { id: d.id, name: data.name || '', office, party: data.party || '', tally: data.tally ?? Number(data?.votes ?? 0) };
						if (!byOffice[office]) byOffice[office] = [];
						byOffice[office].push(cd);
					});
					setSummaryByOffice(byOffice);
				}

				// Ballot: load ballot document with contests
				if (view === 'ballot') {
					const bdoc = await getDoc(doc(db, 'ballots', electionId));
					if (bdoc.exists()) {
						const data = bdoc.data();
						setBallotContests(Array.isArray(data?.contests) ? data.contests : []);
					} else {
						setBallotContests([]);
					}
				}

				// Voted: load candidate names from user's history and fetch candidate docs
				if (view === 'voted') {
					if (!user) {
						setVotedCandidates([]);
					} else {
						const histRef = doc(db, 'candidateresultshistory', user.uid);
						const histSnap = await getDoc(histRef);
						const names: string[] = [];
						if (histSnap.exists()) {
							const h = histSnap.data() || {};
							const arr = h?.[electionId] || [];
							// arr may be history of names; dedupe latest per candidate
							for (const n of arr) if (typeof n === 'string') names.push(n);
						}
						const unique = Array.from(new Set(names)).slice(-10); // limit to last 10
						const results: CandidateDoc[] = [];
						if (unique.length > 0) {
							// Firestore 'in' supports up to 10 elements
							const q = query(collection(db, 'candidates'), where('electionId', '==', electionId), where('name', 'in', unique));
							const snap = await getDocs(q);
							snap.docs.forEach(d => {
								const data = d.data() as any;
								results.push({ id: d.id, name: data.name || '', office: data.office || data.district, tally: data.tally ?? Number(data?.votes ?? 0), party: data.party || '' });
							});
						}
						setVotedCandidates(results);
					}
				}

				setLoading(false);
			} catch (err: any) {
				setError(String(err?.message || err));
				setLoading(false);
			}
		};
		load();
	}, [view, electionId, user]);

	return (
		<div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #e0eafc 0%, #cfdef3 100%)', padding: 24 }}>
			<div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 18 }}>
				<h2 style={{ margin: 0 }}>Reports</h2>
				<div style={{ marginLeft: 12, color: '#666' }}>Election: <strong>{electionId || '(none)'}</strong></div>
			</div>

			<div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
				<button onClick={() => setView('summary')} style={{ padding: '6px 12px', background: view === 'summary' ? '#3366CC' : '#fff', color: view === 'summary' ? '#fff' : '#333', borderRadius: 6, border: '1px solid #cfd8e6' }}>Summary (tallies)</button>
				<button onClick={() => setView('ballot')} style={{ padding: '6px 12px', background: view === 'ballot' ? '#3366CC' : '#fff', color: view === 'ballot' ? '#fff' : '#333', borderRadius: 6, border: '1px solid #cfd8e6' }}>My Ballot</button>
				<button onClick={() => setView('voted')} style={{ padding: '6px 12px', background: view === 'voted' ? '#3366CC' : '#fff', color: view === 'voted' ? '#fff' : '#333', borderRadius: 6, border: '1px solid #cfd8e6' }}>Races I Voted On</button>
			</div>

			{loading && <div>Loading...</div>}
			{error && <div style={{ color: 'red' }}>{error}</div>}

			<div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
				<div style={{ width: 140, minWidth: 140 }}>
					<div style={{ width: 140, height: 280, background: '#fff', borderRadius: 8, boxShadow: '0 2px 8px #0001', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>Ad</div>
					<div style={{ width: 140, height: 120, background: '#fff', borderRadius: 8, boxShadow: '0 2px 8px #0001', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Ad</div>
				</div>

				<div style={{ flex: 1, background: '#fff', padding: 18, borderRadius: 8, boxShadow: '0 2px 8px #0001' }}>
					{view === 'summary' && (
						<div>
							<h3>Summary: Tallies by contest</h3>
							{Object.keys(summaryByOffice).length === 0 && <div style={{ color: '#888' }}>No candidates found for this election.</div>}
							{Object.entries(summaryByOffice).map(([office, list]) => (
								<div key={office} style={{ marginBottom: 16 }}>
									<div style={{ fontWeight: 700, color: '#334' }}>{office}</div>
									<div style={{ marginTop: 8 }}>
										{list.sort((a,b) => (b.tally||0) - (a.tally||0)).map(c => (
											<div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed #eee' }}>
												<div>
													<div style={{ fontWeight: 600 }}>{c.name}</div>
													<div style={{ fontSize: 12, color: '#777' }}>{c.party}</div>
												</div>
												<div style={{ fontWeight: 700 }}>{c.tally ?? 0}</div>
											</div>
										))}
									</div>
								</div>
							))}
						</div>
					)}

					{view === 'ballot' && (
						<div>
							<h3>My Ballot</h3>
							{!ballotContests && <div style={{ color: '#888' }}>No ballot loaded for this election.</div>}
							{ballotContests && ballotContests.length === 0 && <div style={{ color: '#888' }}>Ballot empty for this election.</div>}
							{ballotContests && ballotContests.map((contest: any, idx: number) => (
								<div key={idx} style={{ marginBottom: 14, paddingBottom: 8, borderBottom: '1px solid #f0f4f8' }}>
									<div style={{ fontWeight: 700 }}>{contest.office || contest.roles || contest.contestType || 'Contest'}</div>
									{Array.isArray(contest.candidates) && contest.candidates.map((cand: any, i: number) => (
										<div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
											<div>{cand.name}</div>
											<div style={{ fontSize: 12, color: '#666' }}>{cand.party || ''}</div>
										</div>
									))}
								</div>
							))}
						</div>
					)}

					{view === 'voted' && (
						<div>
							<h3>Races I Voted On</h3>
							{!user && <div style={{ color: '#888' }}>Sign in to see your votes.</div>}
							{user && votedCandidates.length === 0 && <div style={{ color: '#888' }}>No recorded votes found for you in this election.</div>}
							{user && votedCandidates.map(vc => (
								<div key={vc.id} style={{ padding: '8px 0', borderBottom: '1px dashed #eee', display: 'flex', justifyContent: 'space-between' }}>
									<div>
										<div style={{ fontWeight: 700 }}>{vc.name}</div>
										<div style={{ fontSize: 12, color: '#777' }}>{vc.office}</div>
									</div>
									<div style={{ fontWeight: 700 }}>{vc.tally ?? 0}</div>
								</div>
							))}
						</div>
					)}
				</div>
			</div>
		</div>
	);
};

export default Reports;
