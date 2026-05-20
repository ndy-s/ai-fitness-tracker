import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Calendar, ChevronDown, ChevronUp, Flame, Beef, Trash2, TrendingUp } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const API_URL = import.meta.env.VITE_API_URL;
if (!API_URL) throw new Error("VITE_API_URL is missing in environment variables");

const RANGE_OPTIONS = [
  { label: '7D', value: 7 },
  { label: '14D', value: 14 },
  { label: '30D', value: 30 },
  { label: '60D', value: 60 },
  { label: '90D', value: 90 },
];

export default function History() {
  const [history, setHistory] = useState([]);
  const [expandedDay, setExpandedDay] = useState(null);
  const [loading, setLoading] = useState(true);
  const [trendRange, setTrendRange] = useState(30);
  const [deletingId, setDeletingId] = useState(null);

  const fetchHistory = useCallback(async (days) => {
    try {
      const res = await axios.get(`${API_URL}/history?days=${days}`);
      setHistory(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory(trendRange);
  }, [trendRange, fetchHistory]);

  const handleRangeChange = (range) => {
    setTrendRange(range);
    setLoading(true);
  };

  const handleDeleteFood = async (foodId, e) => {
    e.stopPropagation();
    if (deletingId === foodId) {
      try {
        await axios.delete(`${API_URL}/daily/food/${foodId}`);
        await fetchHistory(trendRange);
        setDeletingId(null);
      } catch (err) {
        console.error(err);
      }
    } else {
      setDeletingId(foodId);
      setTimeout(() => setDeletingId(prev => prev === foodId ? null : prev), 3000);
    }
  };

  const toggleDay = (date) => {
    setExpandedDay(expandedDay === date ? null : date);
    setDeletingId(null);
  };

  const formatDate = (dateStr) => {
    const options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
    return new Date(dateStr).toLocaleDateString(undefined, options);
  };

  if (loading && history.length === 0) {
    return (
      <div style={{ padding: 80, textAlign: 'center', color: 'var(--text-muted)' }}>
        <div style={{ 
          width: 56, height: 56, borderRadius: 16, margin: '0 auto 16px',
          background: 'var(--accent-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <TrendingUp size={24} color="var(--accent)" style={{ animation: 'pulse 1.5s infinite' }} />
        </div>
        <div style={{ fontSize: 14, fontWeight: 500 }}>Loading history...</div>
      </div>
    );
  }

  const chartData = [...history].reverse().map(log => ({
    date: new Date(log.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    calories: log.totalCalories,
    protein: log.totalProtein
  }));


  const avgCalories = history.length > 0 ? Math.round(history.reduce((acc, h) => acc + h.totalCalories, 0) / history.length) : 0;
  const avgProtein = history.length > 0 ? Math.round(history.reduce((acc, h) => acc + h.totalProtein, 0) / history.length) : 0;
  const totalDays = history.length;

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          padding: '14px 18px',
          boxShadow: '0 12px 32px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: 'var(--text-primary)' }}>{label}</div>
          {payload.map((entry, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: entry.color }} />
              <span style={{ color: 'var(--text-secondary)' }}>{entry.name}:</span>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                {entry.value}{entry.name.includes('Protein') ? 'g' : ' kcal'}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div>
      <div className="page-header">
        <h1>Historical Progress</h1>
        <div className="subtitle" style={{ marginBottom: 0 }}>
          View your past daily logs, caloric intake, and macros over time.
        </div>
      </div>

      {history.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📅</div>
          No history found. Start logging food to build your history!
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Summary Stats */}
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 0 }}>
            <div className="stat-box">
              <div className="stat-label"><Flame size={14} /> Avg. Calories</div>
              <div className="stat-value">{avgCalories}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>kcal / day</div>
            </div>
            <div className="stat-box">
              <div className="stat-label"><Beef size={14} /> Avg. Protein</div>
              <div className="stat-value">{avgProtein}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>grams / day</div>
            </div>
            <div className="stat-box">
              <div className="stat-label"><Calendar size={14} /> Days Tracked</div>
              <div className="stat-value">{totalDays}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>in the last {trendRange} days</div>
            </div>
          </div>

          {/* Chart Section */}
          <div className="card" style={{ padding: '28px 28px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 10,
                  background: 'var(--accent-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <TrendingUp size={16} color="var(--accent)" />
                </div>
                <div className="section-title" style={{ marginBottom: 0 }}>Progress Trend</div>
              </div>
              <div style={{ display: 'flex', gap: 4, background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)', padding: 4 }}>
                {RANGE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => handleRangeChange(opt.value)}
                    style={{
                      padding: '7px 14px',
                      border: 'none',
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      background: trendRange === opt.value ? 'var(--accent)' : 'transparent',
                      color: trendRange === opt.value ? '#fff' : 'var(--text-muted)',
                      boxShadow: trendRange === opt.value ? '0 2px 8px rgba(99, 102, 241, 0.3)' : 'none',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ width: '100%', height: 320 }}>
              <ResponsiveContainer>
                <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <defs>
                    <linearGradient id="colorCalories" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorProtein" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    stroke="var(--text-muted)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    dy={10}
                    interval={chartData.length > 30 ? Math.floor(chartData.length / 10) : 'preserveStartEnd'}
                  />
                  <YAxis
                    yAxisId="left"
                    stroke="var(--text-muted)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="var(--text-muted)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ paddingTop: 20 }} />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    name="Calories"
                    dataKey="calories"
                    stroke="var(--accent)"
                    strokeWidth={2.5}
                    fill="url(#colorCalories)"
                    activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }}
                  />
                  <Area
                    yAxisId="right"
                    type="monotone"
                    name="Protein (g)"
                    dataKey="protein"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    fill="url(#colorProtein)"
                    activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* History List Section */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 10,
                  background: 'var(--accent-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <Calendar size={16} color="var(--accent)" />
                </div>
                <div className="section-title" style={{ marginBottom: 0 }}>Daily Breakdown</div>
              </div>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 10,
                background: 'var(--bg-primary)', color: 'var(--text-muted)'
              }}>
                {history.length} days
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {history.map((log) => (
                <div key={log.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '18px 24px',
                      cursor: 'pointer',
                      background: expandedDay === log.date ? 'var(--bg-primary)' : 'var(--card-bg)',
                      transition: 'background 0.2s'
                    }}
                    onClick={() => toggleDay(log.date)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{
                        width: 44,
                        height: 44,
                        borderRadius: 14,
                        background: 'var(--accent-bg)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--accent)'
                      }}>
                        <Calendar size={20} />
                      </div>
                      <div>
                        <h3 style={{ fontSize: 15, marginBottom: 4 }}>{formatDate(log.date)}</h3>
                        <div style={{ display: 'flex', gap: 10, fontSize: 13 }}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 8,
                            background: 'rgba(245, 158, 11, 0.08)', color: '#b45309'
                          }}>
                            <Flame size={11} /> {log.totalCalories} kcal
                          </span>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 8,
                            background: 'rgba(16, 185, 129, 0.08)', color: '#047857'
                          }}>
                            <Beef size={11} /> {log.totalProtein}g
                          </span>
                        </div>
                      </div>
                    </div>
                    <div style={{
                      width: 32, height: 32, borderRadius: 8,
                      background: expandedDay === log.date ? 'var(--accent-bg)' : 'var(--bg-primary)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.2s'
                    }}>
                      {expandedDay === log.date ? <ChevronUp size={18} color="var(--accent)" /> : <ChevronDown size={18} color="var(--text-muted)" />}
                    </div>
                  </div>

                  {expandedDay === log.date && (
                    <div style={{ padding: '0 24px 22px', borderTop: '1px solid var(--border-color)', marginTop: -1, animation: 'fadeIn 0.2s ease' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 20, marginBottom: 14 }}>
                        <div className="section-title" style={{ marginBottom: 0 }}>Food Log Items</div>
                        {log.foodLogs && (
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: 'var(--bg-primary)', color: 'var(--text-muted)' }}>
                            {log.foodLogs.length}
                          </span>
                        )}
                      </div>
                      {log.foodLogs && log.foodLogs.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {log.foodLogs.map((item, idx) => (
                            <div key={item.id} style={{
                              display: 'flex', alignItems: 'center', gap: 14,
                              padding: '14px 16px', background: 'var(--bg-primary)',
                              borderRadius: 'var(--radius-md)', border: '1px solid transparent',
                              transition: 'all 0.2s'
                            }}
                              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.background = '#f5f5ff'; }}
                              onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = 'var(--bg-primary)'; }}
                            >
                              <div style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                                background: 'var(--accent-bg)', color: 'var(--accent)',
                                fontWeight: 800, fontSize: 13
                              }}>
                                {idx + 1}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', marginBottom: 6, lineHeight: 1.4 }}>
                                  {item.description}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                  <span style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 4,
                                    fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 8,
                                    background: 'rgba(245, 158, 11, 0.08)', color: '#b45309'
                                  }}>
                                    <Flame size={11} /> {item.calories} kcal
                                  </span>
                                  <span style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 4,
                                    fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 8,
                                    background: 'rgba(16, 185, 129, 0.08)', color: '#047857'
                                  }}>
                                    <Beef size={11} /> {item.protein}g
                                  </span>
                                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                    {new Date(item.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                              </div>
                              <button
                                onClick={(e) => handleDeleteFood(item.id, e)}
                                title={deletingId === item.id ? 'Click again to confirm' : 'Delete this entry'}
                                style={{
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  width: 34, height: 34, borderRadius: 10, border: 'none',
                                  cursor: 'pointer', transition: 'all 0.2s ease', flexShrink: 0,
                                  background: deletingId === item.id ? 'var(--danger)' : 'transparent',
                                  color: deletingId === item.id ? '#fff' : 'var(--text-muted)',
                                  animation: deletingId === item.id ? 'pulse 1s infinite' : 'none',
                                }}
                                onMouseEnter={e => { if (deletingId !== item.id) { e.currentTarget.style.background = 'var(--danger-bg)'; e.currentTarget.style.color = 'var(--danger)'; }}}
                                onMouseLeave={e => { if (deletingId !== item.id) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}}
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>No individual items recorded for this day.</div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
