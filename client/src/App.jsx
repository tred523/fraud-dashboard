import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Overview from './pages/Overview';
import VisitorDetail from './pages/VisitorDetail';
import Anomalies from './pages/Anomalies';
import Clusters from './pages/Clusters';
import Graph from './pages/Graph';
import ApiDocs from './pages/ApiDocs';

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-layout">
        <Sidebar />
        <main className="main-content">
          <Routes>
            <Route path="/"               element={<Overview />} />
            <Route path="/visitor/:id"    element={<VisitorDetail />} />
            <Route path="/anomalies"      element={<Anomalies />} />
            <Route path="/graph"          element={<Graph />} />
            <Route path="/clusters"       element={<Clusters />} />
            <Route path="/api-docs"        element={<ApiDocs />} />
            <Route path="*"               element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
