import { utils, writeFile, WorkBook } from 'xlsx';
import { Pattern } from '../classes/PatternClass';
import { Plate } from '../classes/PlateClass';
import { formatWellBlock, getCoordsFromWellId, getWellIdFromCoords, lettersToNumber, splitIntoBlocks } from './plateUtils';

export function generateExcelTemplate(patterns: Pattern[]) {
  const wb: WorkBook = utils.book_new();

  const patternsData = patterns.map(pattern => {
    const baseData: any = {
      Pattern: pattern.name,
      Type: pattern.type,
      Direction: pattern.type === 'Unused' ? '' : pattern.direction[0],
      Replicates: pattern.type === 'Unused' ? '' : pattern.replicates,
    };

    for (let i = 1; i <= 20; i++) {
      baseData[`Conc${i}`] = pattern.type === 'Unused' ? null : (pattern.concentrations[i - 1] || null);
    }

    return baseData;
  });

  const patternsWs = utils.json_to_sheet(patternsData);

  const patternsHeaders = [
    "Pattern", "Type", "Direction", "Replicates",
    ...Array.from({ length: 20 }, (_, i) => `Conc${i + 1}`)
  ];
  utils.sheet_add_aoa(patternsWs, [patternsHeaders], { origin: "A1" });

  utils.book_append_sheet(wb, patternsWs, "Patterns");

  const layoutData = patterns.flatMap(pattern =>
    pattern.locations.map(location => ({
      Pattern: pattern.name,
      "Well Block": location
    }))
  );
  const layoutWs = utils.json_to_sheet(layoutData);
  utils.book_append_sheet(wb, layoutWs, "Layout");

  const compoundsHeaders = ["Source Barcode", "Well ID", "Concentration (µM)", "Compound ID", "Volume (µL)", "Pattern"];
  const compoundsWs = utils.aoa_to_sheet([compoundsHeaders]);
  utils.book_append_sheet(wb, compoundsWs, "Compounds");

  const barcodesHeaders = ["Intermediate Plate Barcodes", "Destination Plate Barcodes"];
  const barcodesWs = utils.aoa_to_sheet([barcodesHeaders]);
  utils.book_append_sheet(wb, barcodesWs, "Barcodes");

  const assayHeaders = ["Setting", "Value"];
  const assayWs = utils.aoa_to_sheet([assayHeaders]);
  utils.book_append_sheet(wb, assayWs, "Assay");

  const fileName = `Echo_Template_${new Date().toISOString().split('T')[0]}.xlsx`;
  writeFile(wb, fileName);
}

export function getPatternWells(pattern: Pattern, plate: Plate): string[] {
  const allWells: string[] = [];
  for (const location of pattern.locations) {
    const wells = plate.getSomeWells(location);
    allWells.push(...wells.map(w => w.id));
  }
  return allWells;
};

export function mergeUnusedPatternLocations(pattern: Pattern, plate: Plate, newWells: string[]): string {
  const existingWells = getPatternWells(pattern, plate);
  const allWells = [...new Set([...existingWells, ...newWells])];
  return formatWellBlock(allWells);
};

export function isBlockOverlapping(plate: Plate, newBlock: string, existingLocations: string[]): boolean {
  const newWells = plate.getSomeWells(newBlock)
  for (const location of existingLocations) {
    const existingWells = plate.getSomeWells(location)
    for (const well of existingWells) {
      if (newWells.includes(well)) {
        return true
      }
    }
  }
  return false;
};

