import React, { useId } from 'react';

/**
 * V2 Gold-Standard Dinotaeng Minimalist Oil-Pastel Illustrations (97%+ Reference Fidelity):
 * - Anchored to V2 Top-Right Gold Standard (mouthless chunky-black-nose Quokka + calm w-smile squishy BOBO + smiling Marsh)
 * - High-frequency fine oil-pastel chalk filter (baseFrequency="0.62") for crisp badges
 * - Genuine oil-pastel WebP illustrations for Hero & Empty-State scenes
 */

const FUR = '#C99661';
const INK = '#171210';
const BOBO_WHITE = '#FFFFFF';
const BOBO_SHADE = '#EAE6DC';
const BUTTER = '#F7CE6A';
const OAT_STAGE = '#DBD7CA';

function ChalkFilter({ id, scale = 1.9 }: { id: string; scale?: number }) {
  return (
    <defs>
      <filter id={id} x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.62"
          numOctaves="4"
          seed="7"
          result="grain"
        />
        <feDisplacementMap
          in="SourceGraphic"
          in2="grain"
          scale={scale}
          xChannelSelector="R"
          yChannelSelector="G"
        />
      </filter>
    </defs>
  );
}

export const QuokkaFaceBadge: React.FC<{ className?: string }> = ({
  className = 'w-9 h-9',
}) => {
  const fid = useId().replace(/:/g, '');
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <ChalkFilter id={fid} scale={2.0} />
      <rect width="120" height="120" rx="32" fill={BUTTER} />
      <g filter={`url(#${fid})`}>
        {/* Unified crown-ears + chubby lower-cheek silhouette (mouthless chunky nose gold standard) */}
        <path
          d="M 44 36
             C 30 21, 19 34, 28 51
             C 21 63, 20 83, 31 95
             C 42 104, 78 104, 89 95
             C 100 83, 99 63, 92 51
             C 101 34, 90 21, 76 36
             C 69 33, 51 33, 44 36 Z"
          fill={FUR}
        />
        <circle cx="52.5" cy="58" r="2.8" fill={INK} />
        <circle cx="67.5" cy="58" r="2.8" fill={INK} />
        <ellipse cx="60" cy="70.5" rx="6.4" ry="8.6" fill={INK} />
      </g>
    </svg>
  );
};

export const BoboFaceBadge: React.FC<{ className?: string }> = ({
  className = 'w-9 h-9',
}) => {
  const fid = useId().replace(/:/g, '');
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <ChalkFilter id={fid} scale={2.0} />
      <rect width="120" height="120" rx="32" fill={OAT_STAGE} />
      <g filter={`url(#${fid})`}>
        <path
          d="M 43 39
             C 29 29, 21 41, 28 55
             C 21 67, 22 88, 36 96
             C 50 102, 73 102, 86 95
             C 99 87, 99 67, 92 55
             C 99 41, 91 29, 77 39
             C 68 37, 52 37, 43 39 Z"
          fill={BOBO_SHADE}
          transform="translate(1.5, 2)"
        />
        <path
          d="M 43 39
             C 29 29, 21 41, 28 55
             C 21 67, 22 88, 36 96
             C 50 102, 73 102, 86 95
             C 99 87, 99 67, 92 55
             C 99 41, 91 29, 77 39
             C 68 37, 52 37, 43 39 Z"
          fill={BOBO_WHITE}
        />
        <circle cx="53.5" cy="57.5" r="2.5" fill={INK} />
        <circle cx="66.5" cy="57.5" r="2.5" fill={INK} />
        <circle cx="60" cy="64.5" r="2.4" fill={INK} />
        <path
          d="M 52.5 69.5 Q 56.2 73.5 60 68.5 Q 63.8 73.5 67.5 69.5"
          fill="none"
          stroke={INK}
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
};

export const QuokkaBoboHeroDuo: React.FC<{ className?: string }> = ({
  className = 'w-36 h-20',
}) => {
  const src = './assets/hero-split-mates.webp?v=3';
  return (
    <div
      className={`overflow-hidden rounded-2xl border border-[#DFBA54]/60 bg-[#F7CE6A] shadow-sm select-none ${className}`}
      aria-hidden="true"
    >
      <img
        src={src}
        alt=""
        loading="eager"
        decoding="async"
        className="w-full h-full object-cover object-center"
      />
    </div>
  );
};

export const QuokkaEmptyReceiptArt: React.FC<{ className?: string }> = ({
  className = 'w-44 h-36 mx-auto',
}) => {
  const src = './assets/gold-marshmallow-tower.webp?v=3';
  return (
    <div
      className={`overflow-hidden rounded-3xl border border-[#DDD7C9] bg-[#DBD7CA] shadow-sm select-none ${className}`}
      aria-hidden="true"
    >
      <img
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        className="w-full h-full object-cover object-center"
      />
    </div>
  );
};
