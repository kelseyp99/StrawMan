import React, { useEffect, useRef, useState } from 'react';

type AdSenseAdProps = {
  client?: string;
  slot?: string;
  style?: React.CSSProperties;
  test?: boolean;
};

const AdSenseAd: React.FC<AdSenseAdProps> = ({
  client = 'ca-pub-1315319831980259',
  slot = '1234567890',
  style,
  test = true,
}) => {
  const insRef = useRef<HTMLDivElement | null>(null);
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    console.info('[AdSenseAd] mounting ad slot', { client, slot, test });

  // Respect explicit opt-in for ads. Default: disabled in dev to avoid
  // noisy ad-server 400s and ad-blocker interference.
  // Use one of these to enable ads:
  //  - Build-time: set REACT_APP_ADS_ENABLED=true (CRA) — accessible as process.env.REACT_APP_ADS_ENABLED
  //  - Runtime: set window.__ADS_ENABLED = true in the page before React loads
  // We must avoid accessing `process` directly in the browser (some builds don't define it),
  // so check safely with typeof.
  const buildFlag = (typeof process !== 'undefined' && process && process.env && process.env.REACT_APP_ADS_ENABLED === 'true');
  const runtimeFlag = typeof window !== 'undefined' && (window as any).__ADS_ENABLED === true;
  const adsEnabled = buildFlag || runtimeFlag;

    try {
      // Trigger adsbygoogle to render into the ins element only when enabled.
      if (!adsEnabled) {
        console.info('[AdSenseAd] ads disabled by REACT_APP_ADS_ENABLED (skipping request)');
      } else if ((window as any).adsbygoogle) {
        (window as any).adsbygoogle.push({});
        console.info('[AdSenseAd] called (adsbygoogle).push()');
      } else {
        console.info('[AdSenseAd] adsbygoogle not present on window');
      }
    } catch (e) {
      console.warn('[AdSenseAd] push failed', e);
    }

    // After 2s, check whether an iframe was inserted by the ads script.
    const t = setTimeout(() => {
      try {
        const el = insRef.current as any;
        const hasIframe = el && el.querySelector && el.querySelector('iframe');
        if (hasIframe) {
          console.info('[AdSenseAd] ad iframe detected');
          setShowFallback(false);
        } else {
          console.info('[AdSenseAd] no ad iframe detected — showing fallback');
          setShowFallback(true);
        }
      } catch (err) {
        console.warn('[AdSenseAd] detection error', err);
        setShowFallback(true);
      }
    }, 2000);

    return () => clearTimeout(t);
  }, [client, slot, test]);

  if (showFallback) {
    // Minimal placeholder: blank space or subtle icon, no large message
    return (
      <div style={{ width: style?.width || 120, height: style?.height || 300, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', borderRadius: 8, boxShadow: '0 1px 6px #0001', color: '#ccc', fontSize: 13, padding: 8, textAlign: 'center' }}>
        {/* Ad placeholder */}
        <span style={{fontSize:24,opacity:0.2}}>🄰</span>
      </div>
    );
  }

  return (
    <ins
      ref={insRef as any}
      className="adsbygoogle"
      style={style}
      data-ad-client={client}
      data-ad-slot={slot}
      data-ad-format="auto"
      data-full-width-responsive="true"
      {...(test ? { 'data-adtest': 'on' } : {})}
    />
  );
};

export default AdSenseAd;
