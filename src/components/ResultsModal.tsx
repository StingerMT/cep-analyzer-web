/**
 * ResultsModal — full-screen overlay showing CEP metrics, plot, and export controls.
 *
 * Layout:
 *   Header bar  — title + close button
 *   Body row    — metrics grid (left) + CEP plot (right); stacks on mobile
 *   Action menu — popup for Download or Share options (anchored above footer)
 *   Footer bar  — target-distance input + Edit/Download/Share/Done buttons
 *
 * Asset pipeline:
 *   Effect #3 (PDF pre-generator) — fires when share popup opens and assets are ready.
 *   Effect #4 (asset fetcher)     — generates PNG blob, fetches target image blob,
 *                                   builds CSV/XLSX blobs when any popup opens.
 *   Effect #5 (cache reset)       — clears PDF/error state when distance or shot count changes.
 *
 * Image source: accepts loadedImageSrc / imageSrc / uploadedImage for forward-compatibility;
 * all three are coalesced into `unifiedImageSrc` at the top of the component.
 */

import { useState, useEffect } from 'react';
import { CEP_THEME } from '../lib/theme';
import { computeMrad, generateDataPdfReport, safeBlobToBase64 } from '../lib/pdfUtils';
import { SpinnerIcon } from './SpinnerIcon';
import { CEPPlot } from './CEPPlot';
import { MetricCard } from './MetricCard';
import { Btn } from './Atoms';
import Ico from './Ico';

