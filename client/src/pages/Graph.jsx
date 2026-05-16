import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import ForceGraph2D from 'react-force-graph-2d';
import { fetchGraph } from '../api';

const RISK_COLORS = {
  'HIGH RISK':  '#ef4444',
  'SUSPICIOUS': '#f97316',
  'LOW':        '#eab308',
  'CLEAN':      '#22c55e',
};

const LINK_COLORS = {
  'IP':      '#3b82f6',
  'Font':    '#a855f7',
  'GPU':     '#06b6d4',
  'Payment': '#22c55e',
};

const FILTER_OPTIONS = [
  { label: 'All',     value: 'All',     color: '#94a3b8' },
  { label: 'IP',      value: 'IP',      color: LINK_COLORS.IP },
  { label: 'Font',    value: 'Font',    color: LINK_COLORS.Font },
  { label: 'GPU',     value: 'GPU',     color: LINK_COLORS.GPU },
  { label: 'Payment', value: 'Payment', color: LINK_COLORS.Payment },
];

export default function Graph() {
  const [rawData, setRawData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const containerRef = useRef(null);
  const fgRef = useRef(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const navigate = useNavigate();

  useEffect(() => {
    fetchGraph()
      .then(setRawData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        if (width > 0 && height > 0) setCanvasSize({ width, height });
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [rawData]);

  // Spread nodes out more on init
  useEffect(() => {
    if (fgRef.current && rawData) {
      fgRef.current.d3Force('charge').strength(-200);
      fgRef.current.d3Force('link').distance(80);
    }
  }, [rawData]);

  const graphData = useMemo(() => {
    if (!rawData) return { nodes: [], links: [] };
    return { nodes: rawData.nodes, links: rawData.links };
  }, [rawData]);

  const linkVisibility = useCallback(
    (link) => filter === 'All' || link.type === filter,
    [filter]
  );

  const nodeColor     = useCallback((node) => RISK_COLORS[node.riskLevel] || '#64748b', []);
  const nodeVal       = useCallback((node) => Math.max(1, Math.min(node.eventCount, 30)), []);
  const nodeLabel     = useCallback((node) => `${node.id}  |  ${node.riskLevel}  |  ${node.eventCount} events`, []);
  const linkColor     = useCallback((link) => LINK_COLORS[link.type] || '#64748b', []);

  const linkCanvasObject = useCallback((link, ctx, globalScale) => {
    const start = link.source;
    const end   = link.target;
    if (typeof start !== 'object' || typeof end !== 'object') return;
    if (globalScale < 1.0) return;

    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;
    const fontSize = 9 / globalScale;

    ctx.save();
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const tw = ctx.measureText(link.type).width;
    ctx.fillStyle = 'rgba(15,17,23,0.85)';
    ctx.fillRect(midX - tw / 2 - 2, midY - fontSize / 2 - 1.5, tw + 4, fontSize + 3);

    ctx.fillStyle = LINK_COLORS[link.type] || '#94a3b8';
    ctx.fillText(link.type, midX, midY);
    ctx.restore();
  }, []);

  const handleNodeClick = useCallback(
    (node) => navigate(`/visitor/${encodeURIComponent(node.id)}`),
    [navigate]
  );

  if (loading) return <div className="loading">Building graph…</div>;

  const visibleLinkCount = filter === 'All'
    ? graphData.links.length
    : graphData.links.filter(l => l.type === filter).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', padding: '28px 32px 20px', gap: 14, boxSizing: 'border-box', overflow: 'hidden' }}>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div>
          <h1 className="page-title">Account Relationship Graph</h1>
          <p className="page-subtitle">Visitor connections via shared IP, font fingerprint, GPU, and payment methods</p>
        </div>
      </div>

      {/* Filter controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 500 }}>Connections:</span>
        {FILTER_OPTIONS.map(({ label, value, color }) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            style={{
              padding: '5px 14px',
              borderRadius: 6,
              border: `1px solid ${filter === value ? color : 'var(--border)'}`,
              background: filter === value ? `${color}22` : 'transparent',
              color: filter === value ? color : 'var(--text2)',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 500,
              transition: 'border-color .15s, background .15s, color .15s',
            }}
          >
            {label}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text3)' }}>
          {graphData.nodes.length} visitors · {visibleLinkCount} connections
        </span>
      </div>

      {/* Main area: graph + legend */}
      <div style={{ display: 'flex', gap: 14, flex: 1, minHeight: 0 }}>
        {/* Graph canvas */}
        <div
          ref={containerRef}
          className="card"
          style={{ flex: 1, minWidth: 0, overflow: 'hidden', padding: 0 }}
        >
          {graphData.nodes.length === 0 ? (
            <div className="empty-state" style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div className="empty-text">No visitor data available.</div>
            </div>
          ) : (
            <ForceGraph2D
              ref={fgRef}
              graphData={graphData}
              width={canvasSize.width}
              height={canvasSize.height}
              backgroundColor="#1a1d27"
              nodeColor={nodeColor}
              nodeVal={nodeVal}
              nodeLabel={nodeLabel}
              onNodeClick={handleNodeClick}
              linkColor={linkColor}
              linkVisibility={linkVisibility}
              linkCanvasObject={linkCanvasObject}
              linkCanvasObjectMode="after"
              nodeRelSize={4}
              linkWidth={1.5}
              linkOpacity={0.7}
              nodeOpacity={0.95}
              enableZoomInteraction
              enablePanInteraction
              enableNodeDrag
            />
          )}
        </div>

        {/* Legend */}
        <div style={{ width: 188, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="card" style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text4)', textTransform: 'uppercase', letterSpacing: '.09em', marginBottom: 10 }}>
              Node Risk
            </div>
            {Object.entries(RISK_COLORS).map(([level, color]) => (
              <div key={level} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
                <div style={{ width: 11, height: 11, borderRadius: '50%', background: color, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: 'var(--text2)' }}>{level}</span>
              </div>
            ))}
          </div>

          <div className="card" style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text4)', textTransform: 'uppercase', letterSpacing: '.09em', marginBottom: 10 }}>
              Edge Types
            </div>
            {Object.entries(LINK_COLORS).map(([type, color]) => (
              <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
                <div style={{ width: 22, height: 2, background: color, flexShrink: 0, borderRadius: 1 }} />
                <span style={{ fontSize: 12, color: 'var(--text2)' }}>
                  {type === 'IP' ? 'IP Address' : type === 'Font' ? 'Font Hash' : type === 'GPU' ? 'GPU / WebGL' : 'Payment Method'}
                </span>
              </div>
            ))}
          </div>

          <div className="card" style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text4)', textTransform: 'uppercase', letterSpacing: '.09em', marginBottom: 8 }}>
              Controls
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.75 }}>
              Click node → visitor detail<br />
              Drag nodes to reposition<br />
              Scroll to zoom in / out<br />
              Click &amp; drag canvas to pan<br />
              Node size = event count
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
