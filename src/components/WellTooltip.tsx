import React from 'react';
import type { Well } from '../classes/WellClass';
import '../css/WellTooltip.css'
import { WellTransferSummary } from '../utils/plateUtils';

export interface HoveredWellData {
  well: Well;
  position: { x: number; y: number };
  transform: string;
  transferList?: WellTransferSummary[];
}

interface WellTooltipProps {
  hoveredWell: HoveredWellData;
}

function renderTransferContent(transferList: WellTransferSummary[]) {

  return (
    <table className="content-section">
      <tbody>
        {transferList.map((transfer, index) => (
          <tr key={index}>
            <td>{transfer.counterpartBarcode}</td>
            <td>{transfer.counterpartWellId}</td>
            <td>{transfer.volume} nL</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function renderWellContent(well: Well) {
  const contents = well.getContents();
  const solvents = well.getSolvents();

  if (well.getIsUnused()) {
    return (
      <div className="content-item">
        <span className="label">Status:</span>
        <span className="value">Unused</span>
      </div>
    );
  }

  return (
    <div>
      {contents.length > 0 ? (
        <div className="content-section">
          {contents.map((content, index) => (
            <div key={index} className="content-item">
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
      <div className="volume-section">
        <div className="content-item">
          <span className="label">Total Volume:</span>
          <span className="value">{well.getTotalVolume().toFixed(1)} nL</span>
        </div>
        {solvents.map((solvent, index) => (
          <div key={index} className="content-item">
            <span className="solvent-label">{solvent.name}:</span>
            <span className="solvent-label">
              {(well.getSolventFraction(solvent.name) * 100).toFixed(2)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const WellTooltip: React.FC<WellTooltipProps> = ({ hoveredWell }) => {
  const { well, position, transform, transferList } = hoveredWell;

  return (
    <div className="well-tooltip" style={{ top: position.y, left: position.x, transform }}>
      <div className="header-section">
        <span>{well.id}</span>
        {well.rawResponse && (
          <span>
            {well.rawResponse}
            {well.normalizedResponse && <span> ({Math.round(well.normalizedResponse)}%)</span>}
          </span>
        )}
        {transferList && (
          <span>
            {transferList.reduce((sum, t) => sum + t.volume, 0)} nL
          </span>
        )}
      </div>
      {transferList ? renderTransferContent(transferList) : renderWellContent(well)}
    </div>
  );
};

export default WellTooltip;