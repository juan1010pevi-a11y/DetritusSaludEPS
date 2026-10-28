import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Navbar from './Navbar/Navbar';
import Footer from './Footer/Footer';
import ChatFab from './ChatFab/ChatFab';
import LoginModal from './LoginModal/LoginModal';
import { useAuth } from '../context/AuthContext';

export default function Layout({ children }) {
  const { pathname } = useLocation();
  const { loginModal } = useAuth();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return (
    <>
      <Navbar />
      <main>{children}</main>
      <Footer />
      <ChatFab />
      {loginModal && <LoginModal key={`${loginModal.role}-${loginModal.redirect || ''}`} />}
    </>
  );
}
