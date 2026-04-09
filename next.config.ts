import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['better-sqlite3'],
  turbopack: {},
  webpack: (config) => {
    config.watchOptions = {
      ...config.watchOptions,
      ignored: /node_modules/,
    };
    return config;
  },
};

export default nextConfig;
