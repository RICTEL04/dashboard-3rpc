import type { NextConfig } from 'next';
import path from 'path';

const config: NextConfig = {
  serverExternalPackages: ['@sap/hana-client'],
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default config;
