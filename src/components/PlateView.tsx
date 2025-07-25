import React, { useState, MutableRefObject } from 'react';
import WellTooltip from './WellTooltip';
import { wellColors } from '../pages/EchoTransfer/utils/wellColors';
import { Plate } from '../classes/PlateClass';
import { Well as WellType } from '../classes/WellClass';
import { ColorConfig } from '../pages/EchoTransfer/utils/wellColors';
import WellView from './WellView';
import '../css/PlateComponent.css'

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
  selectionStyle?: React.CSSProperties;
  blockBorderMap?: Map<string, {top: boolean, right: boolean, bottom: boolean, left: boolean}>;
}

type PlateViewRef = ((instance: HTMLDivElement[] | null) => void) | MutableRefObject<HTMLDivElement[] | null>;

interface HoveredWellData {
  well: WellType;
  position: { x: number; y: number };
  transform: string;
}

const PlateView = React.forwardRef<Array<HTMLDivElement>, PlateViewProps>(
  ({ plate, view, colorConfig, handleMaskedWell, selectedWells = [], handleMouseDown, handleMouseMove, handleMouseUp, handleLabelClick, selectionStyle, blockBorderMap }, ref) => {
    const [hoveredWell, setHoveredWell] = useState<HoveredWellData | null>(null);

    const mouseDownHandler = handleMouseDown || (() => { });
    const mouseMoveHandler = handleMouseMove || (() => { });
    const mouseUpHandler = handleMouseUp || (() => { });
    const mouseLabelClickHandler = handleLabelClick || (() => { });
    const selectorStyle = selectionStyle || undefined;
    const selectedWellsArr = selectedWells;

    const handleMouseEnter = (wellId: string, e: React.MouseEvent<HTMLDivElement>) => {
      const wellData = plate.getWell(wellId);
      const wellElement = e.currentTarget;
      const wellRect = wellElement.getBoundingClientRect();
      let tooltipX = wellRect.right + window.scrollX;
      let tooltipY = wellRect.top + window.scrollY;
      if (wellData) {
        setHoveredWell({
          well: wellData,
          position: { x: tooltipX, y: tooltipY },
          transform: (window.innerWidth - wellRect.right > 200 ? 'translate(0%, -100%)' : 'translate(-100%, -100%)')
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

    const isRefObject = (ref: PlateViewRef): ref is MutableRefObject<HTMLDivElement[] | null> => {
      return (ref as MutableRefObject<HTMLDivElement[] | null>).current !== undefined;
    };
    const wellColorArr = wellColors(plate, colorConfig);
    const wells = wellColorArr.map((well, idx) => {
      const borders = (blockBorderMap ? blockBorderMap.get(well.wellId) : undefined)
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
          ref={(element: HTMLDivElement | null) => {
            if (element && ref) {
              if (isRefObject(ref)) {
                if (!ref.current) ref.current = [];
                ref.current[idx] = element;
              } else {
                const arr: HTMLDivElement[] = [];
                arr[idx] = element;
                ref(arr);
              }
            }
          }}
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
        </div>);
    }

    return (
      <div>
        <div className="grid-container">
          <div 
            className="col-labels-container"
            onClick={mouseLabelClickHandler}
            style={{gridTemplateColumns: `repeat(${plate.columns}, 1fr)`}}>
            {columnLabels}
          </div>
          <div 
            className="row-labels-container"
            onClick={mouseLabelClickHandler}
            style={{gridTemplateRows: `repeat(${plate.rows}, 1fr)`}}>
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
          <div className={selectorStyle ? "selection-rectangle" : ''} style={selectorStyle}></div>
        </div>
      </div>
    );
  }
);

export default PlateView;