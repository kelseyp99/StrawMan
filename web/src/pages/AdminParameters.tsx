import React, { useEffect, useState } from 'react';
import { getFirestore, collection, getDocs, updateDoc, doc, addDoc, deleteDoc } from 'firebase/firestore';
import { getAuth, User } from 'firebase/auth';

// You may need to adjust Firebase initialization imports based on your setup
// import { firebaseApp } from '../firebaseConfig';

const db = getFirestore();
const auth = getAuth();


type Parameter = {
  id: string;
  key: string;
  value: string;
};



type Candidate = {
  id: string;
  name: string;
  office?: string;
  party?: string;
  contractAddress?: string;
  metadata?: string;
};


function AdminParameters() {
  const [parameters, setParameters] = useState<Parameter[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [newParam, setNewParam] = useState<{ key: string; value: string }>({ key: '', value: '' });
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>('');
  const [coinFields, setCoinFields] = useState<{ contractAddress: string; metadata: string }>({ contractAddress: '', metadata: '' });
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((firebaseUser) => {
      setUser(firebaseUser);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      fetchParameters();
        fetchCandidates();
    }
  }, [user]);

  async function fetchParameters() {
    const snapshot = await getDocs(collection(db, 'appParameters'));
    setParameters(snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as Omit<Parameter, 'id'>) })));
  }


    async function fetchCandidates() {
      const snapshot = await getDocs(collection(db, 'candidates'));
      setCandidates(snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as Omit<Candidate, 'id'>) })));
    }

  async function addParameter() {
    await addDoc(collection(db, 'appParameters'), newParam);
    setNewParam({ key: '', value: '' });
    fetchParameters();
  }

  async function updateParameter(id: string, key: string, value: string) {
    await updateDoc(doc(db, 'appParameters', id), { key, value });
    fetchParameters();
  }

  async function deleteParameter(id: string) {
    await deleteDoc(doc(db, 'appParameters', id));
    fetchParameters();
  }


    async function assignCoinToCandidate() {
      if (!selectedCandidateId) return;
      await updateDoc(doc(db, 'candidates', selectedCandidateId), {
        contractAddress: coinFields.contractAddress,
        metadata: coinFields.metadata
      });
      setCoinFields({ contractAddress: '', metadata: '' });
      setSelectedCandidateId('');
      fetchCandidates();
    }


  if (!user) {
    return <div>Please log in as an admin to access this page.</div>;
  }

  // You may want to add more robust admin checks here

  return (
    <div style={{ padding: 24 }}>
      <h2>Admin: App Parameters</h2>
      <table border={1} cellPadding={8}>
        <thead>
          <tr>
            <th>Key</th>
            <th>Value</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {parameters.map(param => (
            <tr key={param.id}>
              <td><input value={param.key} onChange={e => updateParameter(param.id, e.target.value, param.value)} /></td>
              <td><input value={param.value} onChange={e => updateParameter(param.id, param.key, e.target.value)} /></td>
              <td><button onClick={() => deleteParameter(param.id)}>Delete</button></td>
            </tr>
          ))}
          <tr>
            <td><input value={newParam.key} onChange={e => setNewParam({ ...newParam, key: e.target.value })} /></td>
            <td><input value={newParam.value} onChange={e => setNewParam({ ...newParam, value: e.target.value })} /></td>
            <td><button onClick={addParameter}>Add</button></td>
          </tr>
        </tbody>
      </table>

      <h2 style={{ marginTop: 40 }}>Candidate Coin Info</h2>
      <div style={{ marginBottom: 16 }}>
        <label>Select Candidate:&nbsp;</label>
        <select value={selectedCandidateId} onChange={e => setSelectedCandidateId(e.target.value)}>
          <option value="">-- Select --</option>
          {candidates.map(c => (
            <option key={c.id} value={c.id}>{c.name} {c.office ? `(${c.office})` : ''}</option>
          ))}
        </select>
      </div>
      {selectedCandidateId && (
        <div style={{ marginBottom: 16 }}>
          <label>Contract Name:&nbsp;</label>
          <input value={coinFields.contractAddress} onChange={e => setCoinFields(f => ({ ...f, contractAddress: e.target.value }))} placeholder="Stacks contract name" />
          <br />
          <label>Metadata:&nbsp;</label>
          <input value={coinFields.metadata} onChange={e => setCoinFields(f => ({ ...f, metadata: e.target.value }))} placeholder="Any extra info (JSON, URL, etc.)" />
          <br />
          <button
            style={{ marginTop: 8 }}
            onClick={assignCoinToCandidate}
          >Save Coin Info</button>
        </div>
      )}
      <h2 style={{ marginTop: 40 }}>All Candidates & Coin Info</h2>
      <table border={1} cellPadding={8}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Office</th>
            <th>Contract Address</th>
            <th>Metadata</th>
            <th>Edit</th>
          </tr>
        </thead>
        <tbody>
          {candidates.map(c => (
            <tr key={c.id}>
              <td>{c.name}</td>
              <td>{c.office || ''}</td>
              <td>
                <input
                  value={c.contractAddress || ''}
                  onChange={e => updateDoc(doc(db, 'candidates', c.id), { contractAddress: e.target.value })}
                  placeholder="Contract address"
                />
              </td>
              <td>
                <input
                  value={c.metadata || ''}
                  onChange={e => updateDoc(doc(db, 'candidates', c.id), { metadata: e.target.value })}
                  placeholder="Metadata"
                />
              </td>
              <td>
                <button onClick={() => fetchCandidates()}>Refresh</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default AdminParameters;
