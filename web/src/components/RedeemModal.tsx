import React, { useState } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';

type Props = { onClose?: () => void };

const REWARDS = [
  { id: 'sticker', name: 'Sticker Pack', cost: 5 },
  { id: 'tshirt', name: 'T-Shirt', cost: 20 },
  { id: 'mug', name: 'Coffee Mug', cost: 10 },
];

const RedeemModal: React.FC<Props> = ({ onClose }) => {
  const [loading, setLoading] = useState(false);

  const redeem = async (item: any) => {
    setLoading(true);
    try {
      const funcs = getFunctions();
      const fn = httpsCallable(funcs, 'redeemPoints') as any;
      const res = await fn({ cost: item.cost, item: item.id });
      alert('Redeemed ' + item.name + '. New balance: ' + (res?.data?.balance ?? 'unknown'));
      onClose?.();
    } catch (err) {
      console.error(err);
      alert('Redeem failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }}>
      <div style={{ background: '#fff', padding: 24, borderRadius: 8, minWidth: 320 }}>
        <h3>Redeem Rewards</h3>
        {REWARDS.map(r => (
          <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <div>{r.name} - {r.cost} pts</div>
            <button disabled={loading} onClick={() => redeem(r)}>{loading ? '...' : 'Redeem'}</button>
          </div>
        ))}
        <div style={{ textAlign: 'right', marginTop: 12 }}>
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

export default RedeemModal;
