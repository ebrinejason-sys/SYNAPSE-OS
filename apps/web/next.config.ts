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
};

export default nextConfig;
