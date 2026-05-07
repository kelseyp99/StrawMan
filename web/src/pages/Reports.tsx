import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { onAuthStateChanged, User } from 'firebase/auth';

type View = 'ballot' | 'voted' | 'summary';

interface Candidate {
  id: string;
  name: string;
  party: string;
  office: string;
  district?: string;
  tally?: number;
  electionId: string;
}

interface VoteRecord {
  candidateId: string;
  electionId: string;
  createdAt: any;
}

const TAB_STYLE = (active: boolean): React.CSSProperties => ({
  padding: '8px 20px', cursor: 'pointer', fontWeight: active ? 700 : 400,
  borderBottom: active ? '3px solid #3366CC' : '3px solid transparent',
  background: 'none', border: 'none', fontSize: 15, color: active ? '#3366CC' : '#555',
});

const Reports: React.FC = () => {
  const [view, setView] = useState<View>('ballot');
  const [user, setUser] = useState<User | null>(null);
  const [electionId, setElectionId] = useState('');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [myVote, setMyVote] = useState<VoteRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      const localEid = localStorage.getItem('electionId') || '9440';
      setElectionId(localEid);

      if (u) {
        const [s1, s2] = await Promise.all([
          getDoc(doc(db, 'users', u.uid)),
          getDoc(doc(db, 'Users', u.uid)),
        ]);
        const data = s1.exists() ? s1.data() : s2.exists() ? s2.data() : {};
        if (data?.electionId) setElectionId(data.electionId);

        // Load user's vote
        const voteSnap = await getDoc(doc(db, 'votes', `${u.uid}_${data?.electionId || localEid}`));
        if (voteSnap.exists()) setMyVote(voteSnap.data() as VoteRecord);
      }
    });
  }, []);

  useEffect(() => {
    if (!electionId) return;
    setLoading(true);
    getDocs(query(collection(db, 'candidates'), where('electionId', '==', electionId)))
      .then(snap => {
        setCandidates(snap.docs.map(d => ({ id: d.id, ...d.data() } as Candidate)));
        setLoading(false);
      });
  }, [electionId]);

  // Group by office
  const byOffice = candidates.reduce((acc, c) => {
    const key = c.office || c.district || 'General Contest';
    if (!acc[key]) acc[key] = [];
    acc[key].push(c);
    return acc;
  }, {} as Record<string, Candidate[]>);

  const myVotedCandidateId = myVote?.candidateId;

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: 24 }}>
      <h2>📊 Reports</h2>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #ddd', marginBottom: 24 }}>
        <button style={TAB_STYLE(view === 'ballot')} onClick={() => setView('ballot')}>🗳 My Ballot Races</button>
        <button style={TAB_STYLE(view === 'voted')} onClick={() => setView('voted')}>✅ Races I Voted In</button>
        <button style={TAB_STYLE(view === 'summary')} onClick={() => setView('summary')}>📈 Live Tally Summary</button>
      </div>

      {loading && <p>Loading...</p>}
      {!loading && candidates.length === 0 && (
        <p style={{ color: 'orange' }}>No candidates found. Go to <a href="/elections">Elections</a> and fetch candidates first.</p>
      )}

      {/* MY BALLOT RACES */}
      {view === 'ballot' && !loading && Object.entries(byOffice).map(([office, list]) => (
        <div key={office} style={{ marginBottom: 24, background: '#f8fafc', borderRadius: 8, padding: 16, border: '1px solid #e0e8f0' }}>
          <h3 style={{ marginTop: 0, color: '#334', borderBottom: '2px solid #c0d8f0', paddingBottom: 6 }}>🏛 {office}</h3>
          {list.map(c => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid #eee' }}>
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 600 }}>{c.name}</span>
                <span style={{ marginLeft: 8, fontSize: 13, color: '#888' }}>{c.party}</span>
              </div>
              {myVotedCandidateId === c.id && (
                <span style={{ background: '#e8f5e9', color: '#2e7d32', borderRadius: 12, padding: '2px 10px', fontSize: 13, fontWeight: 600 }}>✅ Your Vote</span>
              )}
            </div>
          ))}
        </div>
      ))}

      {/* RACES I VOTED IN */}
      {view === 'voted' && !loading && (
        !user ? <p style={{ color: 'orange' }}>Sign in to see your votes.</p> :
        !myVotedCandidateId ? <p style={{ color: '#888' }}>You haven't voted yet. Go to <a href="/ballot">Ballot</a> to vote.</p> :
        Object.entries(byOffice).map(([office, list]) => {
          const voted = list.find(c => c.id === myVotedCandidateId);
          if (!voted) return null;
          return (
            <div key={office} style={{ marginBottom: 20, background: '#f0fff4', borderRadius: 8, padding: 16, border: '1px solid #b2dfdb' }}>
              <h3 style={{ marginTop: 0, color: '#2e7d32' }}>🏛 {office}</h3>
              <div style={{ fontWeight: 600, fontSize: 16 }}>✅ You voted for: <span style={{ color: '#1565C0' }}>{voted.name}</span></div>
              <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>{voted.party}</div>
            </div>
          );
        })
      )}

      {/* LIVE TALLY SUMMARY */}
      {view === 'summary' && !loading && Object.entries(byOffice).map(([office, list]) => {
        const total = list.reduce((s, c) => s + (c.tally || 0), 0);
        return (
          <div key={office} style={{ marginBottom: 24, background: '#f8fafc', borderRadius: 8, padding: 16, border: '1px solid #e0e8f0' }}>
            <h3 style={{ marginTop: 0, color: '#334', borderBottom: '2px solid #c0d8f0', paddingBottom: 6 }}>🏛 {office}</h3>
            {list.sort((a, b) => (b.tally || 0) - (a.tally || 0)).map(c => {
              const pct = total > 0 ? Math.round(((c.tally || 0) / total) * 100) : 0;
              return (
                <div key={c.id} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontWeight: myVotedCandidateId === c.id ? 700 : 400 }}>
                      {myVotedCandidateId === c.id ? '✅ ' : ''}{c.name}
                      <span style={{ fontSize: 12, color: '#888', marginLeft: 8 }}>{c.party}</span>
                    </span>
                    <span style={{ fontSize: 13, color: '#555' }}>{c.tally || 0} votes ({pct}%)</span>
                  </div>
                  <div style={{ background: '#e0e0e0', borderRadius: 4, height: 10 }}>
                    <div style={{ background: myVotedCandidateId === c.id ? '#1565C0' : '#90CAF9', width: `${pct}%`, height: 10, borderRadius: 4, transition: 'width 0.4s' }} />
                  </div>
                </div>
              );
            })}
            <div style={{ fontSize: 12, color: '#aaa', marginTop: 6 }}>Total votes: {total}</div>
          </div>
        );
      })}
    </div>
  );
};

export default Reports;
