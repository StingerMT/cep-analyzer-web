/**
 * SpinnerIcon — animated SVG spinner used in the share/PDF-generating button states.
 */
import React from 'react';

export const SpinnerIcon: React.FC = () => (
  <svg
    style={{
      animation: 'cep-spin 0.8s linear infinite',
      width: 15, height: 15,
      display: 'inline-block', verticalAlign: 'middle', marginInlineEnd: 8,
    }}
    viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="3"
    strokeLinecap="round" strokeLinejoin="round"
  >
    <style>{`@keyframes cep-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);
