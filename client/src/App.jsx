import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Overview from './pages/Overview';
import VisitorDetail from './pages/VisitorDetail';
import Anomalies from './pages/Anomalies';
import Accounts from './pages/Accounts';
import AccountDetail from './pages/AccountDetail';
import Clusters from './pages/Clusters';
import Graph from './pages/Graph';
import ApiDocs from './pages/ApiDocs';
import Login from './pages/Login';
import Admin from './pages/Admin';

function RequireAuth({ children }) {
  const apiKey = localStorage.getItem('fraudshield_api_key');
  const location = useLocation();
  if (!apiKey) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/*" element={
          <RequireAuth>
            <div className="app-layout">
              <Sidebar />
              <main className="main-content">
                <Routes>
                  <Route path="/"                        element={<Overview />} />
                  <Route path="/visitor/:id"             element={<VisitorDetail />} />
                  <Route path="/accounts"                element={<Accounts />} />
                  <Route path="/accounts/:account_id"    element={<AccountDetail />} />
                  <Route path="/anomalies"               element={<Anomalies />} />
                  <Route path="/graph"                   element={<Graph />} />
                  <Route path="/clusters"                element={<Clusters />} />
                  <Route path="/api-docs"                element={<ApiDocs />} />
                  <Route path="/admin"                   element={<Admin />} />
                  <Route path="*"                        element={<Navigate to="/" replace />} />
                </Routes>
              </main>
            </div>
          </RequireAuth>
        } />
      </Routes>
    </BrowserRouter>
  );
}
