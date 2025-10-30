import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { db } from '../firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';

const AdminBallotEditor: React.FC = () => {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const initialElectionId = params.get('electionId') || '';
  const [electionId, setElectionId] = useState(initialElectionId);
  useEffect(() => {
    if (initialElectionId) setElectionId(initialElectionId);
  }, [initialElectionId]);
  const [json, setJson] = useState('');
  const [status, setStatus] = useState('');
  const [loadedJson, setLoadedJson] = useState('');

  const handleLoad = async () => {
    setStatus('Loading...');
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
      const ballotRef = doc(db, 'civic_cache', electionId);
      const data = JSON.parse(json);
      await setDoc(ballotRef, data, { merge: true });
      setStatus('Saved ballot for election ID ' + electionId);
    } catch (err) {
      setStatus('Error saving ballot: ' + String(err));
    }
  };

  return (
    <div style={{ maxWidth: 700, margin: '40px auto', padding: 24, background: '#f8fafc', borderRadius: 12, boxShadow: '0 2px 8px #0001' }}>
      <h2>Admin Ballot Editor</h2>
      <div style={{ marginBottom: 16 }}>
        <label>Election ID: </label>
        <input value={electionId} onChange={e => setElectionId(e.target.value)} style={{ marginRight: 8, padding: '4px 8px' }} />
        <button onClick={handleLoad}>Load Ballot</button>
      </div>
      <div style={{ marginBottom: 16 }}>
        <label>Paste Ballot JSON:</label>
        <textarea value={json} onChange={e => setJson(e.target.value)} rows={10} style={{ width: '100%', fontFamily: 'monospace', fontSize: 14, marginTop: 8 }} />
        <button onClick={handleSave} style={{ marginTop: 8 }}>Save Ballot</button>
      </div>
      <div style={{ marginBottom: 16 }}>
        <label>Loaded Ballot JSON:</label>
        <pre style={{ background: '#fff', padding: 12, borderRadius: 6, fontSize: 13 }}>{loadedJson}</pre>
      </div>
      <div style={{ color: '#888', marginTop: 12 }}>{status}</div>
    </div>
  );
};

export default AdminBallotEditor;
