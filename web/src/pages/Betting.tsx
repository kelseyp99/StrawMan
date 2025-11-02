import React, { useState } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';

const candidates = [
  {
    name: 'Donald Trump',
    symbol: 'TRUMP',
  },
  {
    name: 'Kamala Harris',
    symbol: 'HARRIS',
  },
];

const MOCK_PRICES: Record<string, number> = {
  TRUMP: 2.5,
  HARRIS: 1.8,
};

export default function Betting() {
  const [balances, setBalances] = useState<Record<string, number>>({ TRUMP: 0, HARRIS: 0 });
  const [amount, setAmount] = useState<number>(0);
  const [selected, setSelected] = useState<string>('TRUMP');
  const [status, setStatus] = useState<string>('');

  const pricePerCoin = MOCK_PRICES[selected];
  const totalCost = amount * pricePerCoin;

  const handleBuy = async () => {
    setStatus('');
    const price = pricePerCoin;
    const candidateId = selected === 'TRUMP' ? 1 : 2; // Example mapping
    const buyer = 'user-principal-address'; // Replace with actual user principal
    try {
      const functions = getFunctions();
      const buyCandidateCoin = httpsCallable(functions, 'buyCandidateCoin');
      const result = await buyCandidateCoin({
        candidateId,
        buyer,
        amount,
        price,
      });
      const data = result.data as { success: boolean; txId?: string; error?: string };
      if (data.success) {
        setBalances((prev) => ({ ...prev, [selected]: (prev[selected] || 0) + amount }));
        setStatus(`Success! TxID: ${data.txId}`);
      } else {
        setStatus(`Error: ${data.error}`);
      }
    } catch (err: any) {
      setStatus(`Error: ${err.message || err}`);
    }
    setAmount(0);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #e0eafc 0%, #cfdef3 100%)', padding: '2rem' }}>
      <h2 style={{ textAlign: 'center', marginBottom: 32 }}>Prediction Market</h2>
      <table style={{ margin: '0 auto', background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px #0001', width: 400, padding: 24 }}>
        <thead>
          <tr>
            <th>Candidate</th>
            <th>Coin</th>
            <th>Your Balance</th>
            <th>Market Price</th>
          </tr>
        </thead>
        <tbody>
          {candidates.map((c) => (
            <tr key={c.symbol}>
              <td style={{ fontWeight: 'bold', fontSize: 18 }}>{c.name}</td>
              <td style={{ fontSize: 16 }}>{c.symbol}</td>
              <td style={{ fontSize: 16 }}>{balances[c.symbol] !== undefined ? balances[c.symbol] : 0}</td>
              <td style={{ fontSize: 16 }}>${MOCK_PRICES[c.symbol]}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ margin: '32px auto', width: 400, textAlign: 'center' }}>
        <label style={{ fontWeight: 'bold', marginRight: 12 }}>Buy Coin:</label>
        <select value={selected} onChange={e => setSelected(e.target.value)} style={{ fontSize: 16, marginRight: 12 }}>
          {candidates.map(c => <option key={c.symbol} value={c.symbol}>{c.name}</option>)}
        </select>
        <input type="number" min={1} value={amount} onChange={e => setAmount(Number(e.target.value))} style={{ width: 80, fontSize: 16, marginRight: 12 }} />
        <span style={{ marginRight: 12 }}>@ ${pricePerCoin} each</span>
        <span style={{ marginRight: 12, fontWeight: 'bold' }}>Total: ${totalCost.toFixed(2)}</span>
        <button onClick={handleBuy} style={{ fontSize: 16, padding: '6px 18px', borderRadius: 8, background: '#4f8cff', color: '#fff', border: 'none' }}>Buy</button>
        {status && <div style={{ marginTop: 16, color: status.startsWith('Success') ? 'green' : 'red' }}>{status}</div>}
      </div>
    </div>
  );
}
