/* eslint-disable react-hooks/exhaustive-deps */
import React from 'react';
import './GlassSurface.css';

const GlassSurface = ({
  children,
  width = 'auto',
  height = 'auto',
  borderRadius = 20,
  borderWidth = 1,
  backgroundOpacity = 0.15,
  blur = 15,
  className = '',
  style = {}
}) => {
  const containerStyle = {
    ...style,
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
    borderRadius: `${borderRadius}px`,
    background: `rgba(255, 255, 255, ${backgroundOpacity})`,
    backdropFilter: `blur(${blur}px)`,
    WebkitBackdropFilter: `blur(${blur}px)`,
    border: `${borderWidth}px solid rgba(255, 255, 255, 0.2)`,
    boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)',
    position: 'relative',
    overflow: 'hidden'
  };

  return (
    <div className={`glass-surface ${className}`} style={containerStyle}>
      <div className="glass-surface__content" style={{ position: 'relative', zIndex: 1 }}>
        {children}
      </div>
    </div>
  );
};

export default GlassSurface;
