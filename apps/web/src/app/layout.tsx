import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '../components/auth/AuthProvider';
import { CartProvider } from '../components/cart/CartProvider';
import { FavoritesProvider } from '../components/favorites/FavoritesProvider';
import { Footer } from '../components/layout/Footer';
import { Header } from '../components/layout/Header';
import { ToastProvider } from '../components/ui/ToastProvider';

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
      <body className="min-h-screen flex flex-col font-sans text-body-md bg-surface text-on-surface antialiased selection:bg-secondary-fixed selection:text-on-secondary-fixed">
        <ToastProvider>
          <AuthProvider>
            <CartProvider>
              <FavoritesProvider>
                <Header />
                <main className="flex-1 w-full pt-20">{children}</main>
                <Footer />
              </FavoritesProvider>
            </CartProvider>
          </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
