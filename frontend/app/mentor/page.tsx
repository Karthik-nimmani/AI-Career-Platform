"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';
import { 
  Sparkles, 
  FileText, 
  Briefcase, 
  Compass, 
  Map, 
  LogOut, 
  User,
  Send,
  Loader2,
  Brain,
  HelpCircle,
  TrendingUp,
  MessageSquare,
  UserCheck,
  Settings,
  Trash2,
  Mic,
  MicOff
} from 'lucide-react';
import Link from 'next/link';

interface Message {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  agent?: string; // e.g. resume, career, interview, skill
  created_at?: string;
}

export default function MentorPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, session, signOut, isLoading: authLoading } = useAuthStore();

  // Chat States
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(true);
  
  // Streaming/Agent status
  const [streaming, setStreaming] = useState(false);
  const [activeAgent, setActiveAgent] = useState<string | null>(null);
  const [agentExplanation, setAgentExplanation] = useState<string | null>(null);
  
  // Speech Recognition States
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Suggested Prompts
  const suggestedPrompts = [
    { label: "Mock interview me for a technical role", icon: <MessageSquare className="h-4 w-4 text-primary" /> },
    { label: "Review my resume skills and find gaps", icon: <Brain className="h-4 w-4 text-accent-purple" /> },
    { label: "What learning path will help me learn Docker?", icon: <Map className="h-4 w-4 text-accent-cyan" /> },
    { label: "Give me career options to transition to AI Engineering", icon: <TrendingUp className="h-4 w-4 text-accent" /> }
  ];

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  // Scroll to bottom on messages update
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streaming]);

  // Load chat histories on mount
  useEffect(() => {
    async function loadHistory() {
      try {
        setLoadingHistory(true);
        const res = await api.get(`/api/mentor/history?t=${Date.now()}`);
        const formatted: Message[] = res.data.map((h: any) => ({
          role: h.sender === 'user' ? 'user' : 'assistant',
          content: h.message,
          created_at: h.created_at
        }));
        setMessages(formatted);
      } catch (err) {
        console.error("Failed to load chat history", err);
      } finally {
        setLoadingHistory(false);
      }
    }
    if (user) {
      loadHistory();
    }
  }, [user, pathname]);

  // Initialize Speech Recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.continuous = false;
        rec.interimResults = false;
        rec.lang = 'en-US';

        rec.onstart = () => {
          setIsListening(true);
        };

        rec.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setInputText((prev) => prev + (prev ? ' ' : '') + transcript);
        };

        rec.onerror = (event: any) => {
          console.error("Speech recognition error:", event.error);
          setIsListening(false);
        };

        rec.onend = () => {
          setIsListening(false);
        };

        setRecognition(rec);
      }
    }
  }, []);

  const toggleListening = () => {
    if (!recognition) {
      alert("Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.");
      return;
    }

    if (isListening) {
      recognition.stop();
    } else {
      try {
        recognition.start();
      } catch (err) {
        console.error("Failed to start speech recognition:", err);
      }
    }
  };

  // Handle message submission (Streaming client-side fetch reader)
  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || streaming) return;

    const userMessage: Message = { role: 'user', content: textToSend };
    const updatedMessages = [...messages, userMessage];
    
    // Clear input
    setInputText('');
    setMessages(updatedMessages);
    setStreaming(true);
    setActiveAgent(null);
    setAgentExplanation(null);

    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const token = session?.access_token;

      // Call streaming POST endpoint using standard fetch reader API
      const response = await fetch(`${apiBaseUrl}/api/mentor/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          messages: updatedMessages.map(m => ({ role: m.role, content: m.content }))
        })
      });

      if (!response.ok) {
        throw new Error("HTTP error on streaming connection.");
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Failed to initialize stream reader.");
      }

      const decoder = new TextDecoder();
      
      // Append blank assistant message placeholder
      setMessages(prev => [...prev, { role: 'assistant', content: '', agent: 'routing...' }]);

      let assistantReply = "";
      let detectedAgent = "career";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6).trim();
            if (dataStr === '[DONE]') break;
            
            try {
              const payload = JSON.parse(dataStr);
              if (payload.event === 'route') {
                detectedAgent = payload.agent;
                setActiveAgent(payload.agent);
                setAgentExplanation(payload.explanation);
                
                // Update agent state on assistant bubble
                setMessages(prev => {
                  const copy = [...prev];
                  if (copy.length > 0) {
                    copy[copy.length - 1].agent = payload.agent;
                  }
                  return copy;
                });
              } else if (payload.event === 'token') {
                assistantReply += payload.text;
                
                // Stream token to screen
                setMessages(prev => {
                  const copy = [...prev];
                  if (copy.length > 0) {
                    copy[copy.length - 1].content = assistantReply;
                  }
                  return copy;
                });
              } else if (payload.event === 'error') {
                setMessages(prev => {
                  const copy = [...prev];
                  if (copy.length > 0) {
                    copy[copy.length - 1].content = `Error: ${payload.detail}`;
                  }
                  return copy;
                });
              }
            } catch (jsonErr) {
              // Ignore partial JSON parsing errors during stream splits
            }
          }
        }
      }

    } catch (err: any) {
      console.error(err);
      setMessages(prev => [
        ...prev, 
        { role: 'assistant', content: "An error occurred while streaming response. Please verify backend configurations." }
      ]);
    } finally {
      setStreaming(false);
    }
  };

  const getAgentLabel = (agentCode: string) => {
    switch(agentCode) {
      case 'resume': return 'Resume Analyst';
      case 'interview': return 'Interview Coach';
      case 'skill': return 'Skill Advisor';
      case 'career': return 'Career Architect';
      case 'routing...': return 'Routing intent...';
      default: return 'Career Mentor';
    }
  };

  const getAgentColor = (agentCode: string) => {
    switch(agentCode) {
      case 'resume': return 'bg-primary/10 border-primary/20 text-primary';
      case 'interview': return 'bg-accent/10 border-accent/20 text-accent';
      case 'skill': return 'bg-accent-cyan/10 border-accent-cyan/20 text-accent-cyan';
      case 'career': return 'bg-accent-purple/10 border-accent-purple/20 text-accent-purple';
      default: return 'bg-secondary border-border text-muted';
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#08070d] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-muted text-sm">Loading session...</p>
        </div>
      </div>
    );
  }

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';

  return (
    <div className="min-h-screen bg-[#08070d] flex flex-col md:flex-row text-foreground">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 bg-[#0e0d1a] border-r border-border p-6 flex flex-col justify-between shrink-0">
        <div className="space-y-8">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <span className="font-outfit font-bold text-xl tracking-tight">AI Career Intel</span>
          </div>

          <nav className="space-y-1">
            <Link 
              href="/dashboard" 
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-muted hover:text-foreground hover:bg-[#141320] font-medium transition-all text-sm"
            >
              <TrendingUp className="h-5 w-5" />
              Overview
            </Link>
            <Link 
              href="/resume" 
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-muted hover:text-foreground hover:bg-[#141320] font-medium transition-all text-sm"
            >
              <FileText className="h-5 w-5" />
              Resume Parser
            </Link>
            <Link 
              href="/jobs" 
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-muted hover:text-foreground hover:bg-[#141320] font-medium transition-all text-sm"
            >
              <Briefcase className="h-5 w-5" />
              Job Matcher
            </Link>
            <Link 
              href="/roadmap" 
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-muted hover:text-foreground hover:bg-[#141320] font-medium transition-all text-sm"
            >
              <Map className="h-5 w-5" />
              Roadmaps
            </Link>
            <Link 
              href="/mentor" 
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-primary text-primary-foreground font-medium transition-all shadow-glow text-sm"
            >
              <Compass className="h-5 w-5" />
              AI Mentor
            </Link>
            <Link 
              href="/settings" 
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-muted hover:text-foreground hover:bg-[#141320] font-medium transition-all text-sm"
            >
              <Settings className="h-5 w-5" />
              Settings
            </Link>
          </nav>
        </div>

        <div className="pt-6 border-t border-border mt-8 md:mt-0">
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center border border-border">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-semibold truncate">{userName}</p>
              <p className="text-xs text-muted truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/20 text-accent hover:bg-destructive/20 font-medium transition-all text-sm"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Chat Workspace */}
      <main className="flex-grow p-6 md:p-10 max-w-4xl mx-auto w-full flex flex-col h-screen overflow-hidden">
        {/* Workspace Header */}
        <section className="mb-4 shrink-0 flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 text-primary">
              <Compass className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold font-outfit">AI Career Mentor</h1>
              <p className="text-muted text-xs">LangGraph Multi-Agent Orchestration Hub</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {activeAgent && (
              <div className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-all animate-pulse ${getAgentColor(activeAgent)}`}>
                Agent: {getAgentLabel(activeAgent)}
              </div>
            )}
            {messages.length > 0 && (
              <button
                onClick={async () => {
                  if (window.confirm("Are you sure you want to clear your conversation history?")) {
                    try {
                      await api.delete('/api/mentor/history');
                      setMessages([]);
                      setActiveAgent(null);
                      setAgentExplanation(null);
                    } catch (err) {
                      console.error("Failed to clear chat history", err);
                    }
                  }
                }}
                className="flex items-center gap-1 bg-[#ff4a4a]/10 border border-[#ff4a4a]/20 hover:bg-[#ff4a4a]/25 text-accent px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear Chat
              </button>
            )}
          </div>
        </section>

        {/* Chat Scrolling Window */}
        <section className="flex-grow overflow-y-auto mb-6 pr-2 space-y-4 min-h-0 bg-[#0e0d1a]/20 rounded-2xl p-4 border border-border/50">
          {loadingHistory ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            /* Empty state - suggestions */
            <div className="h-full flex flex-col justify-center items-center text-center px-4 max-w-md mx-auto space-y-8">
              <div className="p-4 rounded-full bg-secondary border border-border text-primary animate-bounce">
                <Brain className="h-10 w-10" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-bold font-outfit">Talk to your Career Mentors</h3>
                <p className="text-muted text-xs leading-relaxed">
                  Start conversing below. The orchestrator automatically routes your questions to specialized agents who read your uploaded resume context.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 w-full">
                {suggestedPrompts.map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(prompt.label)}
                    className="flex items-center gap-3 p-4 rounded-xl border border-border bg-[#141320] hover:border-primary/35 hover:bg-[#111025] transition-all text-xs text-left text-gray-300 font-medium group"
                  >
                    {prompt.icon}
                    <span className="flex-grow truncate">{prompt.label}</span>
                    <Send className="h-3.5 w-3.5 text-muted group-hover:text-primary transition-colors shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Message bubbles list */
            <div className="space-y-4">
              {messages.map((msg, index) => (
                <div 
                  key={index}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[85%] rounded-2xl p-4 leading-relaxed text-sm ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground font-medium rounded-tr-none'
                      : 'glass-panel rounded-tl-none space-y-2 text-gray-300'
                  }`}>
                    {/* Role / Agent badge header for assistant */}
                    {msg.role === 'assistant' && msg.agent && (
                      <div className="flex items-center justify-between pb-2 border-b border-border/40 mb-2">
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${getAgentColor(msg.agent)}`}>
                          {getAgentLabel(msg.agent)}
                        </span>
                      </div>
                    )}
                    
                    {/* Message body content */}
                    <div className="whitespace-pre-wrap leading-relaxed text-gray-200">
                      {msg.content || (
                        <span className="flex items-center gap-2 text-xs italic text-muted">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Analyzing intent...
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={chatEndRef}></div>
            </div>
          )}
        </section>

        {/* Chat input box */}
        <section className="shrink-0">
          {messages.length > 0 && suggestedPrompts.length > 0 && !streaming && (
            /* Suggested pills slider */
            <div className="flex gap-2 overflow-x-auto pb-2 mb-2 scrollbar-none whitespace-nowrap">
              {suggestedPrompts.slice(0, 2).map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(prompt.label)}
                  className="bg-[#141320] hover:bg-[#1a192c] border border-border px-3 py-1.5 rounded-full text-xs text-muted hover:text-foreground transition-all shrink-0"
                >
                  {prompt.label}
                </button>
              ))}
            </div>
          )}

          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage(inputText);
            }}
            className="flex gap-3"
          >
            <div className="relative flex-grow flex items-center">
              <input
                type="text"
                placeholder="Ask your mentor about interview prep, resumes, roadmaps, or salaries..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                disabled={streaming}
                className="w-full bg-[#141320] border border-border rounded-xl pl-4 pr-12 py-3.5 text-foreground placeholder-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-sm leading-relaxed"
              />
              <button
                type="button"
                onClick={toggleListening}
                disabled={streaming}
                className={`absolute right-3 p-2 rounded-lg transition-all ${
                  isListening 
                    ? 'bg-red-500/20 text-red-500 border border-red-500/30 animate-pulse' 
                    : 'text-muted hover:text-foreground hover:bg-secondary/40'
                }`}
                title={isListening ? "Stop listening" : "Start voice typing"}
              >
                {isListening ? (
                  <MicOff className="h-5 w-5" />
                ) : (
                  <Mic className="h-5 w-5" />
                )}
              </button>
            </div>
            <button
              type="submit"
              disabled={streaming || !inputText.trim()}
              className="bg-primary hover:bg-primary-hover disabled:bg-secondary disabled:text-muted text-primary-foreground font-semibold p-4 rounded-xl transition-all shadow-glow flex items-center justify-center shrink-0"
            >
              {streaming ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
