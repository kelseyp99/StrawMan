
import React, { useEffect, useState } from 'react';
import { db, auth } from '../firebase';
import WalletBadge from '../components/WalletBadge';
import SimulatedAdPlayer from '../components/SimulatedAdPlayer';
import RedeemModal from '../components/RedeemModal';
import { getFunctions, httpsCallable } from 'firebase/functions';
import AdSenseAd from '../components/AdSenseAd';
import { doc, getDoc } from 'firebase/firestore';
import { setDoc } from 'firebase/firestore';

const Ballot: React.FC<{ address: string; electionId: string }> = ({ address, electionId }) => {
  const [ballot, setBallot] = useState<any>(null);
  const [selected, setSelected] = useState<{ [contestId: string]: string[] }>({});
  const [loading, setLoading] = useState(false);
  const [showRedeem, setShowRedeem] = useState(false);
  const [customBallotId, setCustomBallotId] = useState<string>('');
  const [activeElectionId, setActiveElectionId] = useState<string>(electionId);

  useEffect(() => {
    setLoading(true);
    console.log('[Ballot] Fetching ballot for electionId:', activeElectionId);
    const fetchBallot = async () => {
      try {
        if (!auth.currentUser) {
          console.log('[Ballot] user not authenticated - skipping civic_cache read');
          setBallot(null);
          setLoading(false);
          return;
        }

        const ballotRef = doc(db, 'civic_cache', activeElectionId);
        const ballotDoc = await getDoc(ballotRef);
        if (ballotDoc.exists()) {
          const data = ballotDoc.data();
          console.log('[Ballot] Loaded ballot data:', data);
          setBallot(data);
        } else {
          // Fetch from Civic API and save to Firestore
          try {
            const apiKey = import.meta.env.VITE_CIVIC_API_KEY;
            // For demo, use a default address if none provided
            const addressParam = address || '1600 Pennsylvania Ave NW, Washington, DC 20500';
            const url = `https://www.googleapis.com/civicinfo/v2/voterinfo?address=${encodeURIComponent(addressParam)}&electionId=${activeElectionId}&key=${apiKey}`;
            const response = await fetch(url);
            if (!response.ok) throw new Error('Civic API error');
            const data = await response.json();
            // Save to Firestore
            await setDoc(ballotRef, data, { merge: true });
            setBallot(data);
            console.log('[Ballot] Saved new ballot data to Firestore:', data);
          } catch (apiErr) {
            console.log('[Ballot] Error fetching/saving ballot from Civic API:', apiErr);
            setBallot(null);
          }
        }
      } catch (err) {
        console.log('[Ballot] Error fetching ballot:', err);
        setBallot(null);
      }
      setLoading(false);
    };
    fetchBallot();
  }, [activeElectionId]);

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
      {/* Wallet badge */}
      <WalletBadge />

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <h2>Election Ballot</h2>
        <div style={{ marginBottom: 16 }}>
          <label htmlFor="ballotIdInput" style={{ fontWeight: 'bold', marginRight: 8 }}>Select Ballot by ID (optional):</label>
          <input
            id="ballotIdInput"
            type="text"
            value={customBallotId}
            onChange={e => setCustomBallotId(e.target.value)}
            placeholder="Enter ballot/election ID"
            style={{ marginRight: 8, padding: '4px 8px', fontSize: 15 }}
          />
          <button
            type="button"
            onClick={() => {
              if (customBallotId.trim()) {
                setBallot(null);
                setLoading(true);
                setActiveElectionId(customBallotId.trim());
              }
            }}
            style={{ padding: '4px 12px', fontSize: 15 }}
          >
            Load Ballot
          </button>
        <div style={{ marginBottom: 8, fontSize: 14, color: '#888' }}>
          <strong>Currently loaded ballot ID:</strong> {activeElectionId}
        </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          {auth.currentUser ? (
            <div>
              <SimulatedAdPlayer duration={8} onComplete={async () => {
                try {
                  const funcs = getFunctions();
                  const credit = httpsCallable(funcs, 'creditPoints') as any;
                  const res = await credit({ amount: 1, reason: 'ad_watch' });
                  const newBal = res?.data?.balance ?? 'unknown';
                  alert('Thanks! You earned 1 point. New balance: ' + newBal);
                } catch (err) {
                  console.error(err);
                  alert('Failed to credit points.');
                }
              }} />
              <div style={{ marginTop: 8 }}>
                <button onClick={() => setShowRedeem(true)}>Redeem rewards</button>
              </div>
            </div>
          ) : (
            <span>Please sign in to earn points.</span>
          )}
        </div>
        {showRedeem && <RedeemModal onClose={() => setShowRedeem(false)} />}
        {ballot.contests?.map((contest: any) => (
          <div key={contest.id} style={{ marginBottom: 24 }}>
            <h3>{contest.office}</h3>
            {contest.candidates.map((candidate: any) => (
              <div key={candidate.name} style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                  <input
                    type="checkbox"
                    checked={selected[contest.id]?.includes(candidate.name) || false}
                    onChange={() => handleCheck(contest.id, candidate.name)}
                    style={{ marginRight: 8 }}
                  />
                  <span>{candidate.name}</span>
                </label>

                {/* Sponsored ad slot for this candidate (non-reward). */}
                {candidate.sponsoredAd ? (
                  <div style={{ width: 160, marginLeft: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <AdSenseAd
                      client={candidate.sponsoredAd.client || 'ca-pub-1315319831980259'}
                      slot={candidate.sponsoredAd.slot || '1234567890'}
                      style={{ width: 160, height: 90, display: 'block' }}
                      test={true}
                    />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Ballot;
