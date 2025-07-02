import React from 'react';
import { Well } from '../classes/WellClass';
import '../css/WellTooltip.css'

interface HoveredWellData {
  well: Well;
  position: { x: number; y: number };
  transform: string;
}

interface WellTooltipProps {
  hoveredWell: HoveredWellData;
}

const WellTooltip: React.FC<WellTooltipProps> = ({ hoveredWell }) => {
  const { well, position, transform } = hoveredWell;

  const contents = well.getContents();
  const solvents = well.getSolvents();
  
  return (
    <div className="well-tooltip" style={{ top: position.y, left: position.x, transform }}>
      <div className="well-id">Well {well.id}</div>
      {well.getIsUnused() ? (
        <div className="content-item">
          <span className="label">Status:</span>
          <span className="value">Unused</span>
        </div>
      ) : contents.length > 0 ? (
        <div className="content-section">
          {contents.map((content, index) => (
            <div key={index} className='content-item'>
              <span>{content.compoundId ? content.compoundId : content.patternName}</span>
              <span>{content.concentration.toFixed(5)} µM</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="content-item">
          <span className="label">Status:</span>
          <span className="value">Empty</span>
        </div>
      )}
      {!well.getIsUnused() && (
        <div className="volume-section">
          <div className='content-item'>
            <span className="label">Total Volume:</span>
            <span className="value">{well.getTotalVolume().toFixed(1)} nL</span>
          </div>
          {solvents.length > 0 && (
          <div>
            {solvents.map((solvent, index) => (
              <div key={index} className="content-item">
                <span className="solvent-label">{solvent.name}:</span>
                <span className="solvent-label">
                  {(well.getSolventFraction(solvent.name) * 100).toFixed(2)}%
                </span>
              </div>
            ))}
          </div>
        )}
        </div>
      )}
    </div>
  );
};

export default WellTooltip;