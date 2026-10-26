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
      <body style={{ background: "#101012", color: "#F2EEE6", fontFamily: "system-ui", margin: 0 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: "24px", textAlign: "center" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}></div>
          <h1 style={{ fontSize: "22px", fontWeight: 700, marginBottom: "8px" }}>Something broke</h1>
          <p style={{ fontSize: "14px", color: "#AAA69D", marginBottom: "24px", maxWidth: "400px" }}>
            {error.message ?? "An unexpected error occurred. Our team has been notified."}
          </p>
          {error.digest && (
            <p style={{ fontSize: "11px", color: "#807D76", marginBottom: "20px", fontFamily: "monospace" }}>
              Error ID: {error.digest}
            </p>
          )}
          <div style={{ display: "flex", gap: "12px" }}>
            <button onClick={reset}
              style={{ background: "#19191C", color: "#F2EEE6", border: "1px solid #2A2A2E", borderRadius: "4px", padding: "10px 20px", cursor: "pointer", fontSize: "14px" }}>
              Try again
            </button>
            <a href="/"
              style={{ background: "#E45B46", color: "white", borderRadius: "4px", padding: "10px 20px", fontSize: "14px", textDecoration: "none" }}>
              Go home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
