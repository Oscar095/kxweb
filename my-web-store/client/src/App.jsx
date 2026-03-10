import { lazy, Suspense } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import CartDrawer from './components/cart/CartDrawer';
import Chatbot from './components/chatbot/Chatbot';

const HomePage = lazy(() => import('./pages/HomePage/HomePage'));
const ProductsPage = lazy(() => import('./pages/ProductsPage/ProductsPage'));
const ProductDetailPage = lazy(() => import('./pages/ProductDetailPage/ProductDetailPage'));
const CartPage = lazy(() => import('./pages/CartPage/CartPage'));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage/CheckoutPage'));
const ConfirmationPage = lazy(() => import('./pages/ConfirmationPage/ConfirmationPage'));
const PersonalizadosPage = lazy(() => import('./pages/PersonalizadosPage/PersonalizadosPage'));
const SearchPage = lazy(() => import('./pages/SearchPage/SearchPage'));
const ContactPage = lazy(() => import('./pages/ContactPage/ContactPage'));
const AboutPage = lazy(() => import('./pages/AboutPage/AboutPage'));
const AdminPage = lazy(() => import('./pages/AdminPage/AdminPage'));

function Loader() {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '60vh',
    }}>
      <div style={{
        width: 40,
        height: 40,
        border: '3px solid #e0e0e0',
        borderTopColor: 'var(--primary)',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}

export default function App() {
  const location = useLocation();

  return (
    <>
      <Header />
      <main style={{ position: 'relative' }}>
        <div className="bg-orb orb-blue" />
        <div className="bg-orb orb-orange" />
        <Suspense fallback={<Loader />}>
          <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
              <Route path="/" element={<HomePage />} />
              <Route path="/products" element={<ProductsPage />} />
              <Route path="/product" element={<ProductDetailPage />} />
              <Route path="/cart" element={<CartPage />} />
              <Route path="/checkout" element={<CheckoutPage />} />
              <Route path="/confirmacion" element={<ConfirmationPage />} />
              <Route path="/personalizados" element={<PersonalizadosPage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/admin" element={<AdminPage />} />
            </Routes>
          </AnimatePresence>
        </Suspense>
      </main>
      <Footer />
      <CartDrawer />
      <Chatbot />
    </>
  );
}
