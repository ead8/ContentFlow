/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
  optimizeFonts: false, // Disable Next.js font optimization
  experimental: {
    optimizePackageImports: ['@/components/ui'],
  },
};

module.exports = nextConfig;