import { Pattern } from "../classes/PatternClass";
import { Plate } from "../classes/PlateClass";
import { Well } from "../classes/WellClass";
import type { PlatesContextType } from "../contexts/Context";

export interface TransferStepExport {
  sourceBarcode: string;
  sourceWellId: string;
  destinationBarcode: string;
  destinationWellId: string;
  volume: number;
}

export interface TransferStepInternal {
  sourcePlateId: number;
  sourceWellId: string;
  destinationPlateId: number;
  destinationWellId: string;
  volume: number;
}

export interface TransferBlock {
  sourcePlateId: number;
  sourceBlock: string;
  destinationPlateId: number;
  destinationBlock: string;
  destinationTiles?: string[];
  volume: number;
  transferSteps: TransferStepInternal[];
}

export function numberToLetters(num: number): string {
  let result = '';
  while (num >= 0) {
    result = String.fromCharCode(65 + (num % 26)) + result;
    num = Math.floor(num / 26) - 1;
  }
  return result;
}

export function lettersToNumber(letters: string): number {
  let result = 0;
  for (let i = 0; i < letters.length; i++) {
    result = result * 26 + letters.charCodeAt(i) - 65 + 1;
  }
  return result - 1;
}

export function getWellIdFromCoords(row: number, col: number): string {
  return `${numberToLetters(row)}${(col + 1).toString().padStart(2, '0')}`;
}

//zero indexed
export function getCoordsFromWellId(wellId: string): { row: number, col: number } {
  const match = wellId.match(/^([A-Z]{1,2})(\d{1,2})$/);
  if (!match) {
    throw new Error(`Invalid well ID format: ${wellId}`);
  }
  const [_, rowLetters, colString] = match;
  const row = lettersToNumber(rowLetters);
  const col = parseInt(colString) - 1;
  return { row, col };
}

//zero indexed
export function getWellIndex(wellId: string, plate: Plate): number | null {
  if (plate.getWell(wellId) == null) return null;
  const coords = getCoordsFromWellId(wellId)
  return (plate.rows * plate.columns + coords.col)
}

export function currentPlate(plates: Plate[], curPlateId: PlatesContextType['curPlateId']) {
  let plate = null
  if (curPlateId != null) {
    plate = plates.find((plate) => plate.id == curPlateId) || null
  }
  return plate
}

export function clonePlate(plate: Plate) {
  return plate.clone()
}

export function modifyPlate(clonePlate: Plate, plates: Plate[], setPlates: PlatesContextType['setPlates'], curPlateId: PlatesContextType['curPlateId']) {
  let plateIdx = plates.findIndex((plate) => plate.id == curPlateId)
  let newPlates = [...plates]
  newPlates[plateIdx] = clonePlate
  setPlates(newPlates)
}

export function formatWellBlock(wellIds: string[]): string {
  if (wellIds.length === 0) return '';
  if (wellIds.length === 1) return wellIds[0];
  let maxRow = 0;
  let maxCol = 0;
  const wells = [...new Set(wellIds)].sort((a, b) => {
    const coordsA = getCoordsFromWellId(a);
    const coordsB = getCoordsFromWellId(b);
    maxRow = Math.max(maxRow,coordsA.row,coordsB.row)
    maxCol = Math.max(maxCol,coordsA.col,coordsB.col)
    return coordsA.row === coordsB.row ? coordsA.col - coordsB.col : coordsA.row - coordsB.row;
  });

  const wellSet = new Set(wells);
  
  const firstCoords = getCoordsFromWellId(wells[0]);
  const lastCoords = getCoordsFromWellId(wells[wells.length - 1]);
  const expectedCount = (lastCoords.row - firstCoords.row + 1) * (lastCoords.col - firstCoords.col + 1);
  
  if (expectedCount === wells.length) {
    let isComplete = true;
    for (let row = firstCoords.row; row <= lastCoords.row && isComplete; row++) {
      for (let col = firstCoords.col; col <= lastCoords.col; col++) {
        if (!wellSet.has(getWellIdFromCoords(row, col))) {
          isComplete = false;
          break;
        }
      }
    }
    
    if (isComplete) {
      return `${wells[0]}:${wells[wells.length - 1]}`;
    }
  }

  const blocks: string[] = [];
  const usedWells = new Set<string>();

  while (usedWells.size < wells.length) {
    const startWell = wells.find(well => !usedWells.has(well))!;
    const rect = findBestRectangle(startWell, wellSet, usedWells, {row:maxRow,col:maxCol});
    blocks.push(rect.block);
    rect.wellIds.forEach(well => usedWells.add(well));
  }

  return blocks.join(';');
}

