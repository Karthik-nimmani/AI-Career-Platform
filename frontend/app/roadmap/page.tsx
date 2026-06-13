"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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
  TrendingUp,
  MapPin,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  BookOpen,
  Calendar,
  PlayCircle,
  FileSpreadsheet,
  Settings,
  Trash2
} from 'lucide-react';
import Link from 'next/link';

interface AnalysisHistoryItem {
  id: string;
  ats_score: number;
  match_percentage: number;
  created_at: string;
  resume_id: string;
  jd_id: string;
}

interface ResourceItem {
  name: string;
  url: string;
  category: string;
}

interface WeeklyModule {
  week_number: number;
  title: string;
  description: string;
  topics: string[];
  resources: ResourceItem[];
}

interface StudyRoadmap {
  duration_weeks: number;
  target_role: string;
  weeks: WeeklyModule[];
  message?: string;
}

export default function RoadmapPage() {
  const router = useRouter();
  const { user, signOut, isLoading: authLoading } = useAuthStore();

  // Analyses History States
  const [analyses, setAnalyses] = useState<AnalysisHistoryItem[]>([]);
  const [selectedAnalysisId, setSelectedAnalysisId] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Roadmap States
  const [roadmap, setRoadmap] = useState<StudyRoadmap | null>(null);
  const [loadingRoadmap, setLoadingRoadmap] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Completion Checkbox State (Persisted in localStorage)
  const [completedTopics, setCompletedTopics] = useState<Record<string, boolean>>({});

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  // Fetch histories
  const fetchHistory = useCallback(async () => {
    try {
      setLoadingHistory(true);
      setError(null);
      const res = await api.get('/api/analysis/my');
      setAnalyses(res.data);
      if (res.data && res.data.length > 0) {
        setSelectedAnalysisId(res.data[0].id);
      }
    } catch (err: any) {
      console.error("Failed to load match history:", err);
      if (err.response?.status !== 401) {
        setError("Could not load analysis history.");
      }
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchHistory();
    }
  }, [user, fetchHistory]);

  // Load selected analysis details (checks for cached roadmap)
  const loadRoadmap = useCallback(async (analysisId: string) => {
    if (!analysisId) return;
    try {
      setLoadingRoadmap(true);
      setError(null);
      const res = await api.get(`/api/analysis/${analysisId}`);
      if (res.data && res.data.roadmap) {
        setRoadmap(res.data.roadmap);
      } else {
        setRoadmap(null);
      }
    } catch (err: any) {
      console.error("Failed to load analysis report details:", err);
      setError("Failed to retrieve matching details.");
    } finally {
      setLoadingRoadmap(false);
    }
  }, []);

  useEffect(() => {
    if (selectedAnalysisId) {
      loadRoadmap(selectedAnalysisId);
    }
  }, [selectedAnalysisId, loadRoadmap]);

  // Load completion states from localStorage
  useEffect(() => {
    if (selectedAnalysisId) {
      const stored = localStorage.getItem(`roadmap_progress_${selectedAnalysisId}`);
      if (stored) {
        try {
          setCompletedTopics(JSON.parse(stored));
        } catch {
          setCompletedTopics({});
        }
      } else {
        setCompletedTopics({});
      }
    }
  }, [selectedAnalysisId]);

  // Trigger roadmap generation endpoint
  const handleGenerateRoadmap = async () => {
    if (!selectedAnalysisId) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await api.post(`/api/analysis/${selectedAnalysisId}/roadmap`);
      setRoadmap(res.data);
    } catch (err: any) {
      console.error("Failed to generate roadmap:", err);
      setError(err.response?.data?.detail || "LLM failed to compile roadmap. Check API keys.");
    } finally {
      setGenerating(false);
    }
  };

  // Toggle study items checkboxes
  const handleToggleTopic = (topicKey: string) => {
    const nextState = {
      ...completedTopics,
      [topicKey]: !completedTopics[topicKey]
    };
    setCompletedTopics(nextState);
    localStorage.setItem(`roadmap_progress_${selectedAnalysisId}`, JSON.stringify(nextState));
  };

  // Calculate completion percentage
  const getProgressStats = () => {
    if (!roadmap || !roadmap.weeks || roadmap.weeks.length === 0) return 0;
    let totalTopics = 0;
    let completedCount = 0;

    roadmap.weeks.forEach((week) => {
      week.topics.forEach((topic) => {
        totalTopics++;
        const topicKey = `${week.week_number}_${topic}`;
        if (completedTopics[topicKey]) {
          completedCount++;
        }
      });
    });

    if (totalTopics === 0) return 0;
    return Math.round((completedCount / totalTopics) * 100);
  };

  const getResourceIcon = (category: string) => {
    const cat = category.toLowerCase();
    if (cat.includes('video') || cat.includes('youtube')) return <PlayCircle className="h-4 w-4 text-accent shrink-0" />;
    if (cat.includes('doc') || cat.includes('api')) return <BookOpen className="h-4 w-4 text-accent-cyan shrink-0" />;
    return <FileSpreadsheet className="h-4 w-4 text-primary shrink-0" />;
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
  const progressPercent = getProgressStats();

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
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-primary text-primary-foreground font-medium transition-all shadow-glow text-sm"
            >
              <Map className="h-5 w-5" />
              Roadmaps
            </Link>
            <Link 
              href="/mentor" 
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-muted hover:text-foreground hover:bg-[#141320] font-medium transition-all text-sm"
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

      {/* Main Roadmap Workspace */}
      <main className="flex-grow p-6 md:p-10 max-w-5xl mx-auto w-full overflow-y-auto flex flex-col md:flex-row gap-8">
        {/* Left column - Select Analysis History */}
        <section className="w-full md:w-64 shrink-0 space-y-6">
          <div className="glass-panel rounded-2xl p-5 space-y-4">
            <h3 className="font-bold font-outfit text-sm text-gray-200 uppercase tracking-wider">Select Job Report</h3>
            {loadingHistory ? (
              <div className="space-y-3">
                <div className="h-10 bg-secondary rounded-xl animate-pulse"></div>
                <div className="h-10 bg-secondary rounded-xl animate-pulse"></div>
              </div>
            ) : analyses.length === 0 ? (
              <p className="text-muted text-xs italic">No job match analyses run yet.</p>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {analyses.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSelectedAnalysisId(item.id)}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all text-xs flex flex-col gap-1 ${
                      selectedAnalysisId === item.id
                        ? 'bg-primary border-primary text-primary-foreground font-semibold shadow-glow'
                        : 'bg-[#141320] border-border hover:border-primary/30 text-muted hover:text-foreground'
                    }`}
                  >
                    <span className="truncate">Report #{item.id.slice(0, 8)}</span>
                    <span className="text-[10px] opacity-80">Match: {item.match_percentage}%</span>
                    <span className="text-[10px] opacity-60">{new Date(item.created_at).toLocaleDateString()}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {roadmap && (
            <div className="glass-panel rounded-2xl p-5 space-y-3">
              <h4 className="font-bold text-xs uppercase tracking-wider text-muted font-outfit">Syllabus Progress</h4>
              <div className="flex items-center justify-between text-sm font-semibold mb-1.5">
                <span>{progressPercent}% Complete</span>
              </div>
              <div className="w-full bg-secondary h-2.5 rounded-full overflow-hidden border border-border">
                <div 
                  className="bg-primary h-full transition-all duration-300 rounded-full" 
                  style={{ width: `${progressPercent}%` }}
                ></div>
              </div>
            </div>
          )}
        </section>

        {/* Right column - Study plan details */}
        <section className="flex-grow space-y-6">
          {error && (
            <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-accent text-sm flex items-start gap-2.5">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {loadingRoadmap ? (
            <div className="glass-panel rounded-2xl p-12 text-center min-h-[350px] flex flex-col justify-center items-center">
              <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
              <p className="text-muted text-sm font-medium">Checking roadmap cache...</p>
            </div>
          ) : generating ? (
            <div className="glass-panel rounded-2xl p-12 text-center min-h-[350px] flex flex-col justify-center items-center">
              <Loader2 className="h-12 w-12 text-primary animate-spin mb-6" />
              <h3 className="text-lg font-bold font-outfit text-gradient-primary mb-2">Generating Learning Roadmap</h3>
              <p className="text-muted text-sm max-w-sm leading-relaxed animate-pulse">
                GPT-4o is currently organizing a structured semana-by-semana syllabus matching your exact skill gaps. This will take a few seconds...
              </p>
            </div>
          ) : !roadmap ? (
            <div className="glass-panel rounded-2xl p-12 text-center min-h-[350px] flex flex-col justify-center items-center">
              <div className="p-4 rounded-full bg-primary/10 border border-primary/20 text-primary mb-6">
                <Map className="h-10 w-10" />
              </div>
              <h3 className="text-xl font-bold font-outfit mb-2">No Active Study Roadmap</h3>
              {selectedAnalysisId ? (
                <>
                  <p className="text-muted text-sm max-w-sm mb-6 leading-relaxed">
                    You have selected a job match report, but you haven&apos;t generated its customized study timeline yet. Let&apos;s build it!
                  </p>
                  <button
                    onClick={handleGenerateRoadmap}
                    className="bg-primary hover:bg-primary-hover text-primary-foreground font-semibold px-6 py-3 rounded-xl transition-all shadow-glow text-sm"
                  >
                    Build study plan
                  </button>
                </>
              ) : (
                <p className="text-muted text-sm max-w-sm leading-relaxed">
                  Run a job match report in the <Link href="/jobs" className="text-primary hover:underline">Job Matcher workspace</Link> first to select your skill gaps and initiate roadmap generations.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Header card */}
              <div className="glass-panel rounded-2xl p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-start gap-4">
                  <div className="p-3.5 rounded-xl bg-accent-purple/10 border border-accent-purple/20 text-accent-purple shrink-0">
                    <MapPin className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold font-outfit">{roadmap.target_role} Roadmap</h3>
                    <p className="text-muted text-xs mt-1 flex items-center gap-1.5 font-medium">
                      <Calendar className="h-4 w-4" />
                      Duration: {roadmap.duration_weeks} Weeks study schedule
                    </p>
                  </div>
                </div>
                <button
                  onClick={async () => {
                    if (window.confirm("Are you sure you want to delete this study plan? This will clear the generated roadmap and reset your progress checkpoints.")) {
                      try {
                        setError(null);
                        await api.delete(`/api/analysis/${selectedAnalysisId}/roadmap`);
                        localStorage.removeItem(`roadmap_progress_${selectedAnalysisId}`);
                        setRoadmap(null);
                        fetchHistory();
                      } catch (err: any) {
                        console.error("Failed to delete roadmap", err);
                        setError("Failed to delete roadmap.");
                      }
                    }
                  }}
                  className="flex items-center gap-1.5 bg-[#ff4a4a]/10 border border-[#ff4a4a]/20 hover:bg-[#ff4a4a]/25 text-accent px-4 py-2.5 rounded-xl text-xs font-semibold transition-all shrink-0 self-start sm:self-center"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete Study Plan
                </button>
              </div>

              {/* Weekly syllabuses */}
              {roadmap.message ? (
                <div className="glass-panel p-6 rounded-2xl text-center text-sm text-green-400 border-green-500/20 bg-green-500/5 flex items-center gap-3">
                  <CheckCircle2 className="h-6 w-6 shrink-0" />
                  <span>{roadmap.message}</span>
                </div>
              ) : (
                <div className="space-y-6 relative before:absolute before:left-4 before:top-4 before:bottom-4 before:w-0.5 before:bg-border">
                  {roadmap.weeks.map((week) => (
                    <div key={week.week_number} className="relative pl-10 group">
                      {/* Timeline dot */}
                      <div className="absolute left-2 top-2 h-4 w-4 rounded-full bg-[#08070d] border-2 border-primary group-hover:scale-110 transition-transform"></div>

                      <div className="glass-panel p-6 rounded-2xl space-y-4">
                        <div>
                          <span className="text-primary text-xs font-bold uppercase tracking-wider">Week {week.week_number}</span>
                          <h4 className="text-lg font-bold font-outfit mt-0.5 text-gray-200">{week.title}</h4>
                          <p className="text-muted text-xs leading-relaxed mt-1">{week.description}</p>
                        </div>

                        {/* Topics checkboxes */}
                        <div className="space-y-2 pt-3 border-t border-border">
                          <span className="text-[10px] uppercase font-semibold tracking-wider text-muted block">Topics to practice</span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {week.topics.map((topic, tIdx) => {
                              const tKey = `${week.week_number}_${topic}`;
                              return (
                                <button
                                  key={tIdx}
                                  onClick={() => handleToggleTopic(tKey)}
                                  className={`flex items-start gap-2.5 p-3 rounded-xl border text-left text-xs transition-all ${
                                    completedTopics[tKey]
                                      ? 'bg-primary/5 border-primary/20 text-muted line-through'
                                      : 'bg-[#141320] border-border hover:border-primary/25 text-gray-300'
                                  }`}
                                >
                                  <CheckCircle2 className={`h-4.5 w-4.5 shrink-0 ${
                                    completedTopics[tKey] ? 'text-primary' : 'text-muted'
                                  }`} />
                                  <span>{topic}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Resource links */}
                        {week.resources && week.resources.length > 0 && (
                          <div className="space-y-2 pt-3 border-t border-border">
                            <span className="text-[10px] uppercase font-semibold tracking-wider text-muted block">Handpicked study links</span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {week.resources.map((res, rIdx) => (
                                <a
                                  key={rIdx}
                                  href={res.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#0e0d1a] border border-border hover:border-accent-cyan/35 hover:bg-[#111025] transition-all text-xs group"
                                >
                                  <div className="flex items-center gap-2 overflow-hidden">
                                    {getResourceIcon(res.category)}
                                    <span className="truncate text-gray-300 group-hover:text-foreground font-medium">{res.name}</span>
                                  </div>
                                  <ExternalLink className="h-3.5 w-3.5 text-muted group-hover:text-accent-cyan shrink-0 transition-colors" />
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
