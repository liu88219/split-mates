import React from 'react';

/**
 * Minimalist Hand-Drawn Creamy Illustrations inspired by Quokka (cheerful caramel marsupial)
 * & BOBO (fluffy white marshmallow bear).
 * Designed with warm cocoa linework (#3E2C1E) and soft biscuit/butter tones.
 */

export const QuokkaFaceBadge: React.FC<{ className?: string }> = ({
  className = 'w-9 h-9',
}) => (
  <svg
    viewBox="0 0 80 80"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <rect width="80" height="80" rx="22" fill="#F9EBD9" />
    {/* Ears */}
    <circle cx="22" cy="22" r="9" fill="#BD7B4D" stroke="#3E2C1E" strokeWidth="3.5" />
    <circle cx="22" cy="22" r="4" fill="#F5DEC6" />
    <circle cx="58" cy="22" r="9" fill="#BD7B4D" stroke="#3E2C1E" strokeWidth="3.5" />
    <circle cx="58" cy="22" r="4" fill="#F5DEC6" />
    {/* Chubby Head */}
    <path
      d="M15 48 C13 29, 23 19, 40 19 C57 19, 67 29, 65 48 C64 61, 54 66, 40 66 C26 66, 16 61, 15 48 Z"
      fill="#BD7B4D"
      stroke="#3E2C1E"
      strokeWidth="3.5"
      strokeLinejoin="round"
    />
    {/* Eyes */}
    <circle cx="32" cy="39" r="2.7" fill="#3E2C1E" />
    <circle cx="48" cy="39" r="2.7" fill="#3E2C1E" />
    {/* Cheeks */}
    <ellipse cx="24" cy="45" rx="5" ry="3.2" fill="#EB8B78" opacity="0.85" />
    <ellipse cx="56" cy="45" rx="5" ry="3.2" fill="#EB8B78" opacity="0.85" />
    {/* Nose & Smile */}
    <ellipse cx="40" cy="43" rx="3.8" ry="2.8" fill="#3E2C1E" />
    <path
      d="M32 49 Q40 58 48 49 Z"
      fill="#E56F5E"
      stroke="#3E2C1E"
      strokeWidth="2.8"
      strokeLinejoin="round"
    />
  </svg>
);

export const BoboFaceBadge: React.FC<{ className?: string }> = ({
  className = 'w-9 h-9',
}) => (
  <svg
    viewBox="0 0 80 80"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <rect width="80" height="80" rx="22" fill="#F5EDE1" />
    <circle cx="23" cy="23" r="8.5" fill="#FFFDF9" stroke="#3E2C1E" strokeWidth="3.5" />
    <circle cx="57" cy="23" r="8.5" fill="#FFFDF9" stroke="#3E2C1E" strokeWidth="3.5" />
    <path
      d="M16 49 C15 30, 24 20, 40 20 C56 20, 65 30, 64 49 C63 61, 53 66, 40 66 C27 66, 17 61, 16 49 Z"
      fill="#FFFDF9"
      stroke="#3E2C1E"
      strokeWidth="3.5"
      strokeLinejoin="round"
    />
    <circle cx="33" cy="40" r="2.6" fill="#3E2C1E" />
    <circle cx="47" cy="40" r="2.6" fill="#3E2C1E" />
    <ellipse cx="26" cy="46" rx="4.8" ry="3" fill="#F7B7A9" opacity="0.85" />
    <ellipse cx="54" cy="46" rx="4.8" ry="3" fill="#F7B7A9" opacity="0.85" />
    <ellipse cx="40" cy="44" rx="3.2" ry="2.4" fill="#3E2C1E" />
    <path
      d="M36 50 Q40 53.5 44 50"
      stroke="#3E2C1E"
      strokeWidth="2.8"
      strokeLinecap="round"
    />
  </svg>
);

/**
 * Hero Banner Duo: Quokka holding a toasted marshmallow & BOBO cheering beside him
 */
