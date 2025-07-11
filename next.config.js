/** @type {import('next').NextConfig} */
const nextConfig = {
  // ❌ Remover: output: 'standalone' - não compatível com Amplify
  // ❌ Remover: trailingSlash: true - pode causar problemas
  
  // Otimizações para produção
  experimental: {
    optimizePackageImports: ['@heroicons/react'],
  },
  
  // Configurações de imagem para AWS
  images: {
    unoptimized: true, // ✅ Necessário para Amplify
    domains: [
      'amazonaws.com',
      'amplifyapp.com',
    ],
  },
  
  // Headers de segurança
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
  
  // Configuração de ambiente
  env: {
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME || 'Gerador de Código IA',
    NEXT_PUBLIC_APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
    NEXT_PUBLIC_COMPANY: process.env.NEXT_PUBLIC_COMPANY || 'Desktop',
    NEXT_PUBLIC_PARTNER: process.env.NEXT_PUBLIC_PARTNER || 'Compass UOL',
  },
  
  // Configuração de webpack para otimizações
  webpack: (config, { dev, isServer }) => {
    // Otimizações para produção
    if (!dev && !isServer) {
      config.optimization.splitChunks.cacheGroups = {
        ...config.optimization.splitChunks.cacheGroups,
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
        },
      };
    }
    
    return config;
  },
  
  // Configuração de ESLint
  eslint: {
    ignoreDuringBuilds: false,
  },
  
  // Configuração TypeScript
  typescript: {
    ignoreBuildErrors: false,
  },
  
  // Configuração de compressão
  compress: true,
};

module.exports = nextConfig;