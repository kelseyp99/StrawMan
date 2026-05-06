import React, { useEffect, useState } from 'react';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { onAuthStateChanged, User } from 'firebase/auth';

interface Candidate {
  id: string;
  name: string;
  party: string;
  office: string;
  district?: string;
  level?: string;
  roles?: string;
  contestType?: string;
  electionId: string;
  electionName: string;
  candidateUrl?: string;
  photoUrl?: string;
}

const Ballot: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [electionId, setElectionId] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [voteStatus, setVoteStatus] = useState<Record<string, string>>({});

  // 1. Listen for auth state — load electionId from localStorage first, then Firestore
  useEffect(() => {
    // Immediately load from localStorage — no waiting for auth
    const localEid = localStorage.getItem('electionId') || '9440'; // default to WV
    const localAddr = localStorage.getItem('userAddress') || '';
    setElectionId(localEid);
    if (localAddr) setAddress(localAddr);

    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const [snapLower, snapUpper] = await Promise.all([
          getDoc(doc(db, 'users', u.uid)),
          getDoc(doc(db, 'Users', u.uid)),
        ]);
        const data = snapLower.exists() ? snapLower.data() : snapUpper.exists() ? snapUpper.data() : {};
        const eid = data?.electionId || localEid;
        const addr = data?.address || localAddr;
        console.log('[Ballot] uid:', u.uid, 'electionId:', eid, 'address:', addr);
        if (eid) setElectionId(eid);
        if (addr) setAddress(addr);
      }
    });
  }, []);

  // 3. Load candidates when electionId changes
  useEffect(() => {
    if (!electionId) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    const load = async () => {
      try {
        const q = query(collection(db, 'candidates'), where('electionId', '==', electionId));
        const snap = await getDocs(q);
        const list: Candidate[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as Candidate));
        setCandidates(list);
      } catch (e: any) {
        setError(e.message);
      }
      setLoading(false);
    };
    load();
  }, [electionId]);

  const handleVote = async (candidate: Candidate) => {
    if (!user) { alert('Please sign in to vote.'); return; }
    try {
      // Direct POST to CORS-enabled HTTP endpoint (processVoteHttp)
      const idToken = await user.getIdToken();
      console.log('[Vote] POST to processVoteHttp with:', { userId: user.uid, candidateId: candidate.id, candidateName: candidate.name, electionId });
      const resp = await fetch('https://us-central1-strawman-42.cloudfunctions.net/processVoteHttp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({ userId: user.uid, candidateId: candidate.id, candidateName: candidate.name, electionId }),
      });
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`HTTP ${resp.status}: ${txt}`);
      }
      const data = await resp.json();
      console.log('[Vote] http result:', data);
      setVoteStatus(s => ({ ...s, [candidate.id]: data?.message || '✅ Vote recorded!' }));
    } catch (err: any) {
      console.error('[Vote] error (http):', err);
      setVoteStatus(s => ({ ...s, [candidate.id]: `❌ ${err?.message || err?.code || JSON.stringify(err)}` }));
    }
  };

  // Group candidates by office
  const byOffice = candidates.reduce((acc, c) => {
    const key = c.office || c.district || c.roles || c.contestType || 'General Contest';
    if (!acc[key]) acc[key] = [];
    acc[key].push(c);
    return acc;
  }, {} as Record<string, Candidate[]>);

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 24 }}>
      <h2>Your Ballot</h2>
      {address && <div style={{ color: '#666', marginBottom: 8 }}>📍 {address}</div>}
      <div style={{ fontSize: 12, color: '#aaa', marginBottom: 8 }}>
        electionId: <strong>{electionId || '(none)'}</strong>
        &nbsp;|&nbsp;localStorage: <strong>{localStorage.getItem('electionId') || '(none)'}</strong>
        &nbsp;<button onClick={() => { setElectionId(localStorage.getItem('electionId') || ''); }} style={{ fontSize: 11, padding: '2px 8px', cursor: 'pointer' }}>↺ Reload</button>
      </div>
      {electionId
        ? <div style={{ color: '#888', marginBottom: 16, fontSize: 13 }}>Election ID: {electionId}</div>
        : <div style={{ color: 'orange', marginBottom: 16 }}>
            No election selected. Go to <a href="/elections">Elections</a>, enter your address, and click ⬇ Fetch &amp; Save Candidates.
          </div>
      }
      {loading && <p>Loading candidates...</p>}
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
      {!loading && candidates.length === 0 && electionId && (
        <p style={{ color: 'orange' }}>No candidates found for this election. Try fetching candidates on the <a href="/elections">Elections</a> page.</p>
      )}
      {Object.entries(byOffice).map(([office, list]) => (
        <div key={office} style={{ marginBottom: 28, background: '#f8fafc', borderRadius: 8, padding: 16, border: '1px solid #e0e8f0' }}>
          <h3 style={{ marginTop: 0, color: '#334', borderBottom: '2px solid #c0d0e0', paddingBottom: 8 }}>
            🏛 {office}
            {list[0]?.district && office !== list[0].district && <span style={{ fontSize: 13, color: '#888', fontWeight: 400, marginLeft: 8 }}>({list[0].district})</span>}
            {list[0]?.level && <span style={{ fontSize: 12, color: '#aaa', fontWeight: 400, marginLeft: 8 }}>{list[0].level}</span>}
          </h3>
          {list.map(c => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, padding: 10, background: '#fff', borderRadius: 6, border: '1px solid #e8eaf0' }}>
              {c.photoUrl && <img src={c.photoUrl} alt={c.name} style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }} />}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{c.name}</div>
                <div style={{ fontSize: 13, color: '#888' }}>{c.party}</div>
                {c.office && <div style={{ fontSize: 12, color: '#5577AA', marginTop: 2 }}>🏛 {c.office}</div>}
              </div>
              <button
                onClick={() => handleVote(c)}
                style={{ padding: '6px 16px', background: '#3366CC', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14 }}
              >
                Vote
              </button>
              {voteStatus[c.id] && <span style={{ fontSize: 13, color: voteStatus[c.id].startsWith('✅') ? 'green' : 'red' }}>{voteStatus[c.id]}</span>}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

export default Ballot;
