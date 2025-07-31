import { utils, read, WorkSheet } from 'xlsx';
import { ControlDefinition, Protocol } from '../../../types/mapperTypes';
import { Plate, PlateSize } from '../../../classes/PlateClass';
import { getWellIdFromCoords, numberToLetters } from '../../EchoTransfer/utils/plateUtils';
import { getDestinationPlates } from './exportUtils';

export interface ParsedData {
  barcode: string;
  wellData: Map<string, number>;
}

export interface ParseResult {
  success: boolean;
  data?: ParsedData[];
  errors: string[];
}

interface NormalizationParams {
  maxCtrl?: number;
  minCtrl?: number;
  blank?: number;
}

//utility function used for testing
export function mapEquality(map1: Map<string, number>, map2: Map<string, number>) {
  const keys1 = [...map1.keys()];
  const keys2 = [...map2.keys()]

  if (keys1.length != keys2.length) return false;

  for (let key of keys1) { 
    if (map1.get(key) != map2.get(key)) {
      console.log(key)
      return false
    }
  }
  return true
}

export function hasResponseData(plates: any[]): boolean {
  const destinationPlates = getDestinationPlates(plates);
  return destinationPlates.some(plate =>
    Object.values(plate.getWells()).some((well: any) =>
      well && (well.rawResponse !== null || well.normalizedResponse !== null)
    )
  );
}

