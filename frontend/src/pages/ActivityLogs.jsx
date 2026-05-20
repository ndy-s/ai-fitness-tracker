import { useState, useEffect } from 'react';
import axios from 'axios';
import { Activity, Trash2, Edit, Dumbbell, Settings, Clock, Bot, MessageSquare, Filter, ListChecks } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL;
if (!API_URL) throw new Error("VITE_API_URL is missing in environment variables");

export default function ActivityLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState('');

  const fetchLogs = async () => {
    try {
      const res = await axios.get(`${API_URL}/activity`);
      setLogs(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 10000);
    return () => clearInterval(interval);
  }, []);

  const getIconForAction = (action) => {
    switch (action) {
      case 'FOOD_LOGGED': return <Activity size={18} color="var(--success)" />;
      case 'FOOD_DELETED': return <Trash2 size={18} color="var(--danger)" />;
      case 'FOOD_EDITED': return <Edit size={18} color="var(--accent)" />;
      case 'PLAN_UPDATED': return <Dumbbell size={18} color="var(--accent)" />;
      case 'CONFIG_UPDATED': return <Settings size={18} color="var(--text-secondary)" />;
      case 'AI_SESSION_STARTED': return <Bot size={18} color="var(--accent)" />;
      case 'AI_CHAT_MESSAGE': return <MessageSquare size={18} color="var(--accent)" />;
      default: return <Activity size={18} color="var(--text-muted)" />;
    }
  };

  const getActionColor = (action) => {
    if (action.startsWith('FOOD_LOGGED')) return 'var(--success)';
    if (action.startsWith('FOOD_DELETED')) return 'var(--danger)';
    if (action.startsWith('AI_')) return 'var(--accent)';
    if (action.startsWith('PLAN_')) return 'var(--accent)';
    return 'var(--text-muted)';
  };

  const formatDetails = (detailsStr) => {
    try {
      const parsed = JSON.parse(detailsStr);
      let sourceBadge = '';
      
      if (parsed.source) {
        let bg = 'var(--bg-secondary)';
        let color = 'var(--text-secondary)';
        let text = parsed.source;
        
        if (parsed.source === 'whatsapp_bot') { bg = 'rgba(16, 185, 129, 0.08)'; color = '#166534'; text = 'WhatsApp'; }
        if (parsed.source === 'web_agent') { bg = 'rgba(99, 102, 241, 0.08)'; color = '#3730a3'; text = 'Web AI'; }
        if (parsed.source === 'web_ui') { bg = 'rgba(107, 114, 128, 0.08)'; color = '#4b5563'; text = 'Web UI'; }
        
        sourceBadge = <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 10, background: bg, color: color, marginLeft: 8, fontWeight: 600, letterSpacing: '0.2px' }}>{text}</span>;
      }
      
      let summary = '';
      if (parsed.description) summary = `${parsed.description} (${parsed.calories} kcal)`;
      else if (parsed.key) summary = `Changed config: ${parsed.key}`;
      else if (parsed.message) summary = `"${parsed.message}"`;
      else if (parsed.title) summary = `Created new session: ${parsed.title}`;
      else if (parsed.action) summary = `Action: ${parsed.action}`;
      else summary = `ID: ${parsed.id || 'N/A'}`;

      return <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>{summary} {sourceBadge}</div>;
    } catch (e) {
      return detailsStr;
    }
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const filteredLogs = logs.filter(log => {
    if (dateFilter) {
      const logDate = new Date(log.timestamp).toISOString().split('T')[0];
      if (logDate !== dateFilter) return false;
    }
    if (filter === 'ALL') return true;
    if (filter === 'FOOD' && log.action.startsWith('FOOD_')) return true;
    if (filter === 'PLANS' && log.action.startsWith('PLAN_')) return true;
    if (filter === 'SYSTEM' && log.action === 'CONFIG_UPDATED') return true;
    if (filter === 'AI' && log.action.startsWith('AI_')) return true;
    return false;
  });

  const filterButtons = [
    { key: 'ALL', label: 'All Activity', count: logs.length },
    { key: 'FOOD', label: 'Food', count: logs.filter(l => l.action.startsWith('FOOD_')).length },
    { key: 'PLANS', label: 'Plans', count: logs.filter(l => l.action.startsWith('PLAN_')).length },
    { key: 'SYSTEM', label: 'System', count: logs.filter(l => l.action === 'CONFIG_UPDATED').length },
    { key: 'AI', label: 'AI Chat', count: logs.filter(l => l.action.startsWith('AI_')).length },
  ];

  return (
    <div>
      <div className="page-header">
        <h1>Activity Logs</h1>
        <div className="subtitle" style={{ marginBottom: 0 }}>System-wide audit trail of all food logging, plan changes, and config updates.</div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 22, padding: '14px 20px' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Filter size={14} color="var(--text-muted)" style={{ marginRight: 4 }} />
          {filterButtons.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              style={{
                padding: '6px 16px',
                borderRadius: 20,
                border: 'none',
                background: filter === f.key ? 'var(--accent)' : 'var(--bg-primary)',
                color: filter === f.key ? '#fff' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
                boxShadow: filter === f.key ? '0 2px 8px rgba(99, 102, 241, 0.25)' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              {f.label}
              <span style={{
                fontSize: 11, fontWeight: 700,
                padding: '1px 6px', borderRadius: 8,
                background: filter === f.key ? 'rgba(255,255,255,0.2)' : 'var(--bg-secondary)',
                color: filter === f.key ? 'rgba(255,255,255,0.9)' : 'var(--text-muted)'
              }}>
                {f.count}
              </span>
            </button>
          ))}
          <div style={{ width: 1, height: 24, background: 'var(--border-color)', margin: '0 8px' }}></div>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            style={{
              padding: '6px 14px',
              borderRadius: 10,
              border: '1px solid var(--border-color)',
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontSize: 13,
              outline: 'none',
              fontFamily: 'inherit',
              transition: 'border-color 0.2s'
            }}
          />
          {dateFilter && (
            <button 
              onClick={() => setDateFilter('')}
              style={{
                background: 'var(--danger-bg)', border: 'none', color: 'var(--danger)',
                cursor: 'pointer', fontSize: 12, fontWeight: 600, padding: '5px 12px',
                borderRadius: 8, transition: 'all 0.2s'
              }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Logs List */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading && logs.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
            <div style={{
              width: 48, height: 48, borderRadius: 14, margin: '0 auto 14px',
              background: 'var(--accent-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <ListChecks size={22} color="var(--accent)" style={{ animation: 'pulse 1.5s infinite' }} />
            </div>
            Loading logs...
          </div>
        ) : filteredLogs.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.5 }}>📋</div>
            {filter !== 'ALL' || dateFilter ? 'No logs match your filters.' : 'No activity recorded yet.'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {filteredLogs.map((log, index) => (
              <div key={log.id} style={{
                display: 'flex',
                gap: 16,
                padding: '18px 24px',
                borderBottom: index < filteredLogs.length - 1 ? '1px solid var(--border-color)' : 'none',
                background: 'var(--card-bg)',
                alignItems: 'center',
                transition: 'background 0.2s'
              }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-primary)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--card-bg)'}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: 12, background: 'var(--bg-primary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  border: '1px solid var(--border-color)'
                }}>
                  {getIconForAction(log.action)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 3, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {log.action.replace(/_/g, ' ')}
                    <span style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: getActionColor(log.action), flexShrink: 0
                    }}></span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    {formatDetails(log.details)}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  <Clock size={12} />
                  {formatDate(log.timestamp)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
