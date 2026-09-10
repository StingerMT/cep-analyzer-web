/**
 * CEP (Circular Error Probable) Analysis Library
 * 
 * Ported from Python/MATLAB implementation
 * Provides statistical analysis of shot groupings
 */

import * as XLSX from 'xlsx';

export interface Point {
  x: number;
  y: number;
}

export interface CEPMetrics {
  numPoints: number;
  meanX: number;
  meanY: number;
  sigmaX: number;
  sigmaY: number;
  combinedStd: number;
  cep50: number;
  blockingRadius: number;
  extremeSpread: number;
  meanToOrigin: number;
  unit: string;
  realPoints: Point[];
}

/**
 * Calculate median of an array of numbers
 */
function median(values: number[]): number {
  if (values.length === 0) return 0;
  
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  
  if (sorted.length % 2 === 1) {
    return sorted[mid];
  }
  
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Calculate standard deviation (sample std, n-1)
 */
function stddev(values: number[]): number {
  const n = values.length;
  if (n <= 1) return 0;
  
  const mean = values.reduce((sum, val) => sum + val, 0) / n;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (n - 1);
  
  return Math.sqrt(variance);
}

/**
 * Calculate maximum pairwise distance between points
 */
function pairwiseMaxDistance(points: Point[]): number {
  let maxDist = 0;
  const n = points.length;
  
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dx = points[i].x - points[j].x;
      const dy = points[i].y - points[j].y;
      const dist = Math.hypot(dx, dy);
      
      if (dist > maxDist) {
        maxDist = dist;
      }
    }
  }
  
  return maxDist;
}

/**
 * Compute CEP metrics from shot points
 * 
 * @param shotsScene - Array of shot points in scene coordinates (pixels)
 * @param origin - Origin point (point of aim) in scene coordinates
 * @param unitsPerPixel - Scale factor (real units per pixel)
 * @param unitName - Name of the unit (mm, cm, in, etc.)
 * @returns CEP metrics in real units
 */
export function computeMetrics(
  shotsScene: Point[],
  origin: Point | null,
  unitsPerPixel: number,
  unitName: string
): CEPMetrics {
  if (shotsScene.length === 0) {
    throw new Error('No shot points provided');
  }
  
  if (unitsPerPixel <= 0) {
    throw new Error('Units per pixel must be positive');
  }
  
  // Use first point as origin if not provided
  const actualOrigin = origin || shotsScene[0];
  
  // Convert to real units with Y-axis flipped (matching MATLAB coordinate system).
  // Canvas/image Y increases downward; ballistic convention is Y increases upward.
  // Flipping here means all downstream metrics (meanY, sigmaY, etc.) are in standard
  // cartesian orientation — positive Y = above point of aim, negative Y = below.
  const realPoints: Point[] = shotsScene.map(p => ({
    x: (p.x - actualOrigin.x) * unitsPerPixel,
    y: -(p.y - actualOrigin.y) * unitsPerPixel  // Flip Y axis
  }));
  
  // Calculate mean position
  const meanX = realPoints.reduce((sum, p) => sum + p.x, 0) / realPoints.length;
  const meanY = realPoints.reduce((sum, p) => sum + p.y, 0) / realPoints.length;
  
  // Calculate standard deviations
  const xValues = realPoints.map(p => p.x);
  const yValues = realPoints.map(p => p.y);
  const sigmaX = stddev(xValues);
  const sigmaY = stddev(yValues);
  
  // Calculate radii from mean (distances from each point to the group mean — NOT to origin).
  // CEP50 and blockingRadius are both measured relative to the mean, not the origin.
  // This matches the standard ballistic definition: CEP is the dispersion around the POI,
  // while meanToOrigin separately describes how far the POI is from the intended aim point.
  const radii = realPoints.map(p => 
    Math.hypot(p.x - meanX, p.y - meanY)
  );
  
  // CEP50 - median radius (50% circular error probable)
  const cep50 = median(radii);
  
  // Extreme Spread - maximum pairwise distance
  const extremeSpread = pairwiseMaxDistance(realPoints);
  
  // Blocking Radius - furthest point from mean
  const blockingRadius = Math.max(...radii, 0);
  
  // Distance from mean to origin
  const meanToOrigin = Math.hypot(meanX, meanY);
  
  // Combined standard deviation
  const combinedStd = Math.sqrt(sigmaX * sigmaX + sigmaY * sigmaY);
  
  return {
    numPoints: realPoints.length,
    meanX,
    meanY,
    sigmaX,
    sigmaY,
    combinedStd,
    cep50,
    blockingRadius,
    extremeSpread,
    meanToOrigin,
    unit: unitName,
    realPoints
  };
}

