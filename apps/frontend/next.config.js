/** @type {import('next').NextConfig} */
const nextConfig = {
  // standalone only for production build — breaks HMR in dev
  ...(process.env.NODE_ENV === 'production' ? { output: 'standalone' } : {}),
  async rewrites() {
    return [];
  },
};

module.exports = nextConfig;
