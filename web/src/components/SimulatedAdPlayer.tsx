import React, { useEffect, useState } from 'react';

type Props = { duration?: number; onComplete?: () => void };

const SimulatedAdPlayer: React.FC<Props> = ({ duration = 10, onComplete }) => {
  const [time, setTime] = useState(duration);

  useEffect(() => {
    const id = setInterval(() => setTime(t => t - 1), 1000);
    if (time <= 0) {
      clearInterval(id);
      onComplete?.();
    }
    return () => clearInterval(id);
  }, [time, onComplete]);

  return (
    <div style={{ padding: 12, background: '#fff', borderRadius: 8, boxShadow: '0 2px 8px #0001', textAlign: 'center' }}>
      <div>Ad playing... please wait {time}s</div>
    </div>
  );
};

export default SimulatedAdPlayer;
