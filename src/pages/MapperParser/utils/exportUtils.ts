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
    const sortedWells = Object.values(plate.getWells())
      .filter(well => well && (includeEmptyWells || well.getContents().length > 0))
      .sort((a, b) => a.id.localeCompare(b.id));

    for (const well of sortedWells) {
      const row: string[] = [];

      row.push(plate.barcode);
      row.push(well.id);

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
      if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
        return `"${cellStr.replace(/"/g, '""')}"`;
      }
      return cellStr;
    }).join(',')
  ).join('\n');
  //add a character at the start to tell Excel it's utf-8 encoding and avoid weird characters
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
  const timestamp = new Date().toISOString().split('T')[0];
  const protocolName = protocol?.name ? `_${protocol.name.replace(/[^a-zA-Z0-9]/g, '_')}` : '';
  return `destination_plates_results${protocolName}_${timestamp}.csv`;
}

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
  marginX?: number;
  marginY?: number;
  gapX?: number;
  gapY?: number;
  imageType?: "PNG" | "JPEG";
};

export function pdfExport(
  bigCanvas: HTMLCanvasElement,
  curvesNode: HTMLDivElement,
  perRow: number,
  opts: Partial<ExportOpts> = {}
) {
  const {
    marginX = 0,
    marginY = 0,
    gapX = 0,
    gapY = 0,
    imageType = "JPEG"
  } = { ...opts };

  const pdf = new jsPDF("portrait", "pt", "letter");
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();

  const containerWidth = curvesNode.scrollWidth;
  const containerHeight = curvesNode.scrollHeight;
  const scaleX = bigCanvas.width / containerWidth;
  const scaleY = bigCanvas.height / containerHeight;

  const usableWidth = pdfWidth - 2 * marginX - (perRow - 1) * gapX;
  const cellWidthPt = usableWidth / perRow;

  const cards = Array.from(curvesNode.querySelectorAll(".card")) as HTMLElement[];
  if (!cards.length) return pdf;

  const containerRect = curvesNode.getBoundingClientRect();

  let xPt = marginX;
  let yPt = marginY;
  let col = 0;
  let rowMaxHeightPt = 0;

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const cardRect = card.getBoundingClientRect();

    const relativeLeft = cardRect.left - containerRect.left + curvesNode.scrollLeft;
    const relativeTop = cardRect.top - containerRect.top + curvesNode.scrollTop;

    const canvasX = relativeLeft * scaleX;
    const canvasY = relativeTop * scaleY;
    const cardWidth = cardRect.width * scaleX;
    const cardHeight = cardRect.height * scaleY;

    const tile = document.createElement("canvas");
    tile.width = cardWidth;
    tile.height = cardHeight;
    const tileCtx = tile.getContext("2d")!;
    
    tileCtx.drawImage(
      bigCanvas,
      canvasX, canvasY, cardWidth, cardHeight,
      0, 0, cardWidth, cardHeight
    );

    const aspectRatio = cardHeight / cardWidth;
    const cellHeightPt = cellWidthPt * aspectRatio;

    if (yPt + cellHeightPt > pdfHeight - marginY + 0.001) {
      pdf.addPage();
      xPt = marginX;
      yPt = marginY;
      col = 0;
      rowMaxHeightPt = 0;
    }

    pdf.addImage(tile, imageType, xPt, yPt, cellWidthPt, cellHeightPt, undefined, undefined, 0);

    rowMaxHeightPt = Math.max(rowMaxHeightPt, cellHeightPt);
    col++;

    if (col < perRow) {
      xPt += cellWidthPt + gapX;
    } else {
      xPt = marginX;
      yPt += rowMaxHeightPt + gapY;
      col = 0;
      rowMaxHeightPt = 0;
    }
  }

  return pdf;
}