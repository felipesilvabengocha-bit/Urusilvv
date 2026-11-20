import React from 'react';

interface MinisterAvatarProps {
  seed: string;
  partyColor?: string;
  vacant?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

const SKIN_TONES = ['#f2cbb0', '#e5b592', '#d29a74', '#b87f5a', '#f5d6c3'];
const HAIR_TONES = ['#1f2428', '#3c2a21', '#5c4033', '#7f868d', '#2b2d42', '#9e7b56'];

export const MinisterAvatar: React.FC<MinisterAvatarProps> = ({
  seed,
  partyColor = '#E87532',
  vacant = false,
  size = 'md',
}) => {
  const dim = size === 'sm' ? 'h-9 w-9' : size === 'lg' ? 'h-14 w-14' : 'h-11 w-11';

  if (vacant) {
    return (
      <div
        className={`${dim} flex shrink-0 items-center justify-center rounded-lg border border-dashed border-[#E87532]/60 bg-[#0A0F10] font-mono-data text-xs font-bold text-[#FFB691]`}
        title="Cartera vacante"
      >
        ?
      </div>
    );
  }

  const h = hashSeed(seed || 'uruguay');
  const skin = SKIN_TONES[h % SKIN_TONES.length];
  const hair = HAIR_TONES[(h >> 3) % HAIR_TONES.length];
  const hasGlasses = (h >> 6) % 3 === 0;
  const hairStyle = (h >> 8) % 3;

  return (
    <div
      className={`${dim} shrink-0 overflow-hidden rounded-lg border border-[#574239]/60 bg-[#1B2021] shadow-inner`}
    >
      <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden="true">
        <rect width="64" height="64" fill="#131819" />
        <circle cx="32" cy="30" r="24" fill={partyColor} fillOpacity="0.14" />
        {/* Traje / Saco */}
        <path d="M12 64 C12 48, 22 44, 32 44 C42 44, 52 48, 52 64 Z" fill="#262B2C" />
        {/* Corbata / Solapa */}
        <path d="M27 44 L32 58 L37 44 Z" fill={partyColor} />
        <path d="M26 44 L32 48 L38 44" stroke="#DFE3E4" strokeWidth="1.5" fill="none" />
        {/* Cuello y Cabeza */}
        <rect x="28" y="36" width="8" height="10" rx="3" fill={skin} />
        <ellipse cx="32" cy="27" rx="11" ry="13" fill={skin} />
        {/* Cabello */}
        {hairStyle === 0 && (
          <path d="M20 26 C20 14, 44 14, 44 26 C41 19, 23 19, 20 26 Z" fill={hair} />
        )}
        {hairStyle === 1 && (
          <path d="M19 30 C19 13, 45 13, 45 30 L42 22 C37 18, 27 18, 22 22 Z" fill={hair} />
        )}
        {hairStyle === 2 && (
          <path d="M21 24 C21 15, 43 15, 43 24 C40 20, 24 20, 21 24 Z" fill={hair} />
        )}
        {/* Ojos */}
        <circle cx="27.5" cy="27" r="1.4" fill="#131819" />
        <circle cx="36.5" cy="27" r="1.4" fill="#131819" />
        {/* Lentes opcionales */}
        {hasGlasses && (
          <g stroke="#CDC6B8" strokeWidth="1.1" fill="none">
            <rect x="24" y="24.5" width="7" height="5" rx="1.2" />
            <rect x="33" y="24.5" width="7" height="5" rx="1.2" />
            <line x1="31" y1="27" x2="33" y2="27" />
          </g>
        )}
        {/* Expresión */}
        <path d="M28.5 33 Q32 35.5 35.5 33" stroke="#7a4c36" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      </svg>
    </div>
  );
};
