import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './styles/tailwind.css';
import './styles/design-system.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Alte Service-Worker-Registrierungen entfernen: die früher referenzierte
// sw.js hat nie existiert. Ohne dieses Aufräumen behalten bereits
// installierte PWAs ihren veralteten Worker.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations()
    .then(registrations => registrations.forEach(r => r.unregister()))
    .catch(() => { /* nicht kritisch */ });
}
