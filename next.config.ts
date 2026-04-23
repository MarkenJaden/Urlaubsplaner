import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    serverActions: {
      allowedOrigins: ['urlaubsplaner.me', 'localhost:3000']
    }
  }
}

export default nextConfig
