import React from "react";
import "./shiny-button.css";

export function ShinyButton({ children, onClick, activeGlow = true, className = "", style = {} }) {
  return (
    <button 
      className={`shiny-cta ${activeGlow ? '' : 'glow-inactive'} ${className}`} 
      onClick={onClick}
      style={style}
    >
      <span>{children}</span>
    </button>
  );
}
