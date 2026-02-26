import { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const LINE_COLOR = '#818cf8';

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'rgba(15, 15, 35, 0.92)',
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: 10,
      padding: '0.65rem 0.9rem',
      fontSize: '0.82rem',
      fontFamily: 'Inter, sans-serif',
      color: '#e2e8f0',
      boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
    }}>
      <p style={{ margin: '0 0 0.4rem', fontWeight: 700, color: '#fff' }}>{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ margin: '0.15rem 0', color: p.stroke }}>
          {p.name}: <strong>{typeof p.value === 'number' ? p.value.toLocaleString() : p.value}</strong>
        </p>
      ))}
    </div>
  );
}

export default function MetricVsTimeChart({ data, metric = 'value', timeField = 'date' }) {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  if (!data?.length) return null;

  const chartContent = (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart
        data={data}
        margin={{ top: 8, right: 16, left: 0, bottom: 24 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" vertical={false} />
        <XAxis
          dataKey={timeField}
          tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11 }}
          axisLine={{ stroke: 'rgba(255,255,255,0.12)' }}
          tickLine={false}
          tickFormatter={(v) => {
            if (typeof v === 'string' && v.length > 10) {
              try {
                const d = new Date(v);
                return isNaN(d.getTime()) ? v.slice(0, 10) : d.toLocaleDateString([], { month: 'short', day: 'numeric', year: '2-digit' });
              } catch {
                return v.slice(0, 10);
              }
            }
            return v;
          }}
        />
        <YAxis
          tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={55}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
        <Line type="monotone" dataKey="value" name={metric} stroke={LINE_COLOR} strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );

  const handleDownload = () => {
    const canvas = document.querySelector('.metric-vs-time-chart canvas');
    if (canvas) {
      const link = document.createElement('a');
      link.download = `chart-${metric}-vs-time.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } else {
      const container = document.querySelector('.metric-vs-time-chart .recharts-responsive-container');
      if (container && typeof window.html2canvas === 'undefined') {
        const svg = container.querySelector('svg');
        if (svg) {
          const svgData = new XMLSerializer().serializeToString(svg);
          const blob = new Blob([svgData], { type: 'image/svg+xml' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `chart-${metric}-vs-time.svg`;
          a.click();
          URL.revokeObjectURL(url);
        }
      }
    }
  };

  return (
    <div className="metric-vs-time-chart">
      <p className="metric-vs-time-label">{metric} vs time</p>
      <div role="button" tabIndex={0} className="metric-vs-time-click-wrap" onClick={() => setLightboxOpen(true)} onKeyDown={(e) => e.key === 'Enter' && setLightboxOpen(true)}>
        {chartContent}
      </div>
      <div className="metric-vs-time-actions">
        <button type="button" className="metric-vs-time-download-btn" onClick={(e) => { e.stopPropagation(); handleDownload(); }}>
          Download
        </button>
      </div>
      {lightboxOpen && (
        <div className="metric-vs-time-lightbox" onClick={() => setLightboxOpen(false)} role="dialog" aria-modal="true">
          <div className="metric-vs-time-lightbox-inner" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="metric-vs-time-close" onClick={() => setLightboxOpen(false)} aria-label="Close">×</button>
            <div style={{ width: '90vw', maxWidth: 800, height: 400 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" vertical={false} />
                  <XAxis dataKey={timeField} tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.12)' }} tickLine={false} />
                  <YAxis tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }} axisLine={false} tickLine={false} width={55} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="value" name={metric} stroke={LINE_COLOR} strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <button type="button" className="metric-vs-time-download-btn" onClick={handleDownload}>Download PNG/SVG</button>
          </div>
        </div>
      )}
    </div>
  );
}
