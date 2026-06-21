import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@synapse/auth",
    "@synapse/db",
    "@synapse/config",
    "@synapse/email",
  ],
  experimental: {
    serverActions: {
      allowedOrigins: ["*.synapseos.tech", "localhost:3001"],
    },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Robots-Tag", value: "noai, noimageai" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
