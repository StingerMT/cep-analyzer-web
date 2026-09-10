/**
 * Atom components — small, stateless/near-stateless UI primitives.
 * Used throughout App, ResultsModal, SettingsPanel, and ScaleDistanceDialog.
 *
 * Exports: Btn, IconBtn, SvgToggle
 */

import { useState } from 'react';
import React from 'react';
import { C } from '../lib/theme';
import Ico from './Ico';

// ─── Btn ──────────────────────────────────────────────────────────────────────
// Standard filled button with hover darkening and disabled state.
export function Btn({ onClick, bg = C.accent, children, disabled = false, small = false, title = '' }: {
  onClick: () => void;
  bg?: string;
  children: React.ReactNode;
  disabled?: boolean;
  small?: boolean;
  title?: string;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      className="cep-btn"
      onClick={onClick} disabled={disabled} title={title}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        background: disabled ? C.faint : hov ? bg + 'cc' : bg,
        color: '#fff', border: 'none', borderRadius: 6,
        padding: small ? '4px 10px' : '8px 16px',
        fontSize: small ? '0.75rem' : '0.85rem', fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        minHeight: small ? 28 : 38, fontFamily: 'inherit',
        whiteSpace: 'nowrap' as const,
      }}
    >
      {children}
    </button>
  );
}

// ─── IconBtn ──────────────────────────────────────────────────────────────────
// Square icon button used in the right sidebar (zoom, load, camera, settings).
export function IconBtn({ onClick, children, title = '', active = false }: {
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
  active?: boolean;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      className="cep-icon-btn"
      onClick={onClick} title={title}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        background: active ? C.accent : hov ? C.elevated : C.card,
        color: C.text, border: `1px solid ${C.border}`, borderRadius: 8,
        width: 36, height: 36, display: 'flex', alignItems: 'center',
        justifyContent: 'center', cursor: 'pointer', fontSize: '0.95rem',
        fontFamily: 'inherit', flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

// ─── SvgToggle ────────────────────────────────────────────────────────────────
// Compact row toggle used in SettingsPanel's plot-layer customizer.
// Shows the SVG toggleR/toggleL icons from the icon map.
export const SvgToggle = ({ checked, onChange, title }: {
  checked: boolean;
  onChange: (v: boolean) => void;
  title: string;
}) => {
  const accent = '#5865f2';
  const text = '#dbdee1';
  const muted = '#949ba4';
  return (
    <div
      onClick={() => onChange(!checked)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px', cursor: 'pointer',
        background: checked ? `${accent}12` : '#1e1f22',
        borderRadius: 6, transition: 'all 0.15s ease',
        border: `1px solid ${checked ? accent : '#2b2d31'}`,
        userSelect: 'none', gap: 6,
      }}
    >
      <span style={{
        fontSize: '0.8rem',
        color: checked ? text : muted,
        fontWeight: checked ? 600 : 400,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {title}
      </span>
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
        {checked ? <Ico icon="toggleR" size={20} /> : <Ico icon="toggleL" size={20} />}
      </div>
    </div>
  );
};
