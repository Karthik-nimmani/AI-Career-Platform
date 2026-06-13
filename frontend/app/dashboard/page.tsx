"use client";

import React, { useState, useEffect } from 'react';
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
  PlusCircle,
  TrendingUp,
  Brain,
  ChevronRight,
  Settings
} from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, signOut, isLoading } = useAuthStore();

  const [stats, setStats] = useState({
    resumesCount: 0,
    latestAtsScore: 'N/A',
    roadmapsCount: 0,
    mentionsCount: 0,
  });
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    
    async function loadStats() {
      try {
        setStatsLoading(true);
        const timestamp = Date.now();
        const results = await Promise.allSettled([
          api.get(`/api/resume/my?t=${timestamp}`),
          api.get(`/api/analysis/my?t=${timestamp}`),
          api.get(`/api/mentor/history?t=${timestamp}`)
        ]);
        
        const resumesRes = results[0].status === 'fulfilled' ? results[0].value : null;
        const analysesRes = results[1].status === 'fulfilled' ? results[1].value : null;
        const chatRes = results[2].status === 'fulfilled' ? results[2].value : null;
        
        if (results[0].status === 'rejected') {
          console.error("Failed to load resumes count", results[0].reason);
        }
        if (results[1].status === 'rejected') {
          console.error("Failed to load analyses/roadmaps", results[1].reason);
        }
        if (results[2].status === 'rejected') {
          console.error("Failed to load chat history", results[2].reason);
        }
        
        const resumes = resumesRes?.data || [];
        const analyses = analysesRes?.data || [];
        const chat = chatRes?.data || [];
        
        const latestAts = analyses.length > 0 && analyses[0].match_percentage !== undefined
          ? `${analyses[0].match_percentage}%` 
          : 'N/A';
          
        const roadmaps = analyses.filter((a: any) => a.roadmap !== null && a.roadmap !== undefined).length;
        
        setStats({
          resumesCount: resumes.length,
          latestAtsScore: latestAts,
          roadmapsCount: roadmaps,
          mentionsCount: chat.length
        });
      } catch (err) {
        console.error("Failed to load dashboard stats", err);
      } finally {
        setStatsLoading(false);
      }
    }
    
    loadStats();
    
    // Auto-refresh when tab gains focus or user returns
    const handleFocus = () => {
      loadStats();
    };
    
    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [user, pathname]);

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#08070d] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-muted text-sm font-medium">Loading session...</p>
        </div>
      </div>
    );
  }

  // Fallback name if metadata doesn't exist
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
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-primary text-primary-foreground font-medium transition-all shadow-glow text-sm"
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

      {/* Main Content Area */}
      <main className="flex-grow p-6 md:p-10 max-w-7xl mx-auto w-full overflow-y-auto">
        {/* Welcome Section */}
        <section className="mb-10">
          <h1 className="text-3xl md:text-4xl font-bold font-outfit mb-2">
            Welcome back, <span className="text-gradient-primary">{userName}</span>!
          </h1>
          <p className="text-muted text-sm md:text-base">
            Here is a summary of your career progression tools. Select a path below to get started.
          </p>
        </section>

        {/* Info Cards Row */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          <div className="glass-panel rounded-2xl p-6 relative overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <span className="text-muted text-xs font-semibold uppercase tracking-wider">Resumes</span>
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <p className="text-3xl font-bold font-outfit mb-1">
              {statsLoading ? (
                <span className="text-lg font-normal text-muted/50 animate-pulse">...</span>
              ) : (
                stats.resumesCount
              )}
            </p>
            <p className="text-muted text-xs">Ready for optimization</p>
          </div>

          <div className="glass-panel rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-muted text-xs font-semibold uppercase tracking-wider">ATS Score</span>
              <PlusCircle className="h-5 w-5 text-accent-cyan" />
            </div>
            <p className="text-3xl font-bold font-outfit mb-1">
              {statsLoading ? (
                <span className="text-lg font-normal text-muted/50 animate-pulse">...</span>
              ) : (
                stats.latestAtsScore
              )}
            </p>
            <p className="text-muted text-xs">Analyze against job details</p>
          </div>

          <div className="glass-panel rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-muted text-xs font-semibold uppercase tracking-wider">Roadmaps</span>
              <Map className="h-5 w-5 text-accent-purple" />
            </div>
            <p className="text-3xl font-bold font-outfit mb-1">
              {statsLoading ? (
                <span className="text-lg font-normal text-muted/50 animate-pulse">...</span>
              ) : (
                stats.roadmapsCount
              )}
            </p>
            <p className="text-muted text-xs">Active learning paths</p>
          </div>

          <div className="glass-panel rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-muted text-xs font-semibold uppercase tracking-wider">Mentions</span>
              <Brain className="h-5 w-5 text-accent" />
            </div>
            <p className="text-3xl font-bold font-outfit mb-1">
              {statsLoading ? (
                <span className="text-lg font-normal text-muted/50 animate-pulse">...</span>
              ) : (
                stats.mentionsCount
              )}
            </p>
            <p className="text-muted text-xs">AI mentor messages</p>
          </div>
        </section>

        {/* Feature Pathways */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold font-outfit">Launch Career Intelligence Engines</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Resume optimization pathway */}
            <div className="glass-panel glass-panel-hover rounded-2xl p-6 flex flex-col justify-between h-48">
              <div>
                <div className="flex items-center gap-2 mb-2 text-primary font-semibold text-sm">
                  <FileText className="h-4 w-4" />
                  Phase 2 Pipeline
                </div>
                <h3 className="text-xl font-bold font-outfit mb-2">Resume Upload & Structuring</h3>
                <p className="text-muted text-xs leading-relaxed">
                  Extract resume details automatically with LlamaIndex. Parse skills, education details, and employment history instantly.
                </p>
              </div>
              <Link 
                href="/resume" 
                className="mt-4 text-primary hover:text-primary-hover text-sm font-semibold flex items-center gap-1.5 self-start"
              >
                Go to Resume Parser <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            {/* ATS Matcher pathway */}
            <div className="glass-panel glass-panel-hover rounded-2xl p-6 flex flex-col justify-between h-48">
              <div>
                <div className="flex items-center gap-2 mb-2 text-accent-cyan font-semibold text-sm">
                  <Briefcase className="h-4 w-4" />
                  Phase 3 Engine
                </div>
                <h3 className="text-xl font-bold font-outfit mb-2">Job Description ATS Matcher</h3>
                <p className="text-muted text-xs leading-relaxed">
                  Test your resume against technical and business role postings. Find missing keywords and get specific formatting suggestions.
                </p>
              </div>
              <Link 
                href="/jobs" 
                className="mt-4 text-accent-cyan hover:opacity-85 text-sm font-semibold flex items-center gap-1.5 self-start"
              >
                Go to Job Matcher <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            {/* Roadmap generator */}
            <div className="glass-panel glass-panel-hover rounded-2xl p-6 flex flex-col justify-between h-48">
              <div>
                <div className="flex items-center gap-2 mb-2 text-accent-purple font-semibold text-sm">
                  <Map className="h-4 w-4" />
                  Phase 4 Timeline
                </div>
                <h3 className="text-xl font-bold font-outfit mb-2">Learning Roadmap Generator</h3>
                <p className="text-muted text-xs leading-relaxed">
                  Automatically translate skill deficiencies into multi-week roadmap schedules populated with curated high-quality links and resources.
                </p>
              </div>
              <Link 
                href="/roadmap" 
                className="mt-4 text-accent-purple hover:opacity-85 text-sm font-semibold flex items-center gap-1.5 self-start"
              >
                View Learning Roadmaps <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            {/* Agentic Mentor */}
            <div className="glass-panel glass-panel-hover rounded-2xl p-6 flex flex-col justify-between h-48">
              <div>
                <div className="flex items-center gap-2 mb-2 text-accent font-semibold text-sm">
                  <Compass className="h-4 w-4" />
                  Phase 5 Multi-Agent
                </div>
                <h3 className="text-xl font-bold font-outfit mb-2">Multi-Agent Career Mentor</h3>
                <p className="text-muted text-xs leading-relaxed">
                  Initiate stream conversations with specialized mentor nodes who help mock interview, refine career trajectories, and solve exercises.
                </p>
              </div>
              <Link 
                href="/mentor" 
                className="mt-4 text-accent hover:opacity-85 text-sm font-semibold flex items-center gap-1.5 self-start"
              >
                Consult Career Agent <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
