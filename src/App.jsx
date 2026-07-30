import React from 'react';
import { HashRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom';
import { AppProvider, useAppContext } from './context/AppContext';
import { Search, ShoppingCart, User, LayoutDashboard, LogOut, Home as HomeIcon } from 'lucide-react';

import OfflineBanner from './components/OfflineBanner';
import InstallPrompt from './components/InstallPrompt';
import PullToRefresh from './components/PullToRefresh';

import Login from './pages/Login';
import Home from './pages/Home';
import Cart from './pages/Cart';
import Profile from './pages/Profile';
import Admin from './pages/Admin';
import UserExtras from './pages/UserExtras';

const Navigation = () => {
    const { currentUser, cart, logout } = useAppContext();
    
    if (!currentUser) return null;

    const cartCount = cart.reduce((acc, item) => acc + (item.quantity || 1), 0);

    return (
        <nav className="bottom-nav">
            {currentUser.role === 'user' ? (
                <>
                    <NavLink to="/home" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                        <HomeIcon size={20} />
                        <span>Home</span>
                    </NavLink>
                    <NavLink to="/cart" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                        <div style={{ position: 'relative' }}>
                            <ShoppingCart size={20} />
                            {cartCount > 0 && (
                                <span style={{
                                    position: 'absolute', top: -8, right: -12,
                                    background: 'var(--color-accent)', color: 'white',
                                    borderRadius: '50%', padding: '0 5px', fontSize: '10px',
                                    fontWeight: 'bold'
                                }}>
                                    {cartCount}
                                </span>
                            )}
                        </div>
                        <span>Warenkorb</span>
                    </NavLink>
                    <NavLink to="/profile" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                        <User size={20} />
                        <span>Profil</span>
                    </NavLink>
                    {/* Abmelden steht bei Nutzern im Profil - auf dem Handy ist
                        der Platz in der Leiste für die drei Hauptbereiche da. */}
                </>
            ) : (
                <>
                    <NavLink to="/admin" end className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                        <LayoutDashboard size={20} />
                        <span>Bestellungen</span>
                    </NavLink>
                    <NavLink to="/admin/users" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                        <User size={20} />
                        <span>Benutzer</span>
                    </NavLink>
                    <NavLink to="/admin/catalog" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                        <Search size={20} />
                        <span>Katalog</span>
                    </NavLink>
                    <button onClick={logout} className="nav-item" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                        <LogOut size={20} />
                        <span>Abmelden</span>
                    </button>
                </>
            )}
        </nav>
    );
};

const AppContent = () => {
    const { currentUser, isLoaded } = useAppContext();

    if (!isLoaded) {
        return <div style={{ height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="spinner"></div>
        </div>;
    }

    return (
        <HashRouter>
            <OfflineBanner />
            {currentUser && <InstallPrompt />}
            <div className="app-layout">
                <main className="main-content">
                    <Routes>
                        <Route path="/" element={currentUser ? <Navigate to={currentUser.role === 'admin' ? "/admin" : "/home"} /> : <Navigate to="/login" />} />
                        <Route path="/login" element={!currentUser ? <Login /> : <Navigate to={currentUser.role === 'admin' ? "/admin" : "/home"} />} />
                        
                        <Route path="/home" element={currentUser && currentUser.role === 'user' ? <Home /> : <Navigate to="/login" />} />
                        <Route path="/cart" element={currentUser && currentUser.role === 'user' ? <Cart /> : <Navigate to="/login" />} />
                        <Route path="/profile" element={currentUser && currentUser.role === 'user' ? <Profile /> : <Navigate to="/login" />} />
                        <Route path="/extras" element={currentUser && currentUser.role === 'user' ? <UserExtras /> : <Navigate to="/login" />} />
                        
                        <Route path="/admin" element={currentUser && currentUser.role === 'admin' ? <Admin tab="orders" /> : <Navigate to="/login" />} />
                        <Route path="/admin/users" element={currentUser && currentUser.role === 'admin' ? <Admin tab="users" /> : <Navigate to="/login" />} />
                        <Route path="/admin/catalog" element={currentUser && currentUser.role === 'admin' ? <Admin tab="catalog" /> : <Navigate to="/login" />} />
                    </Routes>
                </main>
                {currentUser && <Navigation />}
            </div>
        </HashRouter>
    );
};

/** Umschließt die App, damit "Ziehen zum Aktualisieren" überall greift. */
const WithPullToRefresh = ({ children }) => {
    const { currentUser, fetchAllData } = useAppContext();
    if (!currentUser) return children;
    return <PullToRefresh onRefresh={fetchAllData}>{children}</PullToRefresh>;
};

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("React Crash:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', color: 'red' }}>
          <h2>Ein Fehler ist aufgetreten!</h2>
          <pre>{this.state.error && this.state.error.toString()}</pre>
          <button onClick={() => { localStorage.clear(); window.location.href = import.meta.env.BASE_URL; }}>
            Reset App (Clear LocalStorage)
          </button>
        </div>
      );
    }
    return this.props.children; 
  }
}

export default function App() {
    return (
        <ErrorBoundary>
            <AppProvider>
                <WithPullToRefresh>
                    <AppContent />
                </WithPullToRefresh>
            </AppProvider>
        </ErrorBoundary>
    );
}