/**
 * Convert value from one unit to centimeters.
 * MOA and mrad/mil conversions are distance-dependent and cannot be done here —
 * if those unit types are ever supported, the caller must pre-convert them before
 * passing to this function. For now they pass through unchanged (treated as cm).
 */
function toCentimeters(value: number, fromUnit: string): number {
  switch (fromUnit.toLowerCase()) {
    case 'mm':
      return value / 10;
    case 'cm':
      return value;
    case 'in':
      return value * 2.54;
    case 'moa':
      // MOA to cm requires distance, handle separately
      return value;
    case 'mil':
    case 'mrad':
      // Milliradians to cm requires distance, handle separately
      return value;
    default:
      return value; // Assume already in cm
  }
}

// calculateMradValue: internal helper — converts a value already in centimetres to milliradians.
// Formula: (valueM / distanceM) * 1000  where valueM = cmValue / 100
// Used only by exportToXLSX and exportToCSV for the mrad section rows.
// NOTE: The public `calculateMrad` exported at the bottom of this file does the same thing
// but accepts a raw value + unit name and runs toCentimeters() first. Prefer that one
// for general use; this one exists to avoid re-running the unit conversion inside the loops.
const calculateMradValue = (cmValue: number, distanceMeters: number): number => {
  if (!distanceMeters || distanceMeters <= 0) return 0;
  return ((cmValue / 100) / distanceMeters) * 1000;
};

// 2. The new unified Excel Export function
// Returns a Blob instead of triggering a direct download — the caller decides what to do with it.
// `points` here are the real-unit coordinates from metrics.realPoints (already origin-relative),
// NOT the raw canvas pixel coordinates — the conversion has already happened in computeMetrics().
// The `metrics` parameter uses `any` intentionally to accept both the CEPMetrics interface and
// the inline `Metrics` interface defined in App.tsx (they have matching field names).
export const exportToXLSX = (
  points: { x: number; y: number }[], 
  metrics: any, 
  distanceMeters: number, 
  unit: string = 'cm'
): Blob => {
  const dataRows: any[][] = [];

  // Section A: Raw Shot Coordinates Header & Points Table
  dataRows.push(['index', `x(${unit})`, `y(${unit})`]);
  points.forEach((pt, idx) => {
    dataRows.push([idx + 1, pt.x, pt.y]);
  });

  // Section B: Clean Spacer Gap
  dataRows.push([]);

  // Section C: Summary Ballistics Metrics Table
  dataRows.push(['metric', 'value', 'units']);
  dataRows.push(['mean_x', metrics.meanX ?? metrics.mean_x ?? 0, unit]);
  dataRows.push(['mean_y', metrics.meanY ?? metrics.mean_y ?? 0, unit]);
  dataRows.push(['sigma_x', metrics.sigmaX, unit]);
  dataRows.push(['sigma_y', metrics.sigmaY, unit]);
  dataRows.push(['cep50', metrics.cep50, unit]);
  dataRows.push(['extreme_spread', metrics.extremeSpread, unit]);
  dataRows.push(['blocking_radius', metrics.blockingRadius, unit]);
  dataRows.push(['mean_to_origin', metrics.meanToOrigin, unit]);

  // Section D: Clean Spacer Gap
  dataRows.push([]);

  // Section E: Contextual Live Angular (mrad) Metrics Table
  const sigmaXCm = toCentimeters(metrics.sigmaX, unit);
  const sigmaYCm = toCentimeters(metrics.sigmaY, unit);

  dataRows.push(['distance_to_target', distanceMeters, 'm']);
  dataRows.push(['sigma_x_mrad', calculateMradValue(sigmaXCm, distanceMeters), 'mrad']);
  dataRows.push(['sigma_y_mrad', calculateMradValue(sigmaYCm, distanceMeters), 'mrad']);

  const worksheet = XLSX.utils.aoa_to_sheet(dataRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'results');

  // Instead of auto-writing to local disk, compile into an internal binary buffer array
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  
  // Wrap buffer into standard browser application/vnd blob parameters
  return new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
};

