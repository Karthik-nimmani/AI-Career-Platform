"use client";

import React from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';
import { Sparkles, FileText, ArrowRight, BrainCircuit, LineChart, Compass } from 'lucide-react';

export default function LandingPage() {
  const { isAuthenticated, isLoading } = useAuthStore();

  return (
    <div className="relative min-h-screen bg-[#08070d] text-foreground overflow-hidden flex flex-col justify-between">
      {/* Background Glows */}
      <div className="ambient-glow w-[600px] h-[600px] bg-primary -top-40 -left-20 animate-pulse-slow"></div>
      <div className="ambient-glow w-[500px] h-[500px] bg-accent-purple -bottom-40 -right-20 animate-pulse-slow"></div>

      {/* Header */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-6 h-20 flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <span className="font-outfit font-bold text-xl tracking-tight">AI Career Intel</span>
        </div>

        <nav className="flex items-center gap-4">
          {isLoading ? (
            <div className="h-10 w-24 bg-[#141320] animate-pulse rounded-xl"></div>
          ) : isAuthenticated ? (
            <Link
              href="/dashboard"
              className="bg-primary hover:bg-primary-hover text-primary-foreground px-5 py-2.5 rounded-xl font-semibold transition-all shadow-glow text-sm flex items-center gap-2"
            >
              Dashboard <ArrowRight className="h-4 w-4" />
            </Link>
          ) : (
            <>
              <Link href="/login" className="text-muted hover:text-foreground text-sm font-medium transition-colors">
                Sign In
              </Link>
              <Link
                href="/register"
                className="bg-primary hover:bg-primary-hover text-primary-foreground px-5 py-2.5 rounded-xl font-semibold transition-all shadow-glow text-sm"
              >
                Get Started
              </Link>
            </>
          )}
        </nav>
      </header>

      {/* Hero Section */}
      <main className="relative z-10 flex-grow max-w-7xl mx-auto px-6 py-20 flex flex-col items-center justify-center text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary border border-border text-primary text-xs font-semibold mb-6">
          <BrainCircuit className="h-4 w-4 animate-bounce" />
          Next-Gen Career Optimization Agent
        </div>

        <h1 className="text-5xl md:text-7xl font-bold font-outfit tracking-tight max-w-4xl leading-tight mb-6">
          Accelerate Your Career with <span className="text-gradient-primary">Intelligence</span>
        </h1>

        <p className="text-muted text-lg md:text-xl max-w-2xl leading-relaxed mb-10">
          Optimize your resume for applicant tracking systems, identify professional skill gaps, generate customized study roadmaps, and receive 1-on-1 mentoring from advanced AI agents.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 mb-20">
          {isAuthenticated ? (
            <Link
              href="/dashboard"
              className="bg-primary hover:bg-primary-hover text-primary-foreground px-8 py-4 rounded-xl font-semibold text-lg transition-all shadow-glow flex items-center justify-center gap-2"
            >
              Go to Dashboard <ArrowRight className="h-5 w-5" />
            </Link>
          ) : (
            <>
              <Link
                href="/register"
                className="bg-primary hover:bg-primary-hover text-primary-foreground px-8 py-4 rounded-xl font-semibold text-lg transition-all shadow-glow flex items-center justify-center gap-2"
              >
                Create Account <ArrowRight className="h-5 w-5" />
              </Link>
              <Link
                href="/login"
                className="bg-[#141320] hover:bg-[#1a192c] border border-border px-8 py-4 rounded-xl font-semibold text-lg transition-all flex items-center justify-center"
              >
                Learn More
              </Link>
            </>
          )}
        </div>

        {/* Feature Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full mt-10">
          <div className="glass-panel glass-panel-hover rounded-2xl p-6 text-left">
            <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 w-fit mb-4">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-xl font-bold font-outfit mb-2">Resume Analyzer</h3>
            <p className="text-muted text-sm leading-relaxed">
              Upload PDF resumes to extract structured data and run deep ATS matching checks against target job descriptions.
            </p>
          </div>

          <div className="glass-panel glass-panel-hover rounded-2xl p-6 text-left">
            <div className="p-3 rounded-xl bg-accent-purple/10 border border-accent-purple/20 w-fit mb-4">
              <LineChart className="h-6 w-6 text-accent-purple" />
            </div>
            <h3 className="text-xl font-bold font-outfit mb-2">Skill Gap Analysis</h3>
            <p className="text-muted text-sm leading-relaxed">
              Identify key technical requirements missing from your profile and review curated actionable feedback.
            </p>
          </div>

          <div className="glass-panel glass-panel-hover rounded-2xl p-6 text-left">
            <div className="p-3 rounded-xl bg-accent-cyan/10 border border-accent-cyan/20 w-fit mb-4">
              <Compass className="h-6 w-6 text-accent-cyan" />
            </div>
            <h3 className="text-xl font-bold font-outfit mb-2">AI Career Mentor</h3>
            <p className="text-muted text-sm leading-relaxed">
              Interact with a dedicated multi-agent system customized to answer career, interview prep, and technical queries.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full max-w-7xl mx-auto px-6 py-6 border-t border-border flex flex-col sm:flex-row items-center justify-between text-muted text-xs">
        <div>&copy; 2026 AI Career Intelligence Platform. All rights reserved.</div>
        <div className="flex gap-4 mt-2 sm:mt-0">
          <a href="#" className="hover:text-foreground">Privacy Policy</a>
          <a href="#" className="hover:text-foreground">Terms of Service</a>
          <a href="#" className="hover:text-foreground">Contact Support</a>
        </div>
      </footer>
    </div>
  );
}
