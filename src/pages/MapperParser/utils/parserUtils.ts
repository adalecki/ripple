import { utils, read, WorkSheet } from 'xlsx';
import { Protocol } from '../../../types/mapperTypes';
import { Plate } from '../../../classes/PlateClass';
import { getWellIdFromCoords } from '../../EchoTransfer/utils/plateUtils';

export interface ParsedData {
  barcode: string;
  wellData: Map<string, number>;
}

export interface ParseResult {
  success: boolean;
  data?: ParsedData[];
  errors: string[];
}

// Parse Excel file based on protocol configuration
export async function parseDataFile(file: File, protocol: Protocol): Promise<ParseResult> {
  const errors: string[] = [];
  const parsedData: ParsedData[] = [];

  try {
    const arrayBuffer = await file.arrayBuffer();
    const wb = read(arrayBuffer, { type: 'array' });
    let ws = wb.Sheets[wb.SheetNames[0]]
    const result = parseSheet(ws, protocol, file.name);
    if (result.errors.length > 0) {
      errors.push(...result.errors.map(e => `${wb.SheetNames[0]}: ${e}`));
    }
      
    if (result.data) {
      parsedData.push(result.data);
    }
    
    return {
      success: errors.length === 0,
      data: parsedData,
      errors
    };
  } catch (error) {
    return {
      success: false,
      errors: [`Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`]
    };
  }
}

function parseSheet(sheet: WorkSheet, protocol: Protocol, filename: string): { data?: ParsedData; errors: string[] } {
  const errors: string[] = [];
  const wellData = new Map<string, number>();
  
  // Determine barcode
  let barcode = '';
  if (protocol.parseStrategy.plateBarcodeLocation === 'filename') {
    // Extract barcode from filename (remove extension)
    barcode = filename.replace(/\.[^/.]+$/, '');
  } else if (protocol.parseStrategy.plateBarcodeLocation === 'cell' && protocol.parseStrategy.plateBarcodeCell) {
    const barcodeCell = sheet[protocol.parseStrategy.plateBarcodeCell];
    if (barcodeCell && barcodeCell.v) {
      barcode = String(barcodeCell.v);
    } else {
      errors.push(`Barcode cell ${protocol.parseStrategy.plateBarcodeCell} not found or empty`);
      return { errors };
    }
  }
  
  if (protocol.parseStrategy.format === 'Matrix') {
    const result = parseMatrixFormat(sheet, protocol);
    if (result.errors.length > 0) {
      errors.push(...result.errors);
    }
    result.wellData.forEach((value, wellId) => wellData.set(wellId, value));
  } else if (protocol.parseStrategy.format === 'Table') {
    const result = parseTableFormat(sheet, protocol);
    if (result.errors.length > 0) {
      errors.push(...result.errors);
    }
    result.wellData.forEach((value, wellId) => wellData.set(wellId, value));
  }
  
  if (errors.length > 0) {
    return { errors };
  }
  
  return {
    data: {
      barcode,
      wellData
    },
    errors
  };
}

function parseMatrixFormat(sheet: WorkSheet, protocol: Protocol): { wellData: Map<string, number>; errors: string[] } {
  const errors: string[] = [];
  const wellData = new Map<string, number>();
  
  // Parse X labels (columns)
  const xLabels: string[] = [];
  if (protocol.parseStrategy.xLabels) {
    const xRange = utils.decode_range(protocol.parseStrategy.xLabels);
    for (let col = xRange.s.c; col <= xRange.e.c; col++) {
      const cell = sheet[utils.encode_cell({ r: xRange.s.r, c: col })];
      if (cell && cell.v) {
        xLabels.push(String(cell.v));
      }
    }
  }
  
  // Parse Y labels (rows)
  const yLabels: string[] = [];
  if (protocol.parseStrategy.yLabels) {
    const yRange = utils.decode_range(protocol.parseStrategy.yLabels);
    for (let row = yRange.s.r; row <= yRange.e.r; row++) {
      const cell = sheet[utils.encode_cell({ r: row, c: yRange.s.c })];
      if (cell && cell.v) {
        yLabels.push(String(cell.v));
      }
    }
  }
  
  // Parse raw data
  const dataRange = utils.decode_range(protocol.parseStrategy.rawData);
  console.log(protocol.parseStrategy.rawData)
  for (let row = dataRange.s.r; row <= dataRange.e.r; row++) {
    for (let col = dataRange.s.c; col <= dataRange.e.c; col++) {
      const cell = sheet[utils.encode_cell({ r: row, c: col })];
      if (cell && cell.v !== undefined && cell.v !== null && cell.v !== '') {
        // Determine well ID from position
        const xIndex = col - dataRange.s.c;
        const yIndex = row - dataRange.s.r;
        
        let wellId = '';
        if (xLabels.length > xIndex && yLabels.length > yIndex) {
          // Try to parse as well IDs
          const colNum = parseInt(xLabels[xIndex]);
          const rowLetter = yLabels[yIndex];
          if (!isNaN(colNum) && /^[A-Z]+$/.test(rowLetter)) {
            wellId = `${rowLetter}${colNum.toString().padStart(2, '0')}`;
          } else {
            // If not standard well format, create based on position
            wellId = getWellIdFromCoords(yIndex, xIndex);
          }
        } else {
          wellId = getWellIdFromCoords(yIndex, xIndex);
        }
        const value = parseFloat(String(cell.v));
        if (!isNaN(value)) {
          wellData.set(wellId, value);
        }
      }
    }
  }
  
  return { wellData, errors };
}