export const QuokkaBoboHeroDuo: React.FC<{ className?: string }> = ({
  className = 'w-28 h-20',
}) => (
  <svg
    viewBox="0 0 188 120"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    {/* Tiny butter star & heart */}
    <path
      d="M88 12 L90.5 18 L97 20.5 L90.5 23 L88 29 L85.5 23 L79 20.5 L85.5 18 Z"
      fill="#F4C95D"
    />
    <path
      d="M162 24 C162 20.5, 167 19, 169 22.5 C171 19, 176 20.5, 176 24 C176 28.5, 169 32, 169 32 C169 32, 162 28.5, 162 24 Z"
      fill="#EA8A79"
    />

    {/* BOBO (Right, fluffy white bear) */}
    <g transform="translate(108, 30)">
      <circle cx="17" cy="17" r="9.5" fill="#FFFDF9" stroke="#3E2C1E" strokeWidth="3.8" />
      <circle cx="57" cy="17" r="9.5" fill="#FFFDF9" stroke="#3E2C1E" strokeWidth="3.8" />
      <path
        d="M10 62 C8 34, 18 16, 37 16 C56 16, 66 34, 64 62 C63 78, 52 86, 37 86 C22 86, 11 78, 10 62 Z"
        fill="#FFFDF9"
        stroke="#3E2C1E"
        strokeWidth="3.8"
        strokeLinejoin="round"
      />
      <circle cx="29" cy="44" r="2.8" fill="#3E2C1E" />
      <circle cx="45" cy="44" r="2.8" fill="#3E2C1E" />
      <ellipse cx="21" cy="50" rx="5.2" ry="3.2" fill="#F7B7A9" opacity="0.85" />
      <ellipse cx="53" cy="50" rx="5.2" ry="3.2" fill="#F7B7A9" opacity="0.85" />
      <ellipse cx="37" cy="48" rx="3.5" ry="2.6" fill="#3E2C1E" />
      <path
        d="M33 54 Q37 57.5 41 54"
        stroke="#3E2C1E"
        strokeWidth="3"
        strokeLinecap="round"
      />
      {/* Cute little raised paw */}
      <path
        d="M12 58 Q3 52 8 44"
        stroke="#3E2C1E"
        strokeWidth="3.6"
        strokeLinecap="round"
      />
    </g>

    {/* QUOKKA (Left, happy caramel marsupial) */}
    <g transform="translate(10, 18)">
      <circle cx="22" cy="20" r="11" fill="#BD7B4D" stroke="#3E2C1E" strokeWidth="3.8" />
      <circle cx="22" cy="20" r="5" fill="#F5DEC6" />
      <circle cx="68" cy="20" r="11" fill="#BD7B4D" stroke="#3E2C1E" strokeWidth="3.8" />
      <circle cx="68" cy="20" r="5" fill="#F5DEC6" />
      <path
        d="M11 72 C8 38, 21 18, 45 18 C69 18, 82 38, 79 72 C77 91, 64 98, 45 98 C26 98, 13 91, 11 72 Z"
        fill="#BD7B4D"
        stroke="#3E2C1E"
        strokeWidth="3.8"
        strokeLinejoin="round"
      />
      {/* Cream belly */}
      <ellipse cx="45" cy="84" rx="20" ry="11" fill="#F5DEC6" />
      {/* Eyes */}
      <circle cx="35" cy="47" r="3.1" fill="#3E2C1E" />
      <circle cx="55" cy="47" r="3.1" fill="#3E2C1E" />
      {/* Cheeks */}
      <ellipse cx="25" cy="54" rx="6.2" ry="3.8" fill="#EB8B78" opacity="0.85" />
      <ellipse cx="65" cy="54" rx="6.2" ry="3.8" fill="#EB8B78" opacity="0.85" />
      {/* Nose & Big Happy Grin */}
      <ellipse cx="45" cy="51" rx="4.4" ry="3.2" fill="#3E2C1E" />
      <path
        d="M35 58 Q45 70 55 58 Z"
        fill="#E56F5E"
        stroke="#3E2C1E"
        strokeWidth="3.2"
        strokeLinejoin="round"
      />
      {/* Marshmallow stick */}
      <line
        x1="67"
        y1="78"
        x2="88"
        y2="54"
        stroke="#3E2C1E"
        strokeWidth="3.4"
        strokeLinecap="round"
      />
      <rect
        x="80"
        y="42"
        width="14"
        height="17"
        rx="5"
        transform="rotate(32 87 50)"
        fill="#FFFDF9"
        stroke="#3E2C1E"
        strokeWidth="3.3"
      />
    </g>
  </svg>
);

