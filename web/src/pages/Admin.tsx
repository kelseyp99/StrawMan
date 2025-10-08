import React from 'react';
import { db } from '../firebase';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';

const CIVIC_API_BASE = 'https://us-central1-strawman-42.cloudfunctions.net/ballot';

const Admin: React.FC = () => {
  const [data, setData] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [zip, setZip] = React.useState('');

  // Google Civic API election info state
  const [civicAddress, setCivicAddress] = React.useState('');
  const [civicElectionId, setCivicElectionId] = React.useState('');
  const [civicLoading, setCivicLoading] = React.useState(false);
  const [civicError, setCivicError] = React.useState<string | null>(null);
  const [civicData, setCivicData] = React.useState<any | null>(null);

  const fetchCivicInfo = async () => {
    setCivicLoading(true);
    setCivicError(null);
    setCivicData(null);
    try {
      const address = civicAddress || '123 Main St, Windermere, FL 34786';
      const electionId = civicElectionId || '2000';
      const url = `${CIVIC_API_BASE}?address=${encodeURIComponent(address)}&electionId=${encodeURIComponent(electionId)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch Google Civic data');
      const ballot = await res.json();
      setCivicData(ballot);
    } catch (e: any) {
      setCivicError(e?.message || 'Unknown error');
    } finally {
      setCivicLoading(false);
    }
  };

  const handleDownload = async () => {
    setLoading(true);
    setError(null);
    try {
      let q;
      if (zip) {
        q = query(collection(db, 'candidateResultHistory'), where('zip', '==', zip), orderBy('timestamp', 'desc'));
      } else {
        q = query(collection(db, 'candidateResultHistory'), orderBy('timestamp', 'desc'));
      }
      const querySnapshot = await getDocs(q);
      const rows: any[] = [];
      querySnapshot.forEach(doc => {
        rows.push({ id: doc.id, ...doc.data() });
      });
      setData(rows);
    } catch (e) {
      setError('Failed to fetch election data');
    }
    setLoading(false);
  };

  return (
    <div style={{ maxWidth: 900, margin: '48px auto', padding: 24, background: '#fff', borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}>
      <h1>Admin Panel</h1>
      <p>Download and view the full elections data for analysis or backup. Optionally filter by zip code.</p>
      <div style={{ marginBottom: 16 }}>
        <input
          type="text"
          placeholder="Filter by Zip Code (optional)"
          value={zip}
          onChange={e => setZip(e.target.value)}
          style={{ fontSize: '1rem', padding: '8px 12px', borderRadius: 4, border: '1px solid #ccc', marginRight: 12 }}
        />
        <button onClick={handleDownload} style={{ fontSize: '1.1rem', padding: '10px 24px', background: '#2288AA', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
          Download Elections Data
        </button>
      </div>
      {loading && <div>Loading...</div>}
      {error && <div style={{ color: 'red' }}>{error}</div>}
      {data.length > 0 && (
        <div style={{ overflowX: 'auto', marginTop: 24 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ border: '1px solid #ccc', padding: 8 }}>Date</th>
                <th style={{ border: '1px solid #ccc', padding: 8 }}>User</th>
                <th style={{ border: '1px solid #ccc', padding: 8 }}>Candidate</th>
                <th style={{ border: '1px solid #ccc', padding: 8 }}>Result</th>
                <th style={{ border: '1px solid #ccc', padding: 8 }}>Zip</th>
              </tr>
            </thead>
            <tbody>
              {data.map(row => (
                <tr key={row.id}>
                  <td style={{ border: '1px solid #ccc', padding: 8 }}>
                    {row.timestamp && row.timestamp.seconds
                      ? new Date(row.timestamp.seconds * 1000).toLocaleString()
                      : ''}
                  </td>
                  <td style={{ border: '1px solid #ccc', padding: 8 }}>{row.userId || ''}</td>
                  <td style={{ border: '1px solid #ccc', padding: 8 }}>{row.candidateName || ''}</td>
                  <td style={{ border: '1px solid #ccc', padding: 8 }}>{row.result || ''}</td>
                  <td style={{ border: '1px solid #ccc', padding: 8 }}>{row.zip || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <hr style={{ margin: '40px 0' }} />
      <h2>Fetch Google Elections Info</h2>
      <div style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Full Address (e.g. 123 Main St, Windermere, FL 34786)"
          value={civicAddress}
          onChange={e => setCivicAddress(e.target.value)}
          style={{ fontSize: '1rem', padding: '8px 12px', borderRadius: 4, border: '1px solid #ccc', width: 350 }}
        />
        <input
          type="text"
          placeholder="Election ID (e.g. 2000)"
          value={civicElectionId}
          onChange={e => setCivicElectionId(e.target.value)}
          style={{ fontSize: '1rem', padding: '8px 12px', borderRadius: 4, border: '1px solid #ccc', width: 120 }}
        />
        <button onClick={fetchCivicInfo} style={{ fontSize: '1.1rem', padding: '10px 24px', background: '#2288AA', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
          Fetch Google Elections Info
        </button>
      </div>
      {civicLoading && <div>Loading Google Civic data...</div>}
      {civicError && <div style={{ color: 'red' }}>{civicError}</div>}
      {civicData && (
        <div style={{ marginTop: 24, textAlign: 'left', background: '#f6f6f6', padding: 16, borderRadius: 8, maxHeight: 400, overflow: 'auto' }}>
          <pre style={{ fontSize: 13 }}>{JSON.stringify(civicData, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};

export default Admin;
