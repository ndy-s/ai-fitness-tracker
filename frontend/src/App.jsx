import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Clock, ListChecks, Calendar, MessageSquare, Dumbbell } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Management from './pages/Management';
import History from './pages/History';
import ActivityLogs from './pages/ActivityLogs';
import AgentOverlay from './components/AgentOverlay';

function Sidebar() {
  const location = useLocation();

  const links = [
    { path: '/', label: 'Today', icon: <LayoutDashboard size={18} /> },
    { path: '/history', label: 'History', icon: <Clock size={18} /> },
    { path: '/activity-logs', label: 'Activity Logs', icon: <ListChecks size={18} /> },
    { path: '/management', label: 'Management', icon: <Calendar size={18} /> },
  ];

  return (
    <div className="sidebar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 10px', marginBottom: 6, position: 'relative' }}>
        <div style={{
          width: 34, height: 34, borderRadius: 10, 
          background: 'linear-gradient(135deg, #6366f1, #818cf8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(99, 102, 241, 0.4)'
        }}>
          <Dumbbell size={18} color="#fff" />
        </div>
        <div>
          <h1 style={{ fontSize: 18, marginBottom: 0 }}>AI Fitness Tracker</h1>
        </div>
      </div>
      <div className="subtitle" style={{ marginBottom: 32, paddingLeft: 10, position: 'relative' }}>Training & Nutrition</div>

      <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '1.5px', padding: '0 14px', marginBottom: 10, position: 'relative' }}>
        Menu
      </div>
      
      <nav style={{ position: 'relative' }}>
        {links.map(link => (
          <Link key={link.path} to={link.path} style={{ textDecoration: 'none' }}>
            <button className={`nav-btn ${location.pathname === link.path ? 'active' : ''}`}>
              {link.icon} <span>{link.label}</span>
            </button>
          </Link>
        ))}
      </nav>
    </div>
  );
}

function App() {
  return (
    <Router>
      <div className="app-container">
        <Sidebar />
        <div className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/history" element={<History />} />
            <Route path="/activity-logs" element={<ActivityLogs />} />
            <Route path="/management" element={<Management />} />
          </Routes>
        </div>
        <AgentOverlay />
      </div>
    </Router>
  );
}

export default App;
