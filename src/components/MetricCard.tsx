/**
 * MetricCard — single metric display cell used in the ResultsModal grid.
 *
 * Props:
 *   label     — metric name (translated string)
 *   value     — primary display value (e.g. "3.42 cm")
 *   subValue  — optional secondary line (e.g. "1.14 mrad")
 *   highlight — when true, draws an accent-coloured border and value colour
 */

export function MetricCard({ label, value, subValue, highlight }: {
  label: string;
  value: string;
  subValue?: string;
  highlight?: boolean;
}) {
  return (
    <div className="cep-metric-card" style={{
      background: '#2b2d31',
      border: highlight ? '1px solid #5865f2' : '1px solid #3f4147',
      borderRadius: 10,
      padding: '12px 14px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      minHeight: 70,
    }}>
      {/* Metric label */}
      <div style={{ fontSize: '0.72rem', color: '#949ba4', fontWeight: 600, marginBottom: 4 }}>
        {label}
      </div>

      {/* Primary value (e.g. cm) */}
      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: highlight ? '#5865f2' : '#dbdee1' }}>
        {value}
      </div>

      {/* Secondary value (e.g. mrad) */}
      {subValue && (
        <div style={{ fontSize: '0.82rem', color: '#949ba4', marginTop: 2, fontWeight: 500 }}>
          {subValue}
        </div>
      )}
    </div>
  );
}