/**
 * Empty Expense State Illustration: Quokka & BOBO with a cozy receipt note & marshmallow
 */
export const QuokkaEmptyReceiptArt: React.FC<{ className?: string }> = ({
  className = 'w-36 h-28 mx-auto',
}) => (
  <svg
    viewBox="0 0 200 140"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <ellipse cx="100" cy="126" rx="76" ry="9" fill="#EFE4D4" />
    {/* Cute Receipt Paper in center */}
    <g transform="translate(74, 26) rotate(-5)">
      <path
        d="M0 8 C0 3.5, 3.5 0, 8 0 L44 0 C48.5 0, 52 3.5, 52 8 L52 74 L44 68 L36 74 L26 68 L16 74 L8 68 L0 74 Z"
        fill="#FFFDF9"
        stroke="#3E2C1E"
        strokeWidth="3.5"
        strokeLinejoin="round"
      />
      <line x1="11" y1="18" x2="41" y2="18" stroke="#D9C3AC" strokeWidth="3.5" strokeLinecap="round" />
      <line x1="11" y1="30" x2="35" y2="30" stroke="#D9C3AC" strokeWidth="3.5" strokeLinecap="round" />
      <line x1="11" y1="42" x2="41" y2="42" stroke="#F4C95D" strokeWidth="4" strokeLinecap="round" />
    </g>

    {/* Quokka peeking left */}
    <g transform="translate(22, 42)">
      <circle cx="16" cy="15" r="8.5" fill="#BD7B4D" stroke="#3E2C1E" strokeWidth="3.5" />
      <circle cx="50" cy="15" r="8.5" fill="#BD7B4D" stroke="#3E2C1E" strokeWidth="3.5" />
      <path
        d="M8 58 C6 31, 16 14, 33 14 C50 14, 60 31, 58 58 C57 73, 47 80, 33 80 C19 80, 9 73, 8 58 Z"
        fill="#BD7B4D"
        stroke="#3E2C1E"
        strokeWidth="3.5"
      />
      <circle cx="25" cy="38" r="2.6" fill="#3E2C1E" />
      <circle cx="41" cy="38" r="2.6" fill="#3E2C1E" />
      <ellipse cx="18" cy="44" rx="4.8" ry="3" fill="#EB8B78" opacity="0.85" />
      <ellipse cx="48" cy="44" rx="4.8" ry="3" fill="#EB8B78" opacity="0.85" />
      <ellipse cx="33" cy="42" rx="3.5" ry="2.5" fill="#3E2C1E" />
      <path d="M26 48 Q33 56 40 48 Z" fill="#E56F5E" stroke="#3E2C1E" strokeWidth="2.8" strokeLinejoin="round" />
    </g>

    {/* BOBO peeking right */}
    <g transform="translate(116, 48)">
      <circle cx="15" cy="14" r="8" fill="#FFFDF9" stroke="#3E2C1E" strokeWidth="3.5" />
      <circle cx="47" cy="14" r="8" fill="#FFFDF9" stroke="#3E2C1E" strokeWidth="3.5" />
      <path
        d="M8 54 C7 29, 16 13, 31 13 C46 13, 55 29, 54 54 C53 68, 44 74, 31 74 C18 74, 9 68, 8 54 Z"
        fill="#FFFDF9"
        stroke="#3E2C1E"
        strokeWidth="3.5"
      />
      <circle cx="24" cy="36" r="2.5" fill="#3E2C1E" />
      <circle cx="38" cy="36" r="2.5" fill="#3E2C1E" />
      <ellipse cx="18" cy="42" rx="4.5" ry="2.8" fill="#F7B7A9" opacity="0.85" />
      <ellipse cx="44" cy="42" rx="4.5" ry="2.8" fill="#F7B7A9" opacity="0.85" />
      <ellipse cx="31" cy="40" rx="3" ry="2.2" fill="#3E2C1E" />
      <path d="M27 45 Q31 48 35 45" stroke="#3E2C1E" strokeWidth="2.6" strokeLinecap="round" />
    </g>
  </svg>
);