interface Rectangle {
  block: string;
  wellIds: string[];
}

function findBestRectangle(startWell: string, allWells: Set<string>, usedWells: Set<string>, maxCoords: {row: number, col: number}): Rectangle {
  const startCoords = getCoordsFromWellId(startWell);
  let bestRect: Rectangle = {
    block: startWell,
    wellIds: [startWell]
  };

  for (let rowDist = 0; rowDist <= maxCoords.row; rowDist++) {
    for (let colDist = 0; colDist <= maxCoords.col; colDist++) {
      const endRow = startCoords.row + rowDist;
      const endCol = startCoords.col + colDist;
      const endWell = getWellIdFromCoords(endRow, endCol);
      
      if (!allWells.has(endWell) || usedWells.has(endWell)) continue;
      
      let validRectangle = true;
      const rectangleWells: string[] = [];
      
      for (let row = startCoords.row; row <= endRow; row++) {
        for (let col = startCoords.col; col <= endCol; col++) {
          const wellId = getWellIdFromCoords(row, col);
          rectangleWells.push(wellId);
          
          if (!allWells.has(wellId) || usedWells.has(wellId)) {
            validRectangle = false;
            break;
          }
        }
        if (!validRectangle) break;
      }

      if (validRectangle && rectangleWells.length > bestRect.wellIds.length) {
        const block = startWell === endWell ? startWell : `${startWell}:${endWell}`;
        bestRect = { block, wellIds: rectangleWells };
      }
    }
  }

  return bestRect;
}

export function mapWellsToConcentrations(
  plate: Plate,
  wellBlock: string,
  concentrations: number[],
  direction: 'LR' | 'RL' | 'TB' | 'BT'
): string[][] {
  const wells = plate.getSomeWells(wellBlock);
  const numConcs = concentrations.length;
  const result: string[][] = Array(numConcs).fill(0).map(() => []);

  if (!wells.length || numConcs === 0) {
    return result;
  }

  const coordsList = wells.map(w => getCoordsFromWellId(w.id));
  const uniqueRows = [...new Set(coordsList.map(c => c.row))].sort((a, b) => a - b);
  const uniqueCols = [...new Set(coordsList.map(c => c.col))].sort((a, b) => a - b);
  
  const blockArray: string[][] = Array(uniqueRows.length)
    .fill(null)
    .map(() => Array(uniqueCols.length).fill(null));
  
  for (const well of wells) {
    const coords = getCoordsFromWellId(well.id);
    const rowIdx = uniqueRows.indexOf(coords.row);
    const colIdx = uniqueCols.indexOf(coords.col);
    blockArray[rowIdx][colIdx] = well.id;
  }

  const wellSequence: string[] = [];
  
  switch (direction) {
    case 'TB': {
      for (let colIdx = 0; colIdx < uniqueCols.length; colIdx++) {
        for (let rowIdx = 0; rowIdx < uniqueRows.length; rowIdx++) {
          if (blockArray[rowIdx][colIdx]) {
            wellSequence.push(blockArray[rowIdx][colIdx]);
          }
        }
      }
      break;
    }
    case 'BT': {
      for (let colIdx = 0; colIdx < uniqueCols.length; colIdx++) {
        for (let rowIdx = uniqueRows.length - 1; rowIdx >= 0; rowIdx--) {
          if (blockArray[rowIdx][colIdx]) {
            wellSequence.push(blockArray[rowIdx][colIdx]);
          }
        }
      }
      break;
    }
    case 'LR': {
      for (let rowIdx = 0; rowIdx < uniqueRows.length; rowIdx++) {
        for (let colIdx = 0; colIdx < uniqueCols.length; colIdx++) {
          if (blockArray[rowIdx][colIdx]) {
            wellSequence.push(blockArray[rowIdx][colIdx]);
          }
        }
      }
      break;
    }
    case 'RL': {
      for (let rowIdx = 0; rowIdx < uniqueRows.length; rowIdx++) {
        for (let colIdx = uniqueCols.length - 1; colIdx >= 0; colIdx--) {
          if (blockArray[rowIdx][colIdx]) {
            wellSequence.push(blockArray[rowIdx][colIdx]);
          }
        }
      }
      break;
    }
  }

  for (let i = 0; i < wellSequence.length; i++) {

    const concentrationIndex = i % numConcs;
    result[concentrationIndex].push(wellSequence[i]);
  }
  for (const concIdx in result) {
    result[concIdx].sort((a,b) => {
      const coordsA = getCoordsFromWellId(a);
      const coordsB = getCoordsFromWellId(b);
  
      switch (direction) {
        case 'LR':
          return coordsA.col === coordsB.col ? coordsA.row - coordsB.row : coordsA.col - coordsB.col;
        case 'RL':
          return coordsA.col === coordsB.col ? coordsA.row - coordsB.row : coordsB.col - coordsA.col;
        case 'TB':
          return coordsA.row === coordsB.row ? coordsA.col - coordsB.col : coordsA.row - coordsB.row;
        case 'BT':
          return coordsA.row === coordsB.row ? coordsA.col - coordsB.col : coordsB.row - coordsA.row;
      }
    })
  }

  return result;
}

