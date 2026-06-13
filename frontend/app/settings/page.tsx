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
  Settings,
  Key,
  Save,
  Trash2,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertCircle,
  Loader2,
  TrendingUp
} from 'lucide-react';
import Link from 'next/link';

interface ApiKeyStatus {
  provider: string;
  has_key: boolean;
  masked_key: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const { user, signOut, isLoading: authLoading } = useAuthStore();

  const [keys, setKeys] = useState<ApiKeyStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingProvider, setSavingProvider] = useState<string | null>(null);
  const [deletingProvider, setDeletingProvider] = useState<string | null>(null);
  
  // Input fields for keys
  const [openaiInput, setOpenaiInput] = useState('');
  const [anthropicInput, setAnthropicInput] = useState('');
  const [googleInput, setGoogleInput] = useState('');

  // Password visibility states
  const [showOpenai, setShowOpenai] = useState(false);
  const [showAnthropic, setShowShowAnthropic] = useState(false);
  const [showGoogle, setShowGoogle] = useState(false);

  // Status and error alerts
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  // Fetch registered key statuses
  async function loadKeyStatuses() {
    try {
      setLoading(true);
      const res = await api.get('/api/settings/keys');
      setKeys(res.data);
    } catch (err: any) {
      console.error("Failed to load settings keys status", err);
      showNotification("Failed to fetch API key statuses from server.", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (user) {
      loadKeyStatuses();
    }
  }, [user]);

  const showNotification = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 5000);
  };

  const handleSaveKey = async (provider: string, keyVal: string, setInput: (v: string) => void) => {
    if (!keyVal.trim()) {
      showNotification("API Key cannot be empty.", "error");
      return;
    }

    try {
      setSavingProvider(provider);
      const res = await api.post('/api/settings/keys', {
        provider,
        api_key: keyVal.trim()
      });
      showNotification(res.data.detail || `Successfully registered ${provider} key.`, "success");
      setInput(''); // Clear input after successful save
      await loadKeyStatuses();
    } catch (err: any) {
      const errMsg = err.response?.data?.detail || `Failed to save ${provider} API key.`;
      showNotification(errMsg, "error");
    } finally {
      setSavingProvider(null);
    }
  };

  const handleDeleteKey = async (provider: string) => {
    if (!confirm(`Are you sure you want to delete your registered ${provider.toUpperCase()} API key?`)) {
      return;
    }

    try {
      setDeletingProvider(provider);
      const res = await api.delete(`/api/settings/keys/${provider}`);
      showNotification(res.data.detail || `Successfully deleted ${provider} key.`, "success");
      await loadKeyStatuses();
    } catch (err: any) {
      const errMsg = err.response?.data?.detail || `Failed to delete ${provider} API key.`;
      showNotification(errMsg, "error");
    } finally {
      setDeletingProvider(null);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#08070d] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-muted text-sm font-medium">Loading session...</p>
        </div>
      </div>
    );
  }

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';

  const getKeyStatus = (provider: string) => {
    return keys.find(k => k.provider === provider);
  };

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
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-muted hover:text-foreground hover:bg-[#141320] font-medium transition-all text-sm"
            >
              <Compass className="h-5 w-5" />
              AI Mentor
            </Link>
            <Link 
              href="/settings" 
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-primary text-primary-foreground font-medium transition-all shadow-glow text-sm"
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

      {/* Main Settings Page */}
      <main className="flex-grow p-6 md:p-10 max-w-4xl mx-auto w-full overflow-y-auto">
        {/* Page Header */}
        <section className="mb-8 border-b border-border pb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 text-primary">
              <Settings className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-outfit">Account Settings</h1>
              <p className="text-muted text-sm">Configure your personal API credentials to avoid server quota limits</p>
            </div>
          </div>
        </section>

        {/* Global Notifications */}
        {notification && (
          <div className={`mb-6 p-4 rounded-xl border flex items-center gap-3 transition-all ${
            notification.type === 'success' 
              ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400' 
              : 'bg-destructive/10 border-destructive/25 text-accent'
          }`}>
            {notification.type === 'success' ? (
              <ShieldCheck className="h-5 w-5 shrink-0" />
            ) : (
              <AlertCircle className="h-5 w-5 shrink-0" />
            )}
            <span className="text-sm font-medium">{notification.message}</span>
          </div>
        )}

        {/* API Credentials Section */}
        <section className="space-y-6">
          <div className="glass-panel p-6 rounded-2xl border border-border/80">
            <h2 className="text-lg font-bold font-outfit mb-2 flex items-center gap-2">
              <Key className="h-5 w-5 text-primary" />
              API Provider Credentials
            </h2>
            <p className="text-muted text-xs mb-6 leading-relaxed">
              Inputting your own API keys ensures that all search parsing, ATS metrics comparison, timeline compilers, and chat streaming sessions execute under your individual account limits. Keys are stored in secure Supabase storage and never shared.
            </p>

            {loading ? (
              <div className="py-12 flex justify-center">
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
              </div>
            ) : (
              <div className="space-y-8">
                {/* 1. OpenAI Key Form */}
                <div className="p-5 rounded-xl bg-[#0e0d1a]/50 border border-border/60">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                    <div>
                      <h3 className="font-semibold text-sm">OpenAI API Key</h3>
                      <p className="text-[11px] text-muted">Required for Resume Parser, ATS Job Matcher, and Roadmap Generator</p>
                    </div>
                    {getKeyStatus('openai')?.has_key ? (
                      <span className="self-start sm:self-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        Configured ({getKeyStatus('openai')?.masked_key})
                      </span>
                    ) : (
                      <span className="self-start sm:self-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-destructive/10 border border-destructive/20 text-accent">
                        Not Configured
                      </span>
                    )}
                  </div>
                  <div className="flex gap-3 items-center">
                    <div className="relative flex-grow">
                      <input
                        type={showOpenai ? "text" : "password"}
                        placeholder="sk-..."
                        value={openaiInput}
                        onChange={(e) => setOpenaiInput(e.target.value)}
                        disabled={savingProvider === 'openai'}
                        className="w-full bg-[#141320] border border-border rounded-xl pl-4 pr-10 py-3 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-gray-300 placeholder-muted"
                      />
                      <button
                        type="button"
                        onClick={() => setShowOpenai(!showOpenai)}
                        className="absolute right-3 top-3.5 text-muted hover:text-foreground transition-colors"
                      >
                        {showOpenai ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <button
                      onClick={() => handleSaveKey('openai', openaiInput, setOpenaiInput)}
                      disabled={savingProvider === 'openai' || !openaiInput.trim()}
                      className="bg-primary hover:bg-primary-hover disabled:bg-secondary disabled:text-muted px-4 py-3 rounded-xl transition-all shadow-glow text-sm font-semibold flex items-center gap-1.5"
                    >
                      {savingProvider === 'openai' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      Save
                    </button>
                    {getKeyStatus('openai')?.has_key && (
                      <button
                        onClick={() => handleDeleteKey('openai')}
                        disabled={deletingProvider === 'openai'}
                        className="bg-destructive/10 hover:bg-destructive/20 border border-destructive/25 text-accent p-3.5 rounded-xl transition-all"
                        title="Delete OpenAI key"
                      >
                        {deletingProvider === 'openai' ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* 2. Anthropic Key Form */}
                <div className="p-5 rounded-xl bg-[#0e0d1a]/50 border border-border/60">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                    <div>
                      <h3 className="font-semibold text-sm">Anthropic Claude API Key</h3>
                      <p className="text-[11px] text-muted">Runs the Career Mentor Node on Claude 3.5 Sonnet</p>
                    </div>
                    {getKeyStatus('anthropic')?.has_key ? (
                      <span className="self-start sm:self-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        Configured ({getKeyStatus('anthropic')?.masked_key})
                      </span>
                    ) : (
                      <span className="self-start sm:self-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-destructive/10 border border-destructive/20 text-accent">
                        Not Configured
                      </span>
                    )}
                  </div>
                  <div className="flex gap-3 items-center">
                    <div className="relative flex-grow">
                      <input
                        type={showAnthropic ? "text" : "password"}
                        placeholder="sk-ant-..."
                        value={anthropicInput}
                        onChange={(e) => setAnthropicInput(e.target.value)}
                        disabled={savingProvider === 'anthropic'}
                        className="w-full bg-[#141320] border border-border rounded-xl pl-4 pr-10 py-3 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-gray-300 placeholder-muted"
                      />
                      <button
                        type="button"
                        onClick={() => setShowShowAnthropic(!showAnthropic)}
                        className="absolute right-3 top-3.5 text-muted hover:text-foreground transition-colors"
                      >
                        {showAnthropic ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <button
                      onClick={() => handleSaveKey('anthropic', anthropicInput, setAnthropicInput)}
                      disabled={savingProvider === 'anthropic' || !anthropicInput.trim()}
                      className="bg-primary hover:bg-primary-hover disabled:bg-secondary disabled:text-muted px-4 py-3 rounded-xl transition-all shadow-glow text-sm font-semibold flex items-center gap-1.5"
                    >
                      {savingProvider === 'anthropic' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      Save
                    </button>
                    {getKeyStatus('anthropic')?.has_key && (
                      <button
                        onClick={() => handleDeleteKey('anthropic')}
                        disabled={deletingProvider === 'anthropic'}
                        className="bg-destructive/10 hover:bg-destructive/20 border border-destructive/25 text-accent p-3.5 rounded-xl transition-all"
                        title="Delete Anthropic key"
                      >
                        {deletingProvider === 'anthropic' ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* 3. Google Gemini Key Form */}
                <div className="p-5 rounded-xl bg-[#0e0d1a]/50 border border-border/60">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                    <div>
                      <h3 className="font-semibold text-sm">Google Gemini API Key</h3>
                      <p className="text-[11px] text-muted">Optionally runs the Career Mentor Node on Gemini 1.5 Pro</p>
                    </div>
                    {getKeyStatus('google')?.has_key ? (
                      <span className="self-start sm:self-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        Configured ({getKeyStatus('google')?.masked_key})
                      </span>
                    ) : (
                      <span className="self-start sm:self-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-destructive/10 border border-destructive/20 text-accent">
                        Not Configured
                      </span>
                    )}
                  </div>
                  <div className="flex gap-3 items-center">
                    <div className="relative flex-grow">
                      <input
                        type={showGoogle ? "text" : "password"}
                        placeholder="AIzaSy..."
                        value={googleInput}
                        onChange={(e) => setGoogleInput(e.target.value)}
                        disabled={savingProvider === 'google'}
                        className="w-full bg-[#141320] border border-border rounded-xl pl-4 pr-10 py-3 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-gray-300 placeholder-muted"
                      />
                      <button
                        type="button"
                        onClick={() => setShowGoogle(!showGoogle)}
                        className="absolute right-3 top-3.5 text-muted hover:text-foreground transition-colors"
                      >
                        {showGoogle ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <button
                      onClick={() => handleSaveKey('google', googleInput, setGoogleInput)}
                      disabled={savingProvider === 'google' || !googleInput.trim()}
                      className="bg-primary hover:bg-primary-hover disabled:bg-secondary disabled:text-muted px-4 py-3 rounded-xl transition-all shadow-glow text-sm font-semibold flex items-center gap-1.5"
                    >
                      {savingProvider === 'google' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      Save
                    </button>
                    {getKeyStatus('google')?.has_key && (
                      <button
                        onClick={() => handleDeleteKey('google')}
                        disabled={deletingProvider === 'google'}
                        className="bg-destructive/10 hover:bg-destructive/20 border border-destructive/25 text-accent p-3.5 rounded-xl transition-all"
                        title="Delete Google key"
                      >
                        {deletingProvider === 'google' ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
