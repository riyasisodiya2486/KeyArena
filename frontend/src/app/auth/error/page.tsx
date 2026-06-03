"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";

const ERROR_MESSAGES: Record<string, string> = {
  Configuration:   "There is a problem with the server configuration. Please contact support.",
  AccessDenied:    "You do not have permission to sign in.",
  Verification:    "The sign-in link has expired or has already been used.",
  OAuthSignin:     "Could not start OAuth sign-in. Please try again.",
  OAuthCallback:   "Could not complete OAuth sign-in. Please try again.",
  OAuthCreateAccount: "Could not create an account using OAuth. The email may already be registered.",
  EmailCreateAccount: "Could not create an account. Please try again.",
  Callback:        "There was an error during sign in. Please try again.",
  Default:         "An unexpected error occurred. Please try again.",
};

export default function AuthErrorPage() {
  const searchParams = useSearchParams();
  const errorCode    = searchParams.get("error") ?? "Default";
  const message      = ERROR_MESSAGES[errorCode] ?? ERROR_MESSAGES.Default;

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center">
        <Link href="/" className="inline-flex items-center gap-0.5 mb-8">
          <span className="font-mono text-2xl font-bold text-ink">key</span>
          <span className="font-mono text-2xl font-bold text-brand-400">race</span>
        </Link>

        <div className="card p-8">
          <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/30
                         flex items-center justify-center mx-auto mb-4">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
              stroke="#F87171" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>

          <h1 className="text-lg font-semibold text-ink mb-2">Sign-in error</h1>
          <p className="text-sm text-ink-2 mb-6 leading-relaxed">{message}</p>

          {errorCode === "OAuthCreateAccount" && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-5 text-xs text-yellow-400 text-left">
              <strong className="block mb-1">Email already registered</strong>
              If you've previously signed in with email/password, please use that method instead. You can link your OAuth account in settings once signed in.
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Link href="/auth/signin" className="btn-primary text-center text-sm py-2.5">
              Try signing in again
            </Link>
            <Link href="/auth/signup" className="btn-ghost text-center text-sm py-2.5">
              Create a new account
            </Link>
          </div>
        </div>

        <p className="mt-5 text-xs text-ink-3">
          Error code: <span className="font-mono text-ink-2">{errorCode}</span>
        </p>
      </div>
    </div>
  );
}
``