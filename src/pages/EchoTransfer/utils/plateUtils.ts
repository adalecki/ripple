import { Plate } from "../classes/PlateClass"
import { PlatesContextType } from "../contexts/Context"

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
  const match = wellId.match(/([A-Z]+)(\d+)/);
  if (!match) {
    throw new Error(`Invalid well ID format: ${wellId}`);
  }
  const [_, rowLetters, colString] = match;
  const row = lettersToNumber(rowLetters);
  const col = parseInt(colString) - 1;
  return { row, col };
}

export function currentPlate(plates: Plate[],curPlateId: PlatesContextType['curPlateId']) {
  let plate = null
  if (curPlateId != null) {
    plate = plates.find((plate) => plate.id == curPlateId)
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
  const wells = [...new Set(wellIds)].sort((a,b) => {
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
  replicates: number,
  direction: 'LR' | 'RL' | 'TB' | 'BT'
): string[][] {
  const wells = plate.getSomeWells(wellBlock);
  const result: string[][] = Array(concentrations.length).fill([]).map(() => []);
  
  // Sort wells based on direction
  wells.sort((a, b) => {
    const coordsA = getCoordsFromWellId(a.id);
    const coordsB = getCoordsFromWellId(b.id);

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
  });

  let wellIndex = 0;
  for (let i = 0; i < concentrations.length; i++) {
    for (let j = 0; j < replicates; j++) {
      if (wellIndex < wells.length) {
        result[i].push(wells[wellIndex].id);
        wellIndex++;
      }
    }
  }

  return result;
}