export function calculateBlockBorders(plate: Plate): Map<string, { top: boolean, right: boolean, bottom: boolean, left: boolean }> {
  const borderMap = new Map<string, { top: boolean, right: boolean, bottom: boolean, left: boolean }>();

  for (const well of plate) {
    if (well) {
      borderMap.set(well.id, { top: false, right: false, bottom: false, left: false });
    }
  }

  const patternIds = Object.keys(plate.patterns)
  for (const patternId of patternIds) {
    const pattern = plate.patterns[patternId]
    for (const block of pattern.locations) {
      const wells = plate.getSomeWells(block);
      const wellIds = wells.map(w => w.id);

      for (const wellId of wellIds) {
        const coords = getCoordsFromWellId(wellId);
        const borders = borderMap.get(wellId)!;

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
    }
  }

  return borderMap;
}

export function splitIntoBlocks(wells: string[], pattern: Pattern, plate: Plate): string[] {
  if (pattern.type === 'Unused') {
    return [formatWellBlock(wells)];
  }
  const concentrations = pattern.concentrations.filter(c => c != null)
  const wellsPerConcentration = wells.length / concentrations.length;

  if (wellsPerConcentration % 1 !== 0) {
    throw new Error("The number of wells must be divisible by the number of concentrations.");
  }

  const patternReplicates = wellsPerConcentration / pattern.replicates;

  if (patternReplicates % 1 !== 0) {
    throw new Error("The number of wells per concentration must be divisible by the original number of replicates.");
  }

  const wellConcentrationArr = mapWellsToConcentrations(
    plate,
    formatWellBlock(wells),
    concentrations,
    pattern.direction[0]
  );

  const blocks: string[] = [];

  for (let i = 0; i < patternReplicates; i++) {
    const block: string[] = [];
    for (const concIdx in concentrations) {
      const startIndex = i * pattern.replicates;
      const endIndex = startIndex + pattern.replicates;
      block.push(...wellConcentrationArr[concIdx].slice(startIndex, endIndex))
    }
    blocks.push(formatWellBlock(block));
  }
  return blocks;
};

export function getWellFromBarcodeAndId(barcode: string, wellId: string, plates: Plate[], curPlate?: Plate): Well | null {
  if (curPlate && curPlate.barcode === barcode) {
    return curPlate.getWell(wellId)
  }
  const plate = plates.find(p => p.barcode === barcode)
  if (!plate) return null
  return plate.getWell(wellId)
}

export interface WellTransferSummary {
  counterpartBarcode: string;
  counterpartWellId: string;
  volume: number;
}

export type WellTransferMap = Map<string, WellTransferSummary[]>;

//for plate reformat primarily
export function buildWellTransferMap(
  plate: Plate,
  transferBlocks: TransferBlock[],
  type: 'source' | 'destination',
  plateBarcodeCache: Map<number, string>
): WellTransferMap {
  const map: WellTransferMap = new Map();
  
  for (const block of transferBlocks) {
    const targetBarcode = type === 'source' ? plateBarcodeCache.get(block.sourcePlateId) : plateBarcodeCache.get(block.destinationPlateId);
    if (targetBarcode !== plate.barcode) continue;
    
    for (const step of block.transferSteps) {
      const wellId = type === 'source' ? step.sourceWellId : step.destinationWellId;
      const counterpartBarcode = type === 'source' ? plateBarcodeCache.get(step.destinationPlateId) : plateBarcodeCache.get(step.sourcePlateId);
      const counterpartWellId = type === 'source' ? step.destinationWellId : step.sourceWellId;
      if (!counterpartBarcode) continue;
      
      const existing = map.get(wellId) ?? [];
      existing.push({ counterpartBarcode, counterpartWellId, volume: step.volume });
      map.set(wellId, existing);
    }
  }
  
  return map;
}