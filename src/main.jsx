import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './styles/design-system.css';

console.log("main.jsx: Script start");

try {
  const rootElement = document.getElementById('root');
  console.log("main.jsx: Root element:", rootElement);
  const root = ReactDOM.createRoot(rootElement);
  console.log("main.jsx: Root created");
  
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  console.log("main.jsx: Render called");
} catch (e) {
  console.error("main.jsx: Render failed with error:", e);
}