export function sensibleWellSelection(selectedWellIds: string[], pattern: Pattern, plate: Plate): string[] {
  const msgArr: string[] = [];
  if (pattern.type === 'Unused') return msgArr
  const blocks = splitIntoBlocks(selectedWellIds, pattern, plate);

  for (const block of blocks) {
    const rects = block.split(";");
    if (rects.length > 1) {
      msgArr.push(`Non-contiguous rectangles in block ${block}`);
      continue
    }
    for (const rect of rects) {
      const startWell = rect.split(':')[0];
      const endWell = rect.split(':')[1];
      if (!startWell || !endWell) {
        continue
      }
      const startCoords = getCoordsFromWellId(startWell);
      const endCoords = getCoordsFromWellId(endWell);
      const rectWidth = endCoords.col - startCoords.col + 1;
      const rectHeight = endCoords.row - startCoords.row + 1;

      switch (pattern.direction[0]) {
        case "LR": case "RL": {
          if (rectWidth != pattern.concentrations.length) { msgArr.push(`${rect} width doesn't match concentration number!`) }
          break
        }
        case "TB": case "BT": {
          if (rectHeight != pattern.concentrations.length) { msgArr.push(`${rect} height doesn't match concentration number!`) }
          break
        }
      }
    }
  }
  return msgArr
}

export interface Point {
  x: number;
  y: number;
}

