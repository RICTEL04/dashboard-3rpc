import type { NextConfig } from 'next';

const config: NextConfig = {
  // Prevents Next.js from bundling the native HANA client (needs .node binaries)
  serverExternalPackages: ['@sap/hana-client'],
};

export default config;
