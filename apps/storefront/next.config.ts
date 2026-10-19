import type { NextConfig } from 'next';

const apiUrl = (process.env.API_URL ?? 'http://localhost:4000/api/v1').replace(/\/$/, '');

const nextConfig: NextConfig = {
  transpilePackages: ['@cosmetics/contracts'],
  // Browser calls go through the storefront's own origin, so the API
  // does not need to allow this domain in CORS_ORIGINS.
  async rewrites() {
    return [{ source: '/api/v1/:path*', destination: `${apiUrl}/:path*` }];
  },
};

export default nextConfig;
