import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Gerador de Código IA - Desktop',
  description: 'Solução baseada em IA para gerar código a partir de histórias de usuário. Powered by AWS Bedrock, Compass UOL e Desktop.',
  robots: 'noindex, nofollow, noarchive, nosnippet, noimageindex',
  icons: {
    icon: '/favicon.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className="h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </head>
      <body className="h-full bg-gradient-to-br from-slate-50 to-blue-50 antialiased">
        <div id="root" className="min-h-full">
          {children}
        </div>
      </body>
    </html>
  );
}