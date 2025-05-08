/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { 
    unoptimized: true,
    domains: ['images.pexels.com']
  },
  optimizeFonts: false,
  experimental: {
    optimizePackageImports: ['@/components/ui'],
  },
  swcMinify: false,
  output: 'standalone',
  webpack: (config) => {
    config.infrastructureLogging = {
      level: 'error',
    };
    return config;
  }
};

module.exports = nextConfig;