
import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';

const Ballot: React.FC<{ address: string; electionId: string }> = ({ address, electionId }) => {
  const [ballot, setBallot] = useState<any>(null);
  const [selected, setSelected] = useState<{ [contestId: string]: string[] }>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    console.log('[Ballot] Fetching ballot for electionId:', electionId);
    const fetchBallot = async () => {
      try {
        const ballotDoc = await getDoc(doc(db, 'civic_cache', electionId));
        if (ballotDoc.exists()) {
          const data = ballotDoc.data();
          console.log('[Ballot] Loaded ballot data:', data);
          setBallot(data);
        } else {
          console.log('[Ballot] No ballot found for electionId:', electionId);
          setBallot(null);
        }
      } catch (err) {
        console.log('[Ballot] Error fetching ballot:', err);
        setBallot(null);
      }
      setLoading(false);
    };
    fetchBallot();
  }, [electionId]);

  const handleCheck = (contestId: string, candidate: string) => {
    setSelected(prev => ({
      ...prev,
      [contestId]: prev[contestId]?.includes(candidate)
        ? prev[contestId].filter(c => c !== candidate)
        : [...(prev[contestId] || []), candidate]
    }));
  };

  if (loading) return <div>Loading ballot...</div>;
  if (!ballot) return <div>No ballot data found in Firestore.</div>;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #e0eafc 0%, #cfdef3 100%)',
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'stretch',
      justifyContent: 'center',
      padding: '2rem',
    }}>
      {/* Left AdSense ads */}
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', width: 120, minWidth: 120, marginRight: 24 }}>
        <div style={{ width: 120, height: 300, background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px #0001', marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: '#bbb', fontSize: 14 }}>AdSense Ad 1</span>
        </div>
        <div style={{ width: 120, height: 300, background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px #0001', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: '#bbb', fontSize: 14 }}>AdSense Ad 2</span>
        </div>
      </div>
      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <h2>Election Ballot</h2>
        {ballot.contests?.map((contest: any) => (
          <div key={contest.id} style={{ marginBottom: 24 }}>
            <h3>{contest.office}</h3>
            {contest.candidates.map((candidate: any) => (
              <label key={candidate.name} style={{ display: 'block' }}>
                <input
                  type="checkbox"
                  checked={selected[contest.id]?.includes(candidate.name) || false}
                  onChange={() => handleCheck(contest.id, candidate.name)}
                />
                {candidate.name}
              </label>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Ballot;
