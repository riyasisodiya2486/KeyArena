"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ background: "#0E0E0F", color: "#F2F1EE", fontFamily: "system-ui", margin: 0 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: "24px", textAlign: "center" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>💥</div>
          <h1 style={{ fontSize: "22px", fontWeight: 700, marginBottom: "8px" }}>Something broke</h1>
          <p style={{ fontSize: "14px", color: "#A8A7A3", marginBottom: "24px", maxWidth: "400px" }}>
            {error.message ?? "An unexpected error occurred. Our team has been notified."}
          </p>
          {error.digest && (
            <p style={{ fontSize: "11px", color: "#6B6A67", marginBottom: "20px", fontFamily: "monospace" }}>
              Error ID: {error.digest}
            </p>
          )}
          <div style={{ display: "flex", gap: "12px" }}>
            <button onClick={reset}
              style={{ background: "#26262A", color: "#F2F1EE", border: "1px solid #303035", borderRadius: "8px", padding: "10px 20px", cursor: "pointer", fontSize: "14px" }}>
              Try again
            </button>
            <a href="/"
              style={{ background: "#E8593C", color: "white", borderRadius: "8px", padding: "10px 20px", fontSize: "14px", textDecoration: "none" }}>
              Go home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
