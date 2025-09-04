import { utils, writeFile, WorkBook } from 'xlsx';
import { Pattern } from '../../../classes/PatternClass';
import { Plate } from '../../../classes/PlateClass';
import { formatWellBlock, getCoordsFromWellId, splitIntoBlocks } from './plateUtils';

export function generateExcelTemplate(patterns: Pattern[]) {
  const wb: WorkBook = utils.book_new();

  const patternsData = patterns.map(pattern => {
    const baseData: any = {
      Pattern: pattern.name,
      Type: pattern.type,
      Direction: pattern.type === 'Unused' ? '' : pattern.direction[0],
      Replicates: pattern.type === 'Unused' ? '' : pattern.replicates,
    };

    // Add concentration columns up to Conc20
    for (let i = 1; i <= 20; i++) {
      baseData[`Conc${i}`] = pattern.type === 'Unused' ? null : (pattern.concentrations[i - 1] || null);
    }

    return baseData;
  });

  const patternsWs = utils.json_to_sheet(patternsData);
  
  const patternsHeaders = [
    "Pattern", "Type", "Direction", "Replicates",
    ...Array.from({length: 20}, (_, i) => `Conc${i + 1}`)
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
          if (rectWidth != pattern.concentrations.length) {msgArr.push(`${rect} width doesn't match concentration number!`)}
          break
        }
        case "TB": case "BT": {
          if (rectHeight != pattern.concentrations.length) {msgArr.push(`${rect} height doesn't match concentration number!`)}
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

export function checkWellsInSelection(startPoint: Point, endPoint: Point, wellsRef: React.MutableRefObject<HTMLDivElement[]>): string[] {
    const wellArr: string[] = [];
    const selectionRect: Rectangle = {
      left: Math.min(startPoint.x, endPoint.x),
      top: Math.min(startPoint.y, endPoint.y),
      right: Math.max(startPoint.x, endPoint.x),
      bottom: Math.max(startPoint.y, endPoint.y)
    };
    wellsRef.current.forEach(wellElement => {
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