"use client";

import { signIn } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";

type Tab = "email" | "oauth";

export default function SignInPage() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const callbackUrl  = searchParams.get("callbackUrl") ?? "/practice";

  const [tab,      setTab]      = useState<Tab>("email");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState<string | null>(null);

  // ── Email/password sign-in ───────────────────────────────────────────────
  async function handleEmailSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading("email");
    try {
      const res = await signIn("credentials", {
        email:    email.trim().toLowerCase(),
        password,
        redirect: false,
      });
      if (res?.error) {
        setError("Incorrect email or password. Please try again.");
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(null);
    }
  }

  // ── OAuth sign-in ─────────────────────────────────────────────────────────
  async function handleOAuth(provider: "google" | "github") {
    setLoading(provider);
    await signIn(provider, { callbackUrl });
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      {/* Background grid */}
      <div
        className="fixed inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(#F2F1EE 1px, transparent 1px),
                            linear-gradient(90deg, #F2F1EE 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-0.5 mb-3">
            <span className="font-mono text-3xl font-bold text-ink">key</span>
            <span className="font-mono text-3xl font-bold text-brand-400">race</span>
          </Link>
          <p className="text-ink-2 text-sm">
            Sign in to track WPM, compete, and rank globally.
          </p>
        </div>

        <div className="card p-6">
          {/* Tabs */}
          <div className="flex bg-surface-2 rounded-lg p-1 mb-6">
            {(["email", "oauth"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setError(""); }}
                className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
                  tab === t
                    ? "bg-surface-1 text-ink shadow-sm"
                    : "text-ink-3 hover:text-ink-2"
                }`}
              >
                {t === "email" ? "Email & Password" : "Continue with"}
              </button>
            ))}
          </div>

          {/* ── Email/password tab ─────────────────────────────────────── */}
          {tab === "email" && (
            <form onSubmit={handleEmailSignIn} className="space-y-4">
              <div>
                <label className="block text-xs text-ink-3 uppercase tracking-wider mb-1.5">
                  Email address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                  className="input w-full"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs text-ink-3 uppercase tracking-wider">
                    Password
                  </label>
                  <Link
                    href="/auth/forgot-password"
                    className="text-xs text-ink-3 hover:text-ink-2 transition-colors"
                  >
                    Forgot password?
                  </Link>
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="input w-full"
                />
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3
                               text-sm text-red-400">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading !== null}
                className="btn-primary w-full py-3 text-sm flex items-center justify-center gap-2"
              >
                {loading === "email" ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Signing in…
                  </>
                ) : "Sign in"}
              </button>

              <p className="text-center text-sm text-ink-3">
                Don't have an account?{" "}
                <Link
                  href={`/auth/signup${callbackUrl !== "/practice" ? `?callbackUrl=${callbackUrl}` : ""}`}
                  className="text-brand-400 hover:text-brand-600 font-medium"
                >
                  Create one free
                </Link>
              </p>
            </form>
          )}

          {/* ── OAuth tab ──────────────────────────────────────────────── */}
          {tab === "oauth" && (
            <div className="space-y-3">
              <p className="text-xs text-ink-3 text-center mb-4">
                Choose your provider to continue
              </p>

              <button
                onClick={() => handleOAuth("google")}
                disabled={loading !== null}
                className="w-full flex items-center justify-center gap-3 bg-surface-2
                           hover:bg-surface-3 border border-surface-3 hover:border-surface-4
                           text-ink font-medium px-5 py-3 rounded-lg transition-all
                           disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading === "google" ? (
                  <span className="w-5 h-5 border-2 border-ink-3 border-t-ink rounded-full animate-spin" />
                ) : <GoogleIcon />}
                Continue with Google
              </button>

              <button
                onClick={() => handleOAuth("github")}
                disabled={loading !== null}
                className="w-full flex items-center justify-center gap-3 bg-surface-2
                           hover:bg-surface-3 border border-surface-3 hover:border-surface-4
                           text-ink font-medium px-5 py-3 rounded-lg transition-all
                           disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading === "github" ? (
                  <span className="w-5 h-5 border-2 border-ink-3 border-t-ink rounded-full animate-spin" />
                ) : <GitHubIcon />}
                Continue with GitHub
              </button>

              <p className="text-center text-sm text-ink-3 pt-2">
                Don't have an account?{" "}
                <Link
                  href="/auth/signup"
                  className="text-brand-400 hover:text-brand-600 font-medium"
                >
                  Sign up free
                </Link>
              </p>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-ink-3 mt-5">
          By signing in you agree to our{" "}
          <Link href="/terms"   className="text-ink-2 hover:text-ink underline">Terms</Link>
          {" "}and{" "}
          <Link href="/privacy" className="text-ink-2 hover:text-ink underline">Privacy Policy</Link>.
        </p>

        {/* Guest practice link */}
        <div className="text-center mt-4">
          <Link
            href="/practice"
            className="text-xs text-ink-3 hover:text-ink-2 transition-colors underline underline-offset-2"
          >
            Just want to practise? Continue as guest →
          </Link>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}
