import React, { useState } from 'react';
import { Search as SearchIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Home() {
    const [query, setQuery] = useState('');
    const navigate = useNavigate();

    const handleSearch = (e) => {
        e.preventDefault();
        if (query.trim().length >= 2) {
            navigate(`/catalog?q=${encodeURIComponent(query.trim())}`);
        }
    };

    return (
        <div className="home-container page-transition">
            <div className="aurora-bg">
                <div className="aurora-blob aurora-1"></div>
                <div className="aurora-blob aurora-2"></div>
                <div className="aurora-blob aurora-3"></div>
            </div>
            
            <div className="home-content">
                <h1 className="home-title">Willkommen zurück</h1>
                <p className="home-subtitle">Wonach suchst du heute?</p>
                
                <form onSubmit={handleSearch} className="home-search-wrapper">
                    <div className="home-search-container">
                        <SearchIcon size={20} className="search-icon" style={{ color: 'rgba(255,255,255,0.7)' }} />
                        <input
                            type="text"
                            placeholder="Produkte suchen..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            className="home-search-input"
                            autoFocus
                        />
                    </div>
                </form>
            </div>
        </div>
    );
}
