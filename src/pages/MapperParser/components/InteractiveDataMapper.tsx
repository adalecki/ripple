import React, { useState } from 'react';
import { Modal, Button, Form, Table, Alert } from 'react-bootstrap';
import { ParseStrategy } from '../../../types/mapperTypes';

import '../../../css/InteractiveDataMapper.css';

interface InteractiveDataMapperProps {
  show: boolean;
  onHide: () => void;
  currentParseStrategy: Partial<ParseStrategy>;
  onConfirm: (newStrategyRanges: Partial<ParseStrategy>) => void;
}

type CellAddress = { row: number; col: number };
type SelectionRange = { start: CellAddress | null; end: CellAddress | null };

const InteractiveDataMapper: React.FC<InteractiveDataMapperProps> = ({
  show,
  onHide,
  currentParseStrategy,
  onConfirm
}) => {
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<string[][]>([]);
  const [error, setError] = useState<string | null>(null);

  const [selection, setSelection] = useState<SelectionRange>({ start: null, end: null });
  const [isSelecting, setIsSelecting] = useState(false);

  // State for the ranges defined by the user
  const [definedRanges, setDefinedRanges] = useState<Partial<ParseStrategy>>({});

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        setFileContent(text);
        parseFileContent(text);
        setError(null);
        // Reset selections when new file is loaded
        setSelection({ start: null, end: null });
        setDefinedRanges(currentParseStrategy || {});
      };
      reader.onerror = () => {
        setError('Error reading file.');
        setFileContent(null);
        setParsedData([]);
      };
      reader.readAsText(file);
    }
  };

  function parseFileContent(content: string) {
    // Basic parsing: split by lines, then by tabs.
    // More sophisticated parsing might be needed for CSVs or other delimiters.
    const lines = content.split(/\r?\n/);
    const data = lines.map(line => line.split('\t')); // Assuming tab-separated for now
    setParsedData(data);
  };

  function getA1Notation(cell1: CellAddress, cell2: CellAddress): string {
    const colToLetter = (col: number): string => {
      let temp, letter = '';
      while (col >= 0) {
        temp = col % 26;
        letter = String.fromCharCode(temp + 65) + letter;
        col = Math.floor(col / 26) - 1;
      }
      return letter;
    };

    const minRow = Math.min(cell1.row, cell2.row);
    const maxRow = Math.max(cell1.row, cell2.row);
    const minCol = Math.min(cell1.col, cell2.col);
    const maxCol = Math.max(cell1.col, cell2.col);

    const startCell = `${colToLetter(minCol)}${minRow + 1}`;
    const endCell = `${colToLetter(maxCol)}${maxRow + 1}`;

    if (startCell === endCell) return startCell;
    return `${startCell}:${endCell}`;
  };


  const handleCellClick = (row: number, col: number) => {
    if (!isSelecting) {
      setSelection({ start: { row, col }, end: { row, col } });
      setIsSelecting(true);
    } else {
      setSelection(prev => ({ ...prev, end: { row, col } }));
      setIsSelecting(false);
    }
  };

  function isCellSelected(row: number, col: number): boolean {
    if (!selection.start || !selection.end) return false;
    const minRow = Math.min(selection.start.row, selection.end.row);
    const maxRow = Math.max(selection.start.row, selection.end.row);
    const minCol = Math.min(selection.start.col, selection.end.col);
    const maxCol = Math.max(selection.start.col, selection.end.col);
    return row >= minRow && row <= maxRow && col >= minCol && col <= maxCol;
  };
  function isCellInRange(row: number, col: number, rangeStr: string | undefined): boolean {
    if (!rangeStr) return false;
    // This is a simplified parser for A1 notation. A robust one would be more complex.
    try {
      const parts = rangeStr.split(':');
      const parseCell = (cellStr: string): CellAddress => {
        const colLetters = cellStr.match(/[A-Z]+/)?.[0] || '';
        const rowDigits = cellStr.match(/[0-9]+/)?.[0] || '';
        let colNum = -1;
        for (let i = 0; i < colLetters.length; i++) {
          colNum = (colNum + 1) * 26 + colLetters.charCodeAt(i) - 65;
        }
        return { row: parseInt(rowDigits, 10) - 1, col: colNum };
      };

      const startCell = parseCell(parts[0]);
      const endCell = parts.length > 1 ? parseCell(parts[1]) : startCell;

      const minRow = Math.min(startCell.row, endCell.row);
      const maxRow = Math.max(startCell.row, endCell.row);
      const minCol = Math.min(startCell.col, endCell.col);
      const maxCol = Math.max(startCell.col, endCell.col);

      return row >= minRow && row <= maxRow && col >= minCol && col <= maxCol;

    } catch (e) {
      // console.warn("Could not parse range string:", rangeStr, e);
      return false;
    }
  };

  function getCellClass(rowIndex: number, colIndex: number) {
    let className = '';
    if (isSelecting && selection.start && selection.start.row === rowIndex && selection.start.col === colIndex) {
      className += ' cell-selection-start';
    }
    if (isCellSelected(rowIndex, colIndex)) {
      className += ' cell-selected';
    }
    if (isCellInRange(rowIndex, colIndex, definedRanges.rawData)) className += ' range-raw-data';
    if (isCellInRange(rowIndex, colIndex, definedRanges.xLabels)) className += ' range-x-labels';
    if (isCellInRange(rowIndex, colIndex, definedRanges.yLabels)) className += ' range-y-labels';
    if (isCellInRange(rowIndex, colIndex, definedRanges.wellIDs)) className += ' range-well-ids';
    if (isCellInRange(rowIndex, colIndex, definedRanges.plateBarcodeCell)) className += ' range-barcode-cell';
    return className.trim();
  };


  function assignSelection(type: keyof ParseStrategy) {
    if (selection.start && selection.end) {
      const rangeStr = getA1Notation(selection.start, selection.end);
      setDefinedRanges(prev => ({ ...prev, [type]: rangeStr }));
      setSelection({ start: null, end: null });
      setIsSelecting(false);
    }
  };

  const handleConfirm = () => {
    onConfirm(definedRanges);
    onHide();
  };

  const currentSelectionA1 = selection.start && selection.end ? getA1Notation(selection.start, selection.end) : 'None';

  // Reset state when modal is hidden (closed without confirm)
  const handleExited = () => {
    setFileContent(null);
    setParsedData([]);
    setError(null);
    setSelection({ start: null, end: null });
    setIsSelecting(false);
    setDefinedRanges({});
  };

  // Load current strategy when modal is shown
  React.useEffect(() => {
    if (show) {
      setDefinedRanges(currentParseStrategy || {});
    }
  }, [show, currentParseStrategy]);

  function detectDataMatrix(data: string[][]): { range: string; startRow: number; startCol: number; endRow: number; endCol: number; } | null {
    if (!data.length) return null;

    let bestBlock = { startRow: -1, endRow: -1, startCol: -1, endCol: -1, numRows: 0, numCols: 0, density: 0 };

    const isNumeric = (val: string) => val && !isNaN(parseFloat(val)) && isFinite(Number(val));
    const MIN_NUMERIC_PERCENT = 0.6; // At least 60% of cells in a data row should look numeric
    const MIN_COLS_IN_MATRIX = 4;
    const MIN_ROWS_IN_MATRIX = 4;

    for (let r = 0; r < data.length; r++) {
      let firstNonEmptyCol = -1;
      let lastNonEmptyCol = -1;
      let numericCells = 0;
      let totalNonEmptyCells = 0;

      for (let c = 0; c < data[r].length; c++) {
        if (data[r][c] && data[r][c].trim() !== '') {
          if (firstNonEmptyCol === -1) firstNonEmptyCol = c;
          lastNonEmptyCol = c;
          totalNonEmptyCells++;
          if (isNumeric(data[r][c])) {
            numericCells++;
          }
        }
      }

      if (totalNonEmptyCells > 0 && (numericCells / totalNonEmptyCells >= MIN_NUMERIC_PERCENT) && (lastNonEmptyCol - firstNonEmptyCol + 1 >= MIN_COLS_IN_MATRIX)) {
        // This row looks like a data row
        let currentBlockStartRow = r;
        let currentBlockEndRow = r;
        let blockFirstCol = firstNonEmptyCol;
        let blockLastCol = lastNonEmptyCol;
        let blockNumericCells = numericCells;
        let blockTotalCells = (lastNonEmptyCol - firstNonEmptyCol + 1);

        // Try to extend downwards
        for (let r2 = r + 1; r2 < data.length; r2++) {
          let nextRowNumericCells = 0;
          let nextRowTotalNonEmpty = 0;
          let nextRowFirstCol = -1;
          let nextRowLastCol = -1;

          for (let c2 = 0; c2 < data[r2].length; c2++) {
            if (data[r2][c2] && data[r2][c2].trim() !== '') {
              if (nextRowFirstCol === -1) nextRowFirstCol = c2;
              nextRowLastCol = c2;
              nextRowTotalNonEmpty++;
              if (isNumeric(data[r2][c2])) {
                nextRowNumericCells++;
              }
            }
          }

          // Check if this row is similar enough (numeric ratio and within column bounds)
          const colOverlap = Math.min(blockLastCol, nextRowLastCol) - Math.max(blockFirstCol, nextRowFirstCol) + 1;
          if (nextRowTotalNonEmpty > 0 && (nextRowNumericCells / nextRowTotalNonEmpty >= MIN_NUMERIC_PERCENT) && (nextRowLastCol - nextRowFirstCol + 1 >= MIN_COLS_IN_MATRIX) && colOverlap > 0) {
            currentBlockEndRow = r2;
            blockFirstCol = Math.min(blockFirstCol, nextRowFirstCol); // Expand columns to fit all data rows
            blockLastCol = Math.max(blockLastCol, nextRowLastCol);
            blockNumericCells += nextRowNumericCells;
            blockTotalCells += (nextRowLastCol - nextRowFirstCol + 1); // Count cells in the current row's identified range
          } else {
            break; // End of contiguous data-like block
          }
        }

        const numRows = currentBlockEndRow - currentBlockStartRow + 1;
        const numCols = blockLastCol - blockFirstCol + 1;
        const density = blockNumericCells / (numRows * numCols); // blockTotalCells;

        // Simple scoring: prefer larger blocks, higher density.
        // Weighting for proximity to "Background Information" or "Plate Information"
        let score = (numRows * numCols) * density;


        if (numRows >= MIN_ROWS_IN_MATRIX && numCols >= MIN_COLS_IN_MATRIX && score > (bestBlock.numRows * bestBlock.numCols * bestBlock.density)) {
          bestBlock = { startRow: currentBlockStartRow, endRow: currentBlockEndRow, startCol: blockFirstCol, endCol: blockLastCol, numRows, numCols, density };
        }
        r = currentBlockEndRow; // Continue search after this block
      }
    }

    // In the example, the actual data starts 2 rows after "Background information" in one instance, and 1 row after "Plate Information" header section
    // This is very specific. A more general heuristic: if we found a block AND "Background Information",
    // and the block is just before "Background Information", it's likely the one.
    // The example data has two "Background information" sections, one above and one below the main data block.
    // The data we want is the one *before* the first "Background information" if "Plate Information" is also present above.
    // Or it's the large numeric block.

    if (bestBlock.startRow !== -1) {
      // Check if the row above the detected block looks like a header (non-numeric, but cells align with data)
      // This could refine startRow and potentially identify xLabels
      if (bestBlock.startRow > 0) {
        const potentialHeaderRow = data[bestBlock.startRow - 1];
        let headerNonNumericCount = 0;
        let headerCellCount = 0;
        for (let c = bestBlock.startCol; c <= bestBlock.endCol; c++) {
          if (potentialHeaderRow[c] && potentialHeaderRow[c].trim() !== '') {
            headerCellCount++;
            if (!isNumeric(potentialHeaderRow[c])) {
              headerNonNumericCount++;
            }
          }
        }
        // If the row above is mostly non-numeric and aligns with data columns, consider it a header
        if (headerCellCount > 0 && (headerNonNumericCount / headerCellCount) > 0.8 && headerCellCount >= MIN_COLS_IN_MATRIX * 0.75) {
          // Tentatively set xLabels, user can override
          // setDefinedRanges(prev => ({ ...prev, xLabels: getA1Notation({row: bestBlock.startRow - 1, col: bestBlock.startCol}, {row: bestBlock.startRow - 1, col: bestBlock.endCol}) }));
        }
      }
      // Check if the column to the left of the detected block looks like a header (non-numeric)
      // This could refine startCol and potentially identify yLabels
      if (bestBlock.startCol > 0) {
        let yLabelNonNumericCount = 0;
        let yLabelCellCount = 0;
        for (let r = bestBlock.startRow; r <= bestBlock.endRow; r++) {
          if (data[r] && data[r][bestBlock.startCol - 1] && data[r][bestBlock.startCol - 1].trim() !== '') {
            yLabelCellCount++;
            if (!isNumeric(data[r][bestBlock.startCol - 1])) {
              yLabelNonNumericCount++;
            }
          }
        }
        if (yLabelCellCount > 0 && (yLabelNonNumericCount / yLabelCellCount) > 0.8 && yLabelCellCount >= MIN_ROWS_IN_MATRIX * 0.75) {
          // Tentatively set yLabels
          // setDefinedRanges(prev => ({ ...prev, yLabels: getA1Notation({row: bestBlock.startRow, col: bestBlock.startCol -1 }, {row: bestBlock.endRow, col: bestBlock.startCol -1}) }));
        }
      }


      return {
        range: getA1Notation({ row: bestBlock.startRow, col: bestBlock.startCol }, { row: bestBlock.endRow, col: bestBlock.endCol }),
        startRow: bestBlock.startRow,
        startCol: bestBlock.startCol,
        endRow: bestBlock.endRow,
        endCol: bestBlock.endCol
      };
    }

    return null;
  };

  const handleAutoDetectDataMatrix = () => {
    const detected = detectDataMatrix(parsedData);
    if (detected) {
      setDefinedRanges(prev => ({ ...prev, rawData: detected.range }));
      // Optionally, also set selection to highlight it
      setSelection({
        start: { row: detected.startRow, col: detected.startCol },
        end: { row: detected.endRow, col: detected.endCol }
      });
      setIsSelecting(false); // Finalize selection
      setError(null);
    } else {
      setError("Could not automatically detect a data matrix. Please select manually.");
    }
  };

  const numColumns = parsedData.length > 0 ? parsedData.slice().sort((a, b) => b.length - a.length)[0].length : 0
  return (
    <Modal show={show} onHide={onHide} dialogClassName="interactive-data-mapper-modal" onExited={handleExited} size="xl">
      <Modal.Header closeButton>
        <Modal.Title>Interactive Data Mapper</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form.Group controlId="formFile" className="mb-3">
          <Form.Label>Upload Data File (tab-separated text or CSV)</Form.Label>
          <Form.Control type="file" onChange={handleFileChange} accept=".txt,.csv,.tsv" />
        </Form.Group>

        {error && <Alert variant="danger">{error}</Alert>}

        {fileContent && (
          <>
            <div className="controls-toolbar mb-2 p-2 border rounded">
              <h6>Define Ranges</h6>
              <p>Current Selection: <strong>{currentSelectionA1}</strong> {isSelecting && <span className="text-primary">(Click end cell)</span>}</p>
              <div className="d-flex flex-wrap gap-2">
                <Button size="sm" variant="outline-primary" onClick={() => assignSelection('rawData')} disabled={!selection.start || !selection.end}>
                  Set as Raw Data ({definedRanges.rawData || 'Not set'})
                </Button>
                {currentParseStrategy.format == 'Matrix' ?
                  <>
                    <Button size="sm" variant="outline-secondary" onClick={() => assignSelection('xLabels')} disabled={!selection.start || !selection.end}>
                      Set as X Labels ({definedRanges.xLabels || 'Not set'})
                    </Button>
                    <Button size="sm" variant="outline-secondary" onClick={() => assignSelection('yLabels')} disabled={!selection.start || !selection.end}>
                      Set as Y Labels ({definedRanges.yLabels || 'Not set'})
                    </Button>
                  </> :
                  <Button size="sm" variant="outline-secondary" onClick={() => assignSelection('wellIDs')} disabled={!selection.start || !selection.end}>
                    Set as Well IDs ({definedRanges.wellIDs || 'Not set'})
                  </Button>
                }


                {currentParseStrategy.plateBarcodeLocation == 'cell' ? <Button size="sm" variant="outline-info" onClick={() => assignSelection('plateBarcodeCell')} disabled={!selection.start || !selection.end}>
                  Set as Barcode Cell ({definedRanges.plateBarcodeCell || 'Not set'})
                </Button> : ''}
              </div>
              <Button
                size="sm"
                variant="outline-success"
                className="mt-2"
                onClick={handleAutoDetectDataMatrix}
                disabled={!parsedData.length}
              >
                Auto-detect Data Matrix
              </Button>
            </div>

            <div className="data-grid-container">
              <Table bordered hover size="sm" className="data-grid">
                <thead>
                  <tr>
                    <th></th>
                    {[...Array(numColumns)].map((_, colIndex) => (
                      <th key={`header-${colIndex}`}>{getA1Notation({ row: 0, col: colIndex }, { row: 0, col: colIndex }).match(/[A-Z]+/)?.[0]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsedData.map((row, rowIndex) => (
                    <tr key={`row-${rowIndex}`}>
                      <td>{rowIndex + 1}</td>
                      {[...Array(numColumns)].map((_, colIndex) => (
                        <td
                          key={`cell-${rowIndex}-${colIndex}`}
                          className={getCellClass(rowIndex, colIndex)}
                          onClick={() => handleCellClick(rowIndex, colIndex)}
                          title={`Cell: ${getA1Notation({ row: rowIndex, col: colIndex }, { row: rowIndex, col: colIndex })}\nValue: ${(row[colIndex] ? row[colIndex] : '')}`}
                        >
                          {row[colIndex] ? row[colIndex] : ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleConfirm} disabled={Object.keys(definedRanges).length === 0 && !currentParseStrategy?.rawData}>
          Confirm Ranges
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default InteractiveDataMapper;
