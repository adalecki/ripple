import React, { useState } from 'react';
import WellTooltip from './WellTooltip';
import { wellColors, type ColorConfig } from '../utils/wellColors';
import { getCoordsFromWellId } from '../utils/plateUtils';
import { Plate } from '../classes/PlateClass';
import { Well } from '../classes/WellClass';
import WellView from './WellView';
import '../css/PlateComponent.css';

interface PlateViewProps {
  plate: Plate;
  view: string;
  colorConfig: ColorConfig;
  handleMaskedWell?: (wellId: string, e: React.MouseEvent<HTMLDivElement>) => void;
  selectedWells?: string[];
  handleMouseDown?: (e: React.MouseEvent<HTMLDivElement>) => void;
  handleMouseMove?: (e: React.MouseEvent<HTMLDivElement>) => void;
  handleMouseUp?: (e: React.MouseEvent<HTMLDivElement>) => void;
  handleLabelClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  blockBorderMap?: Map<string, { top: boolean, right: boolean, bottom: boolean, left: boolean }>;
}

interface HoveredWellData {
  well: Well;
  position: { x: number; y: number };
  transform: string;
}

function tooltipTransform(plate: Plate, wellRect: DOMRect, wellId: string): { x: number, y: number, transform: string } {
  const wellCoords = getCoordsFromWellId(wellId);
  let x = 0;
  let y = 0;
  let tooltipX = wellRect.right + window.scrollX;
  let tooltipY = wellRect.bottom + window.scrollY;

  if (plate.columns / 2 <= wellCoords.col + 1) {
    x = -100;
    tooltipX = wellRect.left + window.scrollX;
  }
  if (plate.rows / 2 <= wellCoords.row + 1) {
    y = -100;
    tooltipY = wellRect.top + window.scrollY;
  }
  return { x: tooltipX, y: tooltipY, transform: `translate(${x}%, ${y}%)` };
}

const PlateView: React.FC<PlateViewProps> = (
  ({
    plate,
    view,
    colorConfig,
    handleMaskedWell,
    selectedWells = [],
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleLabelClick,
    blockBorderMap
  }) => {
    const [hoveredWell, setHoveredWell] = useState<HoveredWellData | null>(null);

    const mouseDownHandler = handleMouseDown || (() => { });
    const mouseMoveHandler = handleMouseMove || (() => { });
    const mouseUpHandler = handleMouseUp || (() => { });
    const mouseLabelClickHandler = handleLabelClick || (() => { });
    const selectedWellsArr = selectedWells;

    const handleMouseEnter = (wellId: string, e: React.MouseEvent<HTMLDivElement>) => {
      const wellData = plate.getWell(wellId);
      const wellElement = e.currentTarget;
      const wellRect = wellElement.getBoundingClientRect();
      const { x, y, transform } = tooltipTransform(plate, wellRect, wellId);

      if (wellData) {
        setHoveredWell({
          well: wellData,
          position: { x: x, y: y },
          transform: transform
        });
      }
    };

    const handleMouseLeave = () => {
      setHoveredWell(null);
    };

    const handleMaskWell = (wellId: string, e: React.MouseEvent<HTMLDivElement>) => {
      if (view === 'masker' && handleMaskedWell) {
        handleMaskedWell(wellId, e);
      }
    };

    const wellColorArr = wellColors(plate, colorConfig);
    const wells = wellColorArr.map((well, _) => {
      const borders = blockBorderMap ? blockBorderMap.get(well.wellId) : undefined;
      return (
        <WellView
          key={well.wellId}
          well={plate.getWell(well.wellId)!}
          bgColors={well.colors}
          wellId={well.wellId}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onClickMask={handleMaskWell}
          isSelected={selectedWellsArr.includes(well.wellId)}
          blockBorders={borders}
        />
      );
    });

    const rowLabels = [];
    const columnLabels = [];

    function numberToLetters(num: number): string {
      let result = '';
      while (num >= 0) {
        result = String.fromCharCode(65 + (num % 26)) + result;
        num = Math.floor(num / 26) - 1;
      }
      return result;
    }

    for (let rowIndex = 0; rowIndex < plate.rows; rowIndex++) {
      const row = numberToLetters(rowIndex)
      rowLabels.push(
        <div
          key={`plate-row-label-${row}`}
          className="plate-grid-label"
        >
          {row}
        </div>
      );
    }

    for (let colIndex = 0; colIndex < plate.columns; colIndex++) {
      columnLabels.push(
        <div
          key={`plate-col-label-${colIndex + 1}`}
          className='plate-grid-label'
        >
          {colIndex + 1}
        </div>
      );
    }

    return (
      <div className="grid-container" data-view={view}>
        <div
          className={`all-wells-container ${!handleLabelClick ? 'invisible' : ''}`}
          onClick={mouseLabelClickHandler}
        >
          all
        </div>
        <div
          className="col-labels-container"
          onClick={mouseLabelClickHandler}
          style={{ gridTemplateColumns: `repeat(${plate.columns}, 1fr)` }}>
          {columnLabels}
        </div>
        <div
          className="row-labels-container"
          onClick={mouseLabelClickHandler}
          style={{ gridTemplateRows: `repeat(${plate.rows}, 1fr)` }}>
          {rowLabels}
        </div>
        <div
          className="wells-container"
          onMouseDown={mouseDownHandler}
          onMouseMove={mouseMoveHandler}
          onMouseUp={mouseUpHandler}
          style={{ gridTemplateRows: `repeat(${plate.rows}, 1fr)`, gridTemplateColumns: `repeat(${plate.columns}, 1fr)` }}>
          {wells}
        </div>
        {hoveredWell && <WellTooltip hoveredWell={hoveredWell} />}
      </div>
    );
  }
);

PlateView.displayName = 'PlateView';

export default PlateView;