// 3. The new unified CSV Export function
// Mirrors the XLSX structure exactly, but formatted as quoted CSV strings.
// The UTF-8 BOM (0xEF 0xBB 0xBF) is prepended so that Excel on Windows opens
// the file with correct character encoding without needing a manual import step.
export const exportToCSV = (
  points: { x: number; y: number }[], 
  metrics: any, 
  distanceMeters: number, 
  unit: string = 'cm'
): Blob => {
  const dataRows: string[][] = [];

  // Section A: Raw Shot Coordinates Table
  dataRows.push(['index', `x(${unit})`, `y(${unit})`]);
  points.forEach((pt, idx) => {
    dataRows.push([(idx + 1).toString(), pt.x.toFixed(6), pt.y.toFixed(6)]);
  });

  // Section B: Spacer Row
  dataRows.push(['', '', '']);

  // Section C: Summary Metrics Table
  dataRows.push(['metric', 'value', 'units']);
  dataRows.push(['mean_x', (metrics.meanX ?? metrics.mean_x ?? 0).toFixed(2), unit]);
  dataRows.push(['mean_y', (metrics.meanY ?? metrics.mean_y ?? 0).toFixed(2), unit]);
  dataRows.push(['sigma_x', metrics.sigmaX.toFixed(2), unit]);
  dataRows.push(['sigma_y', metrics.sigmaY.toFixed(2), unit]);
  dataRows.push(['cep50', metrics.cep50.toFixed(2), unit]);
  dataRows.push(['extreme_spread', metrics.extremeSpread.toFixed(2), unit]);
  dataRows.push(['blocking_radius', metrics.blockingRadius.toFixed(2), unit]);
  dataRows.push(['mean_to_origin', metrics.meanToOrigin.toFixed(2), unit]);

  // Section D: Spacer Row
  dataRows.push(['', '', '']);

  // Section E: Live Contextual Angular (mrad) Metrics Table
  const sigmaXCm = toCentimeters(metrics.sigmaX, unit);
  const sigmaYCm = toCentimeters(metrics.sigmaY, unit);

  dataRows.push(['distance_to_target', distanceMeters.toString(), 'm']);
  dataRows.push(['sigma_x_mrad', calculateMradValue(sigmaXCm, distanceMeters).toFixed(2), 'mrad']);
  dataRows.push(['sigma_y_mrad', calculateMradValue(sigmaYCm, distanceMeters).toFixed(2), 'mrad']);

  const csvContent = dataRows
    .map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
    .join('\n');

  // Packages data with the UTF-8 Byte Order Mark (BOM) wrapper and returns the blob
  return new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
};

/**
 * Get precision rating based on CEP50 value
 * NOTE: This function is currently unused in the app — it was part of the original
 * Python port but no UI component calls it. The rating thresholds assume centimetres.
 * Could be wired to a label in ResultsModal in a future pass.
 */
export function getPrecisionRating(cep50Cm: number): string {
  if (cep50Cm < 1) return 'Exceptional';
  if (cep50Cm < 2) return 'Excellent';
  if (cep50Cm < 3) return 'Very Good';
  if (cep50Cm < 5) return 'Good';
  return 'Needs Improvement';
}

/**
 * Calculate CEP percentiles (50%, 90%, 95%)
 * NOTE: Currently unused in the app. Kept for future feature work (CEP 90% / 95% display).
 * Uses nearest-rank method (Math.ceil). For small shot counts this differs slightly
 * from linear interpolation — acceptable for field use.
 */
export function calculateCEPPercentiles(radii: number[]): {
  cep50: number;
  cep90: number;
  cep95: number;
} {
  if (radii.length === 0) {
    return { cep50: 0, cep90: 0, cep95: 0 };
  }
  
  const sorted = [...radii].sort((a, b) => a - b);
  const n = sorted.length;
  
  const getPercentile = (p: number) => {
    const index = Math.ceil(n * p) - 1;
    return sorted[Math.max(0, Math.min(index, n - 1))];
  };
  
  return {
    cep50: getPercentile(0.50),
    cep90: getPercentile(0.90),
    cep95: getPercentile(0.95)
  };
}

/**
 * Calculate milliradians for a metric value given a target distance
 */
export function calculateMrad(value: number, unitName: string, distanceMeters: number): number {
  if (!distanceMeters || distanceMeters <= 0) return 0;
  const valueCm = toCentimeters(value, unitName);
  const valueM = valueCm / 100; // Convert cm to meters
  return (valueM / distanceMeters) * 1000;
}


