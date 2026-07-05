/** @type {import('next').NextConfig} */
const nextConfig = {
  // ── Images ────────────────────────────────────────────────────────────────
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "*.googleusercontent.com" },
    ],
    formats: ["image/avif", "image/webp"],
  },

  // ── Performance ──────────────────────────────────────────────────────────
  compress:        true,
  poweredByHeader: false,

  // ── Security headers ─────────────────────────────────────────────────────
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options",    value: "nosniff" },
          { key: "X-Frame-Options",           value: "DENY" },
          { key: "X-XSS-Protection",          value: "1; mode=block" },
          { key: "Referrer-Policy",           value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy",        value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      // Cache static assets aggressively
      {
        source: "/(.*)\\.(ico|png|jpg|jpeg|svg|webp|avif|woff2|woff)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      // Never cache the manifest
      {
        source: "/manifest.json",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
        ],
      },
    ];
  },

  // ── Redirects ─────────────────────────────────────────────────────────────
  async redirects() {
    return [
      { source: "/login",    destination: "/auth/signin", permanent: true },
      { source: "/register", destination: "/auth/signup", permanent: true },
      { source: "/race",     destination: "/multiplayer", permanent: true },
    ];
  },

  // ── Webpack (bundle optimisation) ─────────────────────────────────────────
  webpack(config) {
    // Tree-shake lodash if used
    config.resolve.alias = {
      ...config.resolve.alias,
      lodash: "lodash-es",
    };
    return config;
  },
};

export default nextConfig;
