import React, { useState } from 'react';
import { Info } from 'lucide-react';
import '../css/InfoTooltip.css';

export interface InfoTooltipProps {
  text: string;
  size?: number;
  className?: string;
}

const InfoTooltip: React.FC<InfoTooltipProps> = ({ 
  text, 
  size = 16, 
  className = '' 
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleMouseEnter = (e: React.MouseEvent) => {
    setIsVisible(true);
    updatePosition(e);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isVisible) {
      updatePosition(e);
    }
  };

  const handleMouseLeave = () => {
    setIsVisible(false);
  };

  const updatePosition = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const tooltipX = rect.right + window.scrollX + 8;
    const tooltipY = rect.top + window.scrollY;
    
    setPosition({ x: tooltipX, y: tooltipY });
  };

  return (
    <span className={`info-tooltip-container ${className}`}>
      <span
        className="info-icon"
        onMouseEnter={handleMouseEnter}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <Info size={size} />
      </span>
      
      {isVisible && (
        <div 
          className="info-tooltip" 
          style={{
            top: position.y, 
            left: position.x,
            transform: window.innerWidth - position.x > 250 
              ? 'translate(0%,-100%)' 
              : 'translate(-100%, -50%)'
          }}
        >
          {text}
        </div>
      )}
    </span>
  );
};

export default InfoTooltip;