export function getPlatesWithResponseData(plates: any[]) {
  const destinationPlates = getDestinationPlates(plates);
  return destinationPlates.filter(plate =>
    Object.values(plate.getWells()).some((well: any) =>
      well && (well.rawResponse !== null || well.normalizedResponse !== null)
    )
  );
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
  
  let barcode = '';
  if (protocol.parseStrategy.plateBarcodeLocation === 'filename') {
    const filenameWithoutExtension = filename.replace(/\.[^/.]+$/, '');
    
    if (protocol.parseStrategy.barcodeDelimiter == null) {
      barcode = filenameWithoutExtension;
    } else {
      const delimiter = protocol.parseStrategy.barcodeDelimiter;
      const chunkIndex = protocol.parseStrategy.barcodeChunk ? protocol.parseStrategy.barcodeChunk - 1 : 0; //user inputs 1-indexed number; convert to 0 indexed number
      
      if (delimiter === '') {
        barcode = filenameWithoutExtension;
      } else {
        const chunks = filenameWithoutExtension.split(delimiter);
        
        if (chunkIndex < 0 || chunkIndex >= chunks.length) {
          errors.push(`Barcode chunk index ${chunkIndex} is out of range. Filename "${filenameWithoutExtension}" split by "${delimiter}" has ${chunks.length} chunks (0-${chunks.length - 1}).`);
          return { errors };
        }
        
        barcode = chunks[chunkIndex].trim();
        
        if (barcode === '') {
          errors.push(`Barcode chunk ${chunkIndex} is empty after splitting filename "${filenameWithoutExtension}" by delimiter "${delimiter}".`);
          return { errors };
        }
      }
    }
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
    const dataArr: (string | number)[][] = utils.sheet_to_json(sheet, {header: 1})
    let result = new Map<string, number>()
    if (protocol.parseStrategy.autoParse) {
      result = autoParseMatrixFile(dataArr, protocol.parseStrategy.plateSize)
    }
    else {
      result = parseExplicitRangeMatrixFile(sheet, protocol)
    }
    result.forEach((value, wellId) => wellData.set(wellId, value));
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

function parseExplicitRangeMatrixFile(sheet: WorkSheet, protocol: Protocol): Map<string, number> {
  const wellData = new Map<string, number>();
  
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
  else {
    for (let xIdx = 0; xIdx <= PLATE_CONFIGS[protocol.parseStrategy.plateSize].cols; xIdx++) {
      xLabels.push((xIdx+1).toString())
    }
  }
  
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
  else {
    for (let yIdx = 0; yIdx <= PLATE_CONFIGS[protocol.parseStrategy.plateSize].rows; yIdx++) {
      yLabels.push(numberToLetters(yIdx))
    }
  }
  
  const dataRange = utils.decode_range(protocol.parseStrategy.rawData);
  console.log(dataRange)
  console.log(protocol.parseStrategy.rawData)
  for (let row = dataRange.s.r; row <= dataRange.e.r; row++) {
    for (let col = dataRange.s.c; col <= dataRange.e.c; col++) {
      const cell = sheet[utils.encode_cell({ r: row, c: col })];
      if (cell && cell.v !== undefined && cell.v !== null && cell.v !== '') {
        const xIndex = col - dataRange.s.c;
        const yIndex = row - dataRange.s.r;
        
        let wellId = '';
        if (xLabels.length > xIndex && yLabels.length > yIndex) {
          const colNum = parseInt(xLabels[xIndex]);
          const rowLetter = yLabels[yIndex];
          if (!isNaN(colNum) && /^[A-Z]+$/.test(rowLetter)) {
            wellId = `${rowLetter}${colNum.toString().padStart(2, '0')}`;
          } else {
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
  
  return wellData;
}

function parseTableFormat(sheet: WorkSheet, protocol: Protocol): { wellData: Map<string, number>; errors: string[] } {
  const errors: string[] = [];
  const wellData = new Map<string, number>();
  
  const wellIDRange = protocol.parseStrategy.wellIDs ? utils.decode_range(protocol.parseStrategy.wellIDs) : null;
  const dataRange = utils.decode_range(protocol.parseStrategy.rawData);
  
  if (!wellIDRange) {
    errors.push('Well IDs range not specified for Table format');
    return { wellData, errors };
  }
  
  const wellIDRows = wellIDRange.e.r - wellIDRange.s.r + 1;
  const dataRows = dataRange.e.r - dataRange.s.r + 1;
  
  if (wellIDRows !== dataRows) {
    errors.push(`Well ID rows (${wellIDRows}) don't match data rows (${dataRows})`);
    return { wellData, errors };
  }
  
  for (let i = 0; i < wellIDRows; i++) {
    const wellIDCell = sheet[utils.encode_cell({ r: wellIDRange.s.r + i, c: wellIDRange.s.c })];
    const dataCell = sheet[utils.encode_cell({ r: dataRange.s.r + i, c: dataRange.s.c })];
    
    if (wellIDCell && wellIDCell.v && dataCell && dataCell.v !== undefined && dataCell.v !== null && dataCell.v !== '') {
      const wellId = String(wellIDCell.v);
      const value = parseFloat(String(dataCell.v));
      
      if (!isNaN(value)) {
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
  protocol: Protocol
): { updatedPlates: Plate[], errors: string[] } {
  const errors: string[] = [];
  let updatedPlates: Plate[] = [];
  
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
    
    const updatedPlate = plate.clone();
    
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
    
    updatedPlates.push(updatedPlate);
  }
  if (protocol.dataProcessing.normalization ===  'PctOfCtrl') {
    const {recalculatedPlates, errors: normError} = calculateNormalization(updatedPlates,protocol)
    updatedPlates = recalculatedPlates
    if (normError.length > 0) errors.push.apply(errors,normError)
  }
  
  return { updatedPlates, errors };
}

interface PlateInfo {
  rows: number;
  cols: number;
}

const PLATE_CONFIGS: Record<'12' | '24' | '48' | '96' | '384' | '1536', PlateInfo> = {
      '12': { rows: 3, cols: 4 },
      '24': { rows: 4, cols: 6 },
      '48': { rows: 6, cols: 8 },
      '96': { rows: 8, cols: 12 },
      '384': { rows: 16, cols: 24 },
      '1536': { rows: 32, cols: 48 }
};

/**
 * Interface representing a potential data matrix found within the file.
 * It stores the raw data, its location in the file, calculated score, and dimensions.
 * Flags are included to indicate the presence of header rows or columns.
 */
interface CandidateMatrix {
  data: (string | number)[][]; // Raw data, can contain strings (e.g., 'OVER', '-') or numbers
  startLine: number;           // The 0-indexed line number where this matrix block starts in the file
  endLine: number;             // The 0-indexed line number where this matrix block ends in the file
  score: number;               // The calculated score indicating how likely this is the target data
  rows: number;                // Actual number of rows found in this matrix
  cols: number;                // Actual number of columns found in this matrix
  hasHeaderRow: boolean;       // True if the first row is likely a header (e.g., column numbers)
  hasHeaderCol: boolean;       // True if the first column is likely a header (e.g., row letters)
}

/**
 * Scores a candidate matrix based on its content (numeric vs. string values) and its dimensions
 * relative to the expected plate size.
 * @param matrixData The 2D array of data representing the candidate matrix.
 * @param startLine The starting line number of the matrix in the original file.
 * @param endLine The ending line number of the matrix in the original file.
 * @param plateSize The expected plate size (96, 384, 1536).
 * @returns A CandidateMatrix object with an assigned score, or null if the matrix is invalid.
 */
function scoreMatrix(
  matrixData: (string | number)[][],
  startLine: number,
  endLine: number,
  plateSize: PlateSize
): CandidateMatrix | null {
  // A matrix must have at least two rows and two columns to be considered valid.
  if (matrixData.length < 2 || matrixData[0].length < 2) {
    return null;
  }

  const rows = matrixData.length;
  const cols = matrixData[0].length;

  // Basic validation: all rows must have the same number of columns.
  // If not, it's not a valid rectangular matrix.
  for (let row of matrixData) {
    if (row.length !== cols) {
      console.warn(`Skipping candidate matrix from line ${startLine} due to inconsistent column count. Expected ${cols}, got ${row.length}.`);
      return null;
    }
  }

  let numericCount = 0;
  let stringCount = 0;
  let otherCount = 0;

  // Count numeric and string values within the matrix.
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const value = matrixData[r][c];
      if (typeof value === 'number') {
        numericCount++;
      } else if (typeof value === 'string' && value.trim() !== '') {
        stringCount++;
      }
      else {
        otherCount++
      }
    }
  }

  let score = 0;

  const total = (numericCount + stringCount + otherCount)
  const typeScore = ((numericCount - otherCount)/total) * 1000
  score += typeScore

  // Dimension match scoring: Prioritize matrices whose dimensions are exact or common fractions
  // of the expected plate size.
  const expectedDims = PLATE_CONFIGS[plateSize];
  const expectedRows = expectedDims.rows;
  const expectedCols = expectedDims.cols;

  const dimensionScore = (rows / expectedRows) * (cols / expectedCols) * 1000;
  score += dimensionScore

  let hasHeaderRow = false;
  let hasHeaderCol = false;

  // Check for potential header row: The first row contains non-numeric values
  // (e.g., column numbers as strings, or labels) and the rest of the matrix data is predominantly numeric.
  if (rows > 0 && cols > 0) {
    const firstRowNonNumericCount = matrixData[0].filter(cell => typeof cell === 'string' && cell.trim() !== '').length;
    // Heuristic: If more than half the first row's cells are non-numeric strings, and the overall matrix is mostly numeric.
    if (firstRowNonNumericCount > (cols / 2) && numericCount > (rows * cols * 0.5)) {
      hasHeaderRow = true;
    }
  }

  // Check for potential header column: The first column contains non-numeric values
  // (e.g., row letters like 'A', 'B') and the rest of the matrix data is predominantly numeric.
  if (cols > 0 && rows > 0) {
    const firstColNonNumericCount = matrixData.filter(row => typeof row[0] === 'string' && row[0].trim() !== '').length;
    // Heuristic: If more than half the first column's cells are non-numeric strings, and the overall matrix is mostly numeric.
    if (firstColNonNumericCount > (rows / 2) && numericCount > (rows * cols * 0.5)) {
      hasHeaderCol = true;
    }
  }

  // Special case: If the top-left cell is empty/string, and the first row looks like numbers,
  // and the first column looks like letters, it's a strong header indicator.
  if (rows > 0 && cols > 0 && typeof matrixData[0][0] === 'string' && matrixData[0][0].trim() === '') {
    const firstRowLooksLikeNumbers = matrixData[0].slice(1).every(cell => typeof cell === 'number' || !isNaN(parseFloat(String(cell))));
    const firstColLooksLikeLetters = matrixData.slice(1).every(row => typeof row[0] === 'string' && /^[A-Z]$/i.test(row[0].trim()));
    if (firstRowLooksLikeNumbers && firstColLooksLikeLetters) {
      hasHeaderRow = true;
      hasHeaderCol = true;
    }
  }

  // Add a small bonus for detected headers, as they indicate structured data.
  if (hasHeaderRow) score += 50;
  if (hasHeaderCol) score += 50;

  return {
    data: matrixData,
    startLine,
    endLine,
    score,
    rows,
    cols,
    hasHeaderRow,
    hasHeaderCol,
  };
}

/**
 * Parses a raw instrument file to extract plate reader data.
 * It identifies potential data matrices, scores them, and returns the most likely one
 * as a Map of well IDs to numeric values.
 * @param dataArr The input data, either string or number, as an array of arrays
 * @param plateSize The expected plate size (96, 384, or 1536).
 * @returns A Map<string, number> where keys are well IDs (e.g., "A01")
 * and values are the corresponding numeric readings.
 * @throws An Error if no viable plate reader data matrix is found in the file.
 */
export function autoParseMatrixFile(
  dataArr: (string | number)[][],
  plateSize: PlateSize
): Map<string, number> {

  const candidateMatrices: CandidateMatrix[] = [];

  let currentMatrixData: (string | number)[][] = [];
  let currentMatrixStartLine = -1;
  let currentMatrixExpectedCols = -1;

  for (let i = 0; i < dataArr.length; i++) {
    const line = dataArr[i];

    if (line.length === 0) {
      if (currentMatrixData.length > 0) { // found the end of matrix, score it
        const candidate = scoreMatrix(currentMatrixData, currentMatrixStartLine, i - 1, plateSize);
        if (candidate) {
          candidateMatrices.push(candidate);
        }
        currentMatrixData = [];
        currentMatrixStartLine = -1;
        currentMatrixExpectedCols = -1;
      }
      continue;
    }

    // Heuristic: A line is likely part of a matrix if it contains numeric-like content
    // or potential well IDs (e.g., "A1", "B10").
    const hasNumericLikeContent = line.some(p => typeof p === 'number' || !isNaN(parseFloat(String(p))) || /^[A-Z]{1,2}\d{1,2}$/i.test(String(p)));

    if (currentMatrixStartLine === -1) {
      // If no matrix is currently being collected, check if this line could start one.
      // It needs numeric-like content and more than one column.
      if (hasNumericLikeContent && line.length > 1) {
        currentMatrixStartLine = i;
        currentMatrixExpectedCols = line.length;
        currentMatrixData.push(line);
      }
    } else {
      // If a matrix is already being collected, check if this line continues it.
      // It must have the same number of columns and still contain numeric-like content.
      if (line.length === currentMatrixExpectedCols && hasNumericLikeContent) {
        currentMatrixData.push(line);
      } else {
        // Column count mismatch or content change, signifies the end of the current matrix block.
        if (currentMatrixData.length > 0) {
          const candidate = scoreMatrix(currentMatrixData, currentMatrixStartLine, i - 1, plateSize);
          if (candidate) {
            candidateMatrices.push(candidate);
          }
        }
        // Reset and potentially start a new matrix with the current line.
        currentMatrixData = [];
        currentMatrixStartLine = -1;
        currentMatrixExpectedCols = -1;

        if (hasNumericLikeContent && line.length > 1) {
          currentMatrixStartLine = i;
          currentMatrixExpectedCols = line.length;
          currentMatrixData.push(line);
        }
      }
    }
  }

  // After the loop, check if there's any pending matrix data that needs to be scored.
  if (currentMatrixData.length > 0) {
    const candidate = scoreMatrix(currentMatrixData, currentMatrixStartLine, dataArr.length - 1, plateSize);
    if (candidate) {
      candidateMatrices.push(candidate);
    }
  }


  // Sort candidates by score in descending order to get the most likely matrix first.
  candidateMatrices.sort((a, b) => b.score - a.score);

  const bestMatrix = candidateMatrices[0];

  // Step 4: Convert the selected matrix into the final Map<string, number> format.
  const plateData = new Map<string, number>();

  // Determine the actual starting row and column for the data values,
  // accounting for any detected header rows or columns.
  const dataStartRow = bestMatrix.hasHeaderRow ? 1 : 0;
  const dataStartCol = bestMatrix.hasHeaderCol ? 1 : 0;

  // Iterate through the data cells, skipping headers, and map them to well IDs.
  for (let r = dataStartRow; r < bestMatrix.rows; r++) {
    for (let c = dataStartCol; c < bestMatrix.cols; c++) {
      const value = bestMatrix.data[r][c];
      // Only include numeric values in the final map.
      if (typeof value === 'number') {
        // Adjust row/column indices to be 0-indexed relative to the actual data block
        // (i.e., after removing any headers) for getWellIdFromCoords.
        const wellId = getWellIdFromCoords(r - dataStartRow, c - dataStartCol);
        plateData.set(wellId, value);
      }
    }
  }
  return plateData;
}

export function calculateNormalization(
  plates: Plate[], 
  protocol: Protocol,
  excludeWells?: Set<string> // Wells to exclude from control calculations (for masking)
): { recalculatedPlates: Plate[], errors: string[] } {
  const errors: string[] = [];
  const recalculatedPlates: Plate[] = [];
  
  for (const plate of plates) {
    const recalculatedPlate = plate.clone();
    
    if (protocol.dataProcessing.normalization === 'PctOfCtrl') {
      // Extract control values, excluding masked wells if specified
      const controlParams = extractControlValuesWithExclusions(
        recalculatedPlate, 
        protocol.dataProcessing.controls,
        excludeWells
      );
      
      // Validate we have the minimum required controls
      if (controlParams.maxCtrl === undefined && controlParams.minCtrl === undefined) {
        recalculatedPlates.push(recalculatedPlate);
        continue;
      }
      
      // Default to 0 if no MinCtrl is defined
      const minValue = controlParams.minCtrl ?? 0;
      
      // Use MaxCtrl if available, otherwise use the maximum raw response in the plate
      let maxValue = controlParams.maxCtrl;
      if (maxValue === undefined) {
        const allRawResponses = Object.values(recalculatedPlate.getWells())
          .filter(well => ((excludeWells && !excludeWells.has(well.id)) && well.rawResponse != null))
          .map(well => well.rawResponse as number)
          //.map(well => well.rawResponse)
          //.filter((well): well.response is number => response !== null && 
          //  (!excludeWells || !excludeWells.has(well.id)));
        
        if (allRawResponses.length > 0) {
          maxValue = Math.max(...allRawResponses);
        } else {
          maxValue = 100; // Default fallback
        }
      }
      
      const blankValue = controlParams.blank ?? 0;
      const range = maxValue - minValue;
      
      if (range <= 0) {
        errors.push(`Plate ${plate.barcode}: Invalid control range after recalculation (max: ${maxValue}, min: ${minValue})`);
      } else {
        for (const well of recalculatedPlate) {
          if (well && well.rawResponse !== null) {
            // Formula: ((raw - blank) - min) / (max - min) * 100
            const adjustedRaw = well.rawResponse - blankValue;
            const normalizedValue = ((adjustedRaw - minValue) / range) * 100;
            well.applyNormalizedResponse(normalizedValue);
          }
        }
      }
    }
    
    recalculatedPlates.push(recalculatedPlate);
  }
  
  return { recalculatedPlates, errors };
}

// Helper function for extracting control values with exclusions
function extractControlValuesWithExclusions(
  plate: Plate, 
  controls: ControlDefinition[],
  excludeWells?: Set<string>
): NormalizationParams {
  const params: NormalizationParams = {};
  
  for (const control of controls) {
    if (!control.wells) continue;
    
    try {
      const wells = plate.getSomeWells(control.wells);
      const responses = wells
        .filter(well => !excludeWells || !excludeWells.has(well.id)) // Exclude masked wells
        .map(well => well.rawResponse)
        .filter((response): response is number => response !== null);
      if (responses.length === 0) continue;
      
      // Calculate mean response for this control type
      const meanResponse = responses.reduce((sum, val) => sum + val, 0) / responses.length;
      
      switch (control.type) {
        case 'MaxCtrl':
          params.maxCtrl = meanResponse;
          break;
        case 'MinCtrl':
          params.minCtrl = meanResponse;
          break;
        case 'Blank':
          params.blank = meanResponse;
          break;
      }
    } catch (error) {
      console.warn(`Invalid well range for ${control.type}: ${control.wells}`, error);
    }
  }
  
  return params;
}