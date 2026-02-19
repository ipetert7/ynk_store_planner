/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  basePath: '/arriendos',
  images: {
    unoptimized: false,
    formats: ['image/webp', 'image/avif'],
  },
}

module.exports = nextConfig
