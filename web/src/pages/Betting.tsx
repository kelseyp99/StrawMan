import React, { useState } from 'react';

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

export default function Betting() {
  const [balances, setBalances] = useState<Record<string, number>>({ TRUMP: 0, HARRIS: 0 });
  const [amount, setAmount] = useState<number>(0);
  const [selected, setSelected] = useState<string>('TRUMP');

  const handleBuy = () => {
    setBalances((prev) => ({ ...prev, [selected]: (prev[selected] || 0) + amount }));
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
          </tr>
        </thead>
        <tbody>
          {candidates.map((c) => (
            <tr key={c.symbol}>
              <td style={{ fontWeight: 'bold', fontSize: 18 }}>{c.name}</td>
              <td style={{ fontSize: 16 }}>{c.symbol}</td>
              <td style={{ fontSize: 16 }}>{balances[c.symbol] !== undefined ? balances[c.symbol] : 0}</td>
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
        <button onClick={handleBuy} style={{ fontSize: 16, padding: '6px 18px', borderRadius: 8, background: '#4f8cff', color: '#fff', border: 'none' }}>Buy</button>
      </div>
    </div>
  );
}
