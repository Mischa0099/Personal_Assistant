import React, { useState, useEffect, useRef } from 'react';
import { Brain, Music, Video, Calendar, MessageSquare, TrendingUp, Send, Loader, ExternalLink, Target, Plus, Clock, Play, Pause, X } from 'lucide-react';

const AIProductivityAssistant = () => {
  const [activeTab, setActiveTab] = useState('chat');
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  const [detectedMood, setDetectedMood] = useState(null);
  const [moodConfidence, setMoodConfidence] = useState(0);
  const [userContext, setUserContext] = useState({});
  const [userProfile, setUserProfile] = useState({});
  
  const [playlists, setPlaylists] = useState([]);
  const [videos, setVideos] = useState([]);
  const [videoType, setVideoType] = useState('educational');
  const [loadingMusic, setLoadingMusic] = useState(false);
  const [loadingVideos, setLoadingVideos] = useState(false);
  
  const [researchResources, setResearchResources] = useState(null);
  const [loadingResearch, setLoadingResearch] = useState(false);
  
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState('');
  const [pomodoroTime, setPomodoroTime] = useState(25);
  const [pomodoroActive, setPomodoroActive] = useState(false);
  const [pomodoroSeconds, setPomodoroSeconds] = useState(25 * 60);
  
  const chatEndRef = useRef(null);
  const API_BASE = process.env.REACT_APP_API_URL
    ? `${process.env.REACT_APP_API_URL}/api`
    : 'http://localhost:5000/api';

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  useEffect(() => {
    setChatMessages([{
      type: 'ai',
      text: "Hi! I'm your AI Life Navigator. Tell me about yourself - what are you studying? What class/year are you in? What do you need help with today? 🌟",
      timestamp: new Date()
    }]);
  }, []);

  // Pomodoro Timer
  useEffect(() => {
    let interval = null;
    if (pomodoroActive && pomodoroSeconds > 0) {
      interval = setInterval(() => {
        setPomodoroSeconds(seconds => seconds - 1);
      }, 1000);
    } else if (pomodoroSeconds === 0) {
      setPomodoroActive(false);
      alert('🍅 Pomodoro session complete! Take a 5-minute break!');
      setPomodoroSeconds(pomodoroTime * 60);
    }
    return () => clearInterval(interval);
  }, [pomodoroActive, pomodoroSeconds, pomodoroTime]);

  const startPomodoro = () => {
    setPomodoroActive(true);
  };

  const pausePomodoro = () => {
    setPomodoroActive(false);
  };

  const resetPomodoro = () => {
    setPomodoroActive(false);
    setPomodoroSeconds(pomodoroTime * 60);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const analyzeMessage = async (message) => {
    try {
      const response = await fetch(`${API_BASE}/analyze-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, user_id: 'user1' })
      });
      
      if (!response.ok) throw new Error('Failed');
      
      const data = await response.json();
      
      setDetectedMood(data.mood);
      setMoodConfidence(data.confidence);
      setUserContext(data.context);
      setUserProfile(data.user_profile);
      
      return data;
    } catch (error) {
      console.error('Error:', error);
      setChatMessages(prev => [...prev, {
        type: 'system',
        text: '⚠️ Backend error. Make sure Flask server is running.',
        timestamp: new Date()
      }]);
      return null;
    }
  };

  const fetchMusicRecommendations = async () => {
    setLoadingMusic(true);
    try {
      const response = await fetch(`${API_BASE}/music-recommendations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          mood: detectedMood,
          context: userContext
        })
      });
      
      const data = await response.json();
      
      if (data.auth_url) {
        window.open(data.auth_url, '_blank');
        setChatMessages(prev => [...prev, {
          type: 'system',
          text: '🎵 Authenticate with Spotify to get personalized playlists!',
          timestamp: new Date()
        }]);
        return;
      }
      
      setPlaylists(data.playlists || []);
    } catch (error) {
      console.error('Music error:', error);
    } finally {
      setLoadingMusic(false);
    }
  };

  const fetchVideoRecommendations = async (type) => {
    setLoadingVideos(true);
    try {
      const response = await fetch(`${API_BASE}/video-recommendations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          mood: detectedMood,
          context: userContext,
          user_profile: userProfile,
          video_type: type || videoType
        })
      });
      
      const data = await response.json();
      setVideos(data.videos || []);
    } catch (error) {
      console.error('Video error:', error);
    } finally {
      setLoadingVideos(false);
    }
  };

  const fetchResearchResources = async () => {
    if (!userContext.subjects || userContext.subjects.length === 0) {
      setChatMessages(prev => [...prev, {
        type: 'system',
        text: '📚 Tell me what subject you want to research first! (e.g., "I want to research psychology")',
        timestamp: new Date()
      }]);
      return;
    }

    setLoadingResearch(true);
    const topic = userContext.subjects[0];
    
    try {
      const response = await fetch(`${API_BASE}/research-resources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic })
      });
      
      const data = await response.json();
      setResearchResources(data);
      setActiveTab('research');
    } catch (error) {
      console.error('Research error:', error);
    } finally {
      setLoadingResearch(false);
    }
  };

  const addTask = async () => {
    if (!newTask.trim()) return;
    
    const task = {
      id: Date.now(),
      name: newTask,
      completed: false,
      pomodoro: pomodoroTime
    };
    
    setTasks([...tasks, task]);
    
    // Add to Google Calendar
    try {
      await fetch(`${API_BASE}/add-task`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_name: newTask,
          duration: pomodoroTime,
          pomodoro: true
        })
      });
      
      setChatMessages(prev => [...prev, {
        type: 'system',
        text: `✅ Task "${newTask}" added to your calendar with ${pomodoroTime}-min Pomodoro!`,
        timestamp: new Date()
      }]);
    } catch (error) {
      console.error('Calendar error:', error);
    }
    
    setNewTask('');
  };

  const generateSmartResponse = (mood, context) => {
    const subjects = context.subjects || [];
    const currentTask = context.current_task;
    
    if (mood === 'unmotivated') {
      if (subjects.includes('physics')) {
        return "I understand physics can feel overwhelming sometimes. But you know what? Every physicist started exactly where you are. Let's break this down into small wins. I've found some focus music and motivational content just for you. Want to start with a 25-minute Pomodoro session? 💪";
      }
      return "Feeling unmotivated is totally normal! Your brain needs the right environment. I've curated specific playlists and videos to help you get in the zone. Let's start small - just 25 minutes of focused work. You've got this! 🎯";
    } else if (mood === 'stressed') {
      return "I can feel the pressure you're under. Take a deep breath. Let's organize this together. I'll help you create a realistic schedule, and I've got some calming music ready. One task at a time, okay? 🧘";
    } else if (mood === 'motivated') {
      return "YES! That's the energy! Let's channel this into serious productivity. I've got high-focus playlists ready. Let's set up your tasks with Pomodoro timers and crush this! 🚀";
    } else if (mood === 'tired') {
      return "You sound exhausted. Maybe you need a gentle start? I've got some lo-fi beats that won't drain you more. Let's plan shorter focused sessions with good breaks. Your wellbeing matters! ☕";
    }
    
    return "I'm here to support you! Tell me more about what you're working on, and I'll tailor everything specifically for you. 🌟";
  };

  const sendMessage = async () => {
    if (!chatInput.trim()) return;

    const userMessage = {
      type: 'user',
      text: chatInput,
      timestamp: new Date()
    };

    setChatMessages(prev => [...prev, userMessage]);
    setIsAnalyzing(true);
    
    const currentInput = chatInput;
    setChatInput('');

    const analysis = await analyzeMessage(currentInput);
    
    if (analysis) {
      const aiResponse = generateSmartResponse(analysis.mood, analysis.context);
      
      setChatMessages(prev => [...prev, {
        type: 'ai',
        text: aiResponse,
        timestamp: new Date()
      }]);

      // Show motivational quote
      if (analysis.motivational_quote) {
        setTimeout(() => {
          setChatMessages(prev => [...prev, {
            type: 'quote',
            text: `💫 ${analysis.motivational_quote}`,
            timestamp: new Date()
          }]);
        }, 1500);
      }

      // Ask for education level if needed
      if (analysis.needs_education_info) {
        setTimeout(() => {
          setChatMessages(prev => [...prev, {
            type: 'ai',
            text: `To give you the best learning resources, what's your current education level? (e.g., "I'm in 12th grade" or "I'm an undergraduate" or "I'm a medical student")`,
            timestamp: new Date()
          }]);
        }, 2000);
      }

      // Research support
      if (analysis.needs_research_support) {
        setTimeout(async () => {
          await fetchResearchResources();
          
          setChatMessages(prev => [...prev, {
            type: 'system',
            text: `🔬 I've prepared research resources for you! Check the Research tab to access papers, books, and databases.`,
            timestamp: new Date()
          }]);
        }, 2500);
      }

      // Auto-fetch recommendations
      if (analysis.context.subjects && analysis.context.subjects.length > 0) {
        await fetchVideoRecommendations('educational');
        setChatMessages(prev => [...prev, {
          type: 'system',
          text: `📚 Found learning resources for ${analysis.context.subjects.join(', ')}! Check the Videos tab.`,
          timestamp: new Date()
        }]);
      }
    }

    setIsAnalyzing(false);
  };

  const formatDuration = (isoDuration) => {
    const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return '';
    const hours = match[1] || 0;
    const minutes = match[2] || 0;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const formatViews = (count) => {
    const num = parseInt(count);
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(10px)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Brain style={{ width: '32px', height: '32px', color: '#f9a8d4' }} />
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>AI Life Navigator</h1>
              <p style={{ fontSize: '0.75rem', color: '#d1d5db', margin: 0 }}>Your Personal Study Companion</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {detectedMood && (
              <div style={{ padding: '0.5rem 1rem', background: 'rgba(255,255,255,0.1)', borderRadius: '9999px' }}>
                <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{detectedMood}</span>
              </div>
            )}
            {pomodoroActive && (
              <div style={{ padding: '0.5rem 1rem', background: 'rgba(239,68,68,0.2)', borderRadius: '9999px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Clock style={{ width: '16px', height: '16px' }} />
                <span style={{ fontWeight: 'bold' }}>{formatTime(pomodoroSeconds)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '1rem 1.5rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto' }}>
          {[
            { id: 'chat', icon: MessageSquare, label: 'Chat' },
            { id: 'tasks', icon: Calendar, label: 'Tasks', badge: tasks.length },
            { id: 'research', icon: Target, label: 'Research', badge: researchResources ? 1 : 0 },
            { id: 'videos', icon: Video, label: 'Videos', badge: videos.length },
            { id: 'music', icon: Music, label: 'Music', badge: playlists.length },
            { id: 'dashboard', icon: TrendingUp, label: 'Profile' }
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '0.5rem',
                  background: activeTab === tab.id ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.05)',
                  border: 'none',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '1rem'
                }}
              >
                <Icon style={{ width: '20px', height: '20px' }} />
                <span>{tab.label}</span>
                {tab.badge > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '-4px',
                    right: '-4px',
                    minWidth: '20px',
                    height: '20px',
                    padding: '0 6px',
                    background: '#ec4899',
                    borderRadius: '9999px',
                    fontSize: '0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 1.5rem 1.5rem' }}>
        {activeTab === 'chat' && (
          <div style={{ maxWidth: '56rem', margin: '0 auto' }}>
            <div style={{ background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden' }}>
              <div style={{ height: '500px', overflowY: 'auto', padding: '1.5rem' }}>
                {chatMessages.map((msg, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: msg.type === 'user' ? 'flex-end' : 'flex-start', marginBottom: '1rem' }}>
                    <div style={{
                      maxWidth: msg.type === 'quote' ? '90%' : '80%',
                      padding: '0.75rem 1rem',
                      borderRadius: '1rem',
                      background: msg.type === 'user' 
                        ? 'linear-gradient(to right, #a855f7, #ec4899)' 
                        : msg.type === 'system' 
                        ? 'rgba(59, 130, 246, 0.3)' 
                        : msg.type === 'quote'
                        ? 'linear-gradient(135deg, #fbbf24, #f59e0b)'
                        : 'rgba(255,255,255,0.1)'
                    }}>
                      <p style={{ margin: 0, lineHeight: '1.5', fontStyle: msg.type === 'quote' ? 'italic' : 'normal', fontWeight: msg.type === 'quote' ? 500 : 'normal' }}>{msg.text}</p>
                      
                      <p style={{ fontSize: '0.75rem', color: msg.type === 'quote' ? '#78350f' : '#d1d5db', margin: '0.25rem 0 0 0' }}>
                        {msg.timestamp?.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
                {isAnalyzing && (
                  <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                    <div style={{ background: 'rgba(255,255,255,0.1)', padding: '0.75rem 1rem', borderRadius: '1rem' }}>
                      <Loader style={{ width: '20px', height: '20px' }} />
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
              
              <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.05)', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="Tell me what you're studying, how you feel, what you need help with..."
                    style={{
                      flex: 1,
                      padding: '0.75rem 1rem',
                      background: 'rgba(255,255,255,0.1)',
                      borderRadius: '0.5rem',
                      border: '1px solid rgba(255,255,255,0.2)',
                      color: 'white',
                      fontSize: '1rem'
                    }}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={isAnalyzing}
                    style={{
                      padding: '0.75rem 1.5rem',
                      background: 'linear-gradient(to right, #a855f7, #ec4899)',
                      borderRadius: '0.5rem',
                      border: 'none',
                      cursor: 'pointer',
                      opacity: isAnalyzing ? 0.5 : 1
                    }}
                  >
                    <Send style={{ width: '20px', height: '20px', color: 'white' }} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'tasks' && (
          <div style={{ maxWidth: '56rem', margin: '0 auto' }}>
            <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '1rem', padding: '1.5rem', border: '1px solid rgba(255,255,255,0.1)', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>🍅 Pomodoro Timer</h2>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '4rem', fontWeight: 'bold', marginBottom: '1rem' }}>
                  {formatTime(pomodoroSeconds)}
                </div>
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginBottom: '1rem' }}>
                  {!pomodoroActive ? (
                    <button onClick={startPomodoro} style={{
                      padding: '0.75rem 2rem',
                      background: 'linear-gradient(to right, #10b981, #059669)',
                      borderRadius: '0.5rem',
                      border: 'none',
                      color: 'white',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      fontSize: '1rem'
                    }}>
                      <Play style={{ width: '20px' }} /> Start Focus Session
                    </button>
                  ) : (
                    <button onClick={pausePomodoro} style={{
                      padding: '0.75rem 2rem',
                      background: 'linear-gradient(to right, #ef4444, #dc2626)',
                      borderRadius: '0.5rem',
                      border: 'none',
                      color: 'white',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      fontSize: '1rem'
                    }}>
                      <Pause style={{ width: '20px' }} /> Pause
                    </button>
                  )}
                  <button onClick={resetPomodoro} style={{
                    padding: '0.75rem 1.5rem',
                    background: 'rgba(255,255,255,0.1)',
                    borderRadius: '0.5rem',
                    border: '1px solid rgba(255,255,255,0.2)',
                    color: 'white',
                    cursor: 'pointer'
                  }}>
                    Reset
                  </button>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                  {[15, 25, 45].map(time => (
                    <button
                      key={time}
                      onClick={() => {
                        setPomodoroTime(time);
                        setPomodoroSeconds(time * 60);
                      }}
                      style={{
                        padding: '0.5rem 1rem',
                        background: pomodoroTime === time ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.05)',
                        borderRadius: '0.5rem',
                        border: 'none',
                        color: 'white',
                        cursor: 'pointer'
                      }}
                    >
                      {time} min
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '1rem', padding: '1.5rem', border: '1px solid rgba(255,255,255,0.1)' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>📝 My Tasks</h2>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                <input
                  type="text"
                  value={newTask}
                  onChange={(e) => setNewTask(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addTask()}
                  placeholder="Add a task..."
                  style={{
                    flex: 1,
                    padding: '0.75rem 1rem',
                    background: 'rgba(255,255,255,0.1)',
                    borderRadius: '0.5rem',
                    border: '1px solid rgba(255,255,255,0.2)',
                    color: 'white'
                  }}
                />
                <button onClick={addTask} style={{
                  padding: '0.75rem 1.5rem',
                  background: 'linear-gradient(to right, #a855f7, #ec4899)',
                  borderRadius: '0.5rem',
                  border: 'none',
                  color: 'white',
                  cursor: 'pointer'
                }}>
                  <Plus style={{ width: '20px', height: '20px' }} />
                </button>
              </div>

              {tasks.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#9ca3af', padding: '2rem' }}>No tasks yet. Add one to get started!</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {tasks.map(task => (
                    <div key={task.id} style={{
                      padding: '1rem',
                      background: 'rgba(255,255,255,0.05)',
                      borderRadius: '0.5rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div>
                        <p style={{ margin: 0, fontWeight: 500 }}>{task.name}</p>
                        <p style={{ margin: 0, fontSize: '0.875rem', color: '#9ca3af' }}>🍅 {task.pomodoro} min session</p>
                      </div>
                      <button
                        onClick={() => setTasks(tasks.filter(t => t.id !== task.id))}
                        style={{
                          padding: '0.5rem',
                          background: 'rgba(239,68,68,0.2)',
                          borderRadius: '0.5rem',
                          border: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        <X style={{ width: '16px', height: '16px', color: '#ef4444' }} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'research' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>🔬 Research Resources</h2>
              <button
                onClick={fetchResearchResources}
                disabled={loadingResearch}
                style={{
                  padding: '0.5rem 1rem',
                  background: 'linear-gradient(to right, #10b981, #059669)',
                  borderRadius: '0.5rem',
                  border: 'none',
                  color: 'white',
                  cursor: loadingResearch ? 'not-allowed' : 'pointer',
                  opacity: loadingResearch ? 0.5 : 1
                }}
              >
                {loadingResearch ? 'Loading...' : 'Refresh Resources'}
              </button>
            </div>

            {!researchResources ? (
              <div style={{ textAlign: 'center', padding: '3rem', background: 'rgba(255,255,255,0.1)', borderRadius: '1rem' }}>
                <Target style={{ width: '64px', height: '64px', margin: '0 auto 1rem', color: '#9ca3af' }} />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem' }}>Ready to Research?</h3>
                <p style={{ color: '#d1d5db', marginBottom: '1rem' }}>Tell me what subject you want to research!</p>
                <p style={{ fontSize: '0.875rem', color: '#9ca3af' }}>Examples:</p>
                <ul style={{ listStyle: 'none', padding: 0, fontSize: '0.875rem', color: '#9ca3af' }}>
                  <li>"I want to research cognitive psychology"</li>
                  <li>"Need papers on quantum mechanics"</li>
                  <li>"Looking for neuroscience research"</li>
                </ul>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '1rem', padding: '1.5rem', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                    📚 Researching: {researchResources.topic}
                  </h3>
                  <p style={{ color: '#d1d5db', fontSize: '0.875rem' }}>
                    Category: {researchResources.category}
                  </p>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '1rem', padding: '1.5rem', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    📄 Research Papers & Journals
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {researchResources.resources.papers.map((url, idx) => (
                      <a
                        key={idx}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          padding: '1rem',
                          background: 'rgba(59, 130, 246, 0.1)',
                          borderRadius: '0.5rem',
                          border: '1px solid rgba(59, 130, 246, 0.3)',
                          textDecoration: 'none',
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)';
                          e.currentTarget.style.transform = 'translateX(4px)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)';
                          e.currentTarget.style.transform = 'translateX(0)';
                        }}
                      >
                        <span style={{ fontSize: '0.9rem' }}>{url.replace('https://', '').split('/')[0]}</span>
                        <ExternalLink style={{ width: '16px', height: '16px' }} />
                      </a>
                    ))}
                  </div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '1rem', padding: '1.5rem', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    📚 Books & eBooks
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {researchResources.resources.books.map((url, idx) => (
                      <a
                        key={idx}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          padding: '1rem',
                          background: 'rgba(139, 92, 246, 0.1)',
                          borderRadius: '0.5rem',
                          border: '1px solid rgba(139, 92, 246, 0.3)',
                          textDecoration: 'none',
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(139, 92, 246, 0.2)';
                          e.currentTarget.style.transform = 'translateX(4px)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(139, 92, 246, 0.1)';
                          e.currentTarget.style.transform = 'translateX(0)';
                        }}
                      >
                        <span style={{ fontSize: '0.9rem' }}>{url.replace('https://', '').split('/')[0]}</span>
                        <ExternalLink style={{ width: '16px', height: '16px' }} />
                      </a>
                    ))}
                  </div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '1rem', padding: '1.5rem', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    🌐 General Resources & Databases
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {researchResources.resources.general.map((url, idx) => (
                      <a
                        key={idx}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          padding: '1rem',
                          background: 'rgba(16, 185, 129, 0.1)',
                          borderRadius: '0.5rem',
                          border: '1px solid rgba(16, 185, 129, 0.3)',
                          textDecoration: 'none',
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(16, 185, 129, 0.2)';
                          e.currentTarget.style.transform = 'translateX(4px)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(16, 185, 129, 0.1)';
                          e.currentTarget.style.transform = 'translateX(0)';
                        }}
                      >
                        <span style={{ fontSize: '0.9rem' }}>{url.replace('https://', '').split('/')[0]}</span>
                        <ExternalLink style={{ width: '16px', height: '16px' }} />
                      </a>
                    ))}
                  </div>
                </div>

                <div style={{ background: 'linear-gradient(to right, #f59e0b, #d97706)', borderRadius: '1rem', padding: '1.5rem' }}>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem' }}>💡 Pro Tip</h3>
                  <p style={{ margin: 0, fontSize: '0.9rem' }}>
                    Start with general resources to understand the topic, then dive into specific research papers. 
                    Don't forget to check the Videos tab for educational content too!
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'videos' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {[
                  { id: 'educational', label: '📚 Study Material' },
                  { id: 'motivational', label: '💪 Motivation' },
                  { id: 'tedtalks', label: '🎤 TED Talks' }
                ].map(type => (
                  <button
                    key={type.id}
                    onClick={() => {
                      setVideoType(type.id);
                      fetchVideoRecommendations(type.id);
                    }}
                    style={{
                      padding: '0.5rem 1rem',
                      background: videoType === type.id ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.05)',
                      borderRadius: '0.5rem',
                      border: 'none',
                      color: 'white',
                      cursor: 'pointer'
                    }}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => fetchVideoRecommendations()}
                disabled={loadingVideos}
                style={{
                  padding: '0.5rem 1rem',
                  background: 'linear-gradient(to right, #ef4444, #ec4899)',
                  borderRadius: '0.5rem',
                  border: 'none',
                  color: 'white',
                  cursor: loadingVideos ? 'not-allowed' : 'pointer',
                  opacity: loadingVideos ? 0.5 : 1
                }}
              >
                {loadingVideos ? 'Loading...' : 'Refresh'}
              </button>
            </div>

            {videos.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', background: 'rgba(255,255,255,0.1)', borderRadius: '1rem' }}>
                <Video style={{ width: '64px', height: '64px', margin: '0 auto 1rem', color: '#9ca3af' }} />
                <p>Chat with me first! Tell me what you're studying and I'll find perfect videos for you!</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                {videos.map((video, i) => (
                  <a
                    key={i}
                    href={video.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      background: 'rgba(255,255,255,0.1)',
                      borderRadius: '1rem',
                      overflow: 'hidden',
                      textDecoration: 'none',
                      color: 'white',
                      display: 'block',
                      transition: 'transform 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    <img src={video.thumbnail} alt={video.title} style={{ width: '100%', height: '180px', objectFit: 'cover' }} />
                    <div style={{ padding: '1rem' }}>
                      <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.5rem', lineHeight: '1.3', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                        {video.title}
                      </h3>
                      <p style={{ fontSize: '0.8rem', color: '#d1d5db', marginBottom: '0.5rem' }}>{video.channel}</p>
                      <div style={{ fontSize: '0.75rem', color: '#9ca3af', display: 'flex', gap: '0.5rem' }}>
                        <span>{formatViews(video.views)}</span>
                        <span>•</span>
                        <span>{formatDuration(video.duration)}</span>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'music' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>🎵 Focus Playlists</h2>
              <button
                onClick={() => fetchMusicRecommendations()}
                disabled={!detectedMood || loadingMusic}
                style={{
                  padding: '0.5rem 1rem',
                  background: 'linear-gradient(to right, #10b981, #059669)',
                  borderRadius: '0.5rem',
                  border: 'none',
                  color: 'white',
                  cursor: (!detectedMood || loadingMusic) ? 'not-allowed' : 'pointer',
                  opacity: (!detectedMood || loadingMusic) ? 0.5 : 1
                }}
              >
                {loadingMusic ? 'Loading...' : 'Get Playlists'}
              </button>
            </div>

            {playlists.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', background: 'rgba(255,255,255,0.1)', borderRadius: '1rem' }}>
                <Music style={{ width: '64px', height: '64px', margin: '0 auto 1rem', color: '#9ca3af' }} />
                <p>Chat with me about how you're feeling and what you're working on!</p>
                <p style={{ fontSize: '0.875rem', color: '#9ca3af' }}>I'll create the perfect playlist for your mood and task.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                {playlists.map((playlist, i) => (
                  <a
                    key={i}
                    href={playlist.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      background: 'rgba(255,255,255,0.1)',
                      borderRadius: '1rem',
                      padding: '1.5rem',
                      border: '1px solid rgba(255,255,255,0.1)',
                      textDecoration: 'none',
                      color: 'white',
                      display: 'block',
                      transition: 'transform 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    {playlist.image && (
                      <img src={playlist.image} alt={playlist.name} style={{ width: '100%', height: '192px', objectFit: 'cover', borderRadius: '0.5rem', marginBottom: '1rem' }} />
                    )}
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>{playlist.name}</h3>
                    <p style={{ color: '#d1d5db', fontSize: '0.875rem', marginBottom: '0.5rem', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {playlist.description}
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.875rem', color: '#9ca3af' }}>{playlist.tracks} tracks</span>
                      <ExternalLink style={{ width: '16px', height: '16px', color: '#f9a8d4' }} />
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'dashboard' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
            <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '1rem', padding: '1.5rem', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                <Brain style={{ width: '24px', height: '24px', color: '#f9a8d4' }} />
                <h3 style={{ fontSize: '1.125rem', fontWeight: 600, margin: 0 }}>Current Mood</h3>
              </div>
              <p style={{ fontSize: '1.875rem', fontWeight: 'bold', textTransform: 'capitalize', margin: '0.5rem 0' }}>
                {detectedMood || 'Not detected'}
              </p>
              <p style={{ fontSize: '0.875rem', color: '#d1d5db', margin: 0 }}>
                {moodConfidence > 0 ? `Confidence: ${(moodConfidence * 100).toFixed(0)}%` : 'Chat with me to detect your mood'}
              </p>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '1rem', padding: '1.5rem', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                <Target style={{ width: '24px', height: '24px', color: '#c084fc' }} />
                <h3 style={{ fontSize: '1.125rem', fontWeight: 600, margin: 0 }}>Studying</h3>
              </div>
              <p style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: '0.5rem 0' }}>
                {userProfile.subjects && userProfile.subjects.length > 0 
                  ? userProfile.subjects.join(', ') 
                  : 'Nothing yet'}
              </p>
              <p style={{ fontSize: '0.875rem', color: '#d1d5db', margin: 0 }}>
                {userProfile.education_level 
                  ? `Level: ${userProfile.education_level}` 
                  : 'Tell me what you\'re studying'}
              </p>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '1rem', padding: '1.5rem', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                <Calendar style={{ width: '24px', height: '24px', color: '#4ade80' }} />
                <h3 style={{ fontSize: '1.125rem', fontWeight: 600, margin: 0 }}>Tasks Today</h3>
              </div>
              <p style={{ fontSize: '1.875rem', fontWeight: 'bold', margin: '0.5rem 0' }}>
                {tasks.length}
              </p>
              <p style={{ fontSize: '0.875rem', color: '#d1d5db', margin: 0 }}>
                {tasks.length > 0 ? 'Keep going!' : 'Add tasks to stay organized'}
              </p>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '1rem', padding: '1.5rem', border: '1px solid rgba(255,255,255,0.1)', gridColumn: 'span 1' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>💡 Quick Tips</h3>
              <ul style={{ margin: 0, paddingLeft: '1.5rem', lineHeight: '1.8' }}>
                <li>Tell me your class/year for better recommendations</li>
                <li>Share what you're studying for subject-specific content</li>
                <li>Describe how you feel - I'll adapt my suggestions</li>
                <li>Use Pomodoro timer for focused study sessions</li>
                <li>Add tasks to sync with Google Calendar</li>
              </ul>
            </div>

            {userContext.current_task && (
              <div style={{ background: 'linear-gradient(to right, #a855f7, #ec4899)', borderRadius: '1rem', padding: '1.5rem', border: '1px solid rgba(255,255,255,0.1)', gridColumn: 'span 2' }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem' }}>🎯 Current Focus</h3>
                <p style={{ fontSize: '1.25rem', fontWeight: 500, margin: 0 }}>
                  {userContext.current_task}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AIProductivityAssistant;