import { getWellIdFromCoords } from '../../EchoTransfer/utils/plateUtils';

interface MatrixCandidate {
  data: (string | number)[][];
  startRow: number;
  startCol: number;
  rows: number;
  cols: number;
  score: number;
}

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
 * Main function to parse and extract plate reader data
 * @param file - The uploaded file containing plate reader data
 * @param plateSize - Expected plate size (96, 384, or 1536)
 * @param getWellIdFromCoords - Function to convert row/col coordinates to well ID
 * @returns Map of well IDs to numeric values
 */
export  function parseAndExtractPlateData(
  dataArr: (string | number)[][],
  plateSize: 96 | 384 | 1536
): Map<string, number> {
  try {
    
    const expectedDims = PLATE_CONFIGS[plateSize];
    
    const candidates = findMatrixCandidates(dataArr, expectedDims);
    
    if (candidates.length === 0) {
      throw new Error('No viable data matrices found in file');
    }
    
    const bestCandidate = selectBestCandidate(candidates, expectedDims);
    
    return convertToWellMap(bestCandidate, getWellIdFromCoords);
    
  } catch (error) {
    throw new Error(`Failed to parse plate reader data: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Find all potential rectangular matrices in the grid
 */
function findMatrixCandidates(grid: (string | number)[][], expectedDims: PlateInfo): MatrixCandidate[] {
  const candidates: MatrixCandidate[] = [];
  const minRows = Math.min(4, expectedDims.rows / 2); // At least 4 rows or half expected
  const minCols = Math.min(6, expectedDims.cols / 2); // At least 6 cols or half expected
  
  for (let startRow = 0; startRow < grid.length; startRow++) {
    for (let startCol = 0; startCol < (grid[startRow]?.length || 0); startCol++) {
      
      // Try different matrix sizes starting from this position
      const maxRows = Math.min(expectedDims.rows * 2, grid.length - startRow);
      const maxCols = Math.min(expectedDims.cols * 2, 
        Math.max(...grid.slice(startRow, startRow + maxRows).map(row => row.length)) - startCol);
      
      for (let rows = minRows; rows <= maxRows; rows++) {
        for (let cols = minCols; cols <= maxCols; cols++) {
          const candidate = extractMatrix(grid, startRow, startCol, rows, cols);
          if (candidate && isViableMatrix(candidate)) {
            candidates.push(candidate);
          }
        }
      }
    }
  }
  
  return candidates;
}

/**
 * Extract a matrix from the grid at specified position and size
 */
function extractMatrix(
  grid: (string | number)[][],
  startRow: number,
  startCol: number,
  rows: number,
  cols: number
): MatrixCandidate | null {
  try {
    const data: (string | number)[][] = [];
    
    for (let r = 0; r < rows; r++) {
      const gridRow = grid[startRow + r];
      if (!gridRow || gridRow.length <= startCol) {
        return null; // Row doesn't exist or too short
      }
      
      const row: (string | number)[] = [];
      for (let c = 0; c < cols; c++) {
        const cell = gridRow[startCol + c];
        if (!cell) {
          return null; // Cell doesn't exist
        }
        row.push(cell);
      }
      data.push(row);
    }
    
    return {
      data,
      startRow,
      startCol,
      rows,
      cols,
      score: 0 // Will be calculated separately
    };
  } catch {
    return null;
  }
}

/**
 * Check if a matrix candidate is viable (basic sanity checks)
 */
function isViableMatrix(candidate: MatrixCandidate): boolean {
  const { data, rows, cols } = candidate;
  
  // Check dimensions
  if (data.length !== rows || data.some(row => row.length !== cols)) {
    return false;
  }
  
  // Check for minimum numeric content
  const totalCells = rows * cols;
  let numericCells = 0;
  
  for (const row of data) {
    for (const cell of row) {
      if (typeof cell === 'number') {
        numericCells++;
      }
    }
  }
  
  // At least 30% of cells should be numeric for a viable matrix
  return (numericCells / totalCells) >= 0.3;
}

/**
 * Score a matrix candidate based on multiple criteria
 */
function scoreMatrix(candidate: MatrixCandidate, expectedDims: PlateInfo): number {
  const { data, rows, cols } = candidate;
  let score = 0;
  
  // 1. Dimension scoring (higher score for closer match to expected)
  const rowRatio = Math.min(rows / expectedDims.rows, expectedDims.rows / rows);
  const colRatio = Math.min(cols / expectedDims.cols, expectedDims.cols / cols);
  score += (rowRatio + colRatio) * 50; // Max 100 points
  
  // 2. Perfect dimension match bonus
  if (rows === expectedDims.rows && cols === expectedDims.cols) {
    score += 50;
  } else if (rows <= expectedDims.rows && cols <= expectedDims.cols) {
    // Bonus for being within expected dimensions (partial plate)
    score += 25;
  }
  
  // 3. Numeric content scoring
  const totalCells = rows * cols;
  let numericCells = 0;
  let validNumericCells = 0;
  let positiveValues = 0;
  
  for (const row of data) {
    for (const cell of row) {
      if (typeof cell === 'number') {
        numericCells++;
        if (cell >= 0) {
          validNumericCells++;
          if (cell > 0) positiveValues++;
        }
      }
    }
  }
  
  const numericRatio = numericCells / totalCells;
  score += numericRatio * 100; // Max 100 points for all numeric
  
  // 4. Bonus for reasonable data values (positive numbers are common in plate readers)
  if (validNumericCells > 0) {
    const positiveRatio = positiveValues / validNumericCells;
    score += positiveRatio * 25; // Max 25 points
  }
  
  // 5. Penalty for non-standard shapes (prefer rectangular)
  if (rows > 0 && cols > 0) {
    const aspectRatio = Math.max(rows / cols, cols / rows);
    if (aspectRatio > 3) {
      score -= 20; // Penalty for very elongated matrices
    }
  }
  
  // 6. Size preference (prefer larger matrices, but not too large)
  const sizeScore = Math.min(totalCells / (expectedDims.rows * expectedDims.cols), 1) * 20;
  score += sizeScore;
  
  return Math.max(0, score);
}

/**
 * Select the best candidate from scored candidates
 */
function selectBestCandidate(candidates: MatrixCandidate[], expectedDims: PlateInfo): MatrixCandidate {
  const scoredCandidates = candidates.map(candidate => ({
    ...candidate,
    score: scoreMatrix(candidate, expectedDims)
  }));
  
  // Sort by score (highest first)
  scoredCandidates.sort((a, b) => b.score - a.score);
  
  if (scoredCandidates.length === 0) {
    throw new Error('No viable matrix candidates found');
  }
  
  return scoredCandidates[0];
}

/**
 * Convert matrix candidate to well ID map
 */
function convertToWellMap(
  candidate: MatrixCandidate,
  getWellIdFromCoords: (row: number, col: number) => string
): Map<string, number> {
  const wellMap = new Map<string, number>();
  
  for (let row = 0; row < candidate.rows; row++) {
    for (let col = 0; col < candidate.cols; col++) {
      const value = candidate.data[row][col];
      
      // Only include numeric values
      if (typeof value === 'number') {
        const wellId = getWellIdFromCoords(row, col);
        wellMap.set(wellId, value);
      }
    }
  }
  
  return wellMap;
}