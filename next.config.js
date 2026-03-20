/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  compress: true,
  generateEtags: true,
  pageExtensions: ['js', 'jsx', 'ts', 'tsx'],
  staticPageGenerationTimeout: 120,
  experimental: {
    isrMemoryCacheSize: 50 * 1024 * 1024,
  },
}

module.exports = nextConfig
