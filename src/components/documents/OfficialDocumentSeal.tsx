import React from 'react';

interface OfficialDocumentSealProps {
  clubName?: string;
  year?: number;
  className?: string;
}

export const OfficialDocumentSeal: React.FC<OfficialDocumentSealProps> = ({
  clubName = "CLUBE D'ALVORADA",
  year = 2026,
  className = "w-28 h-28 opacity-90",
}) => {
  return (
    <div className={`relative flex items-center justify-center select-none pointer-events-none ${className}`}>
      <svg
        viewBox="0 0 200 200"
        className="w-full h-full text-indigo-900 drop-shadow-xs"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Exterior double border */}
        <circle cx="100" cy="100" r="95" stroke="currentColor" strokeWidth="3" strokeDasharray="6 3" />
        <circle cx="100" cy="100" r="89" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="100" cy="100" r="66" stroke="currentColor" strokeWidth="1" />

        {/* Circular path for top text */}
        <defs>
          <path
            id="textPathTop"
            d="M 24,100 A 76,76 0 1,1 176,100"
            fill="none"
          />
          <path
            id="textPathBottom"
            d="M 176,100 A 76,76 0 1,1 24,100"
            fill="none"
          />
        </defs>

        {/* Curved Text Top */}
        <text className="text-[10px] font-bold uppercase tracking-[0.25em]" fill="currentColor">
          <textPath href="#textPathTop" startOffset="50%" textAnchor="middle">
            {clubName.slice(0, 36)}
          </textPath>
        </text>

        {/* Curved Text Bottom */}
        <text className="text-[9px] font-bold uppercase tracking-[0.22em]" fill="currentColor">
          <textPath href="#textPathBottom" startOffset="50%" textAnchor="middle">
            ★ LUANDA ★
          </textPath>
        </text>

        {/* Center Insignia */}
        <g transform="translate(100, 100) scale(0.9) translate(-100, -100)">
          {/* Emblem Shield */}
          <path
            d="M 100,74 L 118,83 C 118,102 108,118 100,126 C 92,118 82,102 82,83 Z"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
          />
          {/* Star in Center */}
          <polygon
            points="100,86 103,94 112,94 105,99 107,107 100,102 93,107 95,99 88,94 97,94"
            fill="currentColor"
          />
          {/* Year and Stamp text */}
          <text x="100" y="140" textAnchor="middle" className="text-[8px] font-mono font-bold tracking-wider" fill="currentColor">
            AUTENTICADO · {year}
          </text>
        </g>
      </svg>
    </div>
  );
};
