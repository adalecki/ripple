import { Pattern } from "../../../classes/PatternClass";
import { Plate } from "../../../classes/PlateClass"
import { Well } from "../../../classes/WellClass";
import { PlatesContextType } from "../../../contexts/Context";

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

  // Sort wells for consistent processing
  const wells = [...new Set(wellIds)].sort((a, b) => {
    const coordsA = getCoordsFromWellId(a);
    const coordsB = getCoordsFromWellId(b);
    return coordsA.row === coordsB.row ? coordsA.col - coordsB.col : coordsA.row - coordsB.row;
  })

  // Find all possible rectangles containing each well
  const blocks: string[] = [];
  const usedWells = new Set<string>();

  while (usedWells.size < wells.length) {
    // Find the next unused well to start a new block
    const startWell = wells.find(well => !usedWells.has(well))!;

    // Find best rectangle starting from this well
    const rect = findBestRectangle(startWell, wells, usedWells);
    blocks.push(rect.block);
    rect.wells.forEach(well => usedWells.add(well));
  }

  return blocks.join(';');
}

interface Rectangle {
  block: string;
  wells: string[];
}

function findBestRectangle(startWell: string, allWells: string[], usedWells: Set<string>): Rectangle {
  const startRow = startWell.match(/^[A-Z]+/)![0];
  const startCol = parseInt(startWell.slice(startRow.length));
  let bestRect: Rectangle = {
    block: startWell,
    wells: [startWell]
  };

  // Find all potential end wells to form rectangles
  const potentialEnds = allWells.filter(well => {
    const endRow = well.match(/^[A-Z]+/)![0];
    const endCol = parseInt(well.slice(endRow.length));
    // Convert row letters to numbers for proper comparison
    const startRowNum = lettersToNumber(startRow);
    const endRowNum = lettersToNumber(endRow);
    return (endRowNum >= startRowNum && endCol >= startCol) && !usedWells.has(well);
  });

  // Try each potential end well
  for (const endWell of potentialEnds) {
    const rectangleWells = getRectangleWells(startWell, endWell);

    const validRectangle = rectangleWells.every(well =>
      allWells.includes(well) && !usedWells.has(well)
    );

    if (validRectangle && rectangleWells.length > bestRect.wells.length) {
      const block = startWell === endWell ? startWell : `${startWell}:${endWell}`;
      bestRect = { block, wells: rectangleWells };
    }
  }

  return bestRect;
}

function getRectangleWells(startWell: string, endWell: string): string[] {
  const startRow = startWell.match(/^[A-Z]+/)![0];
  const endRow = endWell.match(/^[A-Z]+/)![0];
  const startCol = parseInt(startWell.slice(startRow.length));
  const endCol = parseInt(endWell.slice(endRow.length));

  const startRowNum = lettersToNumber(startRow);
  const endRowNum = lettersToNumber(endRow);

  const wells: string[] = [];

  for (let rowNum = startRowNum; rowNum <= endRowNum; rowNum++) {
    const rowLabel = numberToLetters(rowNum);
    for (let col = startCol; col <= endCol; col++) {
      wells.push(`${rowLabel}${col.toString().padStart(2, '0')}`);
    }
  }

  return wells;
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

  // Get the coordinates and determine the block dimensions
  const coordsList = wells.map(w => getCoordsFromWellId(w.id));
  const uniqueRows = [...new Set(coordsList.map(c => c.row))].sort((a, b) => a - b);
  const uniqueCols = [...new Set(coordsList.map(c => c.col))].sort((a, b) => a - b);
  
  // Create a 2D array to represent the block
  const blockArray: string[][] = Array(uniqueRows.length)
    .fill(null)
    .map(() => Array(uniqueCols.length).fill(null));
  
  // Fill the block array with well IDs
  for (const well of wells) {
    const coords = getCoordsFromWellId(well.id);
    const rowIdx = uniqueRows.indexOf(coords.row);
    const colIdx = uniqueCols.indexOf(coords.col);
    blockArray[rowIdx][colIdx] = well.id;
  }

  // Create a linear sequence of wells based on direction
  const wellSequence: string[] = [];
  
  switch (direction) {
    case 'TB': {
      // Primary: left to right across columns, Secondary: top to bottom across rows
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
      // Primary: right to left across columns, Secondary: top to bottom across rows
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
      // Primary: top to bottom across rows, Secondary: left to right across columns
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
      // Primary: bottom to top across rows, Secondary: left to right across columns
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

  // Distribute wells to concentrations in sequence
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

  // Initialize all wells with no borders
  for (const well of plate) {
    if (well) {
      borderMap.set(well.id, { top: false, right: false, bottom: false, left: false });
    }
  }

  // For each pattern
  const patternIds = Object.keys(plate.patterns)
  for (const patternId of patternIds) {
    const pattern = plate.patterns[patternId]
    // For each block in the pattern
    for (const block of pattern.locations) {
      const wells = plate.getSomeWells(block);
      const wellIds = wells.map(w => w.id);

      // For each well in the block
      for (const wellId of wellIds) {
        const coords = getCoordsFromWellId(wellId);
        const borders = borderMap.get(wellId)!;

        // Check top
        const topWellId = coords.row > 0 ?
          getWellIdFromCoords(coords.row - 1, coords.col) : null;
        if (!topWellId || !wellIds.includes(topWellId)) {
          borders.top = true;
        }

        // Check right
        const rightWellId = coords.col < plate.columns - 1 ?
          getWellIdFromCoords(coords.row, coords.col + 1) : null;
        if (!rightWellId || !wellIds.includes(rightWellId)) {
          borders.right = true;
        }

        // Check bottom
        const bottomWellId = coords.row < plate.rows - 1 ?
          getWellIdFromCoords(coords.row + 1, coords.col) : null;
        if (!bottomWellId || !wellIds.includes(bottomWellId)) {
          borders.bottom = true;
        }

        // Check left
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

  // Map wells to concentrations based on the pattern
  const wellConcentrationArr = mapWellsToConcentrations(
    plate,
    formatWellBlock(wells),
    concentrations,
    pattern.direction[0]
  );

  // Split into blocks
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