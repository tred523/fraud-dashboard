import { NavLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import UploadModal from './UploadModal';

const NAV = [
  { to: '/',          icon: '◈', label: 'Overview' },
  { to: '/anomalies', icon: '⚡', label: 'Anomalies' },
  { to: '/clusters',  icon: '◉', label: 'Clusters' },
];

export default function Sidebar() {
  const [showUpload, setShowUpload] = useState(false);
  const navigate = useNavigate();

  return (
    <>
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">FS</div>
          <div className="sidebar-logo-wrap">
            <span className="sidebar-logo-name">FraudShield</span>
            <span className="sidebar-logo-sub">Detection Dashboard</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section">Navigation</div>
          {NAV.map(({ to, icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            >
              <span className="nav-icon">{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setShowUpload(true)}>
            ↑ Import Events
          </button>
        </div>
      </aside>

      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onSuccess={() => { setShowUpload(false); navigate('/'); window.location.reload(); }}
        />
      )}
    </>
  );
}
