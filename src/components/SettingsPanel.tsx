/**
 * SettingsPanel — full-screen modal for display and visualisation settings.
 *
 * Two-column layout on desktop (live preview left, controls right).
 * Single column on mobile.
 *
 * RTL note: columns swap order in Hebrew (preview on right, controls on left)
 * via the `order` CSS property.
 *
 * Sub-panel: "Plot Layer Customization" slides in as an absolute overlay
 * within the card (animated via fadeIn keyframe).
 */

import { useState, useEffect } from 'react';
import { SvgToggle } from './Atoms';

interface SettingsPanelProps {
  onClose: () => void;
  lang: string;
  setLang: (l: 'en' | 'he') => void;
  t: (key: string) => string;
  isRTL: boolean;
  dotSize: number;
  setDotSize: (v: number) => void;
  scaleLineWidth: number;
  setScaleLineWidth: (v: number) => void;
  shotColor: string;
  setShotColor: (v: string) => void;
  originColor: string;
  setOriginColor: (v: string) => void;
  scaleColor: string;
  setScaleColor: (v: string) => void;
  showGridlines: boolean;
  setShowGridlines: (v: boolean) => void;
  showLabels: boolean;
  setShowLabels: (v: boolean) => void;
  showCEP: boolean;
  setShowCEP: (v: boolean) => void;
  showBlockingRadius: boolean;
  setShowBlockingRadius: (v: boolean) => void;
  showES: boolean;
  setShowES: (v: boolean) => void;
  showMeanOrigin: boolean;
  setShowMeanOrigin: (v: boolean) => void;
}

