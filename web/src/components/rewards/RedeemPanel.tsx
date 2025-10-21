import React, { useState } from 'react';
import { redeemPoints } from '../../services/rewards';

export default function RedeemPanel({ email }: { email: string }) {
  const [points, setPoints] = useState<number>(100);
  const [status, setStatus] = useState<string | null>(null);

  const handleRedeem = async () => {
    setStatus('Redeeming...');
    const res = await redeemPoints(email, points);
    if (res?.ok) setStatus(`Redeemed: ${res.gift?.code} (${res.gift?.amount}$)`);
    else setStatus(`Failed: ${res?.error || 'unknown'}`);
  };

  return (
    <div style={{ background: '#fff', padding: 16, borderRadius: 8, maxWidth: 480, margin: '16px auto' }}>
      <h3>Redeem Points</h3>
      <div style={{ marginBottom: 12 }}>
        <label>Points to Redeem: </label>
        <input type="number" value={points} onChange={e => setPoints(Number(e.target.value))} />
      </div>
      <button onClick={handleRedeem} style={{ padding: '8px 16px' }}>Redeem</button>
      {status && <div style={{ marginTop: 12 }}>{status}</div>}
    </div>
  );
}