function parseTableFormat(sheet: WorkSheet, protocol: Protocol): { wellData: Map<string, number>; errors: string[] } {
  const errors: string[] = [];
  const wellData = new Map<string, number>();
  
  // Get well IDs and data ranges
  const wellIDRange = protocol.parseStrategy.wellIDs ? utils.decode_range(protocol.parseStrategy.wellIDs) : null;
  const dataRange = utils.decode_range(protocol.parseStrategy.rawData);
  
  if (!wellIDRange) {
    errors.push('Well IDs range not specified for Table format');
    return { wellData, errors };
  }
  
  // Ensure ranges have same number of rows
  const wellIDRows = wellIDRange.e.r - wellIDRange.s.r + 1;
  const dataRows = dataRange.e.r - dataRange.s.r + 1;
  
  if (wellIDRows !== dataRows) {
    errors.push(`Well ID rows (${wellIDRows}) don't match data rows (${dataRows})`);
    return { wellData, errors };
  }
  
  // Parse row by row
  for (let i = 0; i < wellIDRows; i++) {
    const wellIDCell = sheet[utils.encode_cell({ r: wellIDRange.s.r + i, c: wellIDRange.s.c })];
    const dataCell = sheet[utils.encode_cell({ r: dataRange.s.r + i, c: dataRange.s.c })];
    
    if (wellIDCell && wellIDCell.v && dataCell && dataCell.v !== undefined && dataCell.v !== null && dataCell.v !== '') {
      const wellId = String(wellIDCell.v);
      const value = parseFloat(String(dataCell.v));
      
      if (!isNaN(value)) {
        // Ensure well ID is properly formatted
        const match = wellId.match(/^([A-Z]+)(\d+)$/);
        if (match) {
          const formattedWellId = `${match[1]}${match[2].padStart(2, '0')}`;
          wellData.set(formattedWellId, value);
        }
      }
    }
  }
  
  return { wellData, errors };
}

// Apply parsed data to plates
export function applyParsedDataToPlates(
  plates: Plate[], 
  parsedData: ParsedData[], 
  normalizationType: 'None' | 'PctOfCtrl'
): { updatedPlates: Plate[], errors: string[] } {
  const errors: string[] = [];
  const updatedPlates: Plate[] = [];
  
  // Create a map of barcode to parsed data for efficiency
  const dataByBarcode = new Map<string, ParsedData>();
  parsedData.forEach(data => {
    dataByBarcode.set(data.barcode, data);
  });
  
  // Process each plate
  for (const plate of plates) {
    const plateData = dataByBarcode.get(plate.barcode);
    
    if (!plateData) {
      updatedPlates.push(plate);
      continue;
    }
    
    // Clone the plate to avoid mutating the original
    const updatedPlate = plate.clone();
    
    // Apply raw responses to wells
    let minResponse = Infinity;
    let maxResponse = -Infinity;
    
    plateData.wellData.forEach((value, wellId) => {
      const well = updatedPlate.getWell(wellId);
      if (well) {
        well.applyRawResponse(value);
        minResponse = Math.min(minResponse, value);
        maxResponse = Math.max(maxResponse, value);
      } else {
        errors.push(`Well ${wellId} not found on plate ${plate.barcode}`);
      }
    });
    
    // Store response range in plate metadata
    updatedPlate.metadata.globalMinResponse = minResponse;
    updatedPlate.metadata.globalMaxResponse = maxResponse;
    
    // Apply normalization if needed
    if (normalizationType === 'PctOfCtrl') {
      // TODO: Implement control-based normalization
      // For now, just copy raw to normalized
      for (const well of updatedPlate) {
        if (well && well.rawResponse !== null) {
          well.applyNormalizedResponse(well.rawResponse);
        }
      }
    } else {
      // No normalization - copy raw to normalized
      for (const well of updatedPlate) {
        if (well && well.rawResponse !== null) {
          well.applyNormalizedResponse(well.rawResponse);
        }
      }
    }
    
    updatedPlates.push(updatedPlate);
  }
  
  return { updatedPlates, errors };
}