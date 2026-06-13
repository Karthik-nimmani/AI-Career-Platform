"use client";

import React, { useState, useEffect } from 'react';
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
  AlertCircle,
  Loader2,
  TrendingUp,
  Percent,
  CheckCircle,
  XCircle,
  ChevronRight,
  ArrowLeft,
  FileSearch,
  CheckCircle2,
  Settings,
  Trash2
} from 'lucide-react';
import Link from 'next/link';

interface ResumeOption {
  id: string;
  parsed_content: {
    name: string;
    file_name?: string;
  };
  created_at: string;
}

interface AnalysisReport {
  id: string;
  resume_id: string;
  jd_id: string;
  ats_score: number;
  match_percentage: number;
  vector_score: number;
  skill_gaps: {
    missing_skills: string[];
    matched_skills: string[];
    explanation: string;
  };
  improvement_suggestions: string[];
}

export default function JobsPage() {
  const router = useRouter();
  const { user, signOut, isLoading: authLoading } = useAuthStore();

  // Lists
  const [resumes, setResumes] = useState<ResumeOption[]>([]);
  const [loadingResumes, setLoadingResumes] = useState(true);
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Form Input States
  const [selectedResumeId, setSelectedResumeId] = useState('');
  const [jdText, setJdText] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [company, setCompany] = useState('');

  // Execution States
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState('');
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  // Fetch histories and resumes on mount
  const fetchHistory = async () => {
    try {
      setLoadingHistory(true);
      const res = await api.get('/api/analysis/my');
      setAnalyses(res.data);
    } catch (err: any) {
      console.error("Failed to load match history:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    async function getResumes() {
      try {
        setLoadingResumes(true);
        const res = await api.get('/api/resume/my');
        setResumes(res.data);
        if (res.data && res.data.length > 0) {
          setSelectedResumeId(res.data[0].id);
        }
      } catch (err: any) {
        console.error("Failed to load resumes", err);
      } finally {
        setLoadingResumes(false);
      }
    }

    if (user) {
      getResumes();
      fetchHistory();
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedResumeId) {
      setError("Please upload a resume first before running matches.");
      return;
    }
    if (!jdText.trim()) {
      setError("Please paste the job description details.");
      return;
    }

    setAnalyzing(true);
    setAnalysisProgress(15);
    setAnalysisStep("Pasting job description and creating record...");
    setError(null);

    try {
      const progressInterval = setInterval(() => {
        setAnalysisProgress((prev) => {
          if (prev >= 95) {
            clearInterval(progressInterval);
            return 95;
          }
          const increment = prev < 50 ? 20 : prev < 80 ? 5 : 1;
          
          if (prev === 35) setAnalysisStep("Querying semantic resume chunks from ChromaDB...");
          if (prev === 55) setAnalysisStep("Executing LangChain ATS evaluative Prompt score...");
          if (prev === 75) setAnalysisStep("Pinpointing critical skill gaps with OpenAI...");
          if (prev === 90) setAnalysisStep("Compiling weighted averages and match percentages...");
          
          return prev + increment;
        });
      }, 700);

      const response = await api.post('/api/analysis/compare', {
        resume_id: selectedResumeId,
        jd_text: jdText,
        title: jobTitle,
        company: company
      });

      clearInterval(progressInterval);
      setAnalysisProgress(100);
      setAnalysisStep("Report compiled successfully! Loading match details...");

      setTimeout(() => {
        setReport(response.data);
        setAnalyzing(false);
        setAnalysisProgress(0);
        setAnalysisStep('');
        fetchHistory(); // Refresh history
      }, 1000);

    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || "Match analysis failed. Check API key configs and try again.");
      setAnalyzing(false);
    }
  };

  const handleSelectAnalysis = async (id: string) => {
    try {
      setAnalyzing(true);
      setAnalysisProgress(30);
      setAnalysisStep("Fetching match report details...");
      setError(null);
      const res = await api.get(`/api/analysis/${id}`);
      
      const rawData = res.data;
      const formattedReport: AnalysisReport = {
        id: rawData.id,
        resume_id: rawData.resume_id,
        jd_id: rawData.jd_id,
        ats_score: rawData.ats_score,
        match_percentage: rawData.match_percentage,
        vector_score: rawData.vector_score,
        skill_gaps: {
          missing_skills: rawData.skill_gaps?.missing_skills || [],
          matched_skills: rawData.skill_gaps?.matched_skills || [],
          explanation: rawData.skill_gaps?.explanation || ""
        },
        improvement_suggestions: rawData.improvement_suggestions || []
      };
      
      setJobTitle(rawData.job_descriptions?.title || "Target Job Position");
      setCompany(rawData.job_descriptions?.company || "Target Company");
      setJdText(rawData.job_descriptions?.jd_text || "");
      setReport(formattedReport);
    } catch (err: any) {
      console.error("Failed to load analysis details", err);
      setError("Failed to retrieve matching details.");
    } finally {
      setAnalyzing(false);
      setAnalysisProgress(0);
      setAnalysisStep('');
    }
  };

  const handleDeleteAnalysis = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this job match analysis? This will also remove any cached study roadmap.")) return;
    
    try {
      setError(null);
      await api.delete(`/api/analysis/${id}`);
      setAnalyses(prev => prev.filter(item => item.id !== id));
      localStorage.removeItem(`roadmap_progress_${id}`);
      
      if (report?.id === id) {
        setReport(null);
        setJdText('');
        setJobTitle('');
        setCompany('');
      }
    } catch (err: any) {
      console.error("Failed to delete analysis", err);
      setError("Failed to delete analysis report.");
    }
  };

  const getScoreColorClass = (score: number) => {
    if (score >= 80) return 'text-green-400 border-green-500/20 bg-green-500/5';
    if (score >= 50) return 'text-yellow-400 border-yellow-500/20 bg-yellow-500/5';
    return 'text-accent border-accent/20 bg-accent/5';
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
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-primary text-primary-foreground font-medium transition-all shadow-glow text-sm"
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

      {/* Main Workspace */}
      <main className="flex-grow p-6 md:p-10 max-w-5xl mx-auto w-full overflow-y-auto flex flex-col md:flex-row gap-8">
        {/* Left column - Select Analysis History */}
        <section className="w-full md:w-64 shrink-0 space-y-6">
          <div className="glass-panel rounded-2xl p-5 space-y-4">
            <h3 className="font-bold font-outfit text-sm text-gray-200 uppercase tracking-wider">Match History</h3>
            {loadingHistory ? (
              <div className="space-y-3">
                <div className="h-10 bg-secondary rounded-xl animate-pulse"></div>
                <div className="h-10 bg-secondary rounded-xl animate-pulse"></div>
              </div>
            ) : analyses.length === 0 ? (
              <p className="text-muted text-xs italic">No analyses run yet.</p>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                {analyses.map((item) => (
                  <div key={item.id} className="relative group/item flex items-center justify-between gap-1">
                    <button
                      onClick={() => handleSelectAnalysis(item.id)}
                      className={`flex-grow text-left p-3.5 pr-10 rounded-xl border transition-all text-xs flex flex-col gap-1 ${
                        report?.id === item.id
                          ? 'bg-primary border-primary text-primary-foreground font-semibold shadow-glow'
                          : 'bg-[#141320] border-border hover:border-primary/30 text-muted hover:text-foreground'
                      }`}
                    >
                      <span className="truncate font-bold font-outfit">Report #{item.id.slice(0, 8)}</span>
                      <span className="text-[10px] opacity-80">Match: {item.match_percentage}%</span>
                      <span className="text-[10px] opacity-60">{new Date(item.created_at).toLocaleDateString()}</span>
                    </button>
                    <button
                      onClick={(e) => handleDeleteAnalysis(item.id, e)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-destructive/10 border border-destructive/20 hover:bg-destructive/30 text-accent transition-all duration-200"
                      title="Delete Report"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Right column - Main workspace */}
        <section className="flex-grow space-y-6 min-w-0">
          {/* Header Section */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold font-outfit mb-1">Job Description Matcher</h1>
              <p className="text-muted text-sm font-medium">Evaluate your profile against specific postings using vector semantics and LLMs.</p>
            </div>
            {report && !analyzing && (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleDeleteAnalysis(report.id)}
                  className="flex items-center gap-2 bg-[#ff4a4a]/10 border border-[#ff4a4a]/20 hover:bg-[#ff4a4a]/25 text-accent px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete Report
                </button>
                <button
                  onClick={() => {
                    setReport(null);
                    setJdText('');
                    setJobTitle('');
                    setCompany('');
                    setError(null);
                  }}
                  className="flex items-center gap-2 bg-secondary hover:bg-opacity-80 border border-border px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Analyze Another Job
                </button>
              </div>
            )}
          </div>

          {/* Errors */}
          {error && (
            <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-accent mb-6 text-sm flex items-start gap-2.5 animate-fade-in">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* 1. Job Ingestion Paste Form */}
          {!report && !analyzing && (
            <div className="glass-panel rounded-2xl p-6 md:p-8 space-y-6 animate-fade-in">
              {resumes.length === 0 && !loadingResumes ? (
                <div className="text-center py-8 space-y-4">
                  <FileSearch className="h-12 w-12 text-primary mx-auto animate-pulse" />
                  <h3 className="font-bold text-lg font-outfit">No Resumes Found</h3>
                  <p className="text-muted text-sm max-w-sm mx-auto leading-relaxed">
                    You need to upload and structure a resume first before running job matcher comparisons.
                  </p>
                  <Link 
                    href="/resume" 
                    className="inline-flex bg-primary hover:bg-primary-hover text-primary-foreground font-semibold px-5 py-2.5 rounded-xl transition-all shadow-glow text-sm"
                  >
                    Upload Resume
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Resume Selector */}
                  <div>
                    <label className="block text-sm font-semibold mb-2 text-gray-300" htmlFor="resume-select">
                      Select Profile Resume
                    </label>
                    {loadingResumes ? (
                      <div className="h-12 bg-[#141320] border border-border rounded-xl animate-pulse"></div>
                    ) : (
                      <select
                        id="resume-select"
                        value={selectedResumeId}
                        onChange={(e) => setSelectedResumeId(e.target.value)}
                        className="w-full bg-[#141320] border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:border-primary transition-all text-sm"
                      >
                        {resumes.map((res) => (
                          <option key={res.id} value={res.id}>
                            {res.parsed_content.file_name || res.parsed_content.name} (Uploaded {new Date(res.created_at).toLocaleDateString()})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Job metadata fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold mb-2 text-gray-300" htmlFor="title-input">
                        Job Title
                      </label>
                      <input
                        id="title-input"
                        type="text"
                        placeholder="e.g. Senior Backend Engineer"
                        value={jobTitle}
                        onChange={(e) => setJobTitle(e.target.value)}
                        className="w-full bg-[#141320] border border-border rounded-xl px-4 py-3 text-foreground placeholder-muted focus:outline-none focus:border-primary transition-all text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-2 text-gray-300" htmlFor="company-input">
                        Company Name
                      </label>
                      <input
                        id="company-input"
                        type="text"
                        placeholder="e.g. Google DeepMind"
                        value={company}
                        onChange={(e) => setCompany(e.target.value)}
                        className="w-full bg-[#141320] border border-border rounded-xl px-4 py-3 text-foreground placeholder-muted focus:outline-none focus:border-primary transition-all text-sm"
                      />
                    </div>
                  </div>

                  {/* Job Description Text Area */}
                  <div>
                    <label className="block text-sm font-semibold mb-2 text-gray-300" htmlFor="jd-input">
                      Job Description Requirements
                    </label>
                    <textarea
                      id="jd-input"
                      rows={8}
                      required
                      placeholder="Paste the job description details, qualifications, and core duties here..."
                      value={jdText}
                      onChange={(e) => setJdText(e.target.value)}
                      className="w-full bg-[#141320] border border-border rounded-xl px-4 py-3 text-foreground placeholder-muted focus:outline-none focus:border-primary transition-all text-sm leading-relaxed"
                    ></textarea>
                  </div>

                  <button
                    type="submit"
                    disabled={analyzing}
                    className="w-full bg-primary hover:bg-primary-hover text-primary-foreground font-semibold py-3.5 px-4 rounded-xl transition-all shadow-glow flex items-center justify-center gap-2 text-sm"
                  >
                    <Sparkles className="h-4 w-4" />
                    Analyze Profile Match
                  </button>
                </form>
              )}
            </div>
          )}

          {/* 2. Loading Pipeline Animation */}
          {analyzing && (
            <div className="glass-panel rounded-2xl p-10 flex flex-col items-center justify-center text-center min-h-[380px]">
              <div className="relative flex items-center justify-center mb-8">
                <div className="w-20 h-20 rounded-full border-4 border-primary/25 border-t-primary animate-spin"></div>
                <div className="absolute font-outfit font-bold text-sm">{analysisProgress}%</div>
              </div>
              <h3 className="text-lg font-bold font-outfit mb-2 text-gradient-primary">Job Analyzer Operating</h3>
              <p className="text-muted text-sm max-w-md animate-pulse">
                {analysisStep}
              </p>
              <div className="w-full max-w-xs bg-secondary h-2 rounded-full overflow-hidden mt-6 border border-border">
                <div 
                  className="bg-primary h-full transition-all duration-300 rounded-full" 
                  style={{ width: `${analysisProgress}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* 3. Render Match Report Results Dashboard */}
          {report && !analyzing && (
            <div className="space-y-6 animate-fade-in">
              {/* Header info */}
              <div className="glass-panel rounded-2xl p-6 flex items-center gap-4">
                <div className="p-3.5 rounded-xl bg-primary/10 border border-primary/20 text-primary">
                  <Briefcase className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold font-outfit">{jobTitle || 'Target Position'}</h3>
                  <p className="text-primary text-sm font-semibold">{company || 'Target Company'}</p>
                </div>
              </div>

              {/* Scores Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Overall Match Gauge */}
                <div className="glass-panel rounded-2xl p-6 text-center flex flex-col justify-center items-center">
                  <span className="text-muted text-xs font-semibold uppercase tracking-wider mb-4">Overall Match</span>
                  <div className={`relative w-28 h-28 rounded-full border-8 flex items-center justify-center font-outfit font-bold text-2xl mb-1 ${getScoreColorClass(report.match_percentage)}`}>
                    {report.match_percentage}%
                  </div>
                  <p className="text-muted text-xs">Weighted vector + LLM analysis</p>
                </div>

                {/* LLM ATS Evaluation Score */}
                <div className="glass-panel rounded-2xl p-6 text-center flex flex-col justify-center items-center">
                  <span className="text-muted text-xs font-semibold uppercase tracking-wider mb-4">ATS Alignment</span>
                  <div className={`relative w-28 h-28 rounded-full border-8 flex items-center justify-center font-outfit font-bold text-2xl mb-1 ${getScoreColorClass(report.ats_score)}`}>
                    {report.ats_score}/100
                  </div>
                  <p className="text-muted text-xs">Experience & formatting score</p>
                </div>

                {/* Semantic Vector Match */}
                <div className="glass-panel rounded-2xl p-6 text-center flex flex-col justify-center items-center">
                  <span className="text-muted text-xs font-semibold uppercase tracking-wider mb-4">Vector Similarity</span>
                  <div className={`relative w-28 h-28 rounded-full border-8 flex items-center justify-center font-outfit font-bold text-2xl mb-1 ${getScoreColorClass(report.vector_score)}`}>
                    {report.vector_score}%
                  </div>
                  <p className="text-muted text-xs">Semantic keyword embedding match</p>
                </div>
              </div>

              {/* Gaps, matched and description details */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Missing Skills (Skill Gaps) */}
                <div className="glass-panel rounded-2xl p-6 space-y-4">
                  <h4 className="text-base font-bold font-outfit text-accent flex items-center gap-2">
                    <XCircle className="h-5 w-5 shrink-0" />
                    Key Skill Gaps (Missing)
                  </h4>
                  {report.skill_gaps.missing_skills.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {report.skill_gaps.missing_skills.map((skill, index) => (
                        <span key={index} className="bg-accent/5 border border-accent/20 text-accent px-3 py-1.5 rounded-lg text-xs font-medium">
                          {skill}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted text-xs italic">Wow! No major skill gaps detected.</p>
                  )}
                </div>

                {/* Matched Skills */}
                <div className="glass-panel rounded-2xl p-6 space-y-4">
                  <h4 className="text-base font-bold font-outfit text-green-400 flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 shrink-0" />
                    Matched Profile Skills
                  </h4>
                  {report.skill_gaps.matched_skills.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {report.skill_gaps.matched_skills.map((skill, index) => (
                        <span key={index} className="bg-green-500/5 border border-green-500/20 text-green-400 px-3 py-1.5 rounded-lg text-xs font-medium">
                          {skill}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted text-xs italic">No matched skills extracted. Check resume parameters.</p>
                  )}
                </div>
              </div>

              {/* Detailed Evaluation Description */}
              <div className="glass-panel rounded-2xl p-6 space-y-3">
                <h4 className="text-base font-bold font-outfit">Recruitment Evaluator Feedback</h4>
                <p className="text-muted text-sm leading-relaxed text-gray-300">
                  {report.skill_gaps.explanation}
                </p>
              </div>

              {/* Suggestions Card */}
              <div className="glass-panel rounded-2xl p-6 space-y-4">
                <h4 className="text-base font-bold font-outfit text-gradient-primary">Resume Optimization Recommendations</h4>
                <div className="space-y-3">
                  {report.improvement_suggestions.map((suggestion, index) => (
                    <div key={index} className="flex items-start gap-3 p-4 rounded-xl bg-[#141320] border border-border">
                      <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <p className="text-gray-300 text-sm leading-relaxed">{suggestion}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Phase 4 study roadmap prompt */}
              <div className="glass-panel rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h4 className="font-bold font-outfit text-base mb-1">Bridge Skill Gaps with custom Study Paths</h4>
                  <p className="text-muted text-xs">Generate a 4-12 week structured learning roadmap based on missing keywords.</p>
                </div>
                <Link
                  href="/roadmap"
                  className="bg-primary hover:bg-primary-hover text-primary-foreground font-semibold px-5 py-2.5 rounded-xl transition-all shadow-glow text-xs flex items-center gap-1.5 self-start sm:self-center shrink-0"
                >
                  Build Study Roadmap <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
