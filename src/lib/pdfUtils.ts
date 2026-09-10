/**
 * PDF generation utilities for CEP Target Analyzer.
 *
 * Exports:
 *   fixHebrewRTL          — reverses Hebrew strings for jsPDF's LTR rendering engine
 *   loadImage             — safe async HTMLImageElement loader with timeout guard
 *   generateDataPdfReport — builds the full jsPDF Blob (page 1: metrics, page 2: target photo)
 *   safeBlobToBase64      — null-safe Blob → base64 data URL converter
 *   toCentimeters         — unit conversion helper (mm / cm / in → cm)
 *   computeMrad           — sigma → milliradians given distance in metres
 *   SpinnerIcon           — animated SVG spinner used in the share button
 */

import { registerPdfFont, type SupportedPdfFont } from './pdfFontLoader';

// ─── Hebrew RTL helper ────────────────────────────────────────────────────────
// jsPDF renders all text LTR. This function makes Hebrew strings visually correct
// by reversing them (and handling bracketed LTR tokens like [CEP 50%] specially).
export const fixHebrewRTL = (text: string): string => {
  if (!text) return '';
  const hebrewRegex = /[\u0590-\u05FF]/;
  if (!hebrewRegex.test(text)) return text;

  // Extract bracketed LTR tokens (e.g. [ES], [CEP 50%], [X], [Y], [R])
  const brackets: string[] = [];
  const cleanHebrew = text.replace(/(\[[^\]]+\])/g, (match) => {
    brackets.push(match);
    return '';
  }).trim();

  // If bracket tokens were found, prepend them to the visual left — the PDF viewer's
  // BiDi engine will handle the Hebrew portion correctly.
  if (brackets.length > 0) {
    return `${brackets.join(' ')} ${cleanHebrew}`;
  }

  // Pure Hebrew strings: reverse character-by-character so LTR rendering reads RTL.
  return cleanHebrew.split('').reverse().join('');
};

// ─── Safe image loader ────────────────────────────────────────────────────────
// Resolves to null on error or timeout (never rejects), preventing the PDF
// pipeline from hanging indefinitely on a bad asset URL.
export const loadImage = (src: string, timeoutMs = 3000): Promise<HTMLImageElement | null> => {
  return new Promise((resolve) => {
    const img = new Image();
    let timer: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      img.onload = null;
      img.onerror = null;
    };

    img.onload = () => { cleanup(); resolve(img); };
    img.onerror = () => { cleanup(); resolve(null); };
    timer = setTimeout(() => { cleanup(); resolve(null); }, timeoutMs);

    img.src = src;

    // Short-circuit if browser already has the image cached synchronously
    if (img.complete && img.width > 0) { cleanup(); resolve(img); }
  });
};

// ─── safeBlobToBase64 ─────────────────────────────────────────────────────────
// Resolves to null on error — use this in the PDF pipeline so a single failed
// asset doesn't block or crash the full report generation.
export const safeBlobToBase64 = (blob: Blob): Promise<string | null> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
};

// ─── Unit conversion helpers ──────────────────────────────────────────────────
export const toCentimeters = (value: number, fromUnit: string): number => {
  switch (fromUnit?.toLowerCase()) {
    case 'mm': return value / 10;
    case 'cm': return value;
    case 'in': return value * 2.54;
    default: return value;
  }
};

export const computeMrad = (sigma: number, unit: string, distanceMeters: number): number => {
  if (!distanceMeters || distanceMeters <= 0) return 0;
  const sigmaCm = toCentimeters(sigma, unit);
  const sigmaM = sigmaCm / 100;
  return (sigmaM / distanceMeters) * 1000;
};

// ─── SpinnerIcon ──────────────────────────────────────────────────────────────
// Moved to src/components/SpinnerIcon.tsx (JSX requires a .tsx file).
// Import from there: import { SpinnerIcon } from '../components/SpinnerIcon'

