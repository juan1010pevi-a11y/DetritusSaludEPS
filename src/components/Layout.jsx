import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Navbar from './Navbar/Navbar';
import Footer from './Footer/Footer';
import ChatFab from './ChatFab/ChatFab';

export default function Layout({ children }) {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return (
    <>
      <Navbar />
      <main>{children}</main>
      <Footer />
      <ChatFab />
    </>
  );
}
