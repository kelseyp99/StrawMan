import React, { useEffect, useState } from 'react';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

const Elections: React.FC = () => {
  const [elections, setElections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      <div style={{ fontSize: 13, color: '#888', marginBottom: 8 }}>
        <strong>API Key:</strong> {import.meta.env.VITE_CIVIC_API_KEY || '(not set)'}
      </div>
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
