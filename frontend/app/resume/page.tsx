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
  UploadCloud,
  Mail,
  Phone,
  GraduationCap,
  CheckCircle2,
  Loader2,
  TrendingUp,
  RefreshCw,
  ChevronRight,
  Settings,
  Trash2
} from 'lucide-react';
import Link from 'next/link';

// Extracted resume data structures
interface ExperienceItem {
  company: string;
  role: string;
  duration?: string;
  description?: string;
}

interface EducationItem {
  institution: string;
  degree?: string;
  field_of_study?: string;
  graduation_year?: string;
}

interface ParsedContent {
  name: string;
  email?: string;
  phone?: string;
  skills: string[];
  experience: ExperienceItem[];
  education: EducationItem[];
  file_name?: string;
}

interface ResumeRecord {
  id: string;
  file_url: string;
  parsed_content: ParsedContent;
  created_at: string;
}

export default function ResumePage() {
  const router = useRouter();
  const { user, signOut, isLoading: authLoading } = useAuthStore();
  
  // States
  const [resumes, setResumes] = useState<ResumeRecord[]>([]);
  const [activeResume, setActiveResume] = useState<ResumeRecord | null>(null);
  const [loadingResumes, setLoadingResumes] = useState(true);
  
  // Upload states
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStep, setUploadStep] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  // UI States
  const [activeTab, setActiveTab] = useState<'skills' | 'experience' | 'education'>('skills');

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  // Fetch resumes from backend
  const fetchResumes = useCallback(async () => {
    try {
      setLoadingResumes(true);
      setError(null);
      const response = await api.get('/api/resume/my');
      setResumes(response.data);
      if (response.data && response.data.length > 0) {
        // Automatically activate the most recently uploaded resume
        setActiveResume(response.data[0]);
      }
    } catch (err: any) {
      console.error("Failed to fetch resumes:", err);
      // Don't show hard error if it's just local environment startup
      if (err.response?.status !== 401) {
        setError("Could not retrieve resumes from server.");
      }
    } finally {
      setLoadingResumes(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchResumes();
    }
  }, [user, fetchResumes]);

  // Drag and drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processFile = async (file: File) => {
    if (!file) return;
    if (file.type !== "application/pdf") {
      setError("Please upload a PDF file only.");
      return;
    }

    setUploading(true);
    setUploadProgress(10);
    setUploadStep("Uploading PDF to storage...");
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      // Simulate progress updates for premium UX
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 95) {
            clearInterval(progressInterval);
            return 95;
          }
          // Slow down progress after 70% during backend LlamaIndex/GPT extraction
          const increment = prev < 60 ? 15 : prev < 85 ? 5 : 1;
          
          // Step names matching increments
          if (prev === 40) setUploadStep("Running LlamaIndex text extractor...");
          if (prev === 65) setUploadStep("Structuring candidate profile with GPT-4o-mini...");
          if (prev === 85) setUploadStep("Indexing vectors in local ChromaDB...");
          
          return prev + increment;
        });
      }, 500);

      const response = await api.post('/api/resume/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      clearInterval(progressInterval);
      setUploadProgress(100);
      setUploadStep("Indexing complete! Profile successfully generated.");

      // Delay briefly to allow user to see 100% success state
      setTimeout(() => {
        setUploading(false);
        setUploadProgress(0);
        setUploadStep('');
        fetchResumes();
      }, 1000);

    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || "Upload and parsing failed. Please check your network and try again.");
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
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
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-primary text-primary-foreground font-medium transition-all shadow-glow text-sm"
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

      {/* Main Workspace */}
      <main className="flex-grow p-6 md:p-10 max-w-5xl mx-auto w-full overflow-y-auto">
        {/* Header Section */}
        <section className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold font-outfit mb-1">Resume Parser</h1>
            <p className="text-muted text-sm">Upload, parse, and structure your PDF resume with LlamaIndex and vector indexing.</p>
          </div>
          {!uploading && (
            <div className="flex flex-wrap items-center gap-3 self-start sm:self-center">
              {resumes.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase text-muted tracking-wider hidden sm:inline">Selected Resume:</span>
                  <select
                    value={activeResume?.id || 'upload'}
                    onChange={(e) => {
                      if (e.target.value === 'upload') {
                        setActiveResume(null);
                        setError(null);
                      } else {
                        const selected = resumes.find(r => r.id === e.target.value);
                        if (selected) {
                          setActiveResume(selected);
                          setError(null);
                        }
                      }
                    }}
                    className="bg-[#141320] border border-border text-foreground rounded-xl px-3 py-2 text-sm font-semibold focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all cursor-pointer min-w-[180px]"
                  >
                    {resumes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.parsed_content.file_name || r.parsed_content.name}
                      </option>
                    ))}
                    <option value="upload">+ Upload/View All</option>
                  </select>
                </div>
              )}
              {activeResume && (
                <button
                  onClick={async () => {
                    if (window.confirm("Are you sure you want to delete this resume? This will also remove it from vector indexes.")) {
                      try {
                        await api.delete(`/api/resume/${activeResume.id}`);
                        const remaining = resumes.filter(r => r.id !== activeResume.id);
                        setResumes(remaining);
                        setActiveResume(remaining.length > 0 ? remaining[0] : null);
                        setError(null);
                      } catch (err: any) {
                        console.error("Failed to delete resume", err);
                        setError("Failed to delete resume.");
                      }
                    }
                  }}
                  className="flex items-center gap-2 bg-[#ff4a4a]/10 border border-[#ff4a4a]/20 hover:bg-[#ff4a4a]/25 text-accent px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              )}
            </div>
          )}
        </section>

        {/* Errors */}
        {error && (
          <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-accent mb-6 text-sm">
            {error}
          </div>
        )}

        {/* 1. Drag and Drop Ingestion Box */}
        {!activeResume && !uploading && (
          <div className="space-y-6">
            <div 
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer flex flex-col items-center justify-center min-h-[350px] relative ${
                dragActive 
                  ? 'border-primary bg-primary/5 shadow-glow scale-[1.01]' 
                  : 'border-border bg-[#0e0d1a] hover:border-primary/45 hover:bg-[#111022]'
              }`}
            >
              <input 
                type="file" 
                id="file-upload" 
                className="hidden" 
                accept=".pdf" 
                onChange={handleChange}
              />
              <label htmlFor="file-upload" className="w-full h-full flex flex-col items-center justify-center cursor-pointer">
                <div className="p-5 rounded-full bg-primary/10 border border-primary/20 text-primary mb-6 animate-pulse-slow">
                  <UploadCloud className="h-12 w-12" />
                </div>
                <h3 className="text-xl font-bold font-outfit mb-2">Drag and drop your resume</h3>
                <p className="text-muted text-sm max-w-sm mb-6 leading-relaxed">
                  Support PDF files only. Data is parsed and embedded locally in ChromaDB for privacy-first operations.
                </p>
                <span className="bg-primary hover:bg-primary-hover text-primary-foreground font-semibold px-6 py-3 rounded-xl transition-all shadow-glow text-sm">
                  Browse Files
                </span>
              </label>
            </div>
            
            {/* Quick explanation panel */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="glass-panel p-5 rounded-2xl text-xs text-muted leading-relaxed">
                <strong className="text-foreground block mb-1">Privacy-First Embedding</strong>
                Your resume text is segmented, embedded, and stored locally inside your ChromaDB instance. Data is completely scoped to your user account.
              </div>
              <div className="glass-panel p-5 rounded-2xl text-xs text-muted leading-relaxed">
                <strong className="text-foreground block mb-1">LlamaIndex & GPT Extraction</strong>
                We load documents with LlamaIndex and extract structures via OpenAI. This parses structured metadata without using hardcoded regex filters.
              </div>
            </div>

            {/* Saved Resumes Section */}
            {resumes.length > 0 && (
              <div className="space-y-4 pt-4">
                <h3 className="text-lg font-bold font-outfit text-gray-200">Your Saved Resumes</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {resumes.map((res) => (
                    <div 
                      key={res.id} 
                      onClick={() => setActiveResume(res)}
                      className="glass-panel p-5 rounded-xl border border-border hover:border-primary/45 hover:bg-[#111022] transition-all cursor-pointer flex flex-col justify-between"
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2.5 rounded-lg bg-primary/10 border border-primary/20 text-primary">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div className="overflow-hidden">
                          <h4 className="font-bold text-sm text-foreground font-outfit truncate" title={res.parsed_content.file_name || res.parsed_content.name}>
                            {res.parsed_content.file_name || res.parsed_content.name}
                          </h4>
                          <p className="text-muted text-[11px] truncate">
                            {res.parsed_content.file_name ? `Candidate: ${res.parsed_content.name}` : (res.parsed_content.email || 'No Email')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/50 text-[10px] text-muted">
                        <span>{new Date(res.created_at).toLocaleDateString()}</span>
                        <button 
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (window.confirm("Are you sure you want to delete this resume? This will also remove it from vector indexes.")) {
                              try {
                                await api.delete(`/api/resume/${res.id}`);
                                setResumes(prev => prev.filter(r => r.id !== res.id));
                                if ((activeResume as any)?.id === res.id) {
                                  setActiveResume(null);
                                }
                              } catch (err: any) {
                                console.error("Failed to delete resume", err);
                                setError("Failed to delete resume.");
                              }
                            }
                          }}
                          className="text-accent hover:underline font-semibold flex items-center gap-1"
                        >
                          <Trash2 className="h-3 w-3" />
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 2. Upload Progress Sequence */}
        {uploading && (
          <div className="glass-panel rounded-2xl p-10 flex flex-col items-center justify-center text-center min-h-[350px]">
            <div className="relative flex items-center justify-center mb-8">
              <div className="w-20 h-20 rounded-full border-4 border-primary/20 border-t-primary animate-spin"></div>
              <div className="absolute font-outfit font-bold text-sm">{uploadProgress}%</div>
            </div>
            <h3 className="text-lg font-bold font-outfit mb-2 text-gradient-primary">Ingesting Resume</h3>
            <p className="text-muted text-sm max-w-md animate-pulse">
              {uploadStep}
            </p>
            <div className="w-full max-w-xs bg-secondary h-2 rounded-full overflow-hidden mt-6 border border-border">
              <div 
                className="bg-primary h-full transition-all duration-300 rounded-full" 
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* 3. Render Parsed Resume Details Panel */}
        {activeResume && !uploading && (
          <div className="space-y-6 animate-fade-in">
            {/* Candidate Summary Panel */}
            <div className="glass-panel rounded-2xl p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-outfit font-bold text-2xl">
                  {activeResume.parsed_content.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <h2 className="text-2xl font-bold font-outfit mb-1">
                    {activeResume.parsed_content.file_name || activeResume.parsed_content.name}
                  </h2>
                  {activeResume.parsed_content.file_name && (
                    <p className="text-primary text-sm font-semibold mb-1">
                      Parsed Candidate: {activeResume.parsed_content.name}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                    {activeResume.parsed_content.email && (
                      <span className="flex items-center gap-1.5">
                        <Mail className="h-4 w-4" />
                        {activeResume.parsed_content.email}
                      </span>
                    )}
                    {activeResume.parsed_content.phone && (
                      <span className="flex items-center gap-1.5">
                        <Phone className="h-4 w-4" />
                        {activeResume.parsed_content.phone}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-xs text-muted shrink-0 bg-[#0e0d1a] border border-border px-4 py-2 rounded-xl">
                Uploaded: {new Date(activeResume.created_at).toLocaleDateString()}
              </div>
            </div>

            {/* Dashboard Tabs & Details */}
            <div className="glass-panel rounded-2xl overflow-hidden flex flex-col">
              {/* Tab Selector Headers */}
              <div className="flex border-b border-border bg-[#0e0d1a]">
                <button
                  onClick={() => setActiveTab('skills')}
                  className={`flex-1 py-4 px-6 font-semibold font-outfit text-sm transition-all border-b-2 flex items-center justify-center gap-2 ${
                    activeTab === 'skills'
                      ? 'border-primary text-primary bg-primary/5'
                      : 'border-transparent text-muted hover:text-foreground'
                  }`}
                >
                  <Sparkles className="h-4 w-4" />
                  Skills
                </button>
                <button
                  onClick={() => setActiveTab('experience')}
                  className={`flex-1 py-4 px-6 font-semibold font-outfit text-sm transition-all border-b-2 flex items-center justify-center gap-2 ${
                    activeTab === 'experience'
                      ? 'border-primary text-primary bg-primary/5'
                      : 'border-transparent text-muted hover:text-foreground'
                  }`}
                >
                  <Briefcase className="h-4 w-4" />
                  Experience ({activeResume.parsed_content.experience.length})
                </button>
                <button
                  onClick={() => setActiveTab('education')}
                  className={`flex-1 py-4 px-6 font-semibold font-outfit text-sm transition-all border-b-2 flex items-center justify-center gap-2 ${
                    activeTab === 'education'
                      ? 'border-primary text-primary bg-primary/5'
                      : 'border-transparent text-muted hover:text-foreground'
                  }`}
                >
                  <GraduationCap className="h-4 w-4" />
                  Education ({activeResume.parsed_content.education.length})
                </button>
              </div>

              {/* Tab Display Areas */}
              <div className="p-6 md:p-8 bg-[#100f1c]/30">
                {activeTab === 'skills' && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-bold font-outfit text-gray-200">Extracted Skills</h3>
                    <p className="text-xs text-muted mb-4">Core technical keywords detected by the parser</p>
                    {activeResume.parsed_content.skills && activeResume.parsed_content.skills.length > 0 ? (
                      <div className="flex flex-wrap gap-2.5">
                        {activeResume.parsed_content.skills.map((skill, index) => (
                          <span 
                            key={index}
                            className="bg-[#141320] border border-border px-3 py-1.5 rounded-lg text-sm font-medium hover:border-primary/45 transition-colors cursor-default"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted text-sm italic">No technical skills detected.</p>
                    )}
                  </div>
                )}

                {activeTab === 'experience' && (
                  <div className="space-y-6">
                    <div className="flex justify-between items-center mb-2">
                      <div>
                        <h3 className="text-lg font-bold font-outfit text-gray-200">Work Experience</h3>
                        <p className="text-xs text-muted">Chronological work history</p>
                      </div>
                    </div>

                    {activeResume.parsed_content.experience && activeResume.parsed_content.experience.length > 0 ? (
                      <div className="space-y-6 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
                        {activeResume.parsed_content.experience.map((job, index) => (
                          <div key={index} className="relative pl-8 group">
                            {/* Dot indicator */}
                            <div className="absolute left-1.5 top-1.5 h-3.5 w-3.5 rounded-full bg-primary border-4 border-background group-hover:scale-110 transition-transform"></div>
                            
                            <div className="glass-panel p-5 rounded-xl space-y-2">
                              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-1">
                                <h4 className="font-bold text-base text-foreground font-outfit">{job.role}</h4>
                                <span className="text-xs text-muted font-medium px-2.5 py-1 rounded-full bg-secondary border border-border w-fit">
                                  {job.duration || 'N/A'}
                                </span>
                              </div>
                              <p className="text-primary text-sm font-semibold">{job.company}</p>
                              {job.description && (
                                <p className="text-muted text-sm leading-relaxed pt-2 border-t border-border mt-2">
                                  {job.description}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted text-sm italic">No employment history detected.</p>
                    )}
                  </div>
                )}

                {activeTab === 'education' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-bold font-outfit text-gray-200">Education Details</h3>
                      <p className="text-xs text-muted">Academic backgrounds</p>
                    </div>

                    {activeResume.parsed_content.education && activeResume.parsed_content.education.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {activeResume.parsed_content.education.map((edu, index) => (
                          <div key={index} className="glass-panel p-5 rounded-xl flex items-start gap-4">
                            <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-primary shrink-0">
                              <GraduationCap className="h-6 w-6" />
                            </div>
                            <div className="space-y-1 overflow-hidden">
                              <h4 className="font-bold text-sm text-foreground font-outfit truncate">{edu.institution}</h4>
                              <p className="text-primary text-xs font-semibold">
                                {edu.degree}{edu.field_of_study ? ` in ${edu.field_of_study}` : ''}
                              </p>
                              {edu.graduation_year && (
                                <p className="text-muted text-xs pt-1">
                                  Class of {edu.graduation_year}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted text-sm italic">No academic history detected.</p>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            {/* ATS match pathway prompt */}
            <div className="glass-panel rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h4 className="font-bold font-outfit text-base mb-1">Ready to test against Job Requirements?</h4>
                <p className="text-muted text-xs">Analyze how your parsed resume performs against active job postings.</p>
              </div>
              <Link
                href="/jobs"
                className="bg-primary hover:bg-primary-hover text-primary-foreground font-semibold px-5 py-2.5 rounded-xl transition-all shadow-glow text-xs flex items-center gap-1.5 self-start sm:self-center shrink-0"
              >
                Go to Job Matcher <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
