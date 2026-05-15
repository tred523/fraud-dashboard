import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fetchClusters } from '../api';
import RiskBadge from '../components/RiskBadge';

function worstLevel(levels) {
  const s = levels || '';
  if (s.includes('HIGH RISK'))  return 'HIGH RISK';
  if (s.includes('SUSPICIOUS')) return 'SUSPICIOUS';
  if (s.includes('LOW'))        return 'LOW';
  return 'CLEAN';
}

function ClusterTable({ rows, valueLabel }) {
  if (!rows || rows.length === 0)
    return <div className="empty-state" style={{ padding: '32px 0' }}><div className="empty-text">No clusters found.</div></div>;

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>{valueLabel}</th>
            <th>Visitors</th>
            <th>Events</th>
            <th>Worst Risk</th>
            <th>Affected Visitors</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td>
                <span className="mono" style={{ fontSize: 11, color: 'var(--text2)', wordBreak: 'break-all', display: 'block', maxWidth: 380 }}
                  title={r.value}>
                  {r.value && r.value.length > 80 ? r.value.substring(0, 80) + '…' : r.value}
                </span>
              </td>
              <td style={{ fontWeight: 600, color: r.visitor_count > 1 ? 'var(--orange)' : 'var(--text2)' }}>
                {r.visitor_count}
              </td>
              <td style={{ color: 'var(--text3)' }}>{r.event_count}</td>
              <td><RiskBadge level={worstLevel(r.risk_levels)} /></td>
              <td>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {r.visitor_ids.slice(0, 4).map(vid => (
                    <Link key={vid} to={`/visitor/${vid}`} className="visitor-chip">
                      {vid.substring(0, 12)}…
                    </Link>
                  ))}
                  {r.visitor_ids.length > 4 && (
                    <span style={{ fontSize: 11, color: 'var(--text3)', alignSelf: 'center' }}>
                      +{r.visitor_ids.length - 4} more
                    </span>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Clusters() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchClusters()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">Building clusters…</div>;
  if (!data)   return null;

  const sections = [
    { key: 'ip',        title: 'IP Address Clusters',   tag: 'ip',        label: 'IP Address',     icon: '🌐', rows: data.ip },
    { key: 'font_hash', title: 'Font Hash Clusters',    tag: 'font-hash', label: 'Font Hash (MD5)', icon: '🔤', rows: data.font_hash },
    { key: 'webgl',     title: 'WebGL Renderer Clusters', tag: 'webgl',   label: 'WebGL Renderer', icon: '🖥️', rows: data.webgl },
  ];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Clusters</h1>
          <p className="page-subtitle">Visitors grouped by shared device attributes</p>
        </div>
      </div>

      {sections.map(({ key, title, tag, label, icon, rows }) => (
        <div key={key} className="cluster-section">
          <div className="cluster-title">
            <span>{icon}</span>
            {title}
            <span className="cluster-tag">{tag}</span>
            <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 400, marginLeft: 4 }}>
              {rows.length} cluster{rows.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="card">
            <ClusterTable rows={rows} valueLabel={label} />
          </div>
        </div>
      ))}
    </div>
  );
}