// ─── generateDataPdfReport ────────────────────────────────────────────────────
// Builds a jsPDF document and returns it as a Blob.
//
// Parameters:
//   metrics      — CEP analysis output (numPoints, cep50, sigmaX/Y, etc.)
//   distance     — target distance in metres (for mrad calculations)
//   lang         — 'en' | 'he' — controls RTL layout and Hebrew font registration
//   plotB64      — base64 data URL of the SVG plot rendered as PNG (page 1)
//   targetB64    — base64 data URL of the target photo (page 2, optional)
//   selectedFont — Hebrew TTF font key; defaults to 'Rubik'
//
// Page structure:
//   Page 1: header + CEP hero card + 2-column metrics grid + diagnostic plot
//   Page 2: header + full-width target photo (only if targetB64 provided)
export const generateDataPdfReport = async (
  metrics: any,
  distance: number,
  lang: string,
  plotB64?: string | null,
  targetB64?: string | null,
  selectedFont: SupportedPdfFont = 'Rubik'
): Promise<Blob> => {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const pageWidth = 210;
  const pageHeight = 297;
  const isHe = lang === 'he';

  if (isHe) {
    await registerPdfFont(doc, selectedFont);
    doc.setFont(selectedFont);
  }

  // Pre-load hero SVG icon for embedding in jsPDF.
  // We fetch the SVG, replace currentColor with white, and pass it directly
  // to jsPDF as a base64 SVG — skipping canvas rasterisation entirely,
  // which is unreliable on mobile browsers for complex path SVGs.
  let heroIconB64: string | null = null;
  let heroIconFormat: string = 'SVG';
  try {
    const svgUrl = `${import.meta.env.BASE_URL}assets/cep-50%-hero-stat-icon.svg`;
    const res = await fetch(svgUrl);
    if (res.ok) {
      let svgText = await res.text();
      svgText = svgText.replace(/currentColor/g, '#ffffff');
      heroIconB64 = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgText)))}`;
      heroIconFormat = 'SVG';
    }
  } catch (e) {
    console.warn('[PDF] Could not load hero SVG, using shape fallback', e);
  }

  const now = new Date();
  const dateStr = `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')}.${now.getFullYear()}`;

  // Local mrad formatter — converts a metric value (in its native unit) to a mrad string
  const calcMrad = (val: number) => {
    if (!distance || distance <= 0) return '';
    return `${((val / 100) / distance * 1000).toFixed(2)} mrad`;
  };

  // ── Sub-routines ──────────────────────────────────────────────────────────
  const drawLogoBadge = (x: number, y: number) => {
    doc.setFillColor(255, 255, 255, 0.12);
    doc.roundedRect(x, y, 12, 12, 3, 3, 'F');
    doc.setDrawColor(99, 102, 241); doc.setLineWidth(0.4);
    doc.roundedRect(x, y, 12, 12, 3, 3, 'D');
    const bx = x + 6, by = y + 6;
    doc.setDrawColor(255, 255, 255); doc.setLineWidth(0.3);
    doc.circle(bx, by, 3.5, 'S'); doc.circle(bx, by, 1.5, 'S');
    doc.line(bx - 4.5, by, bx + 4.5, by); doc.line(bx, by - 4.5, bx, by + 4.5);
  };

  const drawHeader = () => {
    doc.setFillColor(10, 34, 64); doc.rect(0, 0, pageWidth, 36, 'F');
    doc.setFillColor(99, 102, 241); doc.rect(0, 35, pageWidth, 1, 'F');
    const logoX = isHe ? pageWidth - 20 : 12;
    const textX = isHe ? pageWidth - 26 : 28;
    const dateX = isHe ? 14 : pageWidth - 14;
    drawLogoBadge(logoX, 12);
    doc.setTextColor(255, 255, 255); doc.setFontSize(14);
    doc.text(isHe ? fixHebrewRTL('דוח ניתוח בליסטי') : 'Ballistics Analysis Report', textX, 17, { align: isHe ? 'right' : 'left' });
    doc.setFontSize(8.5); doc.setTextColor(180, 195, 215);
    doc.text(isHe ? fixHebrewRTL(`מרחק ירי: ${distance}m  |  סה"כ פגיעות: ${metrics.numPoints}`)
      : `Target Distance: ${distance}m  |  Total Shots: ${metrics.numPoints}`, textX, 25, { align: isHe ? 'right' : 'left' });
    doc.setFontSize(9); doc.setTextColor(220, 230, 245);
    doc.text(dateStr, dateX, 21, { align: isHe ? 'left' : 'right' });
  };

  const drawFloatingPageBadge = (pageNum: number, total: number, pageH: number) => {
    const bw = 15, bh = 5.5;
    const bx = isHe ? 8 : pageWidth - 8 - bw;
    const by = pageH - bh - 4;
    doc.setFillColor(15, 23, 42); doc.roundedRect(bx, by, bw, bh, 2.5, 2.5, 'F');
    doc.setDrawColor(99, 102, 241); doc.setLineWidth(0.25); doc.roundedRect(bx, by, bw, bh, 2.5, 2.5, 'D');
    doc.setFontSize(7); doc.setTextColor(255, 255, 255);
    doc.text(`${pageNum}/${total}`, bx + bw / 2, by + 3.8, { align: 'center' });
  };

  const totalPages = targetB64 ? 2 : 1;

  // ── PAGE 1 ────────────────────────────────────────────────────────────────
  doc.setFillColor(238, 242, 255); doc.triangle(0, 80, pageWidth, 20, pageWidth, 180, 'F');
  doc.setFillColor(224, 231, 255); doc.triangle(0, 200, pageWidth, 140, 0, pageHeight, 'F');
  drawHeader();

  const margin = 12;
  const contentWidth = pageWidth - margin * 2;
  let currentY = 40;

  // Hero card
  const heroHeight = 24;
  doc.setFillColor(13, 71, 161); doc.roundedRect(margin, currentY, contentWidth, heroHeight, 3, 3, 'F');
  const iconSize = 10;
  const iconX = (isHe ? margin + 12 : margin + contentWidth - 12) - iconSize / 2;
  const iconY = currentY + (heroHeight - iconSize) / 2;
  if (heroIconB64) {
    doc.addImage(heroIconB64, heroIconFormat, iconX, iconY, iconSize, iconSize, undefined, 'FAST');
  } else {
    const icx = isHe ? margin + 12 : margin + contentWidth - 12;
    doc.setDrawColor(255, 255, 255); doc.setLineWidth(0.4);
    doc.circle(icx, currentY + 12, 4.5, 'S'); doc.circle(icx, currentY + 12, 1.8, 'S');
  }
  const heroTextX = isHe ? margin + contentWidth - 10 : margin + 10;
  doc.setFontSize(7.5); doc.setTextColor(190, 215, 250);
  doc.text(isHe ? fixHebrewRTL('רדיוס מעגל פגיעה [CEP 50%]') : 'CEP 50% Radius', heroTextX, currentY + 6.5, { align: isHe ? 'right' : 'left' });
  doc.setFontSize(12); doc.setTextColor(255, 255, 255);
  doc.text(`${metrics.cep50.toFixed(2)} ${metrics.unit}`, heroTextX, currentY + 13.5, { align: isHe ? 'right' : 'left' });
  const cepMrad = calcMrad(metrics.cep50);
  if (cepMrad) { doc.setFontSize(8); doc.setTextColor(165, 180, 252); doc.text(cepMrad, heroTextX, currentY + 19, { align: isHe ? 'right' : 'left' }); }
  currentY += heroHeight + 3.5;

  // Metrics grid (2 columns)
  const gridGap = 3.5;
  const colWidth = (contentWidth - gridGap) / 2;
  const cardHeight = 18;
  const gridItems = [
    { labelEn: 'Total Hits',                 labelHe: 'מספר פגיעות כולל',  val: String(metrics.numPoints),               subVal: '' },
    { labelEn: 'POI Deviation [Mean]',        labelHe: 'מרחק נפ"ם-נפ"ר',   val: `${metrics.meanToOrigin.toFixed(2)} ${metrics.unit}`,   subVal: calcMrad(metrics.meanToOrigin) },
    { labelEn: 'Extreme Spread [ES]',         labelHe: 'פיזור מקסימלי [ES]', val: `${metrics.extremeSpread.toFixed(2)} ${metrics.unit}`,  subVal: calcMrad(metrics.extremeSpread) },
    { labelEn: 'Max Blocking Radius [R]',     labelHe: 'רדיוס חוסם [R]',    val: `${metrics.blockingRadius.toFixed(2)} ${metrics.unit}`, subVal: calcMrad(metrics.blockingRadius) },
    { labelEn: 'Horizontal Dev [Sigma X]',    labelHe: 'סטייה אופקית [X]',  val: `${metrics.sigmaX.toFixed(2)} ${metrics.unit}`,         subVal: calcMrad(metrics.sigmaX) },
    { labelEn: 'Vertical Dev [Sigma Y]',      labelHe: 'סטייה אנכית [Y]',   val: `${metrics.sigmaY.toFixed(2)} ${metrics.unit}`,         subVal: calcMrad(metrics.sigmaY) },
  ];
  for (let i = 0; i < gridItems.length; i += 2) {
    gridItems.slice(i, i + 2).forEach((item, colIdx) => {
      // RTL: index 0 → right column (visually first); LTR: index 0 → left column
      const isRightCol = isHe ? colIdx === 0 : colIdx === 1;
      const cardX = isRightCol ? margin + colWidth + gridGap : margin;
      doc.setFillColor(30, 34, 42); doc.roundedRect(cardX, currentY, colWidth, cardHeight, 2.5, 2.5, 'F');
      const labelX = isHe ? cardX + colWidth - 5 : cardX + 5;
      doc.setFontSize(7); doc.setTextColor(160, 175, 195);
      doc.text(isHe ? fixHebrewRTL(item.labelHe) : item.labelEn, labelX, currentY + 5.5, { align: isHe ? 'right' : 'left' });
      doc.setFontSize(10); doc.setTextColor(255, 255, 255);
      doc.text(item.val, labelX, currentY + 11.5, { align: isHe ? 'right' : 'left' });
      if (item.subVal) { doc.setFontSize(7); doc.setTextColor(129, 140, 248); doc.text(item.subVal, labelX, currentY + 15.5, { align: isHe ? 'right' : 'left' }); }
    });
    currentY += cardHeight + gridGap;
  }
  currentY += 1;

  // Diagnostic plot container
  if (plotB64) {
    const plotH = pageHeight - currentY - 12;
    doc.setFillColor(30, 31, 34); doc.roundedRect(margin, currentY, contentWidth, plotH, 3, 3, 'F');
    const pad = 4;
    const maxSz = Math.min(contentWidth - pad * 2, plotH - pad * 2);
    doc.addImage(plotB64, 'PNG', margin + (contentWidth - maxSz) / 2, currentY + (plotH - maxSz) / 2, maxSz, maxSz, undefined, 'FAST');
  }
  drawFloatingPageBadge(1, totalPages, pageHeight);

  // ── PAGE 2: Target Photo ──────────────────────────────────────────────────
  if (targetB64) {
    try {
      const img = await loadImage(targetB64, 4000);
      if (img && img.width > 0 && img.height > 0) {
        const pW = 210, headerH = 36;
        const imgH = (img.height * pW) / img.width;
        const pH = headerH + imgH;
        doc.addPage([pW, pH], pW > pH ? 'l' : 'p');
        if (isHe) doc.setFont(selectedFont);
        drawHeader();
        const fmt = (targetB64.match(/^data:image\/(png|jpeg|jpg|webp);base64,/i)?.[1] ?? 'JPEG').toUpperCase();
        doc.addImage(targetB64, fmt, 0, headerH, pW, imgH, undefined, 'FAST');
        drawFloatingPageBadge(2, totalPages, pH);
      }
    } catch (err) { console.warn('[PDF] Failed to render target image on page 2:', err); }
  }

  return doc.output('blob');
};
