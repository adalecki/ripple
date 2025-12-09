import React, { useRef, useEffect, useState } from "react";
import { Plate } from "../classes/PlateClass";
import { Well } from "../classes/WellClass";
import { wellColors, ColorConfig } from "../utils/wellColors";
import { getCoordsFromWellId, getWellIdFromCoords, numberToLetters } from "../utils/plateUtils";
import WellTooltip from "./WellTooltip";
//import '../css/PlateComponent.css'

interface PlateViewCanvasProps {
  plate: Plate;
  view: string;
  colorConfig: ColorConfig;
  selectedWells?: string[];
  handleMouseDown?: React.MouseEventHandler<HTMLCanvasElement>
  handleMouseSelectionMove?: React.MouseEventHandler<HTMLCanvasElement>
  handleMouseUp?: React.MouseEventHandler<HTMLCanvasElement>
  handleLabelClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  blockBorderMap?: Map<string, { top: boolean; right: boolean; bottom: boolean; left: boolean }>;
}

interface HoveredWellData {
  well: Well;
  position: { x: number; y: number };
  transform: string;
}

const PlateViewCanvas: React.FC<PlateViewCanvasProps> = ({
  plate,
  view,
  colorConfig,
  selectedWells = [],
  handleMouseDown = (() => { }),
  handleMouseSelectionMove = (() => { }),
  handleMouseUp = (() => { }),
  handleLabelClick = (() => { }),
  blockBorderMap
}) => {

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wellsContainerRef = useRef<HTMLDivElement | null>(null);
  const [hoveredWell, setHoveredWell] = useState<HoveredWellData | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  const wellColorArr = wellColors(plate, colorConfig);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = wellsContainerRef.current;
    if (!canvas || !container) return;
    const observer = new ResizeObserver(drawPlate);

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [plate, colorConfig, selectedWells, blockBorderMap]);

  function drawPlate() {
    const canvas = canvasRef.current;
    const container = wellsContainerRef.current;
    
    const dpr = window.devicePixelRatio;

    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return

    const rows = plate.rows;
    const cols = plate.columns;

    const availableWidth = container.clientWidth;
    const availableHeight = container.clientHeight;

    if (availableWidth === 0 || availableHeight === 0) return;

    const plateAspect = cols / rows;
    const containerAspect = availableWidth / availableHeight;

    let canvasWidth, canvasHeight;

    if (containerAspect > plateAspect) {
      canvasHeight = availableHeight;
      canvasWidth = canvasHeight * plateAspect;
    } else {
      canvasWidth = availableWidth;
      canvasHeight = canvasWidth / plateAspect;
    }

    //canvas.width = canvasWidth;
    //canvas.height = canvasHeight;
    canvas.width = canvasWidth * dpr;
    canvas.height = canvasHeight * dpr;
    ctx.scale(dpr,dpr)
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${canvasHeight}px`;

    
    setCanvasSize({ width: canvas.width, height: canvas.height });

    //ctx.strokeStyle = "#000";
    //ctx.strokeRect(0, 0, canvasWidth, canvasHeight);

    const gap = 2;
    const cellSize = canvasWidth / cols;
    
    for (const { wellId, colors } of wellColorArr) {
      const { row, col } = getCoordsFromWellId(wellId);
      const x = (col * cellSize);
      const y = (row * cellSize);

      const well = plate.getWell(wellId)!;
      const isSelected = selectedWells.includes(wellId);
      const borders = blockBorderMap?.get(wellId);

      drawWell(ctx, (x + gap/2), (y + gap/2), (cellSize - gap), colors, well, isSelected, borders);
    }
  };

  function drawWell(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    colors: string[],
    well: Well,
    isSelected: boolean,
    borders?: { top: boolean; right: boolean; bottom: boolean; left: boolean }
  ) {
    //ctx.fillStyle = "#fff";
    //ctx.fillRect(x, y, size, size);

    // draw normal black border
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);
    //ctx.strokeRect(x, y, size, size);
    if (colors.length === 1) {
      ctx.fillStyle = colors[0];
      ctx.fillRect(x+1, y+1, size-2, size-2);
    }
    if (colors.length > 1) {
      drawSegments(ctx, x, y, size, size, colors);
    }

    if (well.getSolvents().some(s => s.name === "DMSO") && !well.getIsUnused()) {
      drawDmso(ctx, x, y, Math.min(size, size) * 0.3);
    }

    if (well.getIsUnused()) {
      drawHatch(ctx, x, y, size, size);
    }

    if (isSelected) {
      ctx.strokeStyle = "blue";
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, size - 2, size - 2);
    }

    if (borders) {
      ctx.strokeStyle = "black";
      ctx.lineWidth = 3;
      if (borders.top) ctx.strokeRect(x, y, size, 0);
      if (borders.bottom) ctx.strokeRect(x, y + size, size, 0);
      if (borders.left) ctx.strokeRect(x, y, 0, size);
      if (borders.right) ctx.strokeRect(x + size, y, 0, size);
    }
  };

  function drawSegments(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    colors: string[]
  ) {
    const cx = x + w / 2;
    const cy = y + h / 2;
    const r = Math.min(w, h) / 2;
    const seg = (2 * Math.PI) / colors.length;

    for (let i = 0; i < colors.length; i++) {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, i * seg, (i + 1) * seg);
      ctx.closePath();
      ctx.fillStyle = colors[i];
      ctx.fill();
    }
  };

  function drawDmso(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
    ctx.fillStyle = "black";
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + s, y);
    ctx.lineTo(x, y + s);
    ctx.closePath();
    ctx.fill();
  };

  function drawHatch(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number
  ) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();

    ctx.strokeStyle = "rgba(0,0,0,0.05)";
    ctx.lineWidth = 6;

    for (let i = -h; i < w + h; i += 6) {
      ctx.beginPath();
      ctx.moveTo(x + i, y);
      ctx.lineTo(x + i + h, y + h);
      ctx.stroke();
    }

    ctx.restore();
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    handleMouseSelectionMove(e);
    handleHoveredWellMove(e);
  }

  const handleHoveredWellMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const wellId = canvasCoordsToWell(e);

    if (!wellId) {
      setHoveredWell(null);
      return;
    }

    const well = plate.getWell(wellId);
    if (!well) return;

    const wellCoords = getCoordsFromWellId(wellId);
    let x = 0;
    let y = 0;
    let tooltipX = e.clientX + window.scrollX + 20;
    let tooltipY = e.clientY + window.scrollY + 20;

  if (plate.columns / 2 <= wellCoords.col + 1) {
    x = -100;
    tooltipX -= 40
  }
  if (plate.rows / 2 <= wellCoords.row + 1) {
    y = -100;
  }
    setHoveredWell({
      well,
      position: { x: tooltipX, y: tooltipY },
      transform: `translate(${x}%, ${y}%)`
    });
  };

  function canvasCoordsToWell(e: React.MouseEvent<HTMLCanvasElement>): string | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const rows = plate.rows;
    const cols = plate.columns;

    const cw = canvas.width / cols;
    const ch = canvas.height / rows;

    const col = Math.floor(x / cw);
    const row = Math.floor(y / ch);

    if (col < 0 || row < 0 || col >= cols || row >= rows) return null;

    return getWellIdFromCoords(row, col);
  };

  const rowLabels = [];
  const columnLabels = [];

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
        {(colIndex + 1)}
      </div>
    );
  }

  const rowHeight = canvasSize.height / plate.rows;

  return (
    <div className="grid-container" data-view={view}>

      <div className="all-wells-container" />

      <div
        className="col-labels-container"
        onClick={handleLabelClick}
        style={{ 
          gridTemplateColumns: `repeat(${plate.columns}, minmax(0,1fr))`,
        }}>
        {columnLabels}
      </div>
      <div
        className="row-labels-container"
        onClick={handleLabelClick}
        style={{ 
          gridTemplateRows: `repeat(${plate.rows}, ${rowHeight}px)`,
        }}>
        {rowLabels}
      </div>

      <div className="wells-container" ref={wellsContainerRef} style={{ aspectRatio: `${plate.columns} / ${plate.rows}` }}>
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => setHoveredWell(null)}
        />
      </div>

      {hoveredWell && <WellTooltip hoveredWell={hoveredWell} />}
    </div>
  );
};

export default PlateViewCanvas;
