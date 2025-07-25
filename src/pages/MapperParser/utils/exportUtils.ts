import { Plate } from '../../../classes/PlateClass';
import { Protocol } from '../../../types/mapperTypes';

export interface CsvExportData {
  headers: string[];
  rows: string[][];
}

/**
 * Generates CSV data from destination plates for export
 * @param destinationPlates Array of destination plates with response data
 * @param protocol Protocol containing metadata field definitions
 * @param includeEmptyWells Whether to include wells with no contents (default: false)
 * @returns Object containing headers and rows for CSV export
 */
export function generateDestinationPlatesCSV(
  destinationPlates: Plate[],
  protocol?: Protocol,
  includeEmptyWells: boolean = false
): CsvExportData {
  let maxContents = 0;
  for (const plate of destinationPlates) {
    for (const well of plate) {
      if (well && (includeEmptyWells || well.getContents().length > 0)) {
        maxContents = Math.max(maxContents, well.getContents().length);
      }
    }
  }

  const headers: string[] = ['Barcode', 'Well ID'];
  
  for (let i = 0; i < maxContents; i++) {
    headers.push(`Compound ${i + 1} ID`);
    headers.push(`Compound ${i + 1} Concentration (µM)`);
  }
  
  headers.push('Raw Response');
  
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
      const contents = well.getContents().filter(content => content.compoundId);
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

/**
 * Converts CSV data object to a CSV string
 * @param csvData Object containing headers and rows
 * @returns CSV formatted string
 */
export function csvDataToString(csvData: CsvExportData): string {
  const allRows = [csvData.headers, ...csvData.rows];
  return allRows.map(row => 
    row.map(cell => {
      const cellStr = cell.toString();
      // Escape cells that contain commas, quotes, or newlines
      if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
        return `"${cellStr.replace(/"/g, '""')}"`;
      }
      return cellStr;
    }).join(',')
  ).join('\n');
}

/**
 * Downloads CSV data as a file
 * @param csvData Object containing headers and rows
 * @param filename Name for the downloaded file
 */
export function downloadCSV(csvData: CsvExportData, filename: string): void {
  const csvString = csvDataToString(csvData);
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
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

/**
 * Generates a default filename for the CSV export
 * @param protocol Optional protocol name to include
 * @returns Formatted filename with timestamp
 */
export function generateCSVFilename(protocol?: Protocol): string {
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
  includeEmptyWells: boolean = false,
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