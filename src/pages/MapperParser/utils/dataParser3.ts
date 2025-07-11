import { getWellIdFromCoords } from '../../EchoTransfer/utils/plateUtils';

type PlateSize = 96 | 384 | 1536
interface PlateInfo {
  rows: number;
  cols: number;
}

const PLATE_CONFIGS: Record<96 | 384 | 1536, PlateInfo> = {
  96: { rows: 8, cols: 12 },
  384: { rows: 16, cols: 24 },
  1536: { rows: 32, cols: 48 }
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
export function parsePlateReaderData(
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