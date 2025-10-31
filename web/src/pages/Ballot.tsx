
import React, { useEffect, useState } from 'react';
import { ensureCandidatesExist } from '../services/candidateUtils';
import { db, auth } from '../firebase';
import WalletBadge from '../components/WalletBadge';
import SimulatedAdPlayer from '../components/SimulatedAdPlayer';
import RedeemModal from '../components/RedeemModal';
import { getFunctions, httpsCallable } from 'firebase/functions';
import AdSenseAd from '../components/AdSenseAd';
import { doc, getDoc } from 'firebase/firestore';
import { setDoc } from 'firebase/firestore';

const Ballot: React.FC<{ address?: string; electionId?: string }> = () => {
  const [ballot, setBallot] = useState<any>(null);
  const [selected, setSelected] = useState<{ [contestId: string]: string[] }>({});
  const [loading, setLoading] = useState(false);
  const [showRedeem, setShowRedeem] = useState(false);
  const [customBallotId, setCustomBallotId] = useState<string>('');
  const [activeElectionId, setActiveElectionId] = useState<string>('9132');

  useEffect(() => {
    if (customBallotId && customBallotId !== activeElectionId) {
      setActiveElectionId(customBallotId);
    }
    // eslint-disable-next-line
  }, [customBallotId]);

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
        }
      } catch (err) {
        console.log('[Ballot] Error fetching ballot:', err);
        setBallot(null);
      }
      setLoading(false);
    };
    fetchBallot();
  }, [activeElectionId]);

  // Candidate syncing effect
  useEffect(() => {
    if (!ballot) return;
    let candidateList: any[] = [];
    if (Array.isArray(ballot.contests)) {
      if (typeof ballot.contests[0]?.office === 'string' && !ballot.contests[0]?.candidates) {
        candidateList = ballot.contests;
      } else {
        candidateList = ballot.contests.flatMap((contest: any) =>
          (contest.candidates || []).map((c: any) => ({ ...c, office: contest.office }))
        );
      }
    }
    if (candidateList.length > 0) {
      ensureCandidatesExist(candidateList);
    }
  }, [ballot]);

  const handleCheck = async (contestId: string, candidate: string) => {
    setSelected(prev => ({
      ...prev,
      [contestId]: prev[contestId]?.includes(candidate)
        ? prev[contestId].filter(c => c !== candidate)
        : [...(prev[contestId] || []), candidate]
    }));

    // Call castVote Cloud Function
    try {
      const functions = getFunctions();
      const castVote = httpsCallable(functions, 'castVote');
      // Find candidateId from ballot data
      let candidateId = null;
      if (Array.isArray(ballot.contests)) {
        for (const contest of ballot.contests) {
          if (contest.id === contestId || contest.office === contestId) {
            if (contest.candidates) {
              const found = contest.candidates.find((c: any) => c.name === candidate);
              if (found && found.id) candidateId = found.id;
            } else if (contest.name === candidate && contest.id) {
              candidateId = contest.id;
            }
          }
        }
      }
      if (!candidateId) {
        alert('Candidate ID not found.');
        return;
      }
      const userId = auth.currentUser?.uid;
      const electionId = activeElectionId;
      await castVote({ userId, electionId, candidateId });
      // Optionally, show a success message or refresh ballot/candidate data
      console.log('Vote cast for candidate:', candidateId);
    } catch (err) {
      console.error('Error casting vote:', err);
      alert('Failed to cast vote.');
    }
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
            style={{ padding: '4px 12px', fontSize: 15, marginRight: 8 }}
          >Load Ballot</button>
          <button
            type="button"
            onClick={async () => {
              if (!ballot) return alert('No ballot loaded!');
              let candidateList = [];
              if (Array.isArray(ballot.contests)) {
                if (typeof ballot.contests[0]?.office === 'string' && !ballot.contests[0]?.candidates) {
                  candidateList = ballot.contests;
                } else {
                  candidateList = ballot.contests.flatMap((contest) =>
                    (contest.candidates || []).map((c) => ({ ...c, office: contest.office }))
                  );
                }
              }
              if (candidateList.length > 0) {
                await ensureCandidatesExist(candidateList);
                alert('Candidates synced to Firebase!');
              } else {
                alert('No candidates found in ballot!');
              }
            }}
            style={{ padding: '4px 12px', fontSize: 15 }}
          >Simulate Ballot Load & Sync</button>
        </div>
        {showRedeem && <RedeemModal onClose={() => setShowRedeem(false)} />}
        {/* Support both array of candidates and array of contests */}
        {Array.isArray(ballot.contests) && ballot.contests.length > 0 && (
          typeof ballot.contests[0].office === 'string' && !ballot.contests[0].candidates
            ? ballot.contests.map((candidate: any, idx: number) => (
                <div key={candidate.name + idx} style={{ marginBottom: 24 }}>
                  <h3>{candidate.office}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                    <label style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                      <input
                        type="checkbox"
                        checked={selected[candidate.office]?.includes(candidate.name) || false}
                        onChange={() => handleCheck(candidate.office, candidate.name)}
                        style={{ marginRight: 8 }}
                      />
                      <span>{candidate.name}</span>
                    </label>
                  </div>
                </div>
              ))
            : ballot.contests.map((contest: any) => (
                <div key={contest.id || contest.office} style={{ marginBottom: 24 }}>
                  <h3>{contest.office}</h3>
                  {contest.candidates && contest.candidates.map((candidate: any) => (
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
              ))
        )}
      </div>
    </div>
  );
}
export default Ballot;
