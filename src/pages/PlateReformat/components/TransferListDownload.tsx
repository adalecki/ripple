import { Button } from 'react-bootstrap';
import { getCoordsFromWellId, type TransferStep } from '../../../utils/plateUtils';

const TransferListDownload = (settings: { transferMap: Map<number,TransferStep[]>, splitOutputCSVs: boolean }) => {

  function rowColExport(step: TransferStep) {
    const sourceCoords = getCoordsFromWellId(step.sourceWellId)
    const destCoords = getCoordsFromWellId(step.destinationWellId)
    return {
      'Source Plate Barcode': step.sourceBarcode,
      'Source Row': (sourceCoords.row + 1),
      'Source Column': (sourceCoords.col + 1),
      'Destination Plate Barcode': step.destinationBarcode,
      'Destination Row': (destCoords.row + 1),
      'Destination Column': (destCoords.col + 1),
      'Transfer Volume': step.volume
    };
  }

  function generateCSV(rows: ReturnType<typeof rowColExport>[]): string {
    const headers = Object.keys(rows[0]);
    const csvContent = [
      headers.join(','),
      ...rows.map(row => 
        headers.map(header => row[header as keyof typeof row]).join(',')
      )
    ].join('\n');
    
    return csvContent;
  }

  async function fetchForExport() {
      let allSteps: TransferStep[] = [];
      for (const steps of settings.transferMap.values()) {
        allSteps = allSteps.concat(steps);
      }
      
      const rows = allSteps.map(step => rowColExport(step));
      const csvContent = generateCSV(rows);
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `transfer_list_${Date.now()}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
  }

  return (
      <Button onClick={fetchForExport} variant='success'>
        Export {settings.splitOutputCSVs ? 'Files' : 'File'}
      </Button>
  );
};

export default TransferListDownload;