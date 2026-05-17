import React from 'react';
import { HashRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom';
import { AppProvider, useAppContext } from './context/AppContext';
import { Search, ShoppingCart, User, LayoutDashboard, LogOut } from 'lucide-react';
import './styles/design-system.css';

// Lazy loading could be added here, but importing directly for simplicity
import Login from './pages/Login';
import Catalog from './pages/Catalog';
import Cart from './pages/Cart';
import Profile from './pages/Profile';
import Admin from './pages/Admin';

const Navigation = () => {
    const { currentUser, cart, logout } = useAppContext();
    
    if (!currentUser) return null;

    const cartCount = cart.reduce((acc, item) => acc + (item.quantity || 1), 0);

    return (
        <nav className="bottom-nav">
            {currentUser.role === 'user' ? (
                <>
                    <NavLink to="/catalog" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                        <Search size={20} />
                        <span>Suchen</span>
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
                </>
            ) : (
                <>
                    <NavLink to="/admin" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                        <LayoutDashboard size={20} />
                        <span>Dashboard</span>
                    </NavLink>
                </>
            )}
            <button onClick={logout} className="nav-item" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <LogOut size={20} />
                <span>Abmelden</span>
            </button>
        </nav>
    );
};

const ProtectedRoute = ({ children, roleRequired }) => {
    const { currentUser, isLoaded } = useAppContext();
    
    if (!isLoaded) return <div className="p-4 text-center"><div className="spinner"></div></div>;
    
    if (!currentUser) return <Navigate to="/login" />;
    
    if (roleRequired && currentUser.role !== roleRequired) {
        return <Navigate to={currentUser.role === 'admin' ? '/admin' : '/catalog'} />;
    }
    
    return children;
};

const AppContent = () => {
    const { currentUser, isLoaded } = useAppContext();

    if (!isLoaded) {
        return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="spinner"></div>
        </div>;
    }

    return (
        <HashRouter>
            <div className="page-content">
                <Routes>
                    <Route path="/login" element={currentUser ? <Navigate to={currentUser.role === 'admin' ? '/admin' : '/catalog'} /> : <Login />} />
                    
                    <Route path="/catalog" element={<ProtectedRoute roleRequired="user"><Catalog /></ProtectedRoute>} />
                    <Route path="/cart" element={<ProtectedRoute roleRequired="user"><Cart /></ProtectedRoute>} />
                    <Route path="/profile" element={<ProtectedRoute roleRequired="user"><Profile /></ProtectedRoute>} />
                    
                    <Route path="/admin" element={<ProtectedRoute roleRequired="admin"><Admin /></ProtectedRoute>} />
                    
                    <Route path="*" element={<Navigate to={currentUser ? (currentUser.role === 'admin' ? '/admin' : '/catalog') : '/login'} />} />
                </Routes>
            </div>
            <Navigation />
        </HashRouter>
    );
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
          <button onClick={() => { localStorage.clear(); window.location.href = '/'; }}>
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
                <AppContent />
            </AppProvider>
        </ErrorBoundary>
    );
}
