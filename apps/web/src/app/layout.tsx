import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Coffee } from 'lucide-react';

export const metadata: Metadata = {
  title: 'BrewLite — Đặt Cà Phê Trực Tuyến',
  description: 'Thực đơn đặt món cà phê hiện đại, nhanh chóng và tiện lợi.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body className="min-h-screen flex flex-col font-sans antialiased text-stone-900 bg-[#faf7f2]">
        {/* Sticky Mobile-First Header */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-stone-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 bg-brew-700 text-white rounded-xl shadow-sm">
                <Coffee className="w-5 h-5" />
              </div>
              <div>
                <span className="text-lg font-black tracking-tight text-stone-900">
                  Brew<span className="text-brew-700">Lite</span>
                </span>
                <span className="hidden sm:inline-block ml-2 text-xs font-semibold px-2 py-0.5 bg-brew-100 text-brew-800 rounded-full">
                  Sprint 1 MVP
                </span>
              </div>
            </div>

            <div className="text-xs text-stone-500 font-medium">
              Menu Trực Tuyến
            </div>
          </div>
        </header>

        {/* Content Container */}
        <div className="flex-1 w-full">
          {children}
        </div>

        {/* Footer */}
        <footer className="mt-auto border-t border-stone-200 bg-white py-6 text-center text-xs text-stone-400">
          <div className="max-w-7xl mx-auto px-4">
            BrewLite &copy; 2026 — Công nghệ Phần mềm (SGU)
          </div>
        </footer>
      </body>
    </html>
  );
}
