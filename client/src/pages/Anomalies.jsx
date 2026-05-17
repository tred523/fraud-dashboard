import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fetchAnomalies } from '../api';

const TYPE_META = {
  IP_SHARING:               { label: 'IP Sharing',           icon: '🌐', color: '#60a5fa' },
  FONT_HASH_CLUSTER:        { label: 'Font Hash Cluster',    icon: '🔤', color: '#c084fc' },
  WEBGL_CLUSTER:            { label: 'WebGL Cluster',        icon: '🖥️', color: '#34d399' },
  RAPID_IP_CHANGE:          { label: 'Rapid IP Change',      icon: '⚡', color: '#f87171' },
  VM_MACINTEL_CONTRADICTION:{ label: 'VM/MacIntel Contradiction', icon: '⚠️', color: '#fb923c' },
  ANTI_DETECT_CLUSTER:      { label: 'Anti-Detect Cluster',  icon: '🎭', color: '#fbbf24' },
  PAYMENT_SHARING:          { label: 'Payment Sharing',      icon: '💳', color: '#f472b6' },
};

export default function Anomalies() {
  const [anomalies, setAnomalies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnomalies()
      .then(setAnomalies)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">Detecting anomalies…</div>;

  // Group by type
  const grouped = anomalies.reduce((acc, a) => {
    (acc[a.type] = acc[a.type] || []).push(a);
    return acc;
  }, {});

  const typeOrder = ['RAPID_IP_CHANGE', 'VM_MACINTEL_CONTRADICTION', 'ANTI_DETECT_CLUSTER', 'PAYMENT_SHARING', 'IP_SHARING', 'FONT_HASH_CLUSTER', 'WEBGL_CLUSTER'];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Anomalies</h1>
          <p className="page-subtitle">{anomalies.length} cross-visitor pattern{anomalies.length !== 1 ? 's' : ''} detected</p>
        </div>
      </div>

      {anomalies.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">✅</div>
          <div className="empty-text">No anomalies detected in current dataset.</div>
        </div>
      ) : (
        typeOrder
          .filter(t => grouped[t])
          .map(type => {
            const meta = TYPE_META[type] || { label: type, icon: '•', color: 'var(--text2)' };
            const items = grouped[type];
            return (
              <div key={type} className="anomaly-group">
                <div className="anomaly-g-title">
                  <span>{meta.icon}</span>
                  <span style={{ color: meta.color }}>{meta.label}</span>
                  <span style={{
                    fontSize: 11, padding: '1px 7px', borderRadius: 10,
                    background: 'var(--border2)', color: 'var(--text3)',
                  }}>
                    {items.length}
                  </span>
                </div>

                {items.map((a, i) => (
                  <div key={i} className={`anomaly-card anomaly-card-${a.severity === 'HIGH' ? 'high' : a.severity === 'MEDIUM' ? 'medium' : 'low'}`}>
                    <div className="anomaly-card-top">
                      <div className="anomaly-title">{a.description}</div>
                      <span className={`badge badge-sev-${a.severity === 'HIGH' ? 'high' : 'medium'}`} style={{ flexShrink: 0 }}>
                        {a.severity}
                      </span>
                    </div>

                    <div className="anomaly-detail">{a.detail}</div>

                    {a.shared_value && a.type !== 'RAPID_IP_CHANGE' && (
                      <div className="anomaly-value">
                        <span style={{ color: 'var(--text4)', marginRight: 5 }}>Shared value:</span>
                        {a.shared_value}
                      </div>
                    )}

                    {a.visitor_ids?.length > 0 && (
                      <div className="anomaly-visitors">
                        <span style={{ fontSize: 11, color: 'var(--text4)', alignSelf: 'center' }}>Visitors:</span>
                        {a.visitor_ids.map(vid => (
                          <Link key={vid} to={`/visitor/${vid}`} className="visitor-chip">
                            {vid.substring(0, 14)}…
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            );
          })
      )}
    </div>
  );
}