export function SettingsPanel({
  onClose, lang, setLang, t, isRTL,
  dotSize, setDotSize,
  scaleLineWidth, setScaleLineWidth,
  shotColor, setShotColor,
  originColor, setOriginColor,
  scaleColor, setScaleColor,
  showGridlines, setShowGridlines,
  showLabels, setShowLabels,
  showCEP, setShowCEP,
  showBlockingRadius, setShowBlockingRadius,
  showES, setShowES,
  showMeanOrigin, setShowMeanOrigin,
}: SettingsPanelProps) {
  const [showPlotCustomizer, setShowPlotCustomizer] = useState(false);
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== 'undefined' ? window.innerWidth > 640 : false
  );

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth > 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Local token aliases (SettingsPanel uses slightly different surface shades)
  const T = {
    modalBg: '#2b2d31', innerBg: '#111214',
    border: '#2b2d31', text: '#dbdee1', muted: '#949ba4',
    accent: '#5865f2', success: '#248046',
  };

  const sectionLabel: React.CSSProperties = {
    fontSize: '0.75rem', color: T.muted, textTransform: 'uppercase',
    letterSpacing: '0.05em', marginBottom: 6, marginTop: 10, display: 'block',
    textAlign: isRTL ? 'right' : 'left',
  };

  const rowStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '8px 0', borderBottom: '1px solid #3f4248',
    flexDirection: isRTL ? 'row-reverse' : 'row',
  };

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 16,
      }}
    >
      <div
        style={{
          position: 'relative', width: '100%',
          maxWidth: isDesktop ? '820px' : '440px',
          background: T.modalBg, borderRadius: 16,
          padding: isDesktop ? 24 : 18,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 16,
        }}
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 700, fontSize: '1.2rem', color: T.text }}>
            {t('settings.title')}
          </div>
          <button
            className="cep-btn cep-btn-ghost"
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: T.muted, cursor: 'pointer', fontSize: '1.25rem', lineHeight: 1 }}
          >
            ✕
          </button>
        </div>

        {/* Two-column workspace */}
        <div style={{ display: 'flex', flexDirection: isDesktop ? 'row' : 'column', gap: isDesktop ? 26 : 16, alignItems: 'stretch' }}>

          {/* ── Live Preview Canvas ── */}
          {/* RTL: order 1 (left side); LTR: order 2 (right side) */}
          <div style={{
            flex: 1, minWidth: isDesktop ? '340px' : '100%',
            order: isDesktop ? (isRTL ? 1 : 2) : 1,
            display: 'flex', flexDirection: 'column', gap: 12, justifyContent: 'space-between',
          }}>
            <div style={{
              width: '100%', height: isDesktop ? '310px' : '150px',
              background: T.innerBg, borderRadius: 10, position: 'relative',
              border: '1px solid #202225', overflow: 'hidden',
            }}>
              <svg style={{ width: '100%', height: '100%', position: 'absolute' }}>
                {showGridlines && (
                  <>
                    <line x1="25%" y1="0" x2="25%" y2="100%" stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="4 4" />
                    <line x1="75%" y1="0" x2="75%" y2="100%" stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="4 4" />
                    <line x1="0" y1="25%" x2="100%" y2="25%" stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="4 4" />
                    <line x1="0" y1="75%" x2="100%" y2="75%" stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="4 4" />
                  </>
                )}
                <line x1="0" y1="50%" x2="100%" y2="50%" stroke={originColor} strokeWidth={scaleLineWidth / 2} />
                <line x1="50%" y1="0" x2="50%" y2="100%" stroke={originColor} strokeWidth={scaleLineWidth / 2} />
                {showCEP && <circle cx="50%" cy="50%" r={isDesktop ? '58' : '30'} fill="none" stroke={scaleColor} strokeWidth={scaleLineWidth / 2} strokeDasharray="3 3" />}
                {showBlockingRadius && <circle cx="50%" cy="50%" r={isDesktop ? '88' : '50'} fill="none" stroke="#e11d48" strokeWidth={scaleLineWidth / 2} strokeDasharray="4 2" />}
                {showES && <line x1="33%" y1="40%" x2="67%" y2="60%" stroke="#eab308" strokeWidth={scaleLineWidth} strokeDasharray="3 3" />}
                {showMeanOrigin && <line x1="50%" y1="50%" x2="44%" y2="60%" stroke="#a855f7" strokeWidth={scaleLineWidth} />}
                <circle cx="33%" cy="40%" r={dotSize * (isDesktop ? 0.9 : 0.7)} fill={shotColor} />
                <circle cx="67%" cy="60%" r={dotSize * (isDesktop ? 0.9 : 0.7)} fill={shotColor} />
                <circle cx="52%" cy="28%" r={dotSize * (isDesktop ? 0.9 : 0.7)} fill={shotColor} />
                <circle cx="50%" cy="50%" r={3.5} fill={originColor} />
                {showLabels && (
                  <text x="54%" y="14%" fill={T.muted} fontSize="10" fontFamily="sans-serif">MOA 1.0</text>
                )}
              </svg>
              <div style={{
                position: 'absolute', bottom: 6,
                left: isRTL ? undefined : 8, right: isRTL ? 8 : undefined,
                background: 'rgba(0,0,0,0.6)', padding: '2px 8px', borderRadius: 4,
                fontSize: '0.68rem', color: T.muted,
              }}>
                {t('settings.live_preview')}
              </div>
            </div>

            {/* Reset defaults button */}
            <div
              onClick={() => { setDotSize(7); setScaleLineWidth(2); setShotColor('#22c55e'); setOriginColor('#ef4444'); setScaleColor('#3b82f6'); }}
              style={{
                padding: '6px 14px', background: '#1e1f22', border: '1px solid #2b2d31',
                color: T.muted, fontSize: '0.8rem', cursor: 'pointer', borderRadius: 6,
                textAlign: 'center', transition: 'all 0.15s ease', alignSelf: 'center', userSelect: 'none',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = T.accent; e.currentTarget.style.color = T.text; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#2b2d31'; e.currentTarget.style.color = T.muted; }}
            >
              {t('settings.reset_to_defaults')}
            </div>
          </div>

          {/* ── Controls Panel ── */}
          {/* RTL: order 2 (right side); LTR: order 1 (left side) */}
          <div style={{
            flex: 1.2, position: 'relative',
            order: isDesktop ? (isRTL ? 2 : 1) : 2,
            display: 'flex', flexDirection: 'column',
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>

              {/* Language selector */}
              <span style={sectionLabel}>{t('settings.language')}</span>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['he', 'en'] as const).map(l => (
                  <button
                    key={l}
                    onClick={() => setLang(l)}
                    style={{
                      flex: 1, padding: '9px',
                      background: lang === l ? `${T.accent}22` : '#1e1f22',
                      border: `1px solid ${lang === l ? T.accent : '#202225'}`,
                      color: lang === l ? T.text : T.muted,
                      borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem',
                    }}
                  >
                    {l === 'he' ? 'עברית' : 'English'}
                  </button>
                ))}
              </div>

              {/* Visual property sliders & colour pickers */}
              <span style={sectionLabel}>{t('settings.visual')}</span>

              <div style={rowStyle}>
                <span style={{ fontSize: '0.88rem', color: T.text }}>{t('settings.shot_nodes_size')}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                  <input type="range" min="4" max="12" value={dotSize} onChange={e => setDotSize(Number(e.target.value))} style={{ width: 90, accentColor: T.accent }} />
                  <span style={{ fontSize: '0.8rem', color: T.muted, minWidth: 30 }}>{dotSize}px</span>
                </div>
              </div>

              <div style={rowStyle}>
                <span style={{ fontSize: '0.88rem', color: T.text }}>{t('settings.axis_line_weight')}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                  <input type="range" min="1" max="5" value={scaleLineWidth} onChange={e => setScaleLineWidth(Number(e.target.value))} style={{ width: 90, accentColor: T.accent }} />
                  <span style={{ fontSize: '0.8rem', color: T.muted, minWidth: 30 }}>{scaleLineWidth}px</span>
                </div>
              </div>

              <div style={rowStyle}>
                <span style={{ fontSize: '0.88rem', color: T.text }}>{t('settings.shot_tint')}</span>
                <input type="color" value={shotColor} onChange={e => setShotColor(e.target.value)} style={{ width: 40, height: 20, border: 'none', padding: 0, background: 'none', cursor: 'pointer' }} />
              </div>
              <div style={rowStyle}>
                <span style={{ fontSize: '0.88rem', color: T.text }}>{t('settings.axis_color')}</span>
                <input type="color" value={originColor} onChange={e => setOriginColor(e.target.value)} style={{ width: 40, height: 20, border: 'none', padding: 0, background: 'none', cursor: 'pointer' }} />
              </div>
              <div style={rowStyle}>
                <span style={{ fontSize: '0.88rem', color: T.text }}>{t('settings.scale_color_label')}</span>
                <input type="color" value={scaleColor} onChange={e => setScaleColor(e.target.value)} style={{ width: 40, height: 20, border: 'none', padding: 0, background: 'none', cursor: 'pointer' }} />
              </div>

              {/* Plot layer customizer button */}
              <button
                onClick={() => setShowPlotCustomizer(true)}
                style={{
                  width: '100%', padding: '11px', background: 'transparent',
                  border: `1px solid ${T.accent}`, borderRadius: 8, color: T.accent,
                  fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer', marginTop: 16,
                  transition: 'background 0.2s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = `${T.accent}15`}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                {t('settings.plot_layers')}
              </button>
            </div>

            {/* ── Plot Layer Customizer (slide-in overlay) ── */}
            {showPlotCustomizer && (
              <div style={{
                position: 'absolute', inset: 0, background: T.modalBg,
                display: 'flex', flexDirection: 'column', zIndex: 10,
                animation: 'fadeIn 0.12s ease-out',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 10 }}>
                  <span style={{ fontSize: '0.82rem', color: T.accent, fontWeight: 700, textTransform: 'uppercase' }}>
                    {t('settings.layer_management')}
                  </span>
                  <div
                    className="cep-btn cep-btn-ghost"
                    onClick={() => setShowPlotCustomizer(false)}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8rem', color: T.muted, cursor: 'pointer', fontWeight: 600 }}
                  >
                    <span>✕</span><span>{t('buttons.back')}</span>
                  </div>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: isDesktop ? 'repeat(2, 1fr)' : '1fr',
                  gap: '8px 10px', overflowY: 'auto', flex: 1, paddingBottom: 6,
                }}>
                  <SvgToggle checked={showGridlines}      onChange={setShowGridlines}      title={t('settings.layer_grid')} />
                  <SvgToggle checked={showLabels}         onChange={setShowLabels}         title={t('settings.layer_labels')} />
                  <SvgToggle checked={showCEP}            onChange={setShowCEP}            title={t('settings.layer_cep')} />
                  <SvgToggle checked={showBlockingRadius} onChange={setShowBlockingRadius} title={t('settings.layer_blocking')} />
                  <SvgToggle checked={showES}             onChange={setShowES}             title={t('settings.layer_es')} />
                  <SvgToggle checked={showMeanOrigin}     onChange={setShowMeanOrigin}     title={t('settings.layer_mean_origin')} />
                </div>

                <button
                  className="cep-btn"
                  onClick={() => setShowPlotCustomizer(false)}
                  style={{
                    width: '100%', padding: '10px', background: T.success, color: '#fff',
                    border: 'none', borderRadius: 8, fontWeight: 600, fontSize: '0.88rem',
                    cursor: 'pointer', marginTop: 10,
                  }}
                >
                  {t('settings.save_changes')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.99); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
