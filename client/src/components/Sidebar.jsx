import { NavLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import UploadModal from './UploadModal';

function ShieldIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L4 5.5V11c0 5.25 3.5 9.74 8 11 4.5-1.26 8-5.75 8-11V5.5L12 2z"
        fill="url(#sbShieldGrad)" opacity="0.95" />
      <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <defs>
        <linearGradient id="sbShieldGrad" x1="4" y1="2" x2="20" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
    </svg>
  );
}

const NAV = [
  { to: '/',          icon: '⊟', label: 'Overview' },
  { to: '/accounts',  icon: '◯', label: 'Accounts' },
  { to: '/anomalies', icon: '△', label: 'Anomalies' },
  { to: '/graph',     icon: '⬡', label: 'Graph' },
  { to: '/clusters',  icon: '◉', label: 'Clusters' },
  { to: '/api-docs',  icon: '⟨⟩', label: 'API Docs' },
];

function NavIcon({ icon }) {
  const svgIcons = {
    '⊟': (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
    ),
    '◯': (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
      </svg>
    ),
    '△': (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    ),
    '⬡': (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
      </svg>
    ),
    '◉': (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/>
      </svg>
    ),
    '⟨⟩': (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
      </svg>
    ),
    '⚙': (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
        <path d="M12 2v2M12 20v2M2 12h2M20 12h2"/>
      </svg>
    ),
  };
  return <span className="nav-icon">{svgIcons[icon] || icon}</span>;
}

export default function Sidebar() {
  const [showUpload, setShowUpload] = useState(false);
  const navigate = useNavigate();

  const clientName = localStorage.getItem('fraudshield_client_name') || '';
  const apiKey = localStorage.getItem('fraudshield_api_key') || '';
  const isAdmin = localStorage.getItem('fraudshield_is_admin') === 'true'
    || !!localStorage.getItem('fraudshield_admin_key');

  const truncatedKey = apiKey.length > 16 ? `${apiKey.slice(0, 12)}…` : apiKey;
  const initials = clientName ? clientName.slice(0, 2).toUpperCase() : 'FS';

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
          <div className="sidebar-logo-icon">
            <ShieldIcon size={17} />
          </div>
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
              <NavIcon icon={icon} />
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
                <NavIcon icon="⚙" />
                Clients
              </NavLink>
            </>
          )}
        </nav>

        <div className="sidebar-bottom">
          {clientName && (
            <div className="sidebar-client-info">
              <div className="sidebar-client-avatar">{initials}</div>
              <div style={{ minWidth: 0 }}>
                <div className="sidebar-client-name">{clientName}</div>
                {truncatedKey && (
                  <div className="sidebar-client-key" title={apiKey}>{truncatedKey}</div>
                )}
              </div>
            </div>
          )}
          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginBottom: 6 }} onClick={() => setShowUpload(true)}>
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
