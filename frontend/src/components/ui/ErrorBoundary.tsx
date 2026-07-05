"use client";

import { Component, type ReactNode } from "react";
import Link from "next/link";

interface Props {
  children:  ReactNode;
  fallback?: ReactNode;
}
interface State { hasError: boolean; error?: Error }

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("[ErrorBoundary]", error, info);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex flex-col items-center justify-center min-h-[300px] px-4 text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-lg font-semibold text-ink mb-2">Something went wrong</h2>
          <p className="text-sm text-ink-2 mb-6 max-w-sm">
            {this.state.error?.message ?? "An unexpected error occurred."}
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => this.setState({ hasError: false })}
              className="btn-ghost px-5 py-2 text-sm"
            >
              Try again
            </button>
            <Link href="/" className="btn-primary px-5 py-2 text-sm">
              Go home
            </Link>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
