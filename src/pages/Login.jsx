import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { LogIn } from 'lucide-react';

export default function Login() {
    const { login } = useAppContext();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const success = await login(username, password);
            if (!success) {
                setError('Ungültige Anmeldedaten');
            }
        } catch (err) {
            setError(err.message || 'Ein Fehler ist aufgetreten');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
            <div className="glass-panel" style={{ width: '100%', maxWidth: '400px', padding: '2rem' }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div style={{ display: 'inline-flex', padding: '1rem', borderRadius: '50%', background: 'rgba(34, 197, 94, 0.1)', color: 'var(--color-accent)', marginBottom: '1rem' }}>
                        <LogIn size={32} />
                    </div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: '600' }}>Willkommen</h1>
                    <p className="text-muted" style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>Bitte melden Sie sich an.</p>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">Benutzername</label>
                        <input 
                            type="text" 
                            className="form-input" 
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            required 
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Passwort</label>
                        <input 
                            type="password" 
                            className="form-input" 
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            required 
                        />
                    </div>
                    
                    {error && <div style={{ color: 'var(--color-destructive)', fontSize: '0.875rem', marginBottom: '1rem', textAlign: 'center' }}>{error}</div>}
                    
                    <button type="submit" className="btn btn-primary w-full" disabled={loading} style={{ marginTop: '1rem' }}>
                        {loading ? <span className="spinner" style={{ width: '1rem', height: '1rem', borderWidth: '2px' }}></span> : 'Anmelden'}
                    </button>
                </form>
            </div>
        </div>
    );
}
