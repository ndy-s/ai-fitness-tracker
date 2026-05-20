import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Send, Bot, Minus, List, Plus, Trash2, ChevronLeft, Sparkles, MessageCircle, Clock } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const API_URL = import.meta.env.VITE_API_URL;
if (!API_URL) throw new Error("VITE_API_URL is missing in environment variables");

const DEFAULT_MESSAGE = { role: 'assistant', content: 'Hi! I\'m your AI Fitness Tracker Agent. Ask me anything about your training or nutrition, or request changes to your plan.', timestamp: new Date().toISOString() };

export default function AgentOverlay() {
  const [isOpen, setIsOpen] = useState(false);
  

  const [messages, setMessages] = useState([DEFAULT_MESSAGE]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);


  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [showSessionsList, setShowSessionsList] = useState(false);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen && !showSessionsList) {
      scrollToBottom();
    }
  }, [messages, isOpen, showSessionsList]);

  const loadSession = async (sessionId) => {
    setIsLoading(true);
    setCurrentSessionId(sessionId);
    setShowSessionsList(false);
    try {
      const res = await axios.get(`${API_URL}/agent/sessions/${sessionId}/messages`);
      if (res.data && res.data.length > 0) {
        setMessages(res.data);
      } else {
        setMessages([DEFAULT_MESSAGE]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const startNewChat = () => {
    setCurrentSessionId(null);
    setMessages([DEFAULT_MESSAGE]);
    setShowSessionsList(false);
  };

  const fetchSessions = async () => {
    setSessionsLoading(true);
    try {
      const res = await axios.get(`${API_URL}/agent/sessions`);
      setSessions(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setSessionsLoading(false);
    }
  };

  const toggleSessionsList = () => {
    if (!showSessionsList) fetchSessions();
    setShowSessionsList(!showSessionsList);
  };

  const deleteSession = async (e, sessionId) => {
    e.stopPropagation();
    try {
      await axios.delete(`${API_URL}/agent/sessions/${sessionId}`);
      setSessions(sessions.filter(s => s.id !== sessionId));
      if (currentSessionId === sessionId) {
        startNewChat();
        setShowSessionsList(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (isOpen && !currentSessionId && messages.length <= 1) {
       setMessages([DEFAULT_MESSAGE]);
    }
  }, [isOpen]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = { role: 'user', content: input, timestamp: new Date().toISOString() };
    const currentMessages = [...messages, userMessage];
    setMessages(currentMessages);
    setInput('');
    setIsLoading(true);

    try {
      let activeSessionId = currentSessionId;
      if (!activeSessionId) {
        const sessionRes = await axios.post(`${API_URL}/agent/sessions`);
        activeSessionId = sessionRes.data.id;
        setCurrentSessionId(activeSessionId);
      }

      const apiMessages = currentMessages.filter(m => m !== DEFAULT_MESSAGE);

      const res = await axios.post(`${API_URL}/agent/chat`, {
        messages: apiMessages,
        sessionId: activeSessionId
      });
      setMessages(prev => [...prev, { role: 'assistant', content: res.data.reply, timestamp: new Date().toISOString() }]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.', timestamp: new Date().toISOString() }]);
    } finally {
      setIsLoading(false);
    }
  };

  const headerBtnStyle = {
    background: 'rgba(255,255,255,0.15)',
    backdropFilter: 'blur(4px)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: '#fff',
    cursor: 'pointer',
    borderRadius: 10,
    width: 32,
    height: 32,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s'
  };

  return (
    <>
      {/* Floating Action Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            position: 'fixed',
            bottom: 28,
            right: 28,
            width: 60,
            height: 60,
            borderRadius: 20,
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            color: '#fff',
            border: 'none',
            boxShadow: '0 8px 32px rgba(99, 102, 241, 0.35), 0 2px 8px rgba(0,0,0,0.1)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999,
            transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08) translateY(-3px)'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(99, 102, 241, 0.45), 0 4px 12px rgba(0,0,0,0.15)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1) translateY(0)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(99, 102, 241, 0.35), 0 2px 8px rgba(0,0,0,0.1)'; }}
        >
          <Sparkles size={26} />
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div style={{
          position: 'fixed',
          bottom: 28,
          right: 28,
          width: 420,
          height: 640,
          background: 'var(--card-bg)',
          borderRadius: 24,
          boxShadow: '0 24px 80px rgba(0,0,0,0.12), 0 8px 32px rgba(0,0,0,0.08)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 999,
          overflow: 'hidden',
          border: '1px solid var(--border-color)',
          animation: 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
        }}>
          {/* Header */}
          <div style={{
            padding: '16px 20px',
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a78bfa 100%)',
            color: '#fff',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            position: 'relative',
            overflow: 'hidden'
          }}>
            {/* Decorative circles */}
            <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
            <div style={{ position: 'absolute', bottom: -30, left: 60, width: 60, height: 60, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 600, fontSize: 15, position: 'relative' }}>
              {showSessionsList ? (
                <>
                  <button onClick={() => setShowSessionsList(false)} style={{ ...headerBtnStyle, width: 28, height: 28 }}>
                    <ChevronLeft size={16} />
                  </button>
                  <span>Chat History</span>
                </>
              ) : (
                <>
                  <div style={{
                    width: 34, height: 34, borderRadius: 12,
                    background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '1px solid rgba(255,255,255,0.15)'
                  }}>
                    <Sparkles size={18} />
                  </div>
                  <div>
                    <div style={{ lineHeight: 1.2 }}>AI Fitness Tracker</div>
                    <div style={{ fontSize: 11, opacity: 0.7, fontWeight: 400 }}>Always ready to help</div>
                  </div>
                </>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6, position: 'relative' }}>
              {!showSessionsList && (
                <button onClick={toggleSessionsList} title="Chat History" style={headerBtnStyle}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
                >
                  <Clock size={15} />
                </button>
              )}
              {showSessionsList && (
                <button onClick={startNewChat} title="New Chat" style={headerBtnStyle}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
                >
                  <Plus size={16} />
                </button>
              )}
              <button onClick={() => setIsOpen(false)} title="Minimize" style={headerBtnStyle}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
              >
                <Minus size={16} />
              </button>
            </div>
          </div>

          {showSessionsList ? (
             /* Sessions List View */
             <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-primary)' }}>
               {sessionsLoading ? (
                 <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                   <div className="typing-dot" style={{ marginRight: 4 }}></div>
                   <div className="typing-dot" style={{ marginRight: 4 }}></div>
                   <div className="typing-dot"></div>
                 </div>
               ) : sessions.length === 0 ? (
                 <div style={{ padding: 50, textAlign: 'center' }}>
                    <div style={{
                      width: 52, height: 52, borderRadius: 16, margin: '0 auto 16px',
                      background: 'var(--accent-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <MessageCircle size={22} color="var(--accent)" />
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 14, fontWeight: 500, marginBottom: 4 }}>No past chats</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 12, opacity: 0.7, marginBottom: 20 }}>Start a conversation to see it here</div>
                    <button onClick={startNewChat} style={{
                      padding: '10px 24px', background: 'var(--accent)', color: '#fff', border: 'none',
                      borderRadius: 12, cursor: 'pointer', fontWeight: 600, fontSize: 13,
                      boxShadow: '0 2px 8px rgba(99, 102, 241, 0.25)'
                    }}>New Chat</button>
                 </div>
               ) : (
                 <div style={{ padding: 10 }}>
                   {sessions.map((s, idx) => (
                     <div key={s.id} onClick={() => loadSession(s.id)} style={{
                       display: 'flex',
                       alignItems: 'center',
                       gap: 12,
                       padding: '14px 16px',
                       margin: '4px 0',
                       background: s.id === currentSessionId ? 'var(--card-bg)' : 'transparent',
                       borderRadius: 14,
                       cursor: 'pointer',
                       border: s.id === currentSessionId ? '1px solid var(--accent-border)' : '1px solid transparent',
                       transition: 'all 0.2s',
                       animation: `fadeIn 0.2s ease ${idx * 0.03}s both`
                     }}
                       onMouseEnter={e => { if (s.id !== currentSessionId) e.currentTarget.style.background = 'var(--card-bg)'; }}
                       onMouseLeave={e => { if (s.id !== currentSessionId) e.currentTarget.style.background = 'transparent'; }}
                     >
                       <div style={{
                         width: 36, height: 36, borderRadius: 12, flexShrink: 0,
                         background: s.id === currentSessionId ? 'var(--accent-bg)' : 'var(--bg-primary)',
                         display: 'flex', alignItems: 'center', justifyContent: 'center',
                         border: '1px solid var(--border-color)'
                       }}>
                         <MessageCircle size={16} color={s.id === currentSessionId ? 'var(--accent)' : 'var(--text-muted)'} />
                       </div>
                       <div style={{ flex: 1, overflow: 'hidden' }}>
                         <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                           {s.title}
                         </div>
                         <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                           {new Date(s.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {new Date(s.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                         </div>
                       </div>
                       <button onClick={(e) => deleteSession(e, s.id)} style={{
                         background: 'transparent', border: 'none', color: 'var(--text-muted)',
                         cursor: 'pointer', padding: 6, borderRadius: 8, transition: 'all 0.2s'
                       }}
                         onMouseEnter={e => { e.currentTarget.style.background = 'var(--danger-bg)'; e.currentTarget.style.color = 'var(--danger)'; }}
                         onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                       >
                         <Trash2 size={14} />
                       </button>
                     </div>
                   ))}
                 </div>
               )}
             </div>
          ) : (
            /* Chat View */
            <>
              <div style={{ flex: 1, overflowY: 'auto', padding: 18, background: 'var(--bg-primary)' }}>
                {messages.map((m, idx) => {
                  const msgTime = m.timestamp ? new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                  return (
                    <div key={idx} style={{
                      marginBottom: 18,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: m.role === 'user' ? 'flex-end' : 'flex-start',
                      animation: `fadeIn 0.3s ease`
                    }}>
                      {/* Avatar for assistant */}
                      {m.role === 'assistant' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                          <div style={{
                            width: 22, height: 22, borderRadius: 8,
                            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                          }}>
                            <Sparkles size={12} color="#fff" />
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>AI Assistant</span>
                        </div>
                      )}
                      <div style={{
                        maxWidth: '85%',
                        padding: m.role === 'user' ? '11px 16px' : '14px 16px',
                        borderRadius: 18,
                        borderBottomRightRadius: m.role === 'user' ? 6 : 18,
                        borderTopLeftRadius: m.role === 'assistant' ? 6 : 18,
                        background: m.role === 'user'
                          ? 'linear-gradient(135deg, #6366f1, #7c3aed)'
                          : 'var(--card-bg)',
                        color: m.role === 'user' ? '#fff' : 'var(--text-primary)',
                        border: m.role === 'assistant' ? '1px solid var(--border-color)' : 'none',
                        lineHeight: 1.6,
                        fontSize: 13.5,
                        whiteSpace: m.role === 'user' ? 'pre-wrap' : 'normal',
                        wordBreak: 'break-word',
                        boxShadow: m.role === 'user'
                          ? '0 4px 12px rgba(99, 102, 241, 0.2)'
                          : '0 1px 3px rgba(0,0,0,0.04)'
                      }}>
                        {m.role === 'user' ? (
                          m.content
                        ) : (
                          <div className="markdown-body" style={{ fontSize: 13.5 }}>
                            <ReactMarkdown>{m.content}</ReactMarkdown>
                          </div>
                        )}
                      </div>
                      {msgTime && (
                        <div style={{
                          fontSize: 10,
                          color: 'var(--text-muted)',
                          marginTop: 5,
                          opacity: 0.7,
                          marginRight: m.role === 'user' ? 4 : 0,
                          marginLeft: m.role === 'assistant' ? 4 : 0
                        }}>
                          {msgTime}
                        </div>
                      )}
                    </div>
                  );
                })}
                {isLoading && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 18 }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: 8,
                      background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                    }}>
                      <Sparkles size={12} color="#fff" />
                    </div>
                    <div style={{
                      padding: '12px 18px', borderRadius: 18, borderTopLeftRadius: 6,
                      background: 'var(--card-bg)', border: '1px solid var(--border-color)',
                      display: 'flex', gap: 5, alignItems: 'center',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                    }}>
                      <span className="typing-dot"></span>
                      <span className="typing-dot"></span>
                      <span className="typing-dot"></span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div style={{
                padding: '14px 18px',
                background: 'var(--card-bg)',
                borderTop: '1px solid var(--border-color)'
              }}>
                <form onSubmit={handleSend} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <input
                    type="text"
                    placeholder="Ask about nutrition, workouts..."
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    disabled={isLoading}
                    style={{
                      flex: 1,
                      padding: '12px 18px',
                      borderRadius: 16,
                      border: '1px solid var(--border-color)',
                      outline: 'none',
                      fontSize: 14,
                      fontFamily: 'inherit',
                      background: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                      transition: 'all 0.2s',
                    }}
                    onFocus={e => {
                      e.target.style.borderColor = 'var(--accent)';
                      e.target.style.background = 'var(--card-bg)';
                      e.target.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.08)';
                    }}
                    onBlur={e => {
                      e.target.style.borderColor = 'var(--border-color)';
                      e.target.style.background = 'var(--bg-primary)';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                  <button
                    type="submit"
                    disabled={isLoading || !input.trim()}
                    style={{
                      background: input.trim() ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'var(--bg-primary)',
                      color: input.trim() ? '#fff' : 'var(--text-muted)',
                      border: input.trim() ? 'none' : '1px solid var(--border-color)',
                      borderRadius: 14,
                      width: 44,
                      height: 44,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: (isLoading || !input.trim()) ? 'default' : 'pointer',
                      transition: 'all 0.3s',
                      flexShrink: 0,
                      boxShadow: input.trim() ? '0 4px 16px rgba(99, 102, 241, 0.3)' : 'none'
                    }}
                  >
                    <Send size={18} style={{ marginLeft: 1 }} />
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
