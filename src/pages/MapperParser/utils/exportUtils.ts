import { Plate } from '../../../classes/PlateClass';
import { Protocol } from '../../../types/mapperTypes';
import jsPDF from 'jspdf';

export interface CsvExportData {
  headers: string[];
  rows: string[][];
}

function generateDestinationPlatesCSV(
  destinationPlates: Plate[],
  protocol?: Protocol,
  includeEmptyWells: boolean = true
): CsvExportData {
  let maxContents = 0;
  let hasNormData = false;
  for (const plate of destinationPlates) {
    for (const well of plate) {
      if (well && (includeEmptyWells || well.getContents().length > 0)) {
        maxContents = Math.max(maxContents, well.getContents().length);
        if (well.normalizedResponse !== null) { hasNormData = true }
      }
    }
  }

  const headers: string[] = ['Barcode', 'Well ID'];

  for (let i = 0; i < maxContents; i++) {
    headers.push(`Compound ${i + 1} ID`);
    headers.push(`Compound ${i + 1} Concentration (µM)`);
  }

  headers.push('Raw Response');
  if (hasNormData) headers.push('Normalized Response')

  if (protocol) {
    for (const field of protocol.metadataFields) {
      headers.push(field.name);
    }
  }

  const rows: string[][] = [];

  for (const plate of destinationPlates) {
    // Sort wells by ID for consistent ordering
    const sortedWells = Object.values(plate.getWells())
      .filter(well => well && (includeEmptyWells || well.getContents().length > 0))
      .sort((a, b) => a.id.localeCompare(b.id));

    for (const well of sortedWells) {
      const row: string[] = [];

      row.push(plate.barcode);
      row.push(well.id);

      // Contents (only include compound contents, not solvents)
      const contents = well.getContents()
      for (let i = 0; i < maxContents; i++) {
        if (i < contents.length) {
          row.push(contents[i].compoundId || '');
          row.push(contents[i].concentration.toFixed(6));
        } else {
          row.push('');
          row.push('');
        }
      }
      row.push(well.rawResponse?.toString() || '');
      if (hasNormData) row.push((+well.normalizedResponse?.toFixed(4)!).toString() || '')

      if (protocol) {
        for (const field of protocol.metadataFields) {
          // Use metadata from plate, fallback to protocol default, then empty string
          const plateMetadataValue = plate.metadata[field.name];
          if (plateMetadataValue !== undefined) {
            row.push(plateMetadataValue.toString());
          } else if (field.defaultValue !== undefined) {
            row.push(field.defaultValue.toString());
          } else {
            row.push('');
          }
        }
      }

      rows.push(row);
    }
  }

  return { headers, rows };
}

