import React from 'react';
import { auth, db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';

const SAVE_ADDRESS_API = 'https://us-central1-strawman-42.cloudfunctions.net/saveUserAddress';
const GET_BALLOT_API = 'https://us-central1-strawman-42.cloudfunctions.net/getUserBallot';

const Profile: React.FC = () => {
  const [address, setAddress] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [userProfile, setUserProfile] = React.useState<any>(null);
  const [electionId, setElectionId] = React.useState('2000'); // Default test election

  const user = auth.currentUser;

  // Load user profile on mount
  React.useEffect(() => {
    if (!user) return;
    const loadProfile = async () => {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setUserProfile(data);
        setAddress(data.address || '');
        setElectionId(data.electionId || '2000');
      }
    };
    loadProfile();
  }, [user]);

  const handleSaveAddress = async () => {
    if (!user) {
      setMessage('Please sign in first');
      return;
    }

    if (!address.trim()) {
      setMessage('Please enter an address');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      // Call saveUserAddress Cloud Function
      const res = await fetch(SAVE_ADDRESS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          address: address.trim(),
          electionId
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to save address');
      }

      const data = await res.json();

      if (data.unchanged) {
        setMessage('Address unchanged. No action needed.');
      } else {
        setMessage(`Address saved! Linked to election: ${data.electionId}`);
        // Reload user profile
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          setUserProfile(userDoc.data());
        }
      }

    } catch (e: any) {
      setMessage(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div style={{ maxWidth: 800, margin: '48px auto', padding: 24 }}>
        <h1>Profile</h1>
        <p>Please sign in to manage your address and ballot information.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: '48px auto', padding: 24, background: '#fff', borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}>
      <h1>My Profile</h1>
      <p>Enter your address to get your ballot information.</p>

      <div style={{ marginTop: 24 }}>
        <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>Your Address:</label>
        <input
          type="text"
          value={address}
          onChange={e => setAddress(e.target.value)}
          placeholder="123 Main St, City, State ZIP"
          style={{ width: '100%', padding: '10px 12px', fontSize: '1rem', borderRadius: 6, border: '1px solid #ccc' }}
        />
      </div>

      <div style={{ marginTop: 16 }}>
        <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>Election ID (optional):</label>
        <input
          type="text"
          value={electionId}
          onChange={e => setElectionId(e.target.value)}
          placeholder="2000"
          style={{ width: 200, padding: '10px 12px', fontSize: '1rem', borderRadius: 6, border: '1px solid #ccc' }}
        />
        <p style={{ fontSize: '0.9rem', color: '#666', marginTop: 4 }}>Leave as 2000 for test election, or enter a real election ID</p>
      </div>

      <button
        onClick={handleSaveAddress}
        disabled={loading}
        style={{
          marginTop: 24,
          padding: '12px 32px',
          fontSize: '1.1rem',
          background: loading ? '#ccc' : '#2288AA',
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          cursor: loading ? 'not-allowed' : 'pointer'
        }}
      >
        {loading ? 'Saving...' : 'Save Address'}
      </button>

      {message && (
        <div style={{
          marginTop: 16,
          padding: 12,
          borderRadius: 6,
          background: message.includes('Error') ? '#ffebee' : '#e8f5e9',
          color: message.includes('Error') ? '#c62828' : '#2e7d32'
        }}>
          {message}
        </div>
      )}

      {userProfile && (
        <div style={{ marginTop: 32, padding: 16, background: '#f5f5f5', borderRadius: 8 }}>
          <h3>Current Profile</h3>
          <p><strong>Address:</strong> {userProfile.address || 'Not set'}</p>
          <p><strong>Election ID:</strong> {userProfile.electionId || 'Not set'}</p>
          {userProfile.lastUpdated && (
            <p><strong>Last Updated:</strong> {new Date(userProfile.lastUpdated.seconds * 1000).toLocaleString()}</p>
          )}
        </div>
      )}
    </div>
  );
};

export default Profile;
