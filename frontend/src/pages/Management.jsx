import { useState, useEffect } from 'react';
import axios from 'axios';
import { Trash2, Edit2, Plus, Save, Dumbbell, UtensilsCrossed, CheckCircle, Zap, Sparkles, ChevronDown, Moon, Flame, MessageSquare, Send, Settings, Wifi, WifiOff, QrCode, Loader, LogOut, Key, ExternalLink, Eye, EyeOff } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL;
if (!API_URL) throw new Error("VITE_API_URL is missing in environment variables");

export default function Management() {
  const [plans, setPlans] = useState([]);
  const [config, setConfig] = useState({});
  const [providerInput, setProviderInput] = useState([]);
  const [ownerJidInput, setOwnerJidInput] = useState('');
  const [ownerTelegramInput, setOwnerTelegramInput] = useState('');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [openRouterApiKey, setOpenRouterApiKey] = useState('');
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showOpenRouterKey, setShowOpenRouterKey] = useState(false);
  const [newWorkout, setNewWorkout] = useState({ planId: null, name: '', reps: '', video: '' });

  const [newMeal, setNewMeal] = useState({ planId: null, time: '', title: '', items: '', kcal: '', protein: '', applyToAll: false });
  const [configSaved, setConfigSaved] = useState(false);
  const [expandedDay, setExpandedDay] = useState(null);
  const [botPlatform, setBotPlatform] = useState('whatsapp');

  const [editingWorkoutId, setEditingWorkoutId] = useState(null);
  const [editWorkoutData, setEditWorkoutData] = useState({ name: '', reps: '', video: '' });

  const [editingMealId, setEditingMealId] = useState(null);
  const [editMealData, setEditMealData] = useState({ time: '', title: '', items: '', kcal: '', protein: '' });

  const [editingTargetPlanId, setEditingTargetPlanId] = useState(null);
  const [editTargetData, setEditTargetData] = useState({ calories: '', protein: '', carbs: '', fats: '' });


  const [waStatus, setWaStatus] = useState('loading');
  const [qr, setQr] = useState(null);
  const [isDisconnectingWa, setIsDisconnectingWa] = useState(false);
  const [tgStatus, setTgStatus] = useState('loading');
  const [tgToken, setTgToken] = useState('');
  const [isSavingTg, setIsSavingTg] = useState(false);
  const [isDisconnectingTg, setIsDisconnectingTg] = useState(false);

  const fetchData = async () => {
    try {
      const [plansRes, configRes] = await Promise.all([
        axios.get(`${API_URL}/plans`),
        axios.get(`${API_URL}/config`)
      ]);
      setPlans(plansRes.data);
      setConfig(configRes.data);
      try {
        setProviderInput(JSON.parse(configRes.data.ai_providers || '["gemini"]'));
      } catch {
        setProviderInput([configRes.data.ai_provider || 'gemini']);
      }
      setOwnerJidInput(configRes.data.owner_jid || '');
      setOwnerTelegramInput(configRes.data.owner_telegram_id || '');
      setGeminiApiKey(configRes.data.gemini_api_key || '');
      setOpenRouterApiKey(configRes.data.openrouter_api_key || '');
      setBotPlatform(configRes.data.bot_platform || 'whatsapp');
    } catch (err) {
      console.error(err);
    }
  };

  const fetchWaStatus = async () => {
    try {
      const res = await axios.get(`${API_URL}/bot/status`);
      setWaStatus(res.data.status);
      setQr(res.data.qr);
    } catch (err) { console.error(err); }
  };

  const fetchTgStatus = async () => {
    try {
      const res = await axios.get(`${API_URL}/bot/telegram/status`);
      setTgStatus(res.data.status);
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    fetchData();
    fetchWaStatus();
    fetchTgStatus();
    const waInterval = setInterval(fetchWaStatus, 3000);
    const tgInterval = setInterval(fetchTgStatus, 5000);
    return () => { clearInterval(waInterval); clearInterval(tgInterval); };
  }, []);

  const toggleRestDay = async (id, currentStatus) => {
    try {
      await axios.put(`${API_URL}/plans/${id}`, { isRestDay: !currentStatus });
      fetchData();
    } catch (err) { console.error(err); }
  };

  const handleWaDisconnect = async () => {
    if (!window.confirm('Disconnect WhatsApp?')) return;
    setIsDisconnectingWa(true);
    try {
      await axios.post(`${API_URL}/bot/disconnect`);
      await fetchWaStatus();
    } catch (err) { console.error(err); }
    finally { setIsDisconnectingWa(false); }
  };

  const saveTelegramToken = async (e) => {
    e.preventDefault();
    setIsSavingTg(true);
    try {
      await axios.put(`${API_URL}/config`, { key: 'telegram_bot_token', value: tgToken });
      await axios.post(`${API_URL}/bot/telegram/connect`);
      await fetchTgStatus();
    } catch (err) { console.error(err); }
    finally { setIsSavingTg(false); }
  };

  const handleTgDisconnect = async () => {
    if (!window.confirm('Disconnect Telegram?')) return;
    setIsDisconnectingTg(true);
    try {
      await axios.post(`${API_URL}/bot/telegram/disconnect`);
      setTgToken('');
      await fetchTgStatus();
    } catch (err) { console.error(err); }
    finally { setIsDisconnectingTg(false); }
  };

  const saveConfig = async () => {
    try {
      let jid = ownerJidInput;
      if (jid && !jid.includes('@')) {
        jid = `${jid.replace(/[^0-9]/g, '')}@s.whatsapp.net`;
      }
      await Promise.all([
        axios.put(`${API_URL}/config`, { key: 'ai_providers', value: JSON.stringify(providerInput) }),
        axios.put(`${API_URL}/config`, { key: 'owner_jid', value: jid }),
        axios.put(`${API_URL}/config`, { key: 'owner_telegram_id', value: ownerTelegramInput }),
        axios.put(`${API_URL}/config`, { key: 'gemini_api_key', value: geminiApiKey }),
        axios.put(`${API_URL}/config`, { key: 'openrouter_api_key', value: openRouterApiKey }),
        axios.put(`${API_URL}/config`, { key: 'bot_platform', value: botPlatform })
      ]);
      
      if (botPlatform !== config.bot_platform) {
        if (botPlatform === 'telegram') {
          await axios.post(`${API_URL}/bot/disconnect`);
          if (config.telegram_bot_token) {
            await axios.post(`${API_URL}/bot/telegram/connect`);
          }
        } else {
          await axios.post(`${API_URL}/bot/telegram/disconnect`);
          await axios.post(`${API_URL}/bot/connect`);
        }
      }

      setConfigSaved(true);
      setTimeout(() => setConfigSaved(false), 2500);
      fetchData();
    } catch (err) { console.error(err); }
  };

  const toggleProvider = (value) => {
    setProviderInput(prev =>
      prev.includes(value) ? prev.filter(p => p !== value) : [...prev, value]
    );
  };

  const addWorkout = async (e, planId) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/workouts`, { ...newWorkout, planId });
      setNewWorkout({ planId: null, name: '', reps: '', video: '' });
      fetchData();
    } catch (err) { console.error(err); }
  };

  const deleteWorkout = async (id) => {
    if (!confirm('Delete this workout?')) return;
    try { await axios.delete(`${API_URL}/workouts/${id}`); fetchData(); } catch (err) { console.error(err); }
  };

  const addMeal = async (e, planId) => {
    e.preventDefault();
    try {
      const itemsArray = newMeal.items.split(',').map(s => s.trim());
      await axios.post(`${API_URL}/meals`, { ...newMeal, items: itemsArray, planId });
      setNewMeal({ planId: null, time: '', title: '', items: '', kcal: '', protein: '', applyToAll: false });
      fetchData();
    } catch (err) { console.error(err); }
  };

  const deleteMeal = async (id) => {
    if (!confirm('Delete this meal?')) return;
    try { await axios.delete(`${API_URL}/meals/${id}`); fetchData(); } catch (err) { console.error(err); }
  };

  const startEditWorkout = (workout) => {
    setEditingWorkoutId(workout.id);
    setEditWorkoutData({ name: workout.name, reps: workout.reps, video: workout.video || '' });
  };

  const saveWorkoutEdit = async (e, id) => {
    e.preventDefault();
    try {
      await axios.put(`${API_URL}/workouts/${id}`, editWorkoutData);
      setEditingWorkoutId(null);
      fetchData();
    } catch (err) { console.error(err); }
  };

  const startEditMeal = (meal) => {
    setEditingMealId(meal.id);
    let parsedItems = [];
    try { parsedItems = JSON.parse(meal.items); } catch(e) {}
    setEditMealData({
      time: meal.time,
      title: meal.title,
      items: Array.isArray(parsedItems) ? parsedItems.join(', ') : meal.items,
      kcal: meal.kcal,
      protein: meal.protein
    });
  };

  const saveMealEdit = async (e, id) => {
    e.preventDefault();
    try {
      const itemsArray = editMealData.items.split(',').map(s => s.trim());
      await axios.put(`${API_URL}/meals/${id}`, { ...editMealData, items: itemsArray });
      setEditingMealId(null);
      fetchData();
    } catch (err) { console.error(err); }
  };

  const startEditTarget = (planId, target) => {
    setEditingTargetPlanId(planId);
    setEditTargetData({
      calories: target?.calories || '',
      protein: target?.protein || '',
      carbs: target?.carbs || '',
      fats: target?.fats || ''
    });
  };

  const saveTargetEdit = async (e, planId) => {
    e.preventDefault();
    try {
      await axios.put(`${API_URL}/plans/${planId}/target`, editTargetData);
      setEditingTargetPlanId(null);
      fetchData();
    } catch (err) { console.error(err); }
  };

  const getDayEmoji = (dayOfWeek) => {
    const map = { monday: '🟢', tuesday: '🔵', wednesday: '🟣', thursday: '🟠', friday: '🔴', saturday: '🟡', sunday: '⚪' };
    return map[dayOfWeek] || '⚪';
  };

  const isToday = (dayOfWeek) => {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[new Date().getDay()] === dayOfWeek;
  };

  /* ── Reusable Styles ─────────────────────────────────── */
  const sectionLabel = {
    fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
    textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 12
  };

  const fieldLabel = {
    fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6, display: 'block'
  };

  const divider = {
    height: 1, background: 'var(--border-color)', margin: '20px 0'
  };

  return (
    <div>
      <div className="page-header">
        <h1>Settings & Management</h1>
        <div className="subtitle" style={{ marginBottom: 0 }}>Configure your AI bot and manage weekly routines.</div>
      </div>

      {/* ═══════════════════════════════════════════════════ */}
      {/* UNIFIED SETTINGS CARD                               */}
      {/* ═══════════════════════════════════════════════════ */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 36 }}>
        
        {/* Card Header */}
        <div style={{
          padding: '18px 28px',
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05), rgba(139, 92, 246, 0.02))',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex', alignItems: 'center', gap: 12
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, var(--accent), #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(99, 102, 241, 0.25)'
          }}>
            <Settings size={18} color="#fff" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>Configuration</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>AI providers, messaging platform & whitelist</div>
          </div>
        </div>

        <div style={{ padding: '24px 28px' }}>

          {/* ── Section 1: AI Providers ──────────────────── */}
          <div style={sectionLabel}>AI Providers</div>
          <div style={{ display: 'flex', gap: 12 }}>
            {[
              { value: 'gemini', label: 'Google Gemini', sublabel: 'Fast & reliable', icon: <Sparkles size={15} />, gradient: 'linear-gradient(135deg, #4285f4, #34a853)', keyField: geminiApiKey },
              { value: 'deepseek', label: 'DeepSeek V4', sublabel: 'via OpenRouter', icon: <Zap size={15} />, gradient: 'linear-gradient(135deg, #6366f1, #8b5cf6)', keyField: openRouterApiKey }
            ].map(p => {
              const hasKey = !!(p.keyField && p.keyField.trim());
              const isSelected = providerInput.includes(p.value);
              return (
              <div key={p.value} onClick={() => {
                if (!hasKey) return;
                toggleProvider(p.value);
              }} style={{
                flex: 1, display: 'flex', alignItems: 'center', gap: 12,
                cursor: hasKey ? 'pointer' : 'not-allowed',
                padding: '14px 16px', borderRadius: 'var(--radius-md)',
                background: !hasKey ? 'var(--bg-secondary)' : isSelected ? 'var(--accent-bg)' : 'var(--bg-primary)',
                border: `1.5px solid ${!hasKey ? 'var(--border-color)' : isSelected ? 'var(--accent-border)' : 'var(--border-color)'}`,
                opacity: hasKey ? 1 : 0.55,
                transition: 'all 0.2s ease'
              }}>
                <div style={{
                  width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                  border: `2px solid ${isSelected && hasKey ? 'var(--accent)' : 'var(--text-muted)'}`,
                  background: isSelected && hasKey ? 'var(--accent)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s'
                }}>
                  {isSelected && hasKey && <CheckCircle size={10} color="#fff" />}
                </div>
                <div style={{
                  width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                  background: isSelected && hasKey ? p.gradient : 'var(--bg-secondary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s',
                  border: isSelected && hasKey ? 'none' : '1px solid var(--border-color)'
                }}>
                  <span style={{ color: isSelected && hasKey ? '#fff' : 'var(--text-muted)' }}>{p.icon}</span>
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: hasKey ? (isSelected ? 'var(--text-primary)' : 'var(--text-secondary)') : 'var(--text-muted)' }}>{p.label}</div>
                  {hasKey ? (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.sublabel}</div>
                  ) : (
                    <div style={{ fontSize: 11, color: 'var(--danger)', fontWeight: 500 }}>No API key configured</div>
                  )}
                </div>
              </div>
              );
            })}
          </div>

          <div style={divider} />

          {/* ── Section 1b: API Keys ────────────────────── */}
          <div style={sectionLabel}>API Keys</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={fieldLabel}>Google Gemini API Key</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type={showGeminiKey ? "text" : "password"}
                  value={geminiApiKey}
                  onChange={e => setGeminiApiKey(e.target.value)}
                  placeholder="AIza..."
                  className="chat-input"
                  style={{
                    width: '100%', padding: '11px 40px 11px 14px', borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-primary)', border: '1px solid var(--border-color)',
                    fontSize: 13, color: 'var(--text-primary)',
                    fontFamily: "'SF Mono', 'Fira Code', monospace", fontWeight: 500
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowGeminiKey(!showGeminiKey)}
                  style={{
                    position: 'absolute', right: 12, background: 'none', border: 'none',
                    color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center',
                    padding: 0
                  }}
                >
                  {showGeminiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div>
              <label style={fieldLabel}>OpenRouter API Key (DeepSeek)</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type={showOpenRouterKey ? "text" : "password"}
                  value={openRouterApiKey}
                  onChange={e => setOpenRouterApiKey(e.target.value)}
                  placeholder="sk-or-v1-..."
                  className="chat-input"
                  style={{
                    width: '100%', padding: '11px 40px 11px 14px', borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-primary)', border: '1px solid var(--border-color)',
                    fontSize: 13, color: 'var(--text-primary)',
                    fontFamily: "'SF Mono', 'Fira Code', monospace", fontWeight: 500
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowOpenRouterKey(!showOpenRouterKey)}
                  style={{
                    position: 'absolute', right: 12, background: 'none', border: 'none',
                    color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center',
                    padding: 0
                  }}
                >
                  {showOpenRouterKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </div>

          <div style={divider} />

          {/* ── Section 2: Bot Platform ─────────────────── */}
          <div style={sectionLabel}>Messaging Platform</div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            {[
              { value: 'whatsapp', label: 'WhatsApp', icon: <MessageSquare size={15} />, color: '#25d366', activeColor: 'var(--accent)' },
              { value: 'telegram', label: 'Telegram', icon: <Send size={15} />, color: '#0088cc', activeColor: '#0088cc' }
            ].map(p => {
              const active = botPlatform === p.value;
              return (
                <div key={p.value} onClick={() => setBotPlatform(p.value)} style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  padding: '12px 16px', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                  background: active ? `${p.activeColor}10` : 'var(--bg-primary)',
                  border: `1.5px solid ${active ? p.activeColor : 'var(--border-color)'}`,
                  transition: 'all 0.2s ease'
                }}>
                  <span style={{ color: active ? p.activeColor : 'var(--text-muted)', display: 'flex' }}>{p.icon}</span>
                  <span style={{ fontWeight: 600, fontSize: 13, color: active ? p.activeColor : 'var(--text-secondary)' }}>{p.label}</span>
                </div>
              );
            })}
          </div>

          {/* ── Section 3: Owner Whitelist ──────────────── */}
          <div style={sectionLabel}>Owner Whitelist</div>
          {botPlatform === 'whatsapp' ? (
            <div>
              <label style={fieldLabel}>
                <MessageSquare size={12} style={{ verticalAlign: 'middle', marginRight: 6, color: 'var(--accent)' }} />
                WhatsApp Phone Number
              </label>
              <input
                type="text"
                value={ownerJidInput}
                onChange={e => setOwnerJidInput(e.target.value)}
                placeholder="e.g. 628123456789"
                className="chat-input"
                style={{
                  width: '100%', padding: '11px 14px', borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-primary)', border: '1px solid var(--border-color)',
                  fontSize: 13, color: 'var(--text-primary)',
                  fontFamily: "'SF Mono', 'Fira Code', monospace", fontWeight: 500
                }}
              />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                Enter the phone number with country code, without + or spaces.
              </div>
            </div>
          ) : (
            <div>
              <label style={fieldLabel}>
                <Send size={12} style={{ verticalAlign: 'middle', marginRight: 6, color: '#0088cc' }} />
                Telegram User ID
              </label>
              <input
                type="text"
                value={ownerTelegramInput}
                onChange={e => setOwnerTelegramInput(e.target.value)}
                placeholder="e.g. 123456789"
                className="chat-input"
                style={{
                  width: '100%', padding: '11px 14px', borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-primary)', border: '1px solid var(--border-color)',
                  fontSize: 13, color: 'var(--text-primary)',
                  fontFamily: "'SF Mono', 'Fira Code', monospace", fontWeight: 500
                }}
              />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                Find your Telegram ID by messaging @userinfobot on Telegram.
              </div>
            </div>
          )}

          <div style={divider} />

          {/* ── Section 4: Bot Connection ──────────────── */}
          <div style={sectionLabel}>Bot Connection</div>
          {botPlatform === 'whatsapp' ? (
            <div>
              {waStatus === 'connected' ? (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '16px 18px', borderRadius: 'var(--radius-md)',
                  background: 'rgba(16, 185, 129, 0.06)', border: '1px solid var(--success-border)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 10,
                      background: 'var(--success-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <Wifi size={18} color="var(--success)" />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>WhatsApp Connected</div>
                      <div style={{ fontSize: 12, color: 'var(--success)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', display: 'inline-block', animation: 'pulse 2s infinite' }} />
                        Active & Listening
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={handleWaDisconnect}
                    disabled={isDisconnectingWa}
                    className="ghost-btn"
                    style={{ fontSize: 12, color: 'var(--danger)', borderColor: 'var(--danger-border)' }}
                  >
                    {isDisconnectingWa ? <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <LogOut size={13} />}
                    {isDisconnectingWa ? ' Disconnecting...' : ' Disconnect'}
                  </button>
                </div>
              ) : (
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  padding: '24px 18px', borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-primary)', border: '1px solid var(--border-color)'
                }}>
                  {qr ? (
                    <>
                      <div style={{
                        padding: 12, background: '#fff', borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-color)', marginBottom: 16,
                        boxShadow: '0 2px 12px rgba(0,0,0,0.04)'
                      }}>
                        <img src={qr} alt="WhatsApp QR" style={{ width: 180, height: 180, display: 'block' }} />
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.6 }}>
                        Open WhatsApp → <strong>Linked Devices</strong> → Scan this QR code
                      </div>
                    </>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12 }}>
                      <QrCode size={20} color="var(--text-muted)" style={{ animation: 'pulse 1.5s infinite' }} />
                      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Generating QR code...</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div>
              {tgStatus === 'connected' ? (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '16px 18px', borderRadius: 'var(--radius-md)',
                  background: 'rgba(16, 185, 129, 0.06)', border: '1px solid var(--success-border)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 10,
                      background: 'var(--success-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <Wifi size={18} color="var(--success)" />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>Telegram Connected</div>
                      <div style={{ fontSize: 12, color: 'var(--success)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', display: 'inline-block', animation: 'pulse 2s infinite' }} />
                        Active & Listening
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={handleTgDisconnect}
                    disabled={isDisconnectingTg}
                    className="ghost-btn"
                    style={{ fontSize: 12, color: 'var(--danger)', borderColor: 'var(--danger-border)' }}
                  >
                    {isDisconnectingTg ? <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <LogOut size={13} />}
                    {isDisconnectingTg ? ' Disconnecting...' : ' Disconnect'}
                  </button>
                </div>
              ) : (
                <div style={{
                  padding: '18px', borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-primary)', border: '1px solid var(--border-color)'
                }}>
                  <form onSubmit={saveTelegramToken} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <label style={fieldLabel}>
                      <Key size={12} style={{ verticalAlign: 'middle', marginRight: 6, color: '#0088cc' }} />
                      Bot Token
                    </label>
                    <input
                      type="text"
                      value={tgToken}
                      onChange={e => setTgToken(e.target.value)}
                      placeholder="e.g. 123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                      className="chat-input"
                      required
                      style={{
                        width: '100%', padding: '11px 14px', borderRadius: 'var(--radius-sm)',
                        background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                        fontSize: 13, fontFamily: "'SF Mono', monospace"
                      }}
                    />
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                      Get a token from <strong>@BotFather</strong> on Telegram → /newbot
                    </div>
                    <button type="submit" className="primary-btn" disabled={isSavingTg} style={{
                      padding: '10px 20px', background: 'linear-gradient(135deg, #0088cc, #00b4d8)',
                      alignSelf: 'flex-start'
                    }}>
                      {isSavingTg ? <><Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> Connecting...</> : <><Zap size={13} /> Connect Bot</>}
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Save Footer ──────────────────────────────── */}
        <div style={{
          padding: '16px 28px',
          background: 'var(--bg-primary)',
          borderTop: '1px solid var(--border-color)',
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12
        }}>
          {configSaved && (
            <span style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 13, color: 'var(--success)', fontWeight: 600,
              animation: 'fadeIn 0.3s ease'
            }}>
              <CheckCircle size={15} /> Saved!
            </span>
          )}
          <button className="primary-btn" onClick={saveConfig} style={{ padding: '10px 28px' }}>
            <Save size={15} /> Save Changes
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════ */}
      {/* WEEKLY PLAN                                         */}
      {/* ═══════════════════════════════════════════════════ */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{ marginBottom: 0 }}>Weekly Plan</h2>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
            background: 'var(--accent-bg)', color: 'var(--accent)', letterSpacing: '0.3px'
          }}>{plans.length} days</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {plans.map(p => {
          const isExpanded = expandedDay === p.id;
          const today = isToday(p.dayOfWeek);
          
          return (
            <div className="card" key={p.id} style={{
              padding: 0, overflow: 'hidden',
              border: today ? '1.5px solid var(--accent-border)' : '1px solid var(--border-color)',
              boxShadow: today ? '0 0 0 3px rgba(99, 102, 241, 0.06)' : 'var(--shadow-sm)'
            }}>
              {/* Day Header */}
              <div 
                onClick={() => setExpandedDay(isExpanded ? null : p.id)}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '16px 24px', cursor: 'pointer',
                  background: p.isRestDay 
                    ? 'linear-gradient(135deg, rgba(245,158,11,0.04), transparent)' 
                    : today 
                      ? 'linear-gradient(135deg, rgba(99,102,241,0.04), transparent)' 
                      : 'transparent',
                  transition: 'background 0.2s',
                  userSelect: 'none'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <span style={{ fontSize: 18 }}>{getDayEmoji(p.dayOfWeek)}</span>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <h3 style={{ fontSize: 15 }}>{p.title}</h3>
                      {today && (
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                          background: 'var(--accent)', color: '#fff', letterSpacing: '0.5px', textTransform: 'uppercase'
                        }}>Today</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 3 }}>
                      {p.isRestDay ? (
                        <span style={{ fontSize: 12, color: 'var(--warning)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Moon size={12} /> Rest Day
                        </span>
                      ) : (
                        <>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Dumbbell size={11} /> {p.workouts.length} workouts
                          </span>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <UtensilsCrossed size={11} /> {p.mealSchedules.length} meals
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleRestDay(p.id, p.isRestDay); }}
                    className="ghost-btn"
                    style={{ fontSize: 11, padding: '6px 12px' }}
                  >
                    {p.isRestDay ? 'Set Training' : 'Set Rest'}
                  </button>
                  <ChevronDown size={18} color="var(--text-muted)" style={{
                    transition: 'transform 0.25s ease',
                    transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)'
                  }} />
                </div>
              </div>

              {/* Expanded Content */}
              {isExpanded && !p.isRestDay && (
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0,
                  borderTop: '1px solid var(--border-color)',
                  animation: 'fadeIn 0.25s ease'
                }}>
                  {/* Workouts Column */}
                  <div style={{ padding: '20px 24px', borderRight: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: 8,
                          background: 'var(--accent-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                          <Dumbbell size={14} color="var(--accent)" />
                        </div>
                        <div className="section-title" style={{ marginBottom: 0 }}>Workouts</div>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: 'var(--bg-primary)', color: 'var(--text-muted)' }}>
                        {p.workouts.length}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {p.workouts.map((w) => {
                        const isEditing = editingWorkoutId === w.id;
                        return (
                          <div key={w.id} style={{
                            display: 'flex', flexDirection: isEditing ? 'column' : 'row', alignItems: isEditing ? 'stretch' : 'center', gap: 12,
                            padding: '12px 14px', background: 'var(--bg-primary)',
                            borderRadius: 'var(--radius-md)', border: isEditing ? '1px dashed var(--accent-border)' : '1px solid transparent',
                            transition: 'all 0.2s'
                          }}
                            onMouseEnter={e => { if (!isEditing) e.currentTarget.style.borderColor = 'var(--border-color)'; }}
                            onMouseLeave={e => { if (!isEditing) e.currentTarget.style.borderColor = 'transparent'; }}
                          >
                            {isEditing ? (
                              <form onSubmit={(e) => saveWorkoutEdit(e, w.id)} style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                                <input type="text" className="chat-input" placeholder="Workout name" required value={editWorkoutData.name} onChange={e => setEditWorkoutData({...editWorkoutData, name: e.target.value})} style={{ fontSize: 13 }} />
                                <input type="text" className="chat-input" placeholder="Reps (e.g. 4x10)" required value={editWorkoutData.reps} onChange={e => setEditWorkoutData({...editWorkoutData, reps: e.target.value})} style={{ fontSize: 13 }} />
                                <input type="text" className="chat-input" placeholder="Video URL (optional)" value={editWorkoutData.video} onChange={e => setEditWorkoutData({...editWorkoutData, video: e.target.value})} style={{ fontSize: 13 }} />
                                <div style={{ display: 'flex', gap: 8 }}>
                                  <button type="submit" className="primary-btn" style={{ padding: '5px 12px', fontSize: 12 }}>Save</button>
                                  <button type="button" onClick={() => setEditingWorkoutId(null)} className="ghost-btn" style={{ padding: '5px 12px', fontSize: 12 }}>Cancel</button>
                                </div>
                              </form>
                            ) : (
                              <>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', marginBottom: 2 }}>{w.name}</div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{w.reps}</span>
                                    {w.video && w.video.trim() !== '' && (
                                      <a
                                        href={w.video}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{
                                          display: 'inline-flex', alignItems: 'center', gap: 4,
                                          fontSize: 11, color: 'var(--accent)', fontWeight: 500,
                                          textDecoration: 'none', background: 'var(--accent-bg)',
                                          padding: '2px 8px', borderRadius: 12, transition: 'all 0.2s'
                                        }}
                                        onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(0.95)'; }}
                                        onMouseLeave={e => { e.currentTarget.style.filter = 'none'; }}
                                      >
                                        <span>Watch Video</span>
                                        <ExternalLink size={10} />
                                      </a>
                                    )}
                                  </div>
                                </div>
                                <div style={{ display: 'flex', gap: 4 }}>
                                  <button onClick={() => startEditWorkout(w)} style={{
                                    background: 'transparent', border: 'none', color: 'var(--text-muted)',
                                    cursor: 'pointer', padding: 6, borderRadius: 8, transition: 'all 0.2s', opacity: 0.5
                                  }}
                                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-bg)'; e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.opacity = '1'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.opacity = '0.5'; }}
                                  >
                                    <Edit2 size={14} />
                                  </button>
                                  <button onClick={() => deleteWorkout(w.id)} style={{
                                    background: 'transparent', border: 'none', color: 'var(--text-muted)',
                                    cursor: 'pointer', padding: 6, borderRadius: 8, transition: 'all 0.2s', opacity: 0.5
                                  }}
                                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--danger-bg)'; e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.opacity = '1'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.opacity = '0.5'; }}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {newWorkout.planId === p.id ? (
                      <form onSubmit={(e) => addWorkout(e, p.id)} style={{
                        marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8,
                        padding: 14, background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)',
                        border: '1px dashed var(--accent-border)',
                        animation: 'fadeIn 0.2s ease'
                      }}>
                        <input type="text" className="chat-input" placeholder="Workout name" required value={newWorkout.name} onChange={e => setNewWorkout({...newWorkout, name: e.target.value})} style={{ fontSize: 13 }} />
                        <input type="text" className="chat-input" placeholder="Reps (e.g. 4x10)" required value={newWorkout.reps} onChange={e => setNewWorkout({...newWorkout, reps: e.target.value})} style={{ fontSize: 13 }} />
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button type="submit" className="primary-btn" style={{ padding: '7px 14px', fontSize: 12 }}>Save</button>
                          <button type="button" onClick={() => setNewWorkout({...newWorkout, planId: null})} className="ghost-btn" style={{ padding: '7px 14px', fontSize: 12 }}>Cancel</button>
                        </div>
                      </form>
                    ) : (
                      <button onClick={() => setNewWorkout({...newWorkout, planId: p.id})} className="ghost-btn" style={{ marginTop: 10, fontSize: 12, width: '100%' }}>
                        <Plus size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Add Workout
                      </button>
                    )}
                  </div>

                  {/* Meals Column */}
                  <div style={{ padding: '20px 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: 8,
                          background: 'var(--success-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                          <UtensilsCrossed size={14} color="var(--success)" />
                        </div>
                        <div className="section-title" style={{ marginBottom: 0 }}>Meals</div>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: 'var(--bg-primary)', color: 'var(--text-muted)' }}>
                        {p.mealSchedules.length}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {p.mealSchedules.map(m => {
                        let parsedItems = [];
                        try { parsedItems = JSON.parse(m.items); } catch(e) {}
                        const isEditing = editingMealId === m.id;
                        return (
                          <div key={m.id} style={{
                            display: 'flex', flexDirection: isEditing ? 'column' : 'row', alignItems: isEditing ? 'stretch' : 'flex-start', gap: 12,
                            padding: '12px 14px', background: 'var(--bg-primary)',
                            borderRadius: 'var(--radius-md)', border: isEditing ? '1px dashed var(--success-border)' : '1px solid transparent',
                            transition: 'all 0.2s'
                          }}
                            onMouseEnter={e => { if (!isEditing) e.currentTarget.style.borderColor = 'var(--border-color)'; }}
                            onMouseLeave={e => { if (!isEditing) e.currentTarget.style.borderColor = 'transparent'; }}
                          >
                            {isEditing ? (
                              <form onSubmit={(e) => saveMealEdit(e, m.id)} style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                                <div style={{ display: 'flex', gap: 8 }}>
                                  <input type="text" className="chat-input" placeholder="Time (e.g. 08:00)" required value={editMealData.time} onChange={e => setEditMealData({...editMealData, time: e.target.value})} style={{ fontSize: 13, flex: '0 0 90px' }} />
                                  <input type="text" className="chat-input" placeholder="Meal Title" required value={editMealData.title} onChange={e => setEditMealData({...editMealData, title: e.target.value})} style={{ fontSize: 13 }} />
                                </div>
                                <input type="text" className="chat-input" placeholder="Items (comma separated)" required value={editMealData.items} onChange={e => setEditMealData({...editMealData, items: e.target.value})} style={{ fontSize: 13 }} />
                                <div style={{ display: 'flex', gap: 8 }}>
                                  <input type="text" className="chat-input" placeholder="Calories" required value={editMealData.kcal} onChange={e => setEditMealData({...editMealData, kcal: e.target.value})} style={{ fontSize: 13 }} />
                                  <input type="text" className="chat-input" placeholder="Protein" required value={editMealData.protein} onChange={e => setEditMealData({...editMealData, protein: e.target.value})} style={{ fontSize: 13 }} />
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                  <button type="submit" className="primary-btn" style={{ padding: '5px 12px', fontSize: 12 }}>Save</button>
                                  <button type="button" onClick={() => setEditingMealId(null)} className="ghost-btn" style={{ padding: '5px 12px', fontSize: 12 }}>Cancel</button>
                                </div>
                              </form>
                            ) : (
                              <>
                                <div style={{
                                  padding: '4px 8px', borderRadius: 6,
                                  background: 'var(--accent-bg)', color: 'var(--accent)',
                                  fontSize: 11, fontWeight: 700, flexShrink: 0, marginTop: 2
                                }}>
                                  {m.time}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', marginBottom: 4 }}>{m.title}</div>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 4 }}>
                                    {parsedItems.map((item, idx) => (
                                      <span key={idx} style={{
                                        fontSize: 11, padding: '2px 8px', borderRadius: 5,
                                        background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                                        color: 'var(--text-secondary)'
                                      }}>{item}</span>
                                    ))}
                                  </div>
                                  <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 8 }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Flame size={10} /> {m.kcal}</span>
                                    <span>{m.protein}</span>
                                  </div>
                                </div>
                                <div style={{ display: 'flex', gap: 4 }}>
                                  <button onClick={() => startEditMeal(m)} style={{
                                    background: 'transparent', border: 'none', color: 'var(--text-muted)',
                                    cursor: 'pointer', padding: 6, borderRadius: 8, transition: 'all 0.2s', opacity: 0.5
                                  }}
                                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-bg)'; e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.opacity = '1'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.opacity = '0.5'; }}
                                  >
                                    <Edit2 size={14} />
                                  </button>
                                  <button onClick={() => deleteMeal(m.id)} style={{
                                    background: 'transparent', border: 'none', color: 'var(--text-muted)',
                                    cursor: 'pointer', padding: 6, borderRadius: 8, transition: 'all 0.2s', opacity: 0.5
                                  }}
                                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--danger-bg)'; e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.opacity = '1'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.opacity = '0.5'; }}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Daily Nutrition Targets Panel */}
                    {editingTargetPlanId === p.id ? (
                      <form onSubmit={(e) => saveTargetEdit(e, p.id)} style={{
                        marginTop: 16, marginBottom: 16, padding: 14, background: 'var(--bg-primary)', 
                        borderRadius: 'var(--radius-md)', border: '1px dashed var(--accent-border)',
                        display: 'flex', flexDirection: 'column', gap: 8,
                        animation: 'fadeIn 0.2s ease'
                      }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>Daily Nutrition Targets</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                          <input type="text" className="chat-input" placeholder="Calories (e.g. 2650 kcal)" value={editTargetData.calories} onChange={e => setEditTargetData({...editTargetData, calories: e.target.value})} required style={{ fontSize: 12 }} />
                          <input type="text" className="chat-input" placeholder="Protein (e.g. 145g)" value={editTargetData.protein} onChange={e => setEditTargetData({...editTargetData, protein: e.target.value})} required style={{ fontSize: 12 }} />
                          <input type="text" className="chat-input" placeholder="Carbs (e.g. 320g)" value={editTargetData.carbs} onChange={e => setEditTargetData({...editTargetData, carbs: e.target.value})} required style={{ fontSize: 12 }} />
                          <input type="text" className="chat-input" placeholder="Fats (e.g. 70g)" value={editTargetData.fats} onChange={e => setEditTargetData({...editTargetData, fats: e.target.value})} required style={{ fontSize: 12 }} />
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                          <button type="submit" className="primary-btn" style={{ padding: '5px 12px', fontSize: 12 }}>Save Targets</button>
                          <button type="button" onClick={() => setEditingTargetPlanId(null)} className="ghost-btn" style={{ padding: '5px 12px', fontSize: 12 }}>Cancel</button>
                        </div>
                      </form>
                    ) : (
                      <div style={{
                        marginTop: 16, marginBottom: 16, padding: '12px 14px', background: 'var(--bg-primary)', 
                        borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Flame size={12} color="var(--accent)" /> Daily Target Nutrition
                          </div>
                          <button onClick={() => startEditTarget(p.id, p.mealTarget)} className="ghost-btn" style={{ padding: '3px 8px', fontSize: 11 }}>
                            {p.mealTarget ? 'Edit Targets' : 'Set Targets'}
                          </button>
                        </div>
                        {p.mealTarget ? (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px 12px', fontSize: 12, color: 'var(--text-secondary)' }}>
                            <div><span style={{ color: 'var(--text-muted)' }}>Calories:</span> <strong style={{ color: 'var(--text-primary)' }}>{p.mealTarget.calories}</strong></div>
                            <div><span style={{ color: 'var(--text-muted)' }}>Protein:</span> <strong style={{ color: 'var(--text-primary)' }}>{p.mealTarget.protein}</strong></div>
                            <div><span style={{ color: 'var(--text-muted)' }}>Carbs:</span> <strong style={{ color: 'var(--text-primary)' }}>{p.mealTarget.carbs}</strong></div>
                            <div><span style={{ color: 'var(--text-muted)' }}>Fats:</span> <strong style={{ color: 'var(--text-primary)' }}>{p.mealTarget.fats}</strong></div>
                          </div>
                        ) : (
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            No target nutritional values set for this day.
                          </div>
                        )}
                      </div>
                    )}

                    {newMeal.planId === p.id ? (
                      <form onSubmit={(e) => addMeal(e, p.id)} style={{
                        marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8,
                        padding: 14, background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)',
                        border: '1px dashed var(--success-border)',
                        animation: 'fadeIn 0.2s ease'
                      }}>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <input type="text" className="chat-input" placeholder="Time (08:00)" required value={newMeal.time} onChange={e => setNewMeal({...newMeal, time: e.target.value})} style={{ fontSize: 13, flex: '0 0 90px' }} />
                          <input type="text" className="chat-input" placeholder="Meal title" required value={newMeal.title} onChange={e => setNewMeal({...newMeal, title: e.target.value})} style={{ fontSize: 13 }} />
                        </div>
                        <input type="text" className="chat-input" placeholder="Items (comma separated)" required value={newMeal.items} onChange={e => setNewMeal({...newMeal, items: e.target.value})} style={{ fontSize: 13 }} />
                        <div style={{ display: 'flex', gap: 8 }}>
                          <input type="text" className="chat-input" placeholder="Calories" required value={newMeal.kcal} onChange={e => setNewMeal({...newMeal, kcal: e.target.value})} style={{ fontSize: 13 }} />
                          <input type="text" className="chat-input" placeholder="Protein" required value={newMeal.protein} onChange={e => setNewMeal({...newMeal, protein: e.target.value})} style={{ fontSize: 13 }} />
                        </div>
                        <label style={{
                          display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer',
                          padding: '8px 12px', background: newMeal.applyToAll ? 'var(--accent-bg)' : 'transparent',
                          borderRadius: 'var(--radius-sm)', transition: 'all 0.2s'
                        }}>
                          <input type="checkbox" checked={newMeal.applyToAll} onChange={e => setNewMeal({...newMeal, applyToAll: e.target.checked})} />
                          <span style={{ color: newMeal.applyToAll ? 'var(--accent)' : 'var(--text-secondary)', fontWeight: 500 }}>Apply to all days</span>
                        </label>
                        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                          <button type="submit" className="primary-btn" style={{ padding: '7px 14px', fontSize: 12 }}>Save</button>
                          <button type="button" onClick={() => setNewMeal({...newMeal, planId: null})} className="ghost-btn" style={{ padding: '7px 14px', fontSize: 12 }}>Cancel</button>
                        </div>
                      </form>
                    ) : (
                      <button onClick={() => setNewMeal({...newMeal, planId: p.id})} className="ghost-btn" style={{ marginTop: 10, fontSize: 12, width: '100%' }}>
                        <Plus size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Add Meal
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
