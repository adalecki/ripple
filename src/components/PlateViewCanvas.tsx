import React, { useRef, useEffect, useState } from "react";
import { Plate } from "../classes/PlateClass";
import { Well } from "../classes/WellClass";
import { wellColors, ColorConfig } from "../utils/wellColors";
import { getCoordsFromWellId, numberToLetters, WellTransferMap } from "../utils/plateUtils";
import WellTooltip, { HoveredWellData } from "./WellTooltip";
import '../css/PlateComponent.css'
import { canvasCoordsToWell } from "../utils/designUtils";

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
  transferMap?: WellTransferMap
}

/*const contents = [
  { compoundId: 'cpd001', concentration: 10, patternName: 'pattern1' },
  { compoundId: 'cpd002', concentration: 10, patternName: 'pattern2' },
  { compoundId: 'cpd003', concentration: 10, patternName: 'pattern3' },
  { compoundId: 'cpd004', concentration: 10, patternName: 'pattern4' },
  { compoundId: 'cpd005', concentration: 10, patternName: 'pattern5' }
]
const testColorMap = generateCompoundColors(contents.map(c => c.compoundId))

const testConfig: ColorConfig = {
  scheme: 'compound',
  colorMap: testColorMap,
  maxConcentration: 10
}*/

const PlateViewCanvas: React.FC<PlateViewCanvasProps> = ({
  plate,
  view,
  colorConfig,
  selectedWells = [],
  handleMouseDown = (() => { }),
  handleMouseSelectionMove = (() => { }),
  handleMouseUp = (() => { }),
  handleLabelClick = (() => { }),
  blockBorderMap,
  transferMap
}) => {

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wellsContainerRef = useRef<HTMLDivElement | null>(null);
  const gridContainerRef = useRef<HTMLDivElement | null>(null);
  const [hoveredWell, setHoveredWell] = useState<HoveredWellData | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0, dpr: 1 });

  const wellColorArr = wellColors(plate, colorConfig);
  //const wellColorArr = wellColors(plate, testConfig);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = wellsContainerRef.current;
    const grid = gridContainerRef.current
    if (!canvas || !container || !grid) return;
    const observer = new ResizeObserver(drawPlate);

    observer.observe(grid);

    return () => {
      observer.disconnect();
    };
  }, [plate, colorConfig, selectedWells, blockBorderMap, canvasSize.dpr]);

  function drawPlate() {
    const canvas = canvasRef.current;
    const container = wellsContainerRef.current;

    const dpr = window.devicePixelRatio;

    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return

    const availableWidth = container.clientWidth;
    const availableHeight = container.clientHeight;

    if (availableWidth === 0 || availableHeight === 0) return;
    const gap = 96 / plate.columns
    const wellSize = Math.floor((availableWidth - ((plate.columns - 1) * gap)) / plate.columns)

    const canvasWidth = (wellSize * plate.columns) + (plate.columns - 1) * gap + 1
    const canvasHeight = (wellSize * plate.rows) + (plate.rows - 1) * gap + 1
    canvas.width = Math.ceil(canvasWidth * dpr);
    canvas.height = Math.ceil(canvasHeight * dpr);
    ctx.scale(dpr, dpr);
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${canvasHeight}px`;

    setCanvasSize({ width: canvas.width, height: canvas.height, dpr: dpr });

    for (const { wellId, colors } of wellColorArr) {
      const { row, col } = getCoordsFromWellId(wellId);
      const x = (wellSize + gap) * col
      const y = (wellSize + gap) * row

      const well = plate.getWell(wellId)!;
      /*if (col == 3) well.markAsUnused()
      if (col == 4) well.addSolvent({ name: 'DMSO', volume: 20 })
      if (col == 5) {
        well.addContent(contents[0], 100, { name: 'DMSO', fraction: 1 })
      }
      if (col == 6) {
        well.addContent(contents[0], 100, { name: 'DMSO', fraction: 1 })
        well.addContent(contents[1], 100, { name: 'DMSO', fraction: 1 })
      }
      if (col == 7) {
        well.addContent(contents[0], 100, { name: 'DMSO', fraction: 1 })
        well.addContent(contents[1], 100, { name: 'DMSO', fraction: 1 })
        well.addContent(contents[2], 100, { name: 'DMSO', fraction: 1 })
      }
      if (col == 8) {
        well.addContent(contents[0], 100, { name: 'DMSO', fraction: 1 })
        well.addContent(contents[1], 100, { name: 'DMSO', fraction: 1 })
        well.addContent(contents[2], 100, { name: 'DMSO', fraction: 1 })
        well.addContent(contents[3], 100, { name: 'DMSO', fraction: 1 })
      }
      if (col == 9) {
        well.addContent(contents[0], 100, { name: 'DMSO', fraction: 1 })
        well.addContent(contents[1], 100, { name: 'DMSO', fraction: 1 })
        well.addContent(contents[2], 100, { name: 'DMSO', fraction: 1 })
        well.addContent(contents[3], 100, { name: 'DMSO', fraction: 1 })
        well.addContent(contents[4], 100, { name: 'DMSO', fraction: 1 })
      }*/
      const isSelected = selectedWells.includes(wellId);
      const borders = blockBorderMap?.get(wellId);

      drawWell(ctx, x, y, wellSize, colors, well, isSelected, borders)
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

    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, size, size)

    if (colors.length > 0) {
      drawSegments(ctx, x + 1, y + 1, size - 1, colors);
    }

    if (well.getSolvents().some(s => s.name === "DMSO") && !well.getIsUnused()) {
      drawDmso(ctx, x, y);
    }

    if (well.getIsUnused()) {
      drawUnused(ctx, x, y, size);
    }

    if (isSelected) {
      ctx.strokeStyle = "blue";
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, size - 1, size - 1);
    }

    if (borders) {
      ctx.strokeStyle = "black";
      ctx.lineWidth = 3;
      if (borders.top) ctx.strokeRect(x + 1, y + 2, size - 1, 0);
      if (borders.bottom) ctx.strokeRect(x + 1, y + size - 1, size - 1, 0);
      if (borders.left) ctx.strokeRect(x + 2, y + 1, 0, size - 1);
      if (borders.right) ctx.strokeRect(x + size - 1, y + 1, 0, size - 1);
    }
  };

  function drawSegments(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    colors: string[]
  ) {
    const cx = x + size / 2;
    const cy = y + size / 2;
    const r = size / 1;
    const seg = (2 * Math.PI) / colors.length;
    ctx.save()
    ctx.beginPath();
    ctx.rect(x, y, size, size);
    ctx.clip();

    for (let i = 0; i < colors.length; i++) {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, i * seg + Math.PI / 2, (i + 1) * seg + Math.PI / 2);
      ctx.closePath();
      ctx.fillStyle = colors[i];
      ctx.fill();
    }
    ctx.restore()
  };

  function drawDmso(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number
  ) {
    const triangleSize = 8 / canvasSize.dpr
    ctx.fillStyle = "black";
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + triangleSize, y);
    ctx.lineTo(x, y + triangleSize);
    ctx.closePath();
    ctx.fill();
  };

  function drawUnused(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number
  ) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, size, size);
    ctx.clip();

    ctx.strokeStyle = "rgba(0,0,0,0.4)";
    ctx.lineWidth = 1;

    for (let i = -size; i < size; i += 6) {
      ctx.beginPath();
      ctx.moveTo(x + i, y);
      ctx.lineTo(x + i + size, y + size);
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
    const wellId = canvasCoordsToWell(e, canvasRef, plate);

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
      transform: `translate(${x}%, ${y}%)`,
      transferList: view.includes('reformat') && transferMap ? transferMap.get(wellId) || [] : undefined
    });
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

  const rowHeight = (canvasSize.height / plate.rows) / canvasSize.dpr;

  return (
    <div className="grid-container" ref={gridContainerRef} data-view={view}>

      <div
        className="all-wells-container"
        style={{ height: `${15 / canvasSize.dpr}px` }}
        onClick={handleLabelClick}
      />
      <div style={{ maxWidth: canvasSize.width / canvasSize.dpr }}>
        <div
          className="col-labels-container"
          onClick={handleLabelClick}
          style={{
            gridTemplateColumns: `repeat(${plate.columns}, minmax(0,1fr))`
          }}>
          {columnLabels}
        </div>
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
