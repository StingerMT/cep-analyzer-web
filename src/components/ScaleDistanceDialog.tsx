/**
 * ScaleDistanceDialog — modal shown after the user places 2 scale reference points.
 *
 * Lets the user pick from paper-size presets (A4, A5, US Letter, etc.)
 * or enter a custom distance + unit. Confirms to App with the real-world
 * distance value and unit string.
 *
 * isMobile: when true, the dialog shifts upward when the keyboard opens so the
 *           confirm button stays visible above the software keyboard.
 */

import { useState } from 'react';
import React from 'react';
import { C } from '../lib/theme';
import { Btn } from './Atoms';

// ─── Paper-size preset list ───────────────────────────────────────────────────
// Labels are i18n keys pointing into scale_presets.* in the locale files.
// The component uses t() to resolve them at render time.
export const SCALE_PRESETS: { labelKey: string; dist: number; unit: string }[] = [
  { labelKey: 'scale_presets.custom',         dist: 10,     unit: 'cm' },
  { labelKey: 'scale_presets.a5_short',        dist: 14.80,  unit: 'cm' },
  { labelKey: 'scale_presets.a5_long',         dist: 21.00,  unit: 'cm' },
  { labelKey: 'scale_presets.a4_short',        dist: 21.00,  unit: 'cm' },
  { labelKey: 'scale_presets.a4_long',         dist: 29.70,  unit: 'cm' },
  { labelKey: 'scale_presets.a3_short',        dist: 29.70,  unit: 'cm' },
  { labelKey: 'scale_presets.a3_long',         dist: 42.00,  unit: 'cm' },
  { labelKey: 'scale_presets.a2_short',        dist: 42.00,  unit: 'cm' },
  { labelKey: 'scale_presets.a2_long',         dist: 59.40,  unit: 'cm' },
  { labelKey: 'scale_presets.a1_short',        dist: 59.40,  unit: 'cm' },
  { labelKey: 'scale_presets.a1_long',         dist: 84.10,  unit: 'cm' },
  { labelKey: 'scale_presets.a0_short',        dist: 84.10,  unit: 'cm' },
  { labelKey: 'scale_presets.a0_long',         dist: 118.90, unit: 'cm' },
  { labelKey: 'scale_presets.us_letter_short', dist: 21.59,  unit: 'cm' },
  { labelKey: 'scale_presets.us_letter_long',  dist: 27.94,  unit: 'cm' },
  { labelKey: 'scale_presets.us_legal_short',  dist: 21.59,  unit: 'cm' },
  { labelKey: 'scale_presets.us_legal_long',   dist: 35.56,  unit: 'cm' },
];

// ─── Component ────────────────────────────────────────────────────────────────
export function ScaleDistanceDialog({ onConfirm, onCancel, isMobile = false, t }: {
  onConfirm: (dist: number, unit: string) => void;
  onCancel: () => void;
  isMobile?: boolean;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const [preset, setPreset] = useState(3);        // default: A4 short side (21.0 cm)
  const [dist, setDist] = useState('21');
  const [unit, setUnit] = useState('cm');
  const [custom, setCustom] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);

  const handlePresetChange = (idx: number) => {
    setPreset(idx);
    if (idx === 0) {
      setCustom(true);
    } else {
      const p = SCALE_PRESETS[idx];
      setCustom(false);
      setDist(String(p.dist));
      setUnit(p.unit);
    }
  };

  const confirm = () => {
    const d = parseFloat(dist);
    if (isNaN(d) || d <= 0) { alert('Enter a valid positive distance'); return; }
    onConfirm(d, unit);
  };

  const inp: React.CSSProperties = {
    background: C.elevated, color: C.text,
    border: `1px solid ${C.border}`, borderRadius: 6,
    padding: '8px 10px', fontSize: '0.95rem', fontFamily: 'inherit',
    width: '100%',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      // Shift dialog upward on mobile when keyboard is open so confirm button stays visible
      alignItems: (isMobile && inputFocused) ? 'flex-start' : 'center',
      justifyContent: 'center', zIndex: 300,
      paddingTop: (isMobile && inputFocused) ? '10vh' : 0,
      transition: 'padding-top 0.45s ease',
    }}>
      <div style={{
        background: C.surface, border: `1px solid ${C.border}`,
        borderRadius: 12, padding: 24, width: 340, maxWidth: '92vw',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      }}>
        <div style={{ fontWeight: 700, fontSize: '1rem', color: C.text, marginBottom: 4 }}>
          {t('scale_dialog.title')}
        </div>
        <div style={{ fontSize: '0.78rem', color: C.muted, marginBottom: 18, lineHeight: 1.5 }}>
          {t('scale_dialog.description')}
        </div>

        {/* Preset selector */}
        <label style={{ fontSize: '0.75rem', color: C.muted, display: 'block', marginBottom: 4 }}>
          {t('scale_dialog.preset_label')}
        </label>
        <select
          value={preset}
          onChange={e => handlePresetChange(Number(e.target.value))}
          style={{ ...inp, marginBottom: 14, cursor: 'pointer' }}
        >
          {SCALE_PRESETS.map((p, i) => (
            <option key={i} value={i}>{t(p.labelKey)}</option>
          ))}
        </select>

        {/* Custom distance input — always visible, opacity dims when preset is active */}
        <label style={{ fontSize: '0.75rem', color: C.muted, display: 'block', marginBottom: 4 }}>
          {custom ? t('scale_dialog.distance_label_custom') : t('scale_dialog.distance_label_preset')}
        </label>
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <input
            type="number" value={dist} min="0.1" step="0.1"
            onChange={e => { setDist(e.target.value); setPreset(0); setCustom(true); }}
            onKeyDown={e => e.key === 'Enter' && confirm()}
            autoFocus={custom}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            style={{ ...inp, flex: 1, opacity: custom ? 1 : 0.7 }}
          />
          <select
            value={unit}
            onChange={e => { setUnit(e.target.value); setPreset(0); setCustom(true); }}
            style={{ ...inp, width: 'auto', cursor: 'pointer', opacity: custom ? 1 : 0.7 }}
          >
            <option value="mm">mm</option>
            <option value="cm">cm</option>
            <option value="in">in</option>
          </select>
        </div>

        {/* Preset summary chip */}
        {!custom && (
          <div style={{
            background: C.card, borderRadius: 6, padding: '8px 12px',
            fontSize: '0.78rem', color: C.accent, marginBottom: 16,
          }}>
            {t('scale_dialog.summary', { dist, unit })}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Btn onClick={onCancel} bg={C.faint} small>{t('buttons.cancel')}</Btn>
          <Btn onClick={confirm}  bg={C.accent} small>{t('scale_dialog.confirm')}</Btn>
        </div>
      </div>
    </div>
  );
}
