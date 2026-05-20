import React from 'react';
import { Link } from 'react-router-dom';

type StrawHeaderProps = {
  rightSlot?: React.ReactNode;
};

const StrawHeader: React.FC<StrawHeaderProps> = ({ rightSlot }) => {
  return (
    <header className="straw-header">
      <div className="straw-header__inner">
        <Link to="/" className="straw-header__brand" aria-label="StrawMan home">
          <img className="straw-header__logo" src="/StrawMan.png" alt="" />
          <span className="straw-header__copy">
            <span className="straw-header__title">StrawMan</span>
            <span className="straw-header__tagline">Simple, secure, transparent voting</span>
          </span>
        </Link>
        {rightSlot && <div className="straw-header__right">{rightSlot}</div>}
      </div>
    </header>
  );
};

export default StrawHeader;
