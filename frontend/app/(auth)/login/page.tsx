"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { Mail, Lock, Sparkles, AlertCircle, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, error: storeError, setError } = useAuthStore();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localLoading, setLocalLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Clear errors on mount
  useEffect(() => {
    setError(null);
  }, [setError]);

  // Redirect if already logged in
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, isLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalLoading(true);
    setLocalError(null);
    setError(null);

    if (!email || !password) {
      setLocalError('Please fill in all fields.');
      setLocalLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      
      // Zustand auth store's onAuthStateChange listener will automatically detect the sign-in,
      // update state, set the cookie, and then we redirect.
      router.push('/dashboard');
    } catch (err: any) {
      setLocalError(err.message || 'Invalid email or password');
    } finally {
      setLocalLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setLocalLoading(true);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`
        }
      });
      if (error) throw error;
    } catch (err: any) {
      setLocalError(err.message || 'Failed to initialize Google Login');
      setLocalLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden">
      {/* Background Glows */}
      <div className="ambient-glow w-[500px] h-[500px] bg-primary -top-40 -left-40 animate-pulse-slow"></div>
      <div className="ambient-glow w-[400px] h-[400px] bg-accent-purple -bottom-20 -right-20 animate-pulse-slow"></div>

      <div className="w-full max-w-md glass-panel rounded-2xl p-8 shadow-glass relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 rounded-xl bg-primary/10 border border-primary/20 mb-4">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-3xl font-bold font-outfit tracking-tight">Welcome Back</h1>
          <p className="text-muted mt-2">Sign in to your AI Career Intelligence Account</p>
        </div>

        {/* Errors */}
        {(localError || storeError) && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-accent mb-6 text-sm">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <span>{localError || storeError}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium mb-1.5 text-gray-300" htmlFor="email">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted" />
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-[#141320] border border-border rounded-xl pl-10 pr-4 py-3 text-foreground placeholder-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                disabled={localLoading}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-sm font-medium text-gray-300" htmlFor="password">
                Password
              </label>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted" />
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#141320] border border-border rounded-xl pl-10 pr-4 py-3 text-foreground placeholder-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                disabled={localLoading}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={localLoading}
            className="w-full bg-primary hover:bg-primary-hover text-primary-foreground font-semibold py-3 px-4 rounded-xl transition-all shadow-glow flex items-center justify-center gap-2 mt-2"
          >
            {localLoading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-[#100f1c] px-3 text-muted">Or continue with</span>
          </div>
        </div>

        {/* Google OAuth */}
        <button
          onClick={handleGoogleLogin}
          type="button"
          disabled={localLoading}
          className="w-full bg-secondary hover:bg-opacity-80 text-secondary-foreground font-medium py-3 px-4 rounded-xl border border-border transition-all flex items-center justify-center gap-2 mb-6"
        >
          <svg className="h-5 w-5 mr-1" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.136 4.114-3.48 0-6.301-2.822-6.301-6.301s2.82-6.301 6.3-6.301c1.554 0 2.97.564 4.07 1.498l3.102-3.102C18.89 2.155 15.82 1 12.24 1 6.033 1 1 6.033 1 12.24s5.033 11.24 11.24 11.24c6.478 0 10.793-4.537 10.793-10.997 0-.746-.09-1.42-.22-2.2H12.24z" />
          </svg>
          Google
        </button>

        {/* Footer */}
        <div className="text-center text-sm text-muted">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="text-primary hover:underline font-medium">
            Create Account
          </Link>
        </div>
      </div>
    </div>
  );
}
