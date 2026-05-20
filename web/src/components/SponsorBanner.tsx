import React, { useMemo } from 'react';

type SponsorBannerProps = {
  className?: string;
  compact?: boolean;
  imageIndex?: number;
  label?: string;
};

const BANNERS = [
  '/sponsor_banners/banner-1.png',
  '/sponsor_banners/banner-2.png',
  '/sponsor_banners/banner-3.png',
  '/sponsor_banners/banner-4.png',
  '/sponsor_banners/Banner-5.png',
  '/sponsor_banners/Banner-6.png',
];

const SponsorBanner: React.FC<SponsorBannerProps> = ({
  className = '',
  compact = false,
  imageIndex,
  label = 'Sponsored',
}) => {
  const imageUrl = useMemo(() => {
    const index = typeof imageIndex === 'number'
      ? imageIndex
      : Math.floor(Date.now() / 45000);

    return BANNERS[Math.abs(index) % BANNERS.length];
  }, [imageIndex]);

  return (
    <div className={`sponsor-banner ${compact ? 'sponsor-banner--compact' : ''} ${className}`.trim()}>
      <div className="sponsor-banner__inner">
        <span className="sponsor-banner__label">{label}</span>
        <a className="sponsor-banner__link" href="/fake-advertiser.html" aria-label="Sponsored banner">
          <img className="sponsor-banner__image" src={imageUrl} alt={label} />
        </a>
      </div>
    </div>
  );
};

export default SponsorBanner;
