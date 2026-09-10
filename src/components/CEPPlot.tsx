/**
 * CEPPlot — pure SVG scatter plot component.
 *
 * Renders all analysis layers as SVG elements. No external charting library.
 * The SVG carries id="cep-functional-svg" so ResultsModal can clone it for PNG export.
 *
 * All layer visibility is controlled by props (showGridlines, showCEP, etc.)
 * so the SettingsPanel can toggle them live.
 *
 * RTL support: legend mirrors to the right side when isRTL is true.
 */

import { C } from '../lib/theme';

interface Point { x: number; y: number; }

interface CEPPlotProps {
  metrics: any;
  t: (key: string) => string;
  isRTL: boolean;
  showGridlines?: boolean;
  showLabels?: boolean;
  showCEP?: boolean;
  showBlockingRadius?: boolean;
  showES?: boolean;
  showMeanOrigin?: boolean;
}

export function CEPPlot({
  metrics, t, isRTL,
  showGridlines = true,
  showLabels = true,
  showCEP = true,
  showBlockingRadius = true,
  showES = true,
  showMeanOrigin = true,
}: CEPPlotProps) {
  const points: Point[] = metrics.realPoints || [];

  // Find the shot furthest from the mean (used to draw the blocking-radius vector)
  let furthestShot: Point | null = null;
  let maxDistFromMean = -1;
  points.forEach((p) => {
    const dist = Math.hypot(p.x - metrics.meanX, p.y - metrics.meanY);
    if (dist > maxDistFromMean) { maxDistFromMean = dist; furthestShot = p; }
  });

  // Find the extreme-spread pair (max pairwise distance)
  let esPair: [Point, Point] | null = null;
  let maxEsDist = -1;
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const dist = Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y);
      if (dist > maxEsDist) { maxEsDist = dist; esPair = [points[i], points[j]]; }
    }
  }

  // maxR: largest radial distance that must fit on the plot, with 35% padding
  const maxR = Math.max(
    metrics.cep50,
    metrics.blockingRadius,
    maxEsDist / 2,
    ...points.map((p) => Math.hypot(p.x, p.y)),
    0.001 // floor prevents division-by-zero when all points overlap
  ) * 1.35;

  const svgSize = 400;
  const cx = svgSize / 2;
  const cy = svgSize / 2;
  const chartRadius = svgSize / 2 - 45; // 45 px margin for axis labels

  // Coordinate transform helpers
  const sc = (r: number) => (r / maxR) * chartRadius;                   // real radius → SVG px
  const px = (x: number) => cx + (x / maxR) * chartRadius;              // real X → SVG x
  const py = (y: number) => cy - (y / maxR) * chartRadius;              // real Y → SVG y (inverted)

  // Build dynamic legend — only include items that are currently visible
  const legendItems: { color: string; text: string }[] = [];
  if (showMeanOrigin) legendItems.push({ color: C.red,     text: t('results.legend_origin') });
  legendItems.push(             { color: C.green,   text: t('results.legend_shots') });
  if (showMeanOrigin) legendItems.push({ color: '#ffeb3b', text: t('results.legend_mean') });
  if (showES && esPair) legendItems.push({ color: '#ffb300', text: t('results.legend_es') });
  if (showBlockingRadius && metrics.blockingRadius > 0)
    legendItems.push({ color: '#f44336', text: t('results.legend_blocking') });
  if (showCEP) legendItems.push({ color: C.accent,  text: t('results.legend_cep') });

  return (
    <div className="cep-plot-container" style={{
      background: C.bg, borderRadius: 12, border: `1px solid ${C.border}`,
      overflow: 'hidden', flexShrink: 0, boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
    }}>
      {/* Plot title bar */}
      <div style={{
        fontSize: '0.72rem', fontWeight: 700, color: C.muted, padding: '8px 12px',
        borderBottom: `1px solid ${C.border}`, textTransform: 'uppercase', letterSpacing: '0.06em',
      }}>
        {t('results.plot_title')}
      </div>

      <svg
        id="cep-functional-svg"
        viewBox={`0 0 ${svgSize} ${svgSize}`}
        style={{
          display: 'block', width: '100%', height: 'auto', maxWidth: '420px', margin: '0 auto',
          shapeRendering: 'geometricPrecision', textRendering: 'optimizeLegibility',
          background: C.bg,
        }}
      >
        {/* Background grid rings */}
        {showGridlines && (
          <g stroke={C.border} strokeWidth="0.75" strokeDasharray="3,5" fill="none">
            {[0.33, 0.66, 1.0].map((f, i) => (
              <circle key={i} cx={cx} cy={cy} r={sc(maxR * f)} />
            ))}
          </g>
        )}

        {/* Primary axes */}
        <g stroke={C.faint} strokeWidth="1">
          <line x1={25} y1={cy} x2={svgSize - 25} y2={cy} />
          <line x1={cx} y1={25} x2={cx} y2={svgSize - 25} />
        </g>

        {/* Axis scale labels */}
        {showLabels && (
          <g fill={C.faint} fontSize="10" fontFamily="monospace" textAnchor="middle">
            <text x={svgSize - 24} y={cy - 5}>{`+${maxR.toFixed(1)}`}</text>
            <text x={24}           y={cy - 5}>{`-${maxR.toFixed(1)}`}</text>
            <text x={cx + 5}       y={20}       textAnchor="start">{`+${maxR.toFixed(1)}`}</text>
            <text x={cx + 5}       y={svgSize - 12} textAnchor="start">{`-${maxR.toFixed(1)}`}</text>
            <text x={cx}           y={svgSize - 14} fill={C.muted} fontSize="11" fontWeight="700">{metrics.unit}</text>
          </g>
        )}

        {/* Extreme Spread line */}
        {showES && esPair && (
          <line
            x1={px(esPair[0].x)} y1={py(esPair[0].y)}
            x2={px(esPair[1].x)} y2={py(esPair[1].y)}
            stroke="#ffb300" strokeWidth="2" strokeDasharray="2,4" strokeLinecap="round"
          />
        )}

        {/* Blocking Radius circle + vector */}
        {showBlockingRadius && metrics.blockingRadius > 0 && (
          <g>
            <circle
              cx={px(metrics.meanX)} cy={py(metrics.meanY)} r={sc(metrics.blockingRadius)}
              fill="none" stroke="#f44336" strokeWidth="1.75" strokeDasharray="5,4"
            />
            {furthestShot && (
              <line
                x1={px(metrics.meanX)} y1={py(metrics.meanY)}
                x2={px((furthestShot as Point).x)} y2={py((furthestShot as Point).y)}
                stroke="#f44336" strokeWidth="2" strokeLinecap="round"
              />
            )}
          </g>
        )}

        {/* Mean-to-Origin displacement vector */}
        {showMeanOrigin && (
          <line
            x1={px(0)} y1={py(0)} x2={px(metrics.meanX)} y2={py(metrics.meanY)}
            stroke="#4caf50" strokeWidth="2.5" strokeLinecap="round"
          />
        )}

        {/* CEP 50% circle */}
        {showCEP && (
          <g>
            <circle
              cx={cx} cy={cy} r={sc(metrics.cep50)}
              fill="none" stroke={C.accent} strokeWidth="1.75" strokeDasharray="6,4"
            />
            <text x={cx + sc(metrics.cep50) + 4} y={cy - 4} fill={C.accent} fontSize="9" fontWeight="700" fontFamily="system-ui">
              CEP 50%
            </text>
          </g>
        )}

        {/* Origin crosshair */}
        <g stroke={C.red} strokeWidth="1.5" fill="none">
          <circle cx={cx} cy={cy} r={5} strokeWidth="2" />
          <line x1={cx - 10} y1={cy} x2={cx + 10} y2={cy} />
          <line x1={cx} y1={cy - 10} x2={cx} y2={cy + 10} />
        </g>

        {/* Mean point cross */}
        <g stroke="#ffeb3b" strokeWidth="2.5" strokeLinecap="round">
          <line x1={px(metrics.meanX) - 6} y1={py(metrics.meanY) - 6} x2={px(metrics.meanX) + 6} y2={py(metrics.meanY) + 6} />
          <line x1={px(metrics.meanX) + 6} y1={py(metrics.meanY) - 6} x2={px(metrics.meanX) - 6} y2={py(metrics.meanY) + 6} />
        </g>

        {/* Shot dots with index labels — staggered pop-in + hover scale */}
        {points.map((p, i) => {
          const sx = px(p.x), sy = py(p.y);
          return (
            <g
              key={i}
              className="cep-shot-dot"
              style={{
                filter: 'drop-shadow(0px 1.5px 2px rgba(0,0,0,0.4))',
                animation: `cep-dot-pop 0.35s cubic-bezier(0.34,1.56,0.64,1) ${i * 60}ms both`,
              }}
            >
              <circle cx={sx} cy={sy} r={6} fill={C.green} stroke="#ffffff" strokeWidth="1" />
              <text x={sx} y={sy} fill="#000" fontSize="7.5" fontWeight="900" fontFamily="system-ui" textAnchor="middle" dominantBaseline="central">
                {i + 1}
              </text>
            </g>
          );
        })}

        {/* Legend — mirrors to right side in RTL */}
        <g
          transform={isRTL
            ? `translate(${svgSize - 150}, ${svgSize - (legendItems.length * 13 + 15)})`
            : `translate(16, ${svgSize - (legendItems.length * 13 + 15)})`}
          fontSize="9" fontFamily="system-ui" fill={C.muted}
        >
          {legendItems.map((item, idx) => (
            <g key={idx} transform={`translate(0, ${idx * 13})`}>
              <rect x={isRTL ? 122 : 0} y="-7" width="9" height="8" fill={item.color} rx="1.5" />
              <text x={isRTL ? 114 : 14} y="0" textAnchor={isRTL ? 'end' : 'start'} fill={C.text} fontWeight="500">
                {item.text}
              </text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
