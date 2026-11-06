import React, { useId } from 'react';

/**
 * Authentic Dinotaeng Minimalist Creamy Illustrations:
 * - 100% Lineless Crayon / Soft Gouache Silhouettes (stroke="none" + feDisplacementMap)
 * - Quokka: Solid milk-tea caramel fur (#C48E63), seamless round ears (NO inner ear circles),
 *   close-set dot eyes (#14110F), vertical black bean nose (#14110F), happy open mouth with coral tongue (#E37A70),
 *   and solid black paw/foot tips (#14110F). ZERO dark cartoon outlines, ZERO cheek blush!
 * - BOBO: Pure snow-white gummy bear (#FFFFFF) on warm oatmeal-greige (#DEDCD3) or butter yellow (#F2CA62),
 *   close-set dot eyes + tiny nose + signature w-mouth (#14110F). ZERO cheek blush!
 */

const FUR = '#C48E63';
const INK = '#14110F';
const TONGUE = '#E37A70';
const BOBO_WHITE = '#FFFFFF';
const BUTTER = '#F2CA62';
const OAT_STAGE = '#DEDCD3';
const DENIM = '#2C4268';
const NAVY_SWEATER = '#1E3158';
const RED_CUP = '#C83D33';

function CrayonFilter({ id, scale = 2.2 }: { id: string; scale?: number }) {
  return (
    <defs>
      <filter id={id} x="-12%" y="-12%" width="124%" height="124%">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.085"
          numOctaves="3"
          seed="14"
          result="noise"
        />
        <feDisplacementMap
          in="SourceGraphic"
          in2="noise"
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
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <CrayonFilter id={fid} scale={2.1} />
      <rect width="80" height="80" rx="22" fill={BUTTER} />
      <g filter={`url(#${fid})`}>
        {/* Solid Caramel Ears — NO inner circle, NO outline */}
        <circle cx="24" cy="23" r="9.5" fill={FUR} />
        <circle cx="56" cy="23" r="9.5" fill={FUR} />
        {/* Pear/Peanut Chubby Head */}
        <path
          d="M15 47 C14 28, 24 20, 40 20 C56 20, 66 28, 65 47 C66 61, 56 68, 40 68 C24 68, 14 61, 15 47 Z"
          fill={FUR}
        />
      </g>
      {/* Crisp Minimalist Dinotaeng Facial Features */}
      <ellipse cx="33.5" cy="37.5" rx="2.3" ry="2.8" fill={INK} />
      <ellipse cx="46.5" cy="37.5" rx="2.3" ry="2.8" fill={INK} />
      <ellipse cx="40" cy="45.5" rx="4" ry="5.4" fill={INK} />
      <path
        d="M34.5 53.5 C34.5 52.3, 45.5 52.3, 45.5 53.5 C45.5 60.5, 34.5 60.5, 34.5 53.5 Z"
        fill={INK}
      />
      <ellipse cx="40" cy="57.8" rx="3.2" ry="1.7" fill={TONGUE} />
    </svg>
  );
};

