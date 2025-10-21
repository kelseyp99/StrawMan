import React, { useEffect, useState } from 'react';
import { doc, onSnapshot, DocumentSnapshot } from 'firebase/firestore';
import { db, auth } from '../firebase';

const WalletBadge: React.FC = () => {
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const ref = doc(db, 'users', uid, 'wallet', 'account');
    const unsub = onSnapshot(ref as any, (snap: DocumentSnapshot) => {
      setBalance(snap.exists() ? Number((snap.data() as any)?.balance || 0) : 0);
    });
    return () => unsub();
  }, []);

  if (!auth.currentUser) return null;
  if (balance === null) return null;

  return (
    <div style={{ position: 'absolute', top: 12, right: 12, background: '#fff', padding: '6px 10px', borderRadius: 16, boxShadow: '0 2px 8px #0001', fontSize: 14 }}>
      Wallet: ${balance.toFixed(2)} pts
    </div>
  );
};

export default WalletBadge;
