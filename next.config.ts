import type { NextConfig } from "next";
import withLlamaIndex from "llamaindex/next";

/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = {
  // preserve: to fix "Webpack is configured while Turbopack is not, which may cause problems" warning, see https://github.com/payloadcms/payload/issues/12550#issuecomment-2939070941
  turbopack: {
    resolveExtensions: ['.mdx', '.tsx', '.ts', '.jsx', '.js', '.mjs', '.json'],
    rules: {
      '*.svg': {
        loaders: ['@svgr/webpack'],
        as: '*.js',
      },
    },
  },
  // do NOT remove this, shiki can't be bundled
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
  experimental: {
    turbopackPersistentCaching: true,
  },
};

export default withLlamaIndex(nextConfig);
