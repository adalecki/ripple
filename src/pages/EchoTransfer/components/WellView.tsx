import React from 'react';
import { Well } from '../classes/WellClass';

interface WellProps {
  well: Well;
  bgColors: string[];
  wellId: string;
  onMouseEnter: (wellId: string, e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseLeave: () => void;
  onClickMask: (wellId: string, e: React.MouseEvent<HTMLDivElement>) => void;
  isSelected: boolean;
}

const WellView = React.forwardRef<HTMLDivElement, WellProps>(
  ({ well, bgColors, wellId, onMouseEnter, onMouseLeave, onClickMask, isSelected }, ref) => {
    const classNames = `well ${isSelected ? 'well-highlighted' : ''}`;
    
    const renderSegments = () => {
      const segmentCount = bgColors.length;
      
      if (segmentCount === 1) {
        return <div className="well-segment" style={{ backgroundColor: bgColors[0], width: '100%', height: '100%' }} />;
      }
      
      return bgColors.map((color, index) => {
        const angle = 360 / segmentCount;
        const startAngle = index * angle;
        
        return (
          <div
            key={index}
            className="well-segment"
            style={{
              position: 'absolute',
              top: '0',
              left: '0',
              width: '100%',
              height: '100%',
              background: `conic-gradient(from ${startAngle}deg at 50% 50%, ${color} 0deg, ${color} ${angle}deg, transparent ${angle}deg)`
            }}
          />
        );
      });
    };

    return (
      <div
        ref={ref}
        className={classNames}
        style={{ position: 'relative', overflow: 'hidden' }}
        onMouseEnter={(e) => onMouseEnter(wellId, e)}
        onMouseLeave={onMouseLeave}
        onClick={(e) => onClickMask(wellId, e)}
        data-wellid={wellId}
      >
        {(well.getSolvents().some(s => s.name == 'DMSO') ? <div className='dmso'></div> : '')}
        {renderSegments()}
      </div>
    );
  }
);

export default WellView;