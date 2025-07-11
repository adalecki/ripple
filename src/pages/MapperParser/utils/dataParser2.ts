import { getWellIdFromCoords } from '../../EchoTransfer/utils/plateUtils';

type MatrixCandidate = {
  startLine: number;
  endLine: number;
  numRows: number;
  numCols: number;
  values: (number | null)[][];
  score: number;
};

function parseMatrixBlock(block: (string | number)[][]): (number | null)[][] {
  return block.map(row => row.map(cell => {
    return typeof(cell) != 'number' ? null : cell;
  }));
}

function scoreMatrix(matrix: (number | null)[][], expectedRows: number, expectedCols: number): number {
  let score = 0;
  const rowCount = matrix.length;
  const colCounts = matrix.map(row => row.length);

  if (expectedRows && expectedCols) {
    const rowDiff = Math.abs(rowCount - expectedRows);
    const colDiff = Math.abs(Math.max(...colCounts) - expectedCols);
    score -= (rowDiff + colDiff) * 10;
  }

  for (const row of matrix) {
    for (const val of row) {
      if (val === null) {
        score -= 1;
      } else {
        score += 2;
      }
    }
  }

  return score;
}

function findMatrixCandidates(data: (string | number)[][], expectedRows: number, expectedCols: number): MatrixCandidate[] {
  const candidates: MatrixCandidate[] = [];

  for (let i = 0; i < data.length; i++) {
    for (let j = i + 1; j <= Math.min(i + expectedRows * 2, data.length); j++) {
      const block = data.slice(i, j);
      if (block.length < 2) continue;

      const colSizes = block.map(row => row.length);
      const medianCols = [...colSizes].sort((a, b) => a - b)[Math.floor(colSizes.length / 2)];
      const isMatrixLike = colSizes.every(n => Math.abs(n - medianCols) <= 2);

      if (isMatrixLike && medianCols >= 6) {
        const numericBlock = parseMatrixBlock(block);
        const score = scoreMatrix(numericBlock, expectedRows, expectedCols);
        candidates.push({
          startLine: i,
          endLine: j,
          numRows: block.length,
          numCols: medianCols,
          values: numericBlock,
          score
        });
      }
    }
  }

  return candidates.sort((a, b) => b.score - a.score);
}

export function extractPlateMatrix(
  dataArr: (string | number)[][],
  plateSize: number
): Map<string, number> {

  let expectedRows = 0;
  let expectedCols = 0;

  switch (plateSize) {
    case 96:
      expectedRows = 8;
      expectedCols = 12;
      break;
    case 384:
      expectedRows = 16;
      expectedCols = 24;
      break;
    case 1536:
      expectedRows = 32;
      expectedCols = 48;
      break;
  }

  const candidates = findMatrixCandidates(dataArr, expectedRows, expectedCols);
  const best = candidates[0];

  if (!best) throw new Error('No viable matrix found in file.');

  const result = new Map<string, number>();

  for (let row = 0; row < best.values.length; row++) {
    const rowData = best.values[row];
    for (let col = 0; col < rowData.length; col++) {
      const val = rowData[col];
      if (typeof val === 'number') {
        const well = getWellIdFromCoords(row, col);
        result.set(well, val);
      }
    }
  }

  return result;
}
