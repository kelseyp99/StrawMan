import React, { useEffect, useState } from 'react';
import { doc, setDoc, getDoc, collection, writeBatch } from 'firebase/firestore';
import { db, auth } from '../firebase';

const Elections: React.FC = () => {
  const [elections, setElections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // User address for Civic API lookups — persistent in localStorage and Firestore
  const getInitialAddress = () => {
    try { return window.localStorage.getItem('userAddress') || ''; } catch (e) { return ''; }
  };
  const [userAddress, setUserAddress] = useState<string>(getInitialAddress);

  // Load address from Firestore — tries both 'users' and 'Users' collections and falls back to localStorage
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (u) {
        // Try lowercase 'users' first (User Setup saves here)
        let snap = await getDoc(doc(db, 'users', u.uid));
        if (!snap.exists()) snap = await getDoc(doc(db, 'Users', u.uid));
        const data = snap.data();
        const addr = data?.address || data?.streetAddress || data?.formattedAddress || '';
        if (addr) {
          setUserAddress(addr);
          try { window.localStorage.setItem('userAddress', addr); } catch (e) {}
        }
      }
    });
    return () => unsub();
  }, []);

  const saveAddress = async () => {
    const u = auth.currentUser;
    try { window.localStorage.setItem('userAddress', userAddress); } catch (e) {}
    if (u) {
      await Promise.all([
        setDoc(doc(db, 'Users', u.uid), { address: userAddress }, { merge: true }),
        setDoc(doc(db, 'users', u.uid), { address: userAddress }, { merge: true }),
      ]);
    }
  };

  useEffect(() => {
    const fetchElections = async () => {
      setLoading(true);
      setError(null);
      try {
        const apiKey = import.meta.env.VITE_CIVIC_API_KEY;
        const response = await fetch(`https://www.googleapis.com/civicinfo/v2/elections?key=${apiKey}`);
        if (!response.ok) throw new Error('Failed to fetch elections');
        const data = await response.json();
        setElections(data.elections || []);
      } catch (err: any) {
        setError(err.message);
      }
      setLoading(false);
    };
    fetchElections();
  }, []);

  const [fetchingId, setFetchingId] = useState<string | null>(null);
  const [fetchStatus, setFetchStatus] = useState<Record<string, string>>({});

  const fetchAndSaveCandidates = async (electionId: string, electionName: string) => {
    const apiKey = import.meta.env.VITE_CIVIC_API_KEY;
    const address = userAddress.trim();
    if (!address) {
      setFetchStatus(s => ({ ...s, [electionId]: 'Please enter your address above first.' }));
      return;
    }
    setFetchingId(electionId);
    setFetchStatus(s => ({ ...s, [electionId]: 'Fetching from Google Civic API...' }));
    try {
      const url = `https://www.googleapis.com/civicinfo/v2/voterinfo?key=${apiKey}&address=${encodeURIComponent(address)}&electionId=${electionId}`;
      const res = await fetch(url);
      const data = await res.json();
      const contests: any[] = data.contests || [];
      if (contests.length === 0) {
        setFetchStatus(s => ({ ...s, [electionId]: 'No contests returned by API yet.' }));
        setFetchingId(null);
        return;
      }

      // Save full voterinfo to civic_cache
      await setDoc(doc(db, 'civic_cache', electionId), data, { merge: true });

      // Save each candidate to 'candidates' collection using a batch
      const batch = writeBatch(db);
      let count = 0;
      for (const contest of contests) {
        const office = contest.office || contest.referendumTitle || contest.ballotTitle || contest.district?.name || '';
        for (const candidate of (contest.candidates || [])) {
          const candidateId = `${electionId}_${(candidate.name || '').replace(/\s+/g, '_').toLowerCase()}`;
          const ref = doc(collection(db, 'candidates'), candidateId);
          batch.set(ref, {
            name: candidate.name || '',
            party: candidate.party || '',
            office,
            contestType: contest.type || '',
            district: contest.district?.name || '',
            level: (contest.level || []).join(', '),
            roles: (contest.roles || []).join(', '),
            electionId,
            electionName,
            candidateUrl: candidate.candidateUrl || '',
            photoUrl: candidate.photoUrl || '',
            updatedAt: new Date().toISOString(),
          }, { merge: true });
          count++;
        }
      }
      await batch.commit();
      // Save electionId to localStorage immediately
      try { localStorage.setItem('electionId', electionId); } catch (e) {}
      // Save electionId to user profile so Ballot page reflects this election
      const u = auth.currentUser;
      try { window.localStorage.setItem('electionId', electionId); } catch (e) {}
      if (u) {
        await Promise.all([
          setDoc(doc(db, 'Users', u.uid), { electionId, address: userAddress }, { merge: true }),
          setDoc(doc(db, 'users', u.uid), { electionId, address: userAddress }, { merge: true }),
        ]);
      }
      setFetchStatus(s => ({ ...s, [electionId]: `✅ Saved ${contests.length} contests, ${count} candidates to Firestore.` }));
    } catch (err: any) {
      setFetchStatus(s => ({ ...s, [electionId]: `❌ Error: ${err.message}` }));
    }
    setFetchingId(null);
  };

  const [showModal, setShowModal] = useState(false);
  const [modalElectionId, setModalElectionId] = useState('');
  const [json, setJson] = useState('');
  const [status, setStatus] = useState('');
  const [loadedJson, setLoadedJson] = useState('');

  const openModal = async (electionId: string) => {
    setModalElectionId(electionId);
    setShowModal(true);
    setStatus('');
    setJson('');
    setLoadedJson('');
    // Load existing ballot JSON
    try {
      const ballotRef = doc(db, 'civic_cache', electionId);
      const ballotDoc = await getDoc(ballotRef);
      if (ballotDoc.exists()) {
        setLoadedJson(JSON.stringify(ballotDoc.data(), null, 2));
        setStatus('Loaded ballot for election ID ' + electionId);
      } else {
        setLoadedJson('');
        setStatus('No ballot found for election ID ' + electionId);
      }
    } catch (err) {
      setStatus('Error loading ballot: ' + String(err));
    }
  };

  const handleSave = async () => {
    setStatus('Saving...');
    try {
      const ballotRef = doc(db, 'civic_cache', modalElectionId);
      let data = JSON.parse(json);
      if (Array.isArray(data)) {
        data = { contests: data };
      }
      await setDoc(ballotRef, data, { merge: true });
      setStatus('Saved ballot for election ID ' + modalElectionId);
      setLoadedJson(JSON.stringify(data, null, 2));
    } catch (err) {
      setStatus('Error saving ballot: ' + String(err));
    }
  };
  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 24 }}>
      <h2>Current Elections</h2>
      {loading && <p>Loading elections...</p>}
      {error && (
        <div style={{ color: 'red', marginBottom: 12 }}>
          <p>Error: {error}</p>
          <p>API Key: {import.meta.env.VITE_CIVIC_API_KEY || '(not set)'}</p>
        </div>
      )}
      <ul>
        {elections.map((election: any) => (
          <li key={election.id} style={{ marginBottom: 16 }}>
            <strong>{election.name}</strong><br />
            <span>Election Day: {election.electionDay}</span><br />
            <span>ID: {election.id}</span><br />
            <button
              style={{ marginTop: 8, padding: '4px 12px', fontSize: 14 }}
              onClick={() => openModal(election.id)}
            >
              Edit Ballot JSON
            </button>
            <button
              style={{ marginTop: 8, marginLeft: 8, padding: '4px 12px', fontSize: 14, background: '#2288AA', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
              onClick={() => fetchAndSaveCandidates(election.id, election.name)}
              disabled={fetchingId === election.id}
            >
              {fetchingId === election.id ? 'Fetching...' : '⬇ Fetch & Save Candidates'}
            </button>
            {fetchStatus[election.id] && (
              <div style={{ marginTop: 4, fontSize: 13, color: fetchStatus[election.id].startsWith('✅') ? 'green' : fetchStatus[election.id].startsWith('❌') ? 'red' : '#888' }}>
                {fetchStatus[election.id]}
              </div>
            )}
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: '#0008', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#f8fafc', borderRadius: 12, boxShadow: '0 2px 8px #0001', padding: 32, maxWidth: 700, width: '90vw', position: 'relative' }}>
            <button onClick={() => setShowModal(false)} style={{ position: 'absolute', top: 12, right: 16, fontSize: 18, background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
            <h2>Admin Ballot Editor</h2>
            <div style={{ marginBottom: 16 }}>
              <label>Election ID: </label>
              <input value={modalElectionId} disabled style={{ marginRight: 8, padding: '4px 8px' }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label>Paste Ballot JSON:</label>
              <textarea value={json} onChange={e => setJson(e.target.value)} rows={10} style={{ width: '100%', fontFamily: 'monospace', fontSize: 14, marginTop: 8 }} />
              <button onClick={handleSave} style={{ marginTop: 8 }}>Save Ballot</button>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label>Loaded Ballot JSON:</label>
              <pre style={{ background: '#fff', padding: 12, borderRadius: 6, fontSize: 13, maxHeight: 200, overflow: 'auto' }}>{loadedJson}</pre>
            </div>
            <div style={{ color: '#888', marginTop: 12 }}>{status}</div>
          </div>
        </div>
      )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Elections;
