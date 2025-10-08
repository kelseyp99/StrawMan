import React from 'react';
import { db } from '../firebase';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';

const CIVIC_API_BASE = 'https://us-central1-strawman-42.cloudfunctions.net/ballot';

// Mock contest data for demo purposes
const MOCK_CONTESTS = [
  {
    id: 'president-2024',
    office: 'President of the United States',
    type: 'General',
    district: { name: 'United States', scope: 'national' },
    candidates: [
      {
        name: 'Kamala Harris',
        party: 'Democratic Party',
        candidateUrl: 'https://kamalaharris.com',
        photoUrl: 'https://example.com/harris.jpg'
      },
      {
        name: 'Donald Trump',
        party: 'Republican Party',
        candidateUrl: 'https://donaldtrump.com',
        photoUrl: 'https://example.com/trump.jpg'
      }
    ]
  },
  {
    id: 'senate-fl',
    office: 'U.S. Senate',
    type: 'General',
    district: { name: 'Florida', scope: 'statewide' },
    candidates: [
      {
        name: 'Rick Scott',
        party: 'Republican Party',
        candidateUrl: 'https://rickscott.senate.gov'
      },
      {
        name: 'Debbie Mucarsel-Powell',
        party: 'Democratic Party',
        candidateUrl: 'https://debbieforsenate.com'
      }
    ]
  },
  {
    id: 'house-fl-10',
    office: 'U.S. House of Representatives - District 10',
    type: 'General',
    district: { name: 'Florida District 10', scope: 'congressional' },
    candidates: [
      {
        name: 'Maxwell Frost',
        party: 'Democratic Party',
        candidateUrl: 'https://maxwellfrost.com'
      },
      {
        name: 'Willie Montague',
        party: 'Republican Party'
      }
    ]
  }
];

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
      
      // If contests are empty, add mock data for demo purposes
      if (!ballot.contests || ballot.contests.length === 0) {
        ballot.contests = MOCK_CONTESTS;
        ballot._note = 'Mock data added for demonstration (Google Civic API returned no contests)';
      }
      
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
      
      <h2>Enter Address for Election Info</h2>
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
          Fetch Election Info
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
