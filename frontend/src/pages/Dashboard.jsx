import { useState, useEffect } from 'react';
import axios from 'axios';
import { Flame, Beef, Play, ExternalLink, Trash2, Plus, TrendingUp, Utensils, Dumbbell, Sparkles, Check } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL;
if (!API_URL) throw new Error("VITE_API_URL is missing in environment variables");

export default function Dashboard() {
  const [daily, setDaily] = useState(null);
  const [plan, setPlan] = useState(null);
  const [manualLog, setManualLog] = useState({ description: '', calories: '', protein: '' });
  const [videoUrl, setVideoUrl] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [isAiMode, setIsAiMode] = useState(() => {
    return localStorage.getItem('ai_mode') === 'true';
  });
  const [isEstimating, setIsEstimating] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [customWorkout, setCustomWorkout] = useState({ name: '', reps: '' });
  const [isLoggingWorkout, setIsLoggingWorkout] = useState(false);
  const [editingWorkoutId, setEditingWorkoutId] = useState(null);
  const [tempReps, setTempReps] = useState('');

  useEffect(() => {
    localStorage.setItem('ai_mode', isAiMode);
  }, [isAiMode]);

  useEffect(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const currentDay = days[new Date().getDay()];

    const fetchData = async () => {
      try {
        const [dailyRes, plansRes] = await Promise.all([
          axios.get(`${API_URL}/daily/${todayStr}`),
          axios.get(`${API_URL}/plans`)
        ]);

        setDaily(dailyRes.data);
        const todayPlan = plansRes.data.find(p => p.dayOfWeek === currentDay);
        setPlan(todayPlan);
      } catch (err) {
        console.error(err);
      }
    };

    fetchData();
  }, []);

  if (!plan) return (
    <div style={{ padding: 80, textAlign: 'center', color: 'var(--text-muted)' }}>
      <div style={{ 
        width: 56, height: 56, borderRadius: 16, margin: '0 auto 16px',
        background: 'var(--accent-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        <Dumbbell size={24} color="var(--accent)" style={{ animation: 'pulse 1.5s infinite' }} />
      </div>
      <div style={{ fontSize: 14, fontWeight: 500 }}>Loading your plan...</div>
    </div>
  );

  const targetCal = plan.mealTarget ? parseInt(plan.mealTarget.calories) : 0;
  const currentCal = daily ? daily.totalCalories : 0;
  const targetPro = plan.mealTarget ? parseInt(plan.mealTarget.protein) : 0;
  const currentPro = daily ? daily.totalProtein : 0;
  const calPercent = targetCal > 0 ? Math.min((currentCal / targetCal) * 100, 100) : 0;
  const proPercent = targetPro > 0 ? Math.min((currentPro / targetPro) * 100, 100) : 0;
  const remaining = targetCal - currentCal;

  const handleDeleteFood = async (foodId) => {
    if (deletingId === foodId) {
      try {
        await axios.delete(`${API_URL}/daily/food/${foodId}`);
        const dateStr = new Date().toISOString().split('T')[0];
        const dailyRes = await axios.get(`${API_URL}/daily/${dateStr}`);
        setDaily(dailyRes.data);
        setDeletingId(null);
      } catch (err) {
        console.error(err);
      }
    } else {
      setDeletingId(foodId);
      setTimeout(() => setDeletingId(prev => prev === foodId ? null : prev), 3000);
    }
  };

  const handleAddLog = async (e) => {
    e.preventDefault();
    const dateStr = new Date().toISOString().split('T')[0];
    setAiError(null);
    setIsEstimating(true);
    try {
      if (isAiMode) {
        await axios.post(`${API_URL}/daily/food`, {
          date: dateStr,
          description: manualLog.description,
          useAi: true
        });
      } else {
        await axios.post(`${API_URL}/daily/food`, {
          date: dateStr,
          description: manualLog.description,
          calories: manualLog.calories,
          protein: manualLog.protein,
          useAi: false
        });
      }
      setManualLog({ description: '', calories: '', protein: '' });
      setShowQuickAdd(false);
      const dailyRes = await axios.get(`${API_URL}/daily/${dateStr}`);
      setDaily(dailyRes.data);
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.error || err.message || "Failed to log food. Please try again.";
      setAiError(errMsg);
    } finally {
      setIsEstimating(false);
    }
  };
  const handleToggleWorkout = async (workout) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const isCompleted = daily?.workoutLogs?.some(log => log.workoutId === workout.id);
    try {
      if (isCompleted) {
        const logEntry = daily.workoutLogs.find(log => log.workoutId === workout.id);
        if (logEntry) {
          await axios.delete(`${API_URL}/daily/workout/${logEntry.id}`);
        }
      } else {
        await axios.post(`${API_URL}/daily/workout`, {
          date: todayStr,
          name: workout.name,
          reps: workout.reps,
          workoutId: workout.id
        });
      }
      const dailyRes = await axios.get(`${API_URL}/daily/${todayStr}`);
      setDaily(dailyRes.data);
    } catch (err) {
      console.error("Error toggling workout:", err);
    }
  };
  const handleAddCustomWorkout = async (e) => {
    e.preventDefault();
    if (!customWorkout.name) return;
    const todayStr = new Date().toISOString().split('T')[0];
    setIsLoggingWorkout(true);
    try {
      await axios.post(`${API_URL}/daily/workout`, {
        date: todayStr,
        name: customWorkout.name,
        reps: customWorkout.reps || '1 session',
        workoutId: null
      });
      setCustomWorkout({ name: '', reps: '' });
      const dailyRes = await axios.get(`${API_URL}/daily/${todayStr}`);
      setDaily(dailyRes.data);
    } catch (err) {
      console.error("Error logging custom workout:", err);
    } finally {
      setIsLoggingWorkout(false);
    }
  };
  const handleDeleteWorkoutLog = async (logId) => {
    try {
      await axios.delete(`${API_URL}/daily/workout/${logId}`);
      const todayStr = new Date().toISOString().split('T')[0];
      const dailyRes = await axios.get(`${API_URL}/daily/${todayStr}`);
      setDaily(dailyRes.data);
    } catch (err) {
      console.error("Error deleting workout log:", err);
    }
  };
  const handleSaveReps = async (workoutId, logEntry) => {
    const todayStr = new Date().toISOString().split('T')[0];
    if (logEntry) {
      try {
        await axios.put(`${API_URL}/daily/workout/${logEntry.id}`, { reps: tempReps });
        const dailyRes = await axios.get(`${API_URL}/daily/${todayStr}`);
        setDaily(dailyRes.data);
      } catch (err) {
        console.error("Error updating workout reps:", err);
      }
    } else {
      const workout = plan.workouts.find(work => work.id === workoutId);
      if (workout) {
        try {
          await axios.post(`${API_URL}/daily/workout`, {
            date: todayStr,
            name: workout.name,
            reps: tempReps,
            workoutId: workoutId
          });
          const dailyRes = await axios.get(`${API_URL}/daily/${todayStr}`);
          setDaily(dailyRes.data);
        } catch (err) {
          console.error("Error logging workout with custom reps:", err);
        }
      }
    }
    setEditingWorkoutId(null);
    setTempReps('');
  };
  const handleSaveExtraReps = async (logId) => {
    const todayStr = new Date().toISOString().split('T')[0];
    try {
      await axios.put(`${API_URL}/daily/workout/${logId}`, { reps: tempReps });
      const dailyRes = await axios.get(`${API_URL}/daily/${todayStr}`);
      setDaily(dailyRes.data);
    } catch (err) {
      console.error("Error updating extra workout reps:", err);
    }
    setEditingWorkoutId(null);
    setTempReps('');
  };
  const dayName = new Date().toLocaleDateString(undefined, { weekday: 'long' });
  const dateStr = new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
  const totalPlanned = plan.workouts ? plan.workouts.length : 0;
  const completedPlannedCount = plan.workouts 
    ? plan.workouts.filter(w => daily?.workoutLogs?.some(log => log.workoutId === w.id)).length 
    : 0;
  const workoutPercent = totalPlanned > 0 ? Math.min((completedPlannedCount / totalPlanned) * 100, 100) : 0;
  const extraWorkouts = daily?.workoutLogs?.filter(log => !log.workoutId) || [];
  const totalCompletedWorkouts = completedPlannedCount + extraWorkouts.length;

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <h1>Today's Overview</h1>
          <span style={{
            padding: '4px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
            background: plan.isRestDay ? 'var(--warning-bg)' : 'var(--success-bg)',
            color: plan.isRestDay ? 'var(--warning)' : 'var(--success)'
          }}>
            {plan.isRestDay ? '😴 Rest Day' : '💪 Training'}
          </span>
        </div>
        <div className="subtitle" style={{ marginBottom: 0 }}>
          {dayName}, {dateStr} — {plan.title}
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="stat-box">
          <div className="stat-label"><Flame size={14} /> Calories</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <div className="stat-value">{currentCal}</div>
            <span className="stat-unit">/ {targetCal} kcal</span>
          </div>
          <div className="progress-bar-container">
            <div className="progress-bar" style={{ width: `${calPercent}%` }}></div>
          </div>
        </div>
        <div className="stat-box">
          <div className="stat-label"><Beef size={14} /> Protein</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <div className="stat-value">{currentPro}</div>
            <span className="stat-unit">/ {targetPro}g</span>
          </div>
          <div className="progress-bar-container">
            <div className="progress-bar" style={{ width: `${proPercent}%`, background: 'linear-gradient(90deg, #10b981, #34d399)' }}></div>
          </div>
        </div>
        <div className="stat-box">
          <div className="stat-label"><Dumbbell size={14} color="var(--accent)" /> Workouts</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <div className="stat-value">{totalCompletedWorkouts}</div>
            <span className="stat-unit">{plan.isRestDay ? 'active logged' : `/ ${totalPlanned} completed`}</span>
          </div>
          <div className="progress-bar-container">
            <div className="progress-bar" style={{ 
              width: `${plan.isRestDay ? (totalCompletedWorkouts > 0 ? 100 : 0) : workoutPercent}%`, 
              background: 'linear-gradient(90deg, var(--accent), var(--accent-light))' 
            }}></div>
          </div>
        </div>
        <div className="stat-box" style={{ position: 'relative' }}>
          <div className="stat-label"><TrendingUp size={14} /> Remaining</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <div className="stat-value" style={{ color: remaining > 0 ? 'var(--text-primary)' : 'var(--danger)' }}>
              {remaining > 0 ? remaining : 0}
            </div>
            <span className="stat-unit">kcal left</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12 }}>
            {remaining <= 0 ? '🎯 Target reached!' : `${Math.round(calPercent)}% of daily goal`}
          </div>
        </div>
      </div>

      {/* Food Log — Full Width Below */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              background: 'rgba(245, 158, 11, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Flame size={16} color="var(--warning)" />
            </div>
            <div className="section-title" style={{ marginBottom: 0 }}>Food Log</div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {/* Elegant AI Mode Toggle Switch */}
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
              userSelect: 'none',
              fontSize: 12,
              fontWeight: 600,
              padding: '6px 14px',
              borderRadius: 20,
              background: isAiMode ? 'rgba(139, 92, 246, 0.08)' : 'var(--bg-primary)',
              border: `1px solid ${isAiMode ? 'rgba(139, 92, 246, 0.25)' : 'var(--border-color)'}`,
              color: isAiMode ? '#8b5cf6' : 'var(--text-secondary)',
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: isAiMode ? '0 0 12px rgba(139, 92, 246, 0.1)' : 'none'
            }}>
              <Sparkles size={13} style={{ 
                color: isAiMode ? '#8b5cf6' : 'var(--text-muted)',
                animation: isAiMode ? 'pulse 2s infinite' : 'none' 
              }} />
              <span>AI Mode</span>
              <input
                type="checkbox"
                checked={isAiMode}
                onChange={e => {
                  setIsAiMode(e.target.checked);
                  setAiError(null);
                }}
                disabled={isEstimating}
                style={{ display: 'none' }}
              />
              <div style={{
                width: 32,
                height: 18,
                borderRadius: 9,
                background: isAiMode ? 'linear-gradient(135deg, #8b5cf6, #a78bfa)' : 'var(--border-color)',
                position: 'relative',
                transition: 'background 0.25s ease',
                marginLeft: 4
              }}>
                <div style={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  background: '#fff',
                  position: 'absolute',
                  top: 2,
                  left: isAiMode ? 16 : 2,
                  transition: 'left 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.15)'
                }} />
              </div>
            </label>

            {daily?.foodLogs?.length > 0 && (
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 10,
                background: 'var(--bg-primary)', color: 'var(--text-muted)',
                border: '1px solid var(--border-color)'
              }}>
                {daily.foodLogs.length} {daily.foodLogs.length === 1 ? 'entry' : 'entries'}
              </span>
            )}
          </div>
        </div>

        {/* Error Banner */}
        {aiError && (
          <div style={{
            marginBottom: 16,
            padding: '12px 16px',
            background: 'var(--danger-bg)',
            color: 'var(--danger)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            fontSize: 13,
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: 'var(--shadow-sm)',
            animation: 'fadeIn 0.2s ease-out'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 16 }}>⚠️</span>
              <span style={{ lineHeight: '1.4' }}>{aiError}</span>
            </div>
            <button
              onClick={() => setAiError(null)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--danger)',
                cursor: 'pointer',
                fontSize: 16,
                fontWeight: 600,
                padding: '0 4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: 0.8,
                transition: 'opacity 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '1'}
              onMouseLeave={e => e.currentTarget.style.opacity = '0.8'}
            >
              ✕
            </button>
          </div>
        )}

        {/* Quick Add Form - Always visible inline bar */}
        <div style={{
          marginBottom: 20, padding: 8,
          background: 'var(--bg-primary)',
          borderRadius: 'var(--radius-md)',
          border: `1px solid ${isAiMode ? 'rgba(139, 92, 246, 0.35)' : 'var(--border-color)'}`,
          display: 'flex', alignItems: 'center', gap: 8,
          boxShadow: isAiMode 
            ? '0 0 10px rgba(139, 92, 246, 0.08), inset 0 2px 4px rgba(0,0,0,0.02)' 
            : 'inset 0 2px 4px rgba(0,0,0,0.02)',
          transition: 'all 0.3s ease'
        }}>
          <form onSubmit={handleAddLog} style={{ display: 'flex', flex: 1, gap: 8 }}>
            <div style={{ flex: 1, position: 'relative' }}>
              {isAiMode ? (
                <Sparkles size={14} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#8b5cf6', animation: isEstimating ? 'spin 2s linear infinite' : 'none' }} />
              ) : (
                <Utensils size={14} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              )}
              <input 
                type="text" 
                className="chat-input" 
                placeholder={isAiMode ? 'What did you eat? Describe it naturally, AI will estimate calories & protein...' : 'What did you eat? e.g., Grilled chicken...'} 
                required 
                disabled={isEstimating}
                value={manualLog.description} 
                onChange={e => setManualLog({...manualLog, description: e.target.value})} 
                style={{ 
                  paddingLeft: 38, 
                  border: 'none', 
                  background: 'transparent', 
                  height: 40, 
                  boxShadow: 'none',
                  color: isEstimating ? 'var(--text-muted)' : 'var(--text-primary)'
                }} 
              />
            </div>
            {!isAiMode && (
              <>
                <div style={{ width: 1, background: 'var(--border-color)', margin: '4px 0' }} />
                <div style={{ width: 100, position: 'relative' }}>
                  <input type="number" className="chat-input" placeholder="0" required={!isAiMode} value={manualLog.calories} onChange={e => setManualLog({...manualLog, calories: e.target.value})} style={{ paddingRight: 40, border: 'none', background: 'transparent', height: 40, boxShadow: 'none' }} />
                  <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--text-muted)', pointerEvents: 'none' }}>kcal</span>
                </div>
                <div style={{ width: 1, background: 'var(--border-color)', margin: '4px 0' }} />
                <div style={{ width: 100, position: 'relative' }}>
                  <input type="number" className="chat-input" placeholder="0" required={!isAiMode} value={manualLog.protein} onChange={e => setManualLog({...manualLog, protein: e.target.value})} style={{ paddingRight: 32, border: 'none', background: 'transparent', height: 40, boxShadow: 'none' }} />
                  <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--text-muted)', pointerEvents: 'none' }}>g</span>
                </div>
              </>
            )}
            <button 
              type="submit" 
              className="primary-btn" 
              disabled={isEstimating}
              style={{ 
                borderRadius: 8, 
                padding: '0 20px', 
                height: 40,
                background: isAiMode ? 'linear-gradient(135deg, #8b5cf6, #7c3aed)' : 'var(--accent)',
                borderColor: isAiMode ? '#7c3aed' : 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                minWidth: 90,
                justifyContent: 'center',
                cursor: isEstimating ? 'not-allowed' : 'pointer',
                opacity: isEstimating ? 0.7 : 1,
                boxShadow: isAiMode ? '0 2px 6px rgba(124, 58, 237, 0.2)' : 'none'
              }}
            >
              {isEstimating ? (
                <>
                  <div style={{
                    width: 14, height: 14,
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: '#fff',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite'
                  }} />
                  <span>Estimating...</span>
                </>
              ) : (
                <>
                  {isAiMode ? <Sparkles size={14} /> : <Plus size={14} />}
                  <span>Add</span>
                </>
              )}
            </button>
          </form>
        </div>

        {daily?.foodLogs?.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {daily.foodLogs.map((log, idx) => (
              <div key={log.id} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '14px 16px',
                background: 'var(--bg-primary)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid transparent',
                transition: 'all 0.2s'
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.background = '#f5f5ff'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = 'var(--bg-primary)'; }}
              >

                {/* Number badge */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                  background: 'var(--accent-bg)', color: 'var(--accent)',
                  fontWeight: 800, fontSize: 13
                }}>
                  {idx + 1}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>
                    {log.description}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 8,
                      background: 'rgba(245, 158, 11, 0.08)', color: '#b45309'
                    }}>
                      <Flame size={12} /> {log.calories} kcal
                    </span>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 8,
                      background: 'rgba(16, 185, 129, 0.08)', color: '#047857'
                    }}>
                      <Beef size={12} /> {log.protein}g
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 50, textAlign: 'right' }}>
                      {new Date(log.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>

                {/* Delete */}
                <button
                  onClick={() => handleDeleteFood(log.id)}
                  title={deletingId === log.id ? 'Click again to confirm' : 'Delete this entry'}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 34, height: 34, borderRadius: 10, border: 'none',
                    cursor: 'pointer', transition: 'all 0.2s ease', flexShrink: 0, marginLeft: 8,
                    background: deletingId === log.id ? 'var(--danger)' : 'transparent',
                    color: deletingId === log.id ? '#fff' : 'var(--text-muted)',
                    animation: deletingId === log.id ? 'pulse 1s infinite' : 'none',
                  }}
                  onMouseEnter={e => { if (deletingId !== log.id) { e.currentTarget.style.background = 'var(--danger-bg)'; e.currentTarget.style.color = 'var(--danger)'; }}}
                  onMouseLeave={e => { if (deletingId !== log.id) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '60px 20px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-color)' }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16, margin: '0 auto 16px',
              background: 'var(--card-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: 'var(--shadow-sm)'
            }}>
              <Utensils size={24} color="var(--text-muted)" style={{ opacity: 0.7 }} />
            </div>
            <div style={{ fontSize: 15, color: 'var(--text-primary)', fontWeight: 600 }}>No food logged today</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>Use the quick add bar above or chat with the AI assistant.</div>
          </div>
        )}
      </div>

      {/* Two-column: Workout + Meals */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 22, marginBottom: 22 }}>
        {/* Workout Plan & Checklist */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 34, height: 34, borderRadius: 10,
                background: 'var(--accent-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <Dumbbell size={16} color="var(--accent)" />
              </div>
              <div className="section-title" style={{ marginBottom: 0 }}>Workout Plan</div>
            </div>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 10,
              background: 'var(--bg-primary)', color: 'var(--text-muted)'
            }}>
              {plan.isRestDay ? 'Recovery Day' : `${completedPlannedCount}/${totalPlanned} completed`}
            </span>
          </div>
          {/* Workout Progress Bar */}
          {!plan.isRestDay && totalPlanned > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
                <span>Routine Progress</span>
                <span style={{ color: 'var(--accent)' }}>{Math.round(workoutPercent)}%</span>
              </div>
              <div className="progress-bar-container" style={{ marginTop: 0, height: 6 }}>
                <div className="progress-bar" style={{ width: `${workoutPercent}%`, background: 'linear-gradient(90deg, var(--accent), var(--accent-light))' }}></div>
              </div>
            </div>
          )}
          {/* Workouts list */}
          {plan.isRestDay ? (
            <div style={{
              textAlign: 'center', padding: '32px 16px', background: 'var(--bg-primary)',
              borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-color)', marginBottom: 20
            }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>😴</div>
              <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>Recovery & Rest Day</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, lineHeight: '1.5' }}>
                No routine workouts planned today. Focus on active recovery, hydration, stretching, and mobility.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {plan.workouts.map((w, idx) => {
                const isCompleted = daily?.workoutLogs?.some(log => log.workoutId === w.id);
                const isSearch = w.video?.includes('results?search_query=');
                return (
                  <div key={w.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 14px', background: isCompleted ? 'rgba(99, 102, 241, 0.02)' : 'var(--bg-primary)',
                    borderRadius: 'var(--radius-md)', border: '1px solid',
                    borderColor: isCompleted ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    opacity: isCompleted ? 0.75 : 1
                  }}
                    onMouseEnter={e => {
                      if (!isCompleted) {
                        e.currentTarget.style.borderColor = 'var(--border-color)';
                        e.currentTarget.style.background = '#f5f5ff';
                      }
                    }}
                    onMouseLeave={e => {
                      if (!isCompleted) {
                        e.currentTarget.style.borderColor = 'transparent';
                        e.currentTarget.style.background = 'var(--bg-primary)';
                      }
                    }}
                  >
                    {/* glowing checkbox circle */}
                    <button
                      onClick={() => handleToggleWorkout(w)}
                      style={{
                        background: isCompleted ? 'var(--accent)' : 'transparent',
                        border: `2px solid ${isCompleted ? 'var(--accent)' : 'var(--text-muted)'}`,
                        borderRadius: '50%',
                        width: 20,
                        height: 20,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        flexShrink: 0,
                        transition: 'all 0.2s ease',
                        boxShadow: isCompleted ? '0 0 8px rgba(99, 102, 241, 0.35)' : 'none'
                      }}
                    >
                      {isCompleted && <Check size={11} color="#ffffff" strokeWidth={3} />}
                    </button>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontWeight: 600,
                        fontSize: 14,
                        color: isCompleted ? 'var(--text-muted)' : 'var(--text-primary)',
                        textDecoration: isCompleted ? 'line-through' : 'none',
                        transition: 'all 0.2s ease'
                      }}>{w.name}</div>
                      
                      {editingWorkoutId === w.id ? (
                        <form onSubmit={(e) => {
                          e.preventDefault();
                          const logEntry = daily?.workoutLogs?.find(log => log.workoutId === w.id);
                          handleSaveReps(w.id, logEntry);
                        }} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                          <input 
                            type="text" 
                            value={tempReps} 
                            onChange={e => setTempReps(e.target.value)} 
                            className="chat-input"
                            style={{ height: 26, padding: '0 8px', fontSize: 12, width: 100 }}
                            autoFocus
                          />
                          <button type="submit" className="primary-btn" style={{ height: 26, padding: '0 10px', fontSize: 11, background: 'var(--accent)', borderColor: 'var(--accent)', cursor: 'pointer' }}>Save</button>
                          <button type="button" onClick={() => setEditingWorkoutId(null)} className="workout-link" style={{ height: 26, padding: '0 8px', fontSize: 11, background: 'transparent', border: 'none', cursor: 'pointer' }}>Cancel</button>
                        </form>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                            {daily?.workoutLogs?.find(log => log.workoutId === w.id) ? `${daily.workoutLogs.find(log => log.workoutId === w.id).reps} (completed)` : w.reps}
                          </span>
                          <button 
                            onClick={() => {
                              const logEntry = daily?.workoutLogs?.find(log => log.workoutId === w.id);
                              setEditingWorkoutId(w.id);
                              setTempReps(logEntry ? logEntry.reps : w.reps);
                            }}
                            className="workout-link"
                            style={{ 
                              padding: '1px 6px', fontSize: 10, background: 'transparent', border: 'none', 
                              color: 'var(--text-muted)', cursor: 'pointer', opacity: 0.6,
                              transition: 'opacity 0.2s'
                            }}
                            onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                            onMouseLeave={e => e.currentTarget.style.opacity = '0.6'}
                          >
                            Edit reps
                          </button>
                        </div>
                      )}
                    </div>
                    {isSearch ? (
                      <a href={w.video} target="_blank" rel="noreferrer" className="workout-link" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', fontSize: 11 }}>
                        <ExternalLink size={12} /> Watch
                      </a>
                    ) : (
                      <button onClick={() => setVideoUrl(w.video)} className="workout-link" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', fontSize: 11 }}>
                        <Play size={12} /> Watch
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {/* Extra Workouts List */}
          {extraWorkouts.length > 0 && (
            <div style={{ marginTop: 10, marginBottom: 20 }}>
              <div className="section-title" style={{ fontSize: 10, letterSpacing: '1px', marginBottom: 10 }}>Extra Activity Logged</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {extraWorkouts.map(log => (
                  <div key={log.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 14px', background: 'var(--bg-primary)',
                    borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)',
                    animation: 'fadeIn 0.2s ease'
                  }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: 18, height: 18, borderRadius: '50%',
                      background: 'var(--success-bg)', color: 'var(--success)',
                      flexShrink: 0
                    }}>
                      <Check size={10} strokeWidth={3} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{log.name}</div>
                      {editingWorkoutId === log.id ? (
                        <form onSubmit={(e) => {
                          e.preventDefault();
                          handleSaveExtraReps(log.id);
                        }} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                          <input 
                            type="text" 
                            value={tempReps} 
                            onChange={e => setTempReps(e.target.value)} 
                            className="chat-input"
                            style={{ height: 24, padding: '0 6px', fontSize: 11, width: 80 }}
                            autoFocus
                          />
                          <button type="submit" className="primary-btn" style={{ height: 24, padding: '0 8px', fontSize: 10, background: 'var(--accent)', borderColor: 'var(--accent)', cursor: 'pointer' }}>Save</button>
                          <button type="button" onClick={() => setEditingWorkoutId(null)} className="workout-link" style={{ height: 24, padding: '0 6px', fontSize: 10, background: 'transparent', border: 'none', cursor: 'pointer' }}>Cancel</button>
                        </form>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{log.reps}</span>
                          <button 
                            onClick={() => {
                              setEditingWorkoutId(log.id);
                              setTempReps(log.reps);
                            }}
                            className="workout-link"
                            style={{ 
                              padding: '1px 6px', fontSize: 9, background: 'transparent', border: 'none', 
                              color: 'var(--text-muted)', cursor: 'pointer', opacity: 0.6,
                              transition: 'opacity 0.2s'
                            }}
                            onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                            onMouseLeave={e => e.currentTarget.style.opacity = '0.6'}
                          >
                            Edit
                          </button>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteWorkoutLog(log.id)}
                      title="Delete activity log"
                      style={{
                        background: 'transparent', border: 'none', cursor: 'pointer',
                        color: 'var(--text-muted)', transition: 'color 0.2s', padding: 4,
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}
                      onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Quick Add Custom Workout Form */}
          <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid var(--border-color)' }}>
            <form onSubmit={handleAddCustomWorkout} style={{ display: 'flex', gap: 6 }}>
              <input
                type="text"
                className="chat-input"
                placeholder={plan.isRestDay ? "Log active recovery... e.g. Yoga" : "Log extra workout... e.g. 20 min walk"}
                required
                disabled={isLoggingWorkout}
                value={customWorkout.name}
                onChange={e => setCustomWorkout({ ...customWorkout, name: e.target.value })}
                style={{ height: 36, fontSize: 13, padding: '0 12px' }}
              />
              <input
                type="text"
                className="chat-input"
                placeholder="Reps/Duration"
                disabled={isLoggingWorkout}
                value={customWorkout.reps}
                onChange={e => setCustomWorkout({ ...customWorkout, reps: e.target.value })}
                style={{ width: 110, height: 36, fontSize: 13, padding: '0 12px' }}
              />
              <button
                type="submit"
                className="primary-btn"
                disabled={isLoggingWorkout || !customWorkout.name}
                style={{
                  height: 36, padding: '0 14px', borderRadius: 8,
                  background: 'var(--accent)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  opacity: isLoggingWorkout ? 0.7 : 1
                }}
              >
                {isLoggingWorkout ? (
                  <div style={{
                    width: 12, height: 12,
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: '#fff',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite'
                  }} />
                ) : (
                  <Plus size={14} />
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Meal Schedule */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 34, height: 34, borderRadius: 10,
                background: 'var(--success-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <Utensils size={16} color="var(--success)" />
              </div>
              <div className="section-title" style={{ marginBottom: 0 }}>Meal Schedule</div>
            </div>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 10,
              background: 'var(--bg-primary)', color: 'var(--text-muted)'
            }}>
              {plan.mealSchedules.length} meals
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {plan.mealSchedules.map((m, mealIdx) => {
              let items = [];
              try { items = JSON.parse(m.items); } catch(e) {}
              return (
                <div key={m.id} style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 16px', background: 'var(--bg-primary)',
                  borderRadius: 'var(--radius-md)', border: '1px solid transparent',
                  transition: 'all 0.2s'
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.background = '#f0fdf4'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = 'var(--bg-primary)'; }}
                >
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                    background: 'var(--success-bg)', color: 'var(--success)',
                    fontWeight: 800, fontSize: 13
                  }}>
                    {mealIdx + 1}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{m.time} — {m.title}</div>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6,
                        background: 'var(--success-bg)', color: 'var(--success)'
                      }}>{m.protein}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 8,
                        background: 'rgba(245, 158, 11, 0.08)', color: '#b45309'
                      }}>
                        <Flame size={11} /> {m.kcal}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {items.map((item, idx) => (
                        <span key={idx} style={{
                          fontSize: 12, padding: '3px 10px', borderRadius: 6,
                          background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                          color: 'var(--text-secondary)'
                        }}>{item}</span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Video Modal */}
      {videoUrl && (
        <div className="modal-overlay" onClick={() => setVideoUrl(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Exercise Form Guide</h3>
              <button onClick={() => setVideoUrl(null)} className="icon-btn" style={{ color: 'var(--text-secondary)' }}>✕</button>
            </div>
            <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden' }}>
              <iframe 
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
                src={(() => {
                  if (videoUrl.includes('youtube.com/watch?v=')) return videoUrl.replace('watch?v=', 'embed/').split('&')[0];
                  if (videoUrl.includes('youtu.be/')) return videoUrl.replace('youtu.be/', 'youtube.com/embed/').split('?')[0];
                  return videoUrl;
                })()} 
                frameBorder="0" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                allowFullScreen
              ></iframe>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
