import './globals.css';
import { Providers } from '@/components/Providers';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI Career Intelligence Platform | Elevate Your Path',
  description: 'Unlock your professional potential. Optimize your resume, analyze job requirements, get custom roadmaps, and chat with your agentic career mentor.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased min-h-screen bg-[#08070d] text-[#f3f4f6]">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
