import type { NextConfig } from "next";
import withLlamaIndex from "llamaindex/next";

/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = {
  // Your existing config
};

export default withLlamaIndex(nextConfig);
