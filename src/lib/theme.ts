/**
 * Design tokens — shared across all components.
 *
 * Two token sets exist for historical reasons:
 *   C         — used in the canvas/main-app layer and atom components (Btn, IconBtn, etc.)
 *   CEP_THEME — used inside ResultsModal and SettingsPanel (slightly darker surface values)
 *
 * TODO: Consolidate into a single exported object once decomposition is complete.
 */

// ─── Primary token set ────────────────────────────────────────────────────────
export const C = {
  bg: '#1e1f22',
  surface: '#2b2d31',
  card: '#313338',
  elevated: '#383a40',
  border: '#3f4147',
  accent: '#5865f2',
  green: '#57f287',
  red: '#ed4245',
  yellow: '#fee75c',
  orange: '#f97316',
  purple: '#a855f7',
  text: '#dbdee1',
  muted: '#949ba4',
  faint: '#5c5f66',
} as const;

// ─── ResultsModal / SettingsPanel token set ───────────────────────────────────
// `green` here is intentionally darker than C.green — used for button backgrounds,
// not data-viz colours.
export const CEP_THEME = {
  surface: '#1e1f22',
  border: '#2b2d31',
  text: '#dbdee1',
  muted: '#949ba4',
  background: '#2b2d31',
  elevated: '#111214',
  card: '#202225',
  accent: '#5865f2',
  purple: '#a855f7',
  green: '#248046',
  faint: '#35373c',
} as const;
