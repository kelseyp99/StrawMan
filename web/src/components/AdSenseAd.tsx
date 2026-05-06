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

    try {
      // Trigger adsbygoogle to render into the ins element
      if ((window as any).adsbygoogle) {
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

  // Don't render if no real slot ID is provided
  if (!slot || slot === '1234567890') {
    return null; // suppress ad unit until a real slot ID is configured
  }

  if (showFallback) {
    return (
      <div style={{ width: style?.width || 120, height: style?.height || 300, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', borderRadius: 8, boxShadow: '0 1px 6px #0001', color: '#666', fontSize: 13, padding: 8, textAlign: 'center' }}>
        Test ad (not loaded) — please disable ad blockers or try another browser.
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
