import { NavLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import UploadModal from './UploadModal';

const NAV = [
  { to: '/',          icon: '◈', label: 'Overview' },
  { to: '/accounts',  icon: '👤', label: 'Accounts' },
  { to: '/anomalies', icon: '⚡', label: 'Anomalies' },
  { to: '/graph',     icon: '⬡', label: 'Graph' },
  { to: '/clusters',  icon: '◉', label: 'Clusters' },
  { to: '/api-docs',  icon: '⟨⟩', label: 'API Docs' },
];

export default function Sidebar() {
  const [showUpload, setShowUpload] = useState(false);
  const navigate = useNavigate();

  const clientName = localStorage.getItem('fraudshield_client_name') || '';
  const isAdmin = localStorage.getItem('fraudshield_is_admin') === 'true'
    || !!localStorage.getItem('fraudshield_admin_key');

  function logout() {
    localStorage.removeItem('fraudshield_api_key');
    localStorage.removeItem('fraudshield_client_name');
    localStorage.removeItem('fraudshield_is_admin');
    navigate('/login', { replace: true });
  }

  return (
    <>
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">FS</div>
          <div className="sidebar-logo-wrap">
            <span className="sidebar-logo-name">FraudShield</span>
            <span className="sidebar-logo-sub">{clientName || 'Detection Dashboard'}</span>
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

          {isAdmin && (
            <>
              <div className="nav-section" style={{ marginTop: 10 }}>Admin</div>
              <NavLink
                to="/admin"
                className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              >
                <span className="nav-icon">⚙</span>
                Clients
              </NavLink>
            </>
          )}
        </nav>

        <div className="sidebar-bottom" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setShowUpload(true)}>
            ↑ Import Events
          </button>
          <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center', fontSize: 12, color: 'var(--text3)' }} onClick={logout}>
            Sign Out
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
