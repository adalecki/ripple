import { utils, writeFile, WorkBook } from 'xlsx';
import { Pattern } from '../../../classes/PatternClass';
import { Plate } from '../../../classes/PlateClass';
import { formatWellBlock, getCoordsFromWellId, splitIntoBlocks } from './plateUtils';

export function generateExcelTemplate(patterns: Pattern[]) {
  // Create a new workbook
  const wb: WorkBook = utils.book_new();

  // Create Patterns sheet
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
  
  // Ensure all headers are present
  const patternsHeaders = [
    "Pattern", "Type", "Direction", "Replicates",
    ...Array.from({length: 20}, (_, i) => `Conc${i + 1}`)
  ];
  utils.sheet_add_aoa(patternsWs, [patternsHeaders], { origin: "A1" });
  
  utils.book_append_sheet(wb, patternsWs, "Patterns");

  // Create Layout sheet
  const layoutData = patterns.flatMap(pattern => 
    pattern.locations.map(location => ({
      Pattern: pattern.name,
      "Well Block": location
    }))
  );
  const layoutWs = utils.json_to_sheet(layoutData);
  utils.book_append_sheet(wb, layoutWs, "Layout");

  // Create Compounds sheet (empty with headers)
  const compoundsHeaders = ["Source Barcode", "Well ID", "Concentration (µM)", "Compound ID", "Volume (µL)", "Pattern"];
  const compoundsWs = utils.aoa_to_sheet([compoundsHeaders]);
  utils.book_append_sheet(wb, compoundsWs, "Compounds");

  // Create Barcodes sheet (empty with headers)
  const barcodesHeaders = ["Intermediate Plate Barcodes", "Destination Plate Barcodes"];
  const barcodesWs = utils.aoa_to_sheet([barcodesHeaders]);
  utils.book_append_sheet(wb, barcodesWs, "Barcodes");

  // Generate and download the Excel file
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