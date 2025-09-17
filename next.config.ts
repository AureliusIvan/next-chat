import type { NextConfig } from "next";
import withLlamaIndex from "llamaindex/next";

/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = {
  serverExternalPackages: ['shiki'], // shiki can't be bundled
  // Your existing config
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'github.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default withLlamaIndex(nextConfig);