// ─── Props ────────────────────────────────────────────────────────────────────
interface ResultsModalProps {
  metrics: any;
  t: (key: string, vars?: Record<string, string | number>) => string;
  onClose: () => void;
  getCSVBlob: (distance: number) => Blob | Promise<Blob>;
  getXLSXBlob: (distance: number) => Blob | Promise<Blob>;
  onEditShots: () => void;
  lang: string;
  isRTL: boolean;
  showGridlines: boolean;
  showLabels: boolean;
  showCEP: boolean;
  showBlockingRadius: boolean;
  showES: boolean;
  showMeanOrigin: boolean;
  loadedImageSrc?: string;
  imageSrc?: string;
  uploadedImage?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────
export function ResultsModal({
  metrics, t, onClose, getCSVBlob, getXLSXBlob, onEditShots,
  lang, isRTL, showGridlines, showLabels, showCEP, showBlockingRadius, showES, showMeanOrigin,
  loadedImageSrc, imageSrc, uploadedImage,
}: ResultsModalProps) {

  // Coalesce the three possible image source props into one
  const unifiedImageSrc = loadedImageSrc || imageSrc || uploadedImage || null;

  const [isPlotCollapsed, setIsPlotCollapsed] = useState(false);
  const [distanceInput, setDistanceInput] = useState<number>(100); // metres, default 100 m
  const [activePopup, setActivePopup] = useState<'download' | 'share' | null>(null);

  // Which file types to include in the download popup
  const [downloadOptions, setDownloadOptions] = useState({ xlsx: true, png: true, csv: false });

  // Which assets to include in the share popup
  // When images + csv are both checked they get auto-bundled into a PDF (see isPdfBundleActive)
  const [shareOptions, setShareOptions] = useState({ loadedImage: true, png: true, csv: true });
  const [isProcessingShare, setIsProcessingShare] = useState(false);

  // Blob cache — generated once per popup open, held in state
  const [cachedPngBlob,         setCachedPngBlob]         = useState<Blob | null>(null);
  const [cachedLoadedImageBlob, setCachedLoadedImageBlob] = useState<Blob | null>(null);
  const [cachedXlsxBlob,        setCachedXlsxBlob]        = useState<Blob | null>(null);
  const [cachedCsvBlob,         setCachedCsvBlob]          = useState<Blob | null>(null);
  const [cachedPdfBlob,         setCachedPdfBlob]          = useState<Blob | null>(null);
  const [isPdfPreparing,        setIsPdfPreparing]         = useState(false);

  const currentDir = isRTL ? 'rtl' : 'ltr';

  // isPdfBundleActive: true when the user selects both image types AND csv in the share popup.
  // The share flow will bundle everything into a single PDF report.
  const hasImagesSelected = shareOptions.loadedImage || shareOptions.png;
  const hasCsvSelected    = shareOptions.csv;
  const isPdfBundleActive = hasImagesSelected && hasCsvSelected;

  // ── Helpers ────────────────────────────────────────────────────────────────
  const formatValueWithMrad = (cmValue: number, rawUnit: string) => {
    const primaryStr = `${cmValue.toFixed(2)} ${rawUnit}`;
    const subStr = `${computeMrad(cmValue, rawUnit, distanceInput).toFixed(2)} mrad`;
    return { primaryStr, subStr };
  };

  const triggerFileDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  // generatePngBlob: clones the live SVG by DOM id, stamps to 2000×2000 px,
  // serialises to blob URL, draws on an offscreen canvas, returns PNG blob.
  const generatePngBlob = (): Promise<Blob | null> =>
    new Promise((resolve) => {
      const svgEl = document.getElementById('cep-functional-svg');
      if (!svgEl) return resolve(null);
      const res = 2000;
      const clone = svgEl.cloneNode(true) as SVGElement;
      clone.setAttribute('width', String(res)); clone.setAttribute('height', String(res));
      clone.style.width = `${res}px`; clone.style.height = `${res}px`;
      const svgBlob = new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml;charset=utf-8' });
      const blobURL = URL.createObjectURL(svgBlob);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = res; canvas.height = res;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#1e1f22';
          ctx.fillRect(0, 0, res, res);
          ctx.drawImage(img, 0, 0);
          canvas.toBlob(blob => { URL.revokeObjectURL(blobURL); resolve(blob); }, 'image/png');
        } else { URL.revokeObjectURL(blobURL); resolve(null); }
      };
      img.onerror = () => { URL.revokeObjectURL(blobURL); resolve(null); };
      img.src = blobURL;
    });

  // ── Error / readiness state ────────────────────────────────────────────────
  const [pdfError,          setPdfError]          = useState(false);
  const [loadedImageError,  setLoadedImageError]  = useState(false);

  const isPlotReady        = cachedPngBlob !== null;
  const isTargetImageReady = !unifiedImageSrc || cachedLoadedImageBlob !== null || loadedImageError;
  const areAssetsReadyForPdf = isPlotReady && isTargetImageReady;

  // ── Effect #3: Background PDF pre-generator ────────────────────────────────
  // Fires when the share popup opens AND all assets are ready.
  useEffect(() => {
    if (activePopup === 'share' && areAssetsReadyForPdf && !cachedPdfBlob && !isPdfPreparing && !pdfError) {
      setIsPdfPreparing(true);
      (async () => {
        try {
          const plotB64   = cachedPngBlob         ? await safeBlobToBase64(cachedPngBlob)         : null;
          const targetB64 = cachedLoadedImageBlob ? await safeBlobToBase64(cachedLoadedImageBlob) : null;
          const blob = await generateDataPdfReport(metrics, distanceInput, lang, plotB64, targetB64);
          if (blob) setCachedPdfBlob(blob); else setPdfError(true);
        } catch { setPdfError(true); }
        finally  { setIsPdfPreparing(false); }
      })();
    }
  }, [activePopup, areAssetsReadyForPdf, cachedPdfBlob, isPdfPreparing, pdfError,
      cachedPngBlob, cachedLoadedImageBlob, distanceInput, lang]);

  // ── Effect #4: Asset fetcher ───────────────────────────────────────────────
  // Runs when the popup opens or distanceInput changes.
  // XLSX is only prepared for the download popup (share never attaches raw XLSX).
  useEffect(() => {
    if (!activePopup) return;
    generatePngBlob().then(b => setCachedPngBlob(b));
    if (unifiedImageSrc) {
      fetch(unifiedImageSrc)
        .then(res => { if (!res.ok) throw new Error('fetch failed'); return res.blob(); })
        .then(b => setCachedLoadedImageBlob(b))
        .catch(() => setLoadedImageError(true));
    }
    try {
      const csvRes = getCSVBlob(distanceInput);
      if (csvRes instanceof Promise) csvRes.then(b => setCachedCsvBlob(b)); else setCachedCsvBlob(csvRes);
      if (activePopup === 'download') {
        const xlsxRes = getXLSXBlob(distanceInput);
        if (xlsxRes instanceof Promise) xlsxRes.then(b => setCachedXlsxBlob(b)); else setCachedXlsxBlob(xlsxRes);
      }
    } catch { /* ignore blob generation errors */ }
  }, [activePopup, unifiedImageSrc, distanceInput]);

  // ── Effect #5: Cache reset ─────────────────────────────────────────────────
  // Clears PDF + error state when key inputs change so a fresh report is generated.
  useEffect(() => {
    setCachedPdfBlob(null);
    setPdfError(false);
    setLoadedImageError(false);
  }, [distanceInput, metrics?.numPoints, unifiedImageSrc]);

  // ── Download / share actions ───────────────────────────────────────────────
  const isCacheReady = activePopup === 'download'
    ? (!downloadOptions.xlsx || !!cachedXlsxBlob) && (!downloadOptions.png || !!cachedPngBlob) && (!downloadOptions.csv || !!cachedCsvBlob)
    : !!cachedPngBlob;

  const executeBatchDownload = () => {
    if (downloadOptions.xlsx && cachedXlsxBlob) triggerFileDownload(cachedXlsxBlob, `Analysis-${metrics.numPoints}Shots.xlsx`);
    if (downloadOptions.png  && cachedPngBlob)  triggerFileDownload(cachedPngBlob,  `Analysis-${metrics.numPoints}Shots.png`);
    if (downloadOptions.csv  && cachedCsvBlob)  triggerFileDownload(cachedCsvBlob,  `Analysis-${metrics.numPoints}Shots.csv`);
    setActivePopup(null);
  };

  const executeSmartShare = async () => {
    if (!navigator.share) { alert(t('results.share_not_supported')); return; }
    setIsProcessingShare(true);
    try {
      const files: File[] = [];
      if (isPdfBundleActive) {
        let pdf = cachedPdfBlob;
        if (!pdf) {
          const plotB64   = cachedPngBlob         ? await safeBlobToBase64(cachedPngBlob)         : null;
          const targetB64 = cachedLoadedImageBlob ? await safeBlobToBase64(cachedLoadedImageBlob) : null;
          pdf = await generateDataPdfReport(metrics, distanceInput, lang, plotB64, targetB64);
        }
        if (pdf) files.push(new File([pdf], 'TargetAnalysis-Report.pdf', { type: 'application/pdf' }));
      } else if (hasCsvSelected) {
        if (cachedCsvBlob) files.push(new File([cachedCsvBlob], `metrics-${metrics.numPoints}shots.csv`, { type: 'text/csv' }));
      } else if (hasImagesSelected) {
        if (shareOptions.png  && cachedPngBlob)         files.push(new File([cachedPngBlob],         `plot-${metrics.numPoints}shots.png`, { type: 'image/png' }));
        if (shareOptions.loadedImage && cachedLoadedImageBlob) {
          const mime = cachedLoadedImageBlob.type || 'image/jpeg';
          files.push(new File([cachedLoadedImageBlob], `target-source.${mime.split('/')[1] || 'jpg'}`, { type: mime }));
        }
      }
      if (files.length === 0) { alert(t('results.nothing_selected')); return; }
      await navigator.share({ title: 'Target Diagnostics Data Log', files });
      setActivePopup(null);
    } catch (err: any) {
      if (err.name !== 'AbortError') alert(`Share error: ${err.message}`);
    } finally { setIsProcessingShare(false); }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      onClick={() => { onClose(); setActivePopup(null); }}
      dir={currentDir}
      style={{
        position: 'fixed', inset: 0, zIndex: 400,
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12,
      }}
    >
      <style>{`
        .res-body { display: flex; flex-direction: row; gap: 16px; flex: 1; padding: 8px; overflow: hidden; }
        .res-metrics { flex: 1 1 260px; overflow-y: auto; display: flex; flex-direction: column; justify-content: center; }
        .metrics-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; width: 100%; }
        .res-plot { flex: 0 1 320px; display: flex; justify-content: center; align-items: flex-start; }
        .res-plot svg { direction: ltr !important; }
        .plot-toggle-btn {
          display: flex; position: absolute; top: 7px;
          ${isRTL ? 'left: 8px;' : 'right: 8px;'}
          z-index: 10; background: #383a40; border: 1px solid #3f4147; color: #dbdee1;
          border-radius: 4px; padding: 1px 8px; font-size: 0.68rem; font-weight: 700; cursor: pointer;
        }
        .share-btn-wrapper { display: inline-block !important; }
        .action-popup-menu {
          position: absolute; bottom: 58px;
          ${isRTL ? 'left: 18px;' : 'right: 18px;'}
          background: ${CEP_THEME.elevated}; border: 1px solid ${CEP_THEME.border};
          border-radius: 10px; padding: 14px; box-shadow: 0 12px 32px rgba(0,0,0,0.7);
          z-index: 150; display: flex; flex-direction: column; gap: 10px;
          min-width: 255px; max-height: 400px; overflow-y: auto;
        }
        @media (min-width: 651px) { .plot-toggle-btn { display: none; } }
        @media (max-width: 650px) {
          .res-body { flex-direction: column; }
          .res-plot { order: -1; flex: 0 0 auto; width: 100%; max-height: 360px; position: relative; }
          .res-plot.collapsed { max-height: 32.75px !important; min-height: 32.75px !important; overflow: hidden; }
          .res-metrics { flex: 1 1 auto; justify-content: start; }
          .action-popup-menu { ${isRTL ? 'left: 14px;' : 'right: 14px;'} bottom: 68px; width: calc(100% - 28px); }
        }
      `}</style>

      <div
        onClick={e => e.stopPropagation()}
        className="cep-scale-in"
        style={{
          background: CEP_THEME.surface, border: `1px solid ${CEP_THEME.border}`,
          borderRadius: 14, width: '100%', maxWidth: 740, maxHeight: '85dvh',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          boxShadow: '0 16px 48px rgba(0,0,0,0.6)', position: 'relative',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px', borderBottom: `1px solid ${CEP_THEME.border}`, flexShrink: 0,
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: CEP_THEME.text }}>{t('results.title')}</div>
            <div style={{ fontSize: '0.75rem', color: CEP_THEME.muted, marginTop: 2 }}>
              {t('results.subtitle', { count: metrics.numPoints, cep: metrics.cep50.toFixed(2), unit: metrics.unit })}
            </div>
          </div>
          <button onClick={onClose} className="cep-btn cep-btn-ghost" style={{ background: 'none', border: 'none', color: CEP_THEME.muted, cursor: 'pointer', fontSize: '1.2rem', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>✕</button>
        </div>

        {/* Body */}
        <div className="res-body" onClick={() => setActivePopup(null)}>
          <div className="res-metrics">
            <div className="metrics-grid">
              <MetricCard label={t('results.shots')}         value={String(metrics.numPoints)} />
              <MetricCard label={t('results.mean_to_origin')} {...formatValueWithMrad(metrics.meanToOrigin,  metrics.unit)} subValue={formatValueWithMrad(metrics.meanToOrigin,  metrics.unit).subStr} value={formatValueWithMrad(metrics.meanToOrigin,  metrics.unit).primaryStr} />
              <MetricCard label={t('results.extreme_spread')} value={formatValueWithMrad(metrics.extremeSpread, metrics.unit).primaryStr} subValue={formatValueWithMrad(metrics.extremeSpread, metrics.unit).subStr} />
              <MetricCard label={t('results.sigma_x')}        value={formatValueWithMrad(metrics.sigmaX,        metrics.unit).primaryStr} subValue={formatValueWithMrad(metrics.sigmaX,        metrics.unit).subStr} />
              <MetricCard label={t('results.sigma_y')}        value={formatValueWithMrad(metrics.sigmaY,        metrics.unit).primaryStr} subValue={formatValueWithMrad(metrics.sigmaY,        metrics.unit).subStr} />
              <MetricCard label={t('results.blocking_r')}     value={formatValueWithMrad(metrics.blockingRadius, metrics.unit).primaryStr} subValue={formatValueWithMrad(metrics.blockingRadius, metrics.unit).subStr} />
            </div>
          </div>

          <div className={`res-plot ${isPlotCollapsed ? 'collapsed' : ''}`}>
            <div style={{ width: '100%', maxWidth: 320, position: 'relative' }}>
              <button className="cep-btn cep-btn-ghost plot-toggle-btn" onClick={e => { e.stopPropagation(); setIsPlotCollapsed(v => !v); }}>
                {isPlotCollapsed ? t('results.expand_plot') : t('results.collapse_plot')}
              </button>
              <CEPPlot
                metrics={metrics} t={t} isRTL={isRTL}
                showGridlines={showGridlines} showLabels={showLabels}
                showCEP={showCEP} showBlockingRadius={showBlockingRadius}
                showES={showES} showMeanOrigin={showMeanOrigin}
              />
            </div>
          </div>
        </div>

        {/* Action popup (Download / Share) */}
        {activePopup && (
          <div className="action-popup-menu" onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '0.75rem', color: CEP_THEME.muted, fontWeight: 700, borderBottom: `1px solid ${CEP_THEME.border}`, paddingBottom: 6, marginBottom: 4 }}>
              {activePopup === 'download' ? t('results.download_header') : t('results.share_header')}
            </div>

            {activePopup === 'download' && (
              <>
                {[
                  { key: 'xlsx', label: t('results.download_format_xlsx') },
                  { key: 'png',  label: t('results.download_format_png') },
                  { key: 'csv',  label: t('results.download_format_csv') },
                ].map(({ key, label }) => (
                  <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, color: CEP_THEME.text, fontSize: '0.85rem', cursor: 'pointer', padding: '2px 0' }}>
                    <input type="checkbox" style={{ accentColor: CEP_THEME.green }}
                      checked={downloadOptions[key as keyof typeof downloadOptions]}
                      onChange={e => setDownloadOptions(o => ({ ...o, [key]: e.target.checked }))} />
                    {label}
                  </label>
                ))}
                <button onClick={executeBatchDownload} disabled={!isCacheReady} className="cep-btn"
                  style={{ background: CEP_THEME.green, color: '#fff', border: 'none', borderRadius: 6, padding: '8px 12px', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', marginTop: 4, opacity: isCacheReady ? 1 : 0.5 }}>
                  {!isCacheReady ? t('results.preparing_files') : t('results.download_selected')}
                </button>
              </>
            )}

            {activePopup === 'share' && (
              <>
                {[
                  { key: 'loadedImage', label: t('results.share_label_photo') },
                  { key: 'png',         label: t('results.share_label_png') },
                  { key: 'csv',         label: t('results.share_label_csv') },
                ].map(({ key, label }) => (
                  <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, color: CEP_THEME.text, fontSize: '0.85rem', cursor: 'pointer', padding: '2px 0' }}>
                    <input type="checkbox" style={{ accentColor: CEP_THEME.purple }}
                      checked={shareOptions[key as keyof typeof shareOptions]}
                      onChange={e => setShareOptions(o => ({ ...o, [key]: e.target.checked }))} />
                    {label}
                  </label>
                ))}
                {isPdfBundleActive && (
                  <div style={{ fontSize: '0.72rem', color: CEP_THEME.purple, marginTop: 4, lineHeight: 1.35, background: 'rgba(168,85,247,0.1)', padding: '6px 8px', borderRadius: 6, border: '1px solid rgba(168,85,247,0.25)' }}>
                    ✨ {t('results.pdf_bundle_hint')}
                  </div>
                )}
                <button
                  className="cep-btn"
                  onClick={executeSmartShare}
                  disabled={isProcessingShare || (isPdfBundleActive && isPdfPreparing && !pdfError) || (!shareOptions.loadedImage && !shareOptions.png && !shareOptions.csv)}
                  style={{
                    background: CEP_THEME.purple, color: '#fff', border: 'none', borderRadius: 6,
                    padding: '8px 14px', fontSize: '0.82rem', fontWeight: 700,
                    cursor: (isProcessingShare || (isPdfBundleActive && (isPdfPreparing || !cachedPdfBlob))) ? 'not-allowed' : 'pointer',
                    marginTop: 4,
                    opacity: (isProcessingShare || (isPdfBundleActive && (isPdfPreparing || !cachedPdfBlob))) ? 0.65 : 1,
                    transition: 'opacity 0.2s ease',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {isPdfBundleActive && isPdfPreparing ? (
                    <><SpinnerIcon /><span>{t('results.generating_pdf')}</span></>
                  ) : isProcessingShare ? (
                    <><SpinnerIcon /><span>{t('results.compiling_assets')}</span></>
                  ) : (
                    <span>{t('results.share_selected')}</span>
                  )}
                </button>
              </>
            )}
          </div>
        )}

        {/* Footer */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 18px', borderTop: `1px solid ${CEP_THEME.border}`,
          background: '#1a1b1e', flexShrink: 0, gap: 12,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: '0.72rem', color: CEP_THEME.accent, opacity: 0.9, fontWeight: 700, whiteSpace: 'nowrap' }}>
              {t('results.target_distance_label')}
            </label>
            <input
              type="number" min="1" placeholder="100" value={distanceInput || ''}
              onChange={e => setDistanceInput(e.target.value === '' ? 0 : Number(e.target.value))}
              style={{ width: 80, background: '#2b2d31', border: `1px solid ${CEP_THEME.border}`, borderRadius: 6, padding: '6px 8px', color: CEP_THEME.text, fontSize: '0.85rem', textAlign: 'center', outline: 'none', fontFamily: 'inherit' }}
            />
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Btn onClick={onEditShots} bg={CEP_THEME.faint} small title={t('buttons.edit_shots')}>
              <Ico icon="editShots" size={18} />
            </Btn>
            <span onClick={e => { e.stopPropagation(); setActivePopup(p => p === 'download' ? null : 'download'); }}>
              <Btn onClick={() => {}} bg={CEP_THEME.green} small title={t('buttons.download')}>
                <Ico icon="exportXLSX" size={18} />
              </Btn>
            </span>
            <span className="share-btn-wrapper" onClick={e => { e.stopPropagation(); setActivePopup(p => p === 'share' ? null : 'share'); }}>
              <Btn onClick={() => {}} bg={CEP_THEME.purple} small title={t('buttons.share')}>
                <Ico icon="share" size={18} />
              </Btn>
            </span>
            <Btn onClick={onClose} bg={CEP_THEME.accent} small>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, padding: '0 4px' }}>
                {t('buttons.done')}
              </span>
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}
