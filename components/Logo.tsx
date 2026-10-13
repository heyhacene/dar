import React from 'react';

interface LogoProps {
  className?: string;
  size?: number;
}

export default function Logo({ className = 'w-8 h-8', size = 32 }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Dégradé doux et sobre */}
      <defs>
        <linearGradient id="darGradient" x1="10" y1="10" x2="90" y2="90" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f97316" />
          <stop offset="1" stopColor="#ea580c" />
        </linearGradient>
        <linearGradient id="darAccent" x1="35" y1="35" x2="65" y2="65" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" />
          <stop offset="1" stopColor="#ffedd5" />
        </linearGradient>
      </defs>

      {/* Fond arrondi fluide (Squircle moderne) */}
      <rect width="100" height="100" rx="28" fill="url(#darGradient)" />

      {/* Anneau extérieur représentant la lettre O (Otsmane & Foyer) */}
      <circle
        cx="50"
        cy="50"
        r="32"
        stroke="white"
        strokeWidth="7"
        strokeLinecap="round"
      />

      {/* L'arche intérieure minimaliste évoquant "Dar" (la porte, le foyer, l'accueil) */}
      <path
        d="M39 64V49C39 42.9249 43.9249 38 50 38C56.0751 38 61 42.9249 61 49V64"
        stroke="white"
        strokeWidth="6"
        strokeLinecap="round"
      />

      {/* Point central d'équilibre et de rassemblement */}
      <circle cx="50" cy="50" r="3.5" fill="white" />
    </svg>
  );
}
