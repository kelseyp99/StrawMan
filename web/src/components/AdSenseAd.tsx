import React, { useEffect, useRef } from 'react';

export type AdMode = 'adsense' | 'direct' | 'house';
export type AdVariant = 'banner' | 'sidebar' | 'square';

interface AdSenseAdProps {
  // AdSense
  slot?: string;
  format?: string;
  // Direct sold
  imageUrl?: string;
  linkUrl?: string;
  altText?: string;
  // Layout
  variant?: AdVariant;
  style?: React.CSSProperties;
  // Force a mode (auto-detected if not set)
  mode?: AdMode;
}

const PUBLISHER_ID = 'ca-pub-1315319831980259';
const BANNER_SLOT = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_AD_SLOT_BANNER) || '';
const SIDEBAR_SLOT = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_AD_SLOT_SIDEBAR) || '';

const SIZES: Record<AdVariant, { width: number | string; height: number }> = {
  banner:  { width: '100%', height: 90 },
  sidebar: { width: 160,    height: 600 },
  square:  { width: 300,    height: 250 },
};

const AdSenseAd: React.FC<AdSenseAdProps> = ({
  slot, format, imageUrl, linkUrl, altText,
  variant = 'banner', style, mode,
}) => {
  const insRef = useRef<HTMLModElement>(null);
  const resolvedSlot = slot || (variant === 'banner' ? BANNER_SLOT : variant === 'sidebar' ? SIDEBAR_SLOT : '');
  const size = SIZES[variant];

  // Auto-detect mode
  const resolvedMode: AdMode =
    mode ||
    (imageUrl ? 'direct' :
     (resolvedSlot && resolvedSlot !== '1234567890') ? 'adsense' : 'house');

  useEffect(() => {
    if (resolvedMode !== 'adsense') return;
    try {
      ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
    } catch (e) {}
  }, [resolvedMode]);

  const containerStyle: React.CSSProperties = {
    display: 'block',
    width: size.width,
    height: size.height,
    overflow: 'hidden',
    borderRadius: 6,
    ...style,
  };

  // ── Direct sold banner ──────────────────────────────────────────
  if (resolvedMode === 'direct') {
    return (
      <a href={linkUrl || '#'} target="_blank" rel="noopener noreferrer"
         style={{ ...containerStyle, display: 'block', textDecoration: 'none' }}>
        <img src={imageUrl} alt={altText || 'Advertisement'}
             style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6 }} />
      </a>
    );
  }

  // ── AdSense ─────────────────────────────────────────────────────
  if (resolvedMode === 'adsense') {
    return (
      <ins
        ref={insRef}
        className="adsbygoogle"
        style={{ display: 'block', width: size.width, height: size.height, ...style }}
        data-ad-client={PUBLISHER_ID}
        data-ad-slot={resolvedSlot}
        data-ad-format={format || 'auto'}
        data-full-width-responsive="true"
      />
    );
  }

  // ── House ad / placeholder ───────────────────────────────────────
  return (
    <div style={{
      ...containerStyle,
      background: 'linear-gradient(135deg, #e8eaf6 0%, #f3f4fe 100%)',
      border: '1px dashed #9fa8da',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      color: '#7986cb', fontSize: 13, gap: 4,
    }}>
      <span style={{ fontSize: 20 }}>📢</span>
      <span style={{ fontWeight: 600 }}>Your Ad Here</span>
      <span style={{ fontSize: 11, color: '#9fa8da' }}>
        {variant === 'banner' ? '728×90 Leaderboard' : variant === 'sidebar' ? '160×600 Skyscraper' : '300×250 Rectangle'}
      </span>
    </div>
  );
};

export default AdSenseAd;