interface Rectangle {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export function rectanglesOverlap(rect1: Rectangle, rect2: Rectangle): boolean {
  return !(rect1.right < rect2.left ||
    rect1.left > rect2.right ||
    rect1.bottom < rect2.top ||
    rect1.top > rect2.bottom);
};

export function checkWellsInSelection(startPoint: Point, endPoint: Point, wells: NodeListOf<Element>): string[] {
  const wellArr: string[] = [];
  const selectionRect: Rectangle = {
    left: Math.min(startPoint.x, endPoint.x),
    top: Math.min(startPoint.y, endPoint.y),
    right: Math.max(startPoint.x, endPoint.x),
    bottom: Math.max(startPoint.y, endPoint.y)
  };
  wells.forEach(wellElement => {
    if (wellElement) {
      const rect = wellElement.getBoundingClientRect();
      const wellRect: Rectangle = {
        left: rect.left + window.scrollX,
        top: rect.top + window.scrollY,
        right: rect.right + window.scrollX,
        bottom: rect.bottom + window.scrollY
      };

      if (rectanglesOverlap(wellRect, selectionRect)) {
        const wellId = wellElement.getAttribute('data-wellid');
        if (wellId) {
          wellArr.push(wellId);
        }
      }
    }
  });

  return wellArr;
};

export function calculateTransferBorders(plate: Plate, blockString: string): Map<string, { top: boolean, right: boolean, bottom: boolean, left: boolean }> {
  const borderMap = new Map<string, { top: boolean, right: boolean, bottom: boolean, left: boolean }>();

  const wells = plate.getSomeWells(blockString);
  const wellIds = wells.map(w => w.id);

  for (const wellId of wellIds) {
    const coords = getCoordsFromWellId(wellId);
    const borders = { top: false, right: false, bottom: false, left: false };

    const topWellId = coords.row > 0 ?
      getWellIdFromCoords(coords.row - 1, coords.col) : null;
    if (!topWellId || !wellIds.includes(topWellId)) {
      borders.top = true;
    }

    const rightWellId = coords.col < plate.columns - 1 ?
      getWellIdFromCoords(coords.row, coords.col + 1) : null;
    if (!rightWellId || !wellIds.includes(rightWellId)) {
      borders.right = true;
    }

    const bottomWellId = coords.row < plate.rows - 1 ?
      getWellIdFromCoords(coords.row + 1, coords.col) : null;
    if (!bottomWellId || !wellIds.includes(bottomWellId)) {
      borders.bottom = true;
    }

    const leftWellId = coords.col > 0 ?
      getWellIdFromCoords(coords.row, coords.col - 1) : null;
    if (!leftWellId || !wellIds.includes(leftWellId)) {
      borders.left = true;
    }

    borderMap.set(wellId, borders);
  }

  return borderMap;
}

export function canvasCoordsToWell(e: React.MouseEvent<HTMLCanvasElement>, canvasRef: React.RefObject<HTMLCanvasElement | null>, plate: Plate): string | null {
  const canvas = canvasRef.current;
  if (!canvas) return null;

  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const rows = plate.rows;
  const cols = plate.columns;

  const cw = rect.width / cols;
  const ch = rect.height / rows;

  const col = Math.floor(x / cw);
  const row = Math.floor(y / ch);

  if (col < 0 || row < 0 || col >= cols || row >= rows) return null;

  return getWellIdFromCoords(row, col);
};

export interface TileScheme {
  canTile: boolean;
  srcSize: { x: number, y: number };
  srcStartWellId: string;
  srcEndWellId: string;
  explicitDestBlocks?: string[];
}

export function getTileScheme(srcBlock: string, dstBlock: string): TileScheme {
  const tileScheme: TileScheme = { canTile: false, srcSize: { x: 0, y: 0 }, srcStartWellId: '', srcEndWellId: '' }
  if (srcBlock.length === 0 || dstBlock.length === 0) return tileScheme
  //handle src first, as it's straightforward
  //can't be noncontiguous blocks, but can be a single well
  if (srcBlock.includes(';')) return tileScheme;

  const srcCornerWellIds = srcBlock.split(':');
  if (srcCornerWellIds.length > 2 || srcCornerWellIds.length < 1) return tileScheme;
  const srcStartWellId = srcCornerWellIds[0]
  const srcEndWellId = (srcCornerWellIds.length === 1 ? srcCornerWellIds[0] : srcCornerWellIds[1])

  const srcStartWellCoords = getCoordsFromWellId(srcStartWellId);
  const srcEndWellCoords = getCoordsFromWellId(srcEndWellId);
  const srcSize = { x: srcEndWellCoords.col - srcStartWellCoords.col + 1, y: srcEndWellCoords.row - srcStartWellCoords.row + 1 };

  tileScheme.srcSize = srcSize;
  tileScheme.srcStartWellId = srcStartWellId;
  tileScheme.srcEndWellId = srcEndWellId;

  //dst plate is complicated
  //can be noncontiguous blocks, but each must be exactly the same size as source tile
  const dstBlocks = dstBlock.split(';')
  if (dstBlocks.length < 1) return tileScheme

  const validBlocks: string[] = [];

  for (const block of dstBlocks) {
    const blockWellIds = block.split(':');
    if (blockWellIds.length > 2 || blockWellIds.length < 1) return tileScheme
    const blockStartWellId = blockWellIds[0]
    const blockEndWellId = (blockWellIds.length === 1 ? blockWellIds[0] : blockWellIds[1])
    const blockStartWellCoords = getCoordsFromWellId(blockStartWellId);
    const blockEndWellCoords = getCoordsFromWellId(blockEndWellId);
    const blockSize = { x: blockEndWellCoords.col - blockStartWellCoords.col + 1, y: blockEndWellCoords.row - blockStartWellCoords.row + 1 };

    if (blockSize.x % srcSize.x != 0 || blockSize.y % srcSize.y != 0) {
      return tileScheme;
    }
    const tilesHorizontal = blockSize.x / tileScheme.srcSize.x
    const tilesVertical = blockSize.y / tileScheme.srcSize.y
    for (let tileRow = 0; tileRow < tilesVertical; tileRow++) {
      for (let tileCol = 0; tileCol < tilesHorizontal; tileCol++) {
        const tileOriginY = blockStartWellCoords.row + (tileRow * tileScheme.srcSize.y);
        const tileOriginX = blockStartWellCoords.col + (tileCol * tileScheme.srcSize.x);
        const tileEndY = tileOriginY + tileScheme.srcSize.y - 1
        const tileEndX = tileOriginX + tileScheme.srcSize.x - 1
        const tileOriginWellId = getWellIdFromCoords(tileOriginY, tileOriginX)
        const tileEndWellId = getWellIdFromCoords(tileEndY, tileEndX)
        if (tileOriginWellId == tileEndWellId) { validBlocks.push(tileOriginWellId) }
        else { validBlocks.push(tileOriginWellId + ":" + tileEndWellId) }
      }
    }
  }

  tileScheme.canTile = true;
  tileScheme.explicitDestBlocks = validBlocks;
  return tileScheme;
}

export function tileTransfers(srcWells: string[], tileScheme: TileScheme): { pairs: [string, string][]; tiles: string[] } {

  const fillFromOffset = (srcOffsets: Map<string, string>, originX: number, originY: number) => {
    const tileTsfrs: string[] = []
    for (const [offsetKey, srcWellId] of srcOffsets) {
      const [rowOffset, colOffset] = offsetKey.split(',').map(Number);
      const dstRow = originY + rowOffset;
      const dstCol = originX + colOffset;
      const dstWellId = getWellIdFromCoords(dstRow, dstCol);
      transfers.pairs.push([srcWellId, dstWellId]);
      tileTsfrs.push(dstWellId)
    }
    return tileTsfrs
  }

  const transfers: { pairs: [string, string][], tiles: string[] } = { pairs: [], tiles: [] }
  const srcOffsets = new Map<string, string>();
  const srcStartWellCoords = getCoordsFromWellId(tileScheme.srcStartWellId)
  for (const wellId of srcWells) {
    const { row, col } = getCoordsFromWellId(wellId);
    const offsetKey = `${row - srcStartWellCoords.row},${col - srcStartWellCoords.col}`;
    srcOffsets.set(offsetKey, wellId);
  }

  if (tileScheme.explicitDestBlocks && tileScheme.explicitDestBlocks.length > 0) {
    for (const block of tileScheme.explicitDestBlocks) {
      const blockWellIds = block.split(':');
      const blockStartCoords = getCoordsFromWellId(blockWellIds[0]);
      const tileTsfrs = fillFromOffset(srcOffsets, blockStartCoords.col, blockStartCoords.row)
      transfers.tiles.push(formatWellBlock(tileTsfrs));
    }
  }
  return transfers;
}

export function selectorHelper(e: React.MouseEvent, newSelected: string[], selectedWells: string[], setSelectedWells: React.Dispatch<React.SetStateAction<string[]>>) {
  let newSelection = [...selectedWells]
  if (!e.shiftKey) {
    setSelectedWells(newSelected)
  }
  else {
    for (let wellId of newSelected) {
      let idx = newSelection.indexOf(wellId)
      if (idx > -1) {
        newSelection.splice(idx, 1)
      }
      else {
        newSelection.push(wellId)
      }
    }
    newSelection.sort((a, b) => {
      const aCoords = getCoordsFromWellId(a)
      const bCoords = getCoordsFromWellId(b)
      const rowComp = aCoords.row - bCoords.row
      if (rowComp === 0) {
        return aCoords.col - bCoords.col
      }
      return rowComp
    })
    setSelectedWells(newSelection)
  }
}

export function labelDrag(startEl: Element | null, endEl: Element | null, plate: Plate): string[] {
  const newSelected: string[] = []
  if (!(startEl instanceof HTMLDivElement) || !(endEl instanceof HTMLDivElement)) return newSelected
  if (startEl === endEl) return newSelected
  if (startEl.parentElement != endEl.parentElement) return newSelected
  const startLabel = startEl.innerText
  const endLabel = endEl.innerText
  const rowRange = {start: 0, end: 0}
  const colRange = {start: 0, end: 0}
  if (isNaN(parseInt(startLabel))) {
    rowRange.start = lettersToNumber(startLabel)
    rowRange.end = lettersToNumber(endLabel)
    colRange.end = plate.columns - 1
  }
  else {
    rowRange.end = plate.rows - 1
    colRange.start = parseInt(startLabel) - 1
    colRange.end = parseInt(endLabel) - 1
  }
  for (let r = rowRange.start; r < rowRange.end + 1; r++) {
    for (let c = colRange.start; c < colRange.end + 1; c++) {
      const wellId = getWellIdFromCoords(r, c);
      newSelected.push(wellId);
    }
  }
  return newSelected
}