import React, { useEffect, useState } from 'react';

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
            <span>ID: {election.id}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Elections;