export const BoboFaceBadge: React.FC<{ className?: string }> = ({
  className = 'w-9 h-9',
}) => {
  const fid = useId().replace(/:/g, '');
  return (
    <svg
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <CrayonFilter id={fid} scale={2.1} />
      {/* Warm Stone-Oatmeal Backdrop so Snow-White Lineless BOBO pops cleanly */}
      <rect width="80" height="80" rx="22" fill={OAT_STAGE} />
      <g filter={`url(#${fid})`}>
        <circle cx="23" cy="24" r="8" fill={BOBO_WHITE} />
        <circle cx="57" cy="24" r="8" fill={BOBO_WHITE} />
        <path
          d="M16 49 C15 31, 24 22, 40 22 C56 22, 65 31, 64 49 C64 62, 54 68, 40 68 C26 68, 16 62, 16 49 Z"
          fill={BOBO_WHITE}
        />
      </g>
      <ellipse cx="34.5" cy="41" rx="2" ry="2.5" fill={INK} />
      <ellipse cx="45.5" cy="41" rx="2" ry="2.5" fill={INK} />
      <ellipse cx="40" cy="46.2" rx="2.5" ry="1.8" fill={INK} />
      <path
        d="M40 47.4 L40 50.2 M34.8 49.6 Q37.4 53.2 40 50 Q42.6 53.2 45.2 49.6"
        stroke={INK}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

/**
 * Hero Banner Duo: Quokka in Denim Overalls holding a Red Drink Cup + Stacked Marshmallows + Cheering White BOBO
 * Placed on an authentic Dinotaeng Oatmeal-Stone pill stage (#DEDCD3) so snow-white BOBO stands out with zero dark outlines!
 */
export const QuokkaBoboHeroDuo: React.FC<{ className?: string }> = ({
  className = 'w-28 h-20',
}) => {
  const fid = useId().replace(/:/g, '');
  return (
    <svg
      viewBox="0 0 188 124"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <CrayonFilter id={fid} scale={2.3} />
      {/* Soft Oatmeal-Greige Stage Backdrop + Butter Sun Accent */}
      <rect x="6" y="10" width="176" height="106" rx="28" fill={OAT_STAGE} />
      <circle cx="156" cy="28" r="10" fill={BUTTER} />

      <g filter={`url(#${fid})`}>
        {/* QUOKKA (Left: solid caramel fur + denim overalls + red cup + black paws/feet) */}
        <circle cx="38" cy="30" r="9.5" fill={FUR} />
        <circle cx="68" cy="30" r="9.5" fill={FUR} />
        <path
          d="M29 52 C28 33, 37 25, 53 25 C69 25, 78 33, 77 52 C79 67, 74 78, 53 78 C32 78, 27 67, 29 52 Z"
          fill={FUR}
        />
        <ellipse cx="53" cy="91" rx="23" ry="19" fill={FUR} />
        {/* Denim Overalls */}
        <path d="M31 83 Q53 87 75 83 L76 105 Q53 110 30 105 Z" fill={DENIM} />
        <rect x="39" y="71" width="6" height="15" rx="2" fill={DENIM} />
        <rect x="61" y="71" width="6" height="15" rx="2" fill={DENIM} />
        <rect x="39" y="79" width="28" height="12" rx="3" fill={DENIM} />
        {/* Left & Right Arms + Black Paws */}
        <ellipse cx="29" cy="85" rx="6" ry="9.5" transform="rotate(24 29 85)" fill={FUR} />
        <circle cx="26" cy="92" r="3.8" fill={INK} />
        <ellipse cx="76" cy="83" rx="6" ry="9.5" transform="rotate(-26 76 83)" fill={FUR} />
        <circle cx="80" cy="89" r="3.8" fill={INK} />
        {/* Red Cup with Straw */}
        <line x1="62" y1="68" x2="65" y2="78" stroke="#FAF8F2" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M56 77 L68 77 L66.5 91 L57.5 91 Z" fill={RED_CUP} />
        {/* Black Flat Feet */}
        <ellipse cx="40" cy="108.5" rx="8" ry="3.4" fill={INK} />
        <ellipse cx="66" cy="108.5" rx="8" ry="3.4" fill={INK} />

        {/* Stacked Marshmallows (Marsh) in Center */}
        <rect x="89" y="96" width="11" height="11.5" rx="3.2" fill={BOBO_WHITE} />
        <rect
          x="90"
          y="84.5"
          width="10.5"
          height="11"
          rx="3.2"
          transform="rotate(-6 95 90)"
          fill={BOBO_WHITE}
        />

        {/* BOBO (Right: pure snow-white gummy bear cheering!) */}
        <circle cx="118" cy="48" r="7" fill={BOBO_WHITE} />
        <circle cx="144" cy="48" r="7" fill={BOBO_WHITE} />
        <ellipse cx="131" cy="64" rx="19" ry="16" fill={BOBO_WHITE} />
        <path
          d="M112 87 C111 72, 118 69, 131 69 C144 69, 151 72, 150 87 C150 101, 145 108, 137 108 C134 108, 133 103, 131 103 C129 103, 128 108, 125 108 C117 108, 112 101, 112 87 Z"
          fill={BOBO_WHITE}
        />
        <ellipse
          cx="111"
          cy="78"
          rx="7.5"
          ry="5"
          transform="rotate(-28 111 78)"
          fill={BOBO_WHITE}
        />
        <ellipse
          cx="150"
          cy="77"
          rx="7.5"
          ry="5"
          transform="rotate(28 150 77)"
          fill={BOBO_WHITE}
        />
      </g>

      {/* Quokka Face */}
      <ellipse cx="47" cy="45" rx="2.1" ry="2.6" fill={INK} />
      <ellipse cx="59" cy="45" rx="2.1" ry="2.6" fill={INK} />
      <ellipse cx="53" cy="52.5" rx="3.6" ry="4.9" fill={INK} />
      <path
        d="M48.2 60 C48.2 58.8, 57.8 58.8, 57.8 60 C57.8 66.2, 48.2 66.2, 48.2 60 Z"
        fill={INK}
      />
      <ellipse cx="53" cy="63.8" rx="2.8" ry="1.4" fill={TONGUE} />
      <circle cx="42" cy="82" r="1.6" fill={BUTTER} />
      <circle cx="64" cy="82" r="1.6" fill={BUTTER} />

      {/* BOBO Face */}
      <ellipse cx="126.5" cy="61" rx="1.7" ry="2.1" fill={INK} />
      <ellipse cx="135.5" cy="61" rx="1.7" ry="2.1" fill={INK} />
      <ellipse cx="131" cy="65.2" rx="2.1" ry="1.6" fill={INK} />
      <path
        d="M131 66.3 L131 68.7 M126.5 68.2 Q128.8 71.2 131 68.5 Q133.2 71.2 135.5 68.2"
        stroke={INK}
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Cheer Rays */}
      <path
        d="M104 42 L99 37 M152 40 L157 35"
        stroke="#FAF8F2"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
};

/**
 * Empty Expense State Illustration: Lineless Dinotaeng Quokka (in Navy Sweater) & BOBO (with Red Bag) beside a cozy cream receipt slip
 */
export const QuokkaEmptyReceiptArt: React.FC<{ className?: string }> = ({
  className = 'w-36 h-28 mx-auto',
}) => {
  const fid = useId().replace(/:/g, '');
  return (
    <svg
      viewBox="0 0 212 142"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <CrayonFilter id={fid} scale={2.2} />
      {/* Warm Oatmeal Stage Pill so white BOBO & receipt pop cleanly */}
      <rect x="12" y="14" width="188" height="114" rx="32" fill={OAT_STAGE} />

      <g filter={`url(#${fid})`}>
        {/* Matte Cream Receipt Paper in Center */}
        <g transform="translate(83, 30) rotate(-4)">
          <path
            d="M0 7 C0 3, 3 0, 7 0 L39 0 C43 0, 46 3, 46 7 L46 74 L38 69 L30 74 L23 69 L15 74 L8 69 L0 74 Z"
            fill="#FAF8F2"
          />
          <rect x="9" y="15" width="28" height="3.5" rx="1.7" fill="#C9C3B6" />
          <rect x="9" y="26" width="22" height="3.5" rx="1.7" fill="#C9C3B6" />
          <rect x="9" y="38" width="28" height="5" rx="2.5" fill={BUTTER} />
          <rect x="9" y="51" width="18" height="3.5" rx="1.7" fill="#D5CFC2" />
        </g>

        {/* Quokka on Left in Navy Sweater */}
        <circle cx="38" cy="43" r="8.2" fill={FUR} />
        <circle cx="62" cy="43" r="8.2" fill={FUR} />
        <path
          d="M30 60 C29 45, 37 38, 50 38 C63 38, 71 45, 70 60 C72 73, 67 82, 50 82 C33 82, 28 73, 30 60 Z"
          fill={FUR}
        />
        <ellipse cx="50" cy="104" rx="17" ry="9" fill={FUR} />
        <path d="M30 79 Q50 83 70 79 L71 102 Q50 106 29 102 Z" fill={NAVY_SWEATER} />
        <ellipse cx="30" cy="89" rx="5" ry="8.5" transform="rotate(18 30 89)" fill={NAVY_SWEATER} />
        <circle cx="28" cy="95.5" r="3.3" fill={INK} />
        <ellipse cx="70" cy="88" rx="5" ry="8.5" transform="rotate(-22 70 88)" fill={NAVY_SWEATER} />
        <circle cx="72.5" cy="94" r="3.3" fill={INK} />
        <ellipse cx="40" cy="111" rx="7" ry="3" fill={INK} />
        <ellipse cx="60" cy="111" rx="7" ry="3" fill={INK} />

        {/* BOBO on Right with Red Mini Handbag */}
        <circle cx="146" cy="56" r="6.5" fill={BOBO_WHITE} />
        <circle cx="170" cy="56" r="6.5" fill={BOBO_WHITE} />
        <ellipse cx="158" cy="71" rx="17" ry="14.5" fill={BOBO_WHITE} />
        <path
          d="M141 91 C140 78, 146 75, 158 75 C170 75, 176 78, 175 91 C175 103, 171 110, 164 110 C161 110, 160 105, 158 105 C156 105, 155 110, 152 110 C145 110, 141 103, 141 91 Z"
          fill={BOBO_WHITE}
        />
        <ellipse cx="141" cy="84" rx="6.5" ry="4.5" transform="rotate(-25 141 84)" fill={BOBO_WHITE} />
        <ellipse cx="175" cy="84" rx="6.5" ry="4.5" transform="rotate(25 175 84)" fill={BOBO_WHITE} />
        <path
          d="M168 88 C168 81, 177 81, 177 88"
          fill="none"
          stroke={RED_CUP}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <rect x="165.5" y="87" width="14" height="11" rx="4" fill={RED_CUP} />
      </g>

      {/* Quokka Face */}
      <ellipse cx="44.8" cy="54.5" rx="1.9" ry="2.4" fill={INK} />
      <ellipse cx="55.2" cy="54.5" rx="1.9" ry="2.4" fill={INK} />
      <ellipse cx="50" cy="61" rx="3.2" ry="4.3" fill={INK} />
      <path
        d="M45.8 67.5 C45.8 66.5, 54.2 66.5, 54.2 67.5 C54.2 73, 45.8 73, 45.8 67.5 Z"
        fill={INK}
      />
      <ellipse cx="50" cy="70.8" rx="2.5" ry="1.3" fill={TONGUE} />

      {/* BOBO Face */}
      <ellipse cx="154" cy="68" rx="1.6" ry="2" fill={INK} />
      <ellipse cx="162" cy="68" rx="1.6" ry="2" fill={INK} />
      <ellipse cx="158" cy="72" rx="2" ry="1.5" fill={INK} />
      <path
        d="M158 73 L158 75 M154 74.6 Q156 77.2 158 74.8 Q160 77.2 162 74.6"
        stroke={INK}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};