function downloadCSV(csvData: CsvExportData, filename: string): void {
  const allRows = [csvData.headers, ...csvData.rows];
  const csvString = allRows.map(row =>
    row.map(cell => {
      const cellStr = cell.toString();
      // Escape cells that contain commas, quotes, or newlines
      if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
        return `"${cellStr.replace(/"/g, '""')}"`;
      }
      return cellStr;
    }).join(',')
  ).join('\n');
  // add a character at the start to tell Excel it's utf-8 encoding and avoid weird characters
  const blob = new Blob(['\uFEFF' + csvString], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');

  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

function generateCSVFilename(protocol?: Protocol): string {
  const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
  const protocolName = protocol?.name ? `_${protocol.name.replace(/[^a-zA-Z0-9]/g, '_')}` : '';
  return `destination_plates_results${protocolName}_${timestamp}.csv`;
}

/**
 * Main export function that combines all steps
 * @param plates Array of all plates (will filter to destination plates)
 * @param protocol Protocol for metadata fields
 * @param includeEmptyWells Whether to include wells with no compound contents
 * @param customFilename Custom filename (optional)
 */
export function exportDestinationPlatesCSV(
  plates: Plate[],
  protocol?: Protocol,
  includeEmptyWells: boolean = true,
  customFilename?: string
): void {
  const destinationPlates = getDestinationPlates(plates)

  if (destinationPlates.length === 0) {
    console.warn('No destination plates found for export');
    return;
  }

  const csvData = generateDestinationPlatesCSV(destinationPlates, protocol, includeEmptyWells);
  const filename = customFilename || generateCSVFilename(protocol);

  downloadCSV(csvData, filename);
}

export function getDestinationPlates(plates: Plate[]): Plate[] {
  return plates.filter(plate => plate.plateRole === 'destination');
}

type ExportOpts = {
  marginX?: number; // pts
  marginY?: number; // pts
  gapX?: number;    // pts between columns
  gapY?: number;    // pts between rows
  imageType?: "PNG" | "JPEG";
  jpegQuality?: number; // 0..1
};

export function pdfExport(
  bigCanvas: HTMLCanvasElement,           // result of single html2canvas(curvesNode, ...)
  curvesNode: HTMLDivElement,            // the container you rendered
  perRow: number,                        // graphs per row in the PDF
  opts: Partial<ExportOpts> = {}
) {
  const {
    marginX = 0,
    marginY = 0,
    gapX = 0,
    gapY = 0,
    imageType = "PNG"
  } = { ...opts };

  const pdf = new jsPDF("portrait", "pt", "letter");
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();

  // html2canvas scale compensation: canvas is scaled vs DOM css pixels
  const scaleX = bigCanvas.width / curvesNode.scrollWidth;
  const scaleY = bigCanvas.height / curvesNode.scrollHeight;

  // Tile width (pts) after margins/gaps, preserving aspect ratio per card
  const usableWidth = pdfWidth - 2 * marginX - (perRow - 1) * gapX;
  const cellWidthPt = usableWidth / perRow;

  const containerRect = curvesNode.getBoundingClientRect();
  const cards = Array.from(curvesNode.querySelectorAll(".card")) as HTMLElement[];
  if (!cards.length) return pdf;

  // Layout state
  let xPt = marginX;
  let yPt = marginY;
  let col = 0;
  let rowMaxHeightPt = 0;
  let gap = 0;
  gap = cards[1].getBoundingClientRect().left - cards[0].getBoundingClientRect().right

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];

    // Rect relative to container, then scale into bigCanvas coordinates
    const r = card.getBoundingClientRect();
    const relLeft = r.left - containerRect.left + curvesNode.scrollLeft ;
    const relTop = r.top - containerRect.top + curvesNode.scrollTop;

    const sx = (relLeft * scaleX);
    const sy = (relTop * scaleY);
    const sw = (r.width * scaleX);
    const sh = (r.height * scaleY);

    // Crop from the big canvas into a small offscreen canvas (no dataURL conversion needed)
    const tile = document.createElement("canvas");
    tile.width = sw;
    tile.height = sh;
    const tctx = tile.getContext("2d")!;
    tctx.drawImage(bigCanvas,sx,sy,sw,sh,0,0,sw,sh)
    document.body.appendChild(tile)
    const br = document.createElement("br")
    document.body.appendChild(br)

    // Preserve aspect ratio: compute target height in pts from width in pts
    //const aspect = r.height / r.width;
    const aspect = sh/sw
    const cellHeightPt = cellWidthPt * aspect;

    // Page break if this row’s next tile won’t fit vertically
    if (yPt + cellHeightPt > pdfHeight - marginY + 0.001) {
      pdf.addPage();
      xPt = marginX;
      yPt = marginY;
      col = 0;
      rowMaxHeightPt = 0;
    }

    // Place the image
    // jsPDF accepts HTMLCanvasElement directly (faster than toDataURL)
    pdf.addImage(tile, imageType, xPt, yPt, cellWidthPt, cellHeightPt, undefined, undefined, 0);

    // Advance layout
    rowMaxHeightPt = Math.max(rowMaxHeightPt, cellHeightPt);
    col++;

    if (col < perRow) {
      xPt += cellWidthPt + gapX;
    } else {
      // new row
      xPt = marginX;
      yPt += rowMaxHeightPt + gapY;
      col = 0;
      rowMaxHeightPt = 0;
    }
  }

  return pdf;
}