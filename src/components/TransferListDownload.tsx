import { Button } from 'react-bootstrap';
import JSZip from 'jszip';
import { getCoordsFromWellId, TransferStepExport } from '../utils/plateUtils';

const TransferListDownload = (settings: { transferMap: Map<number, TransferStepExport[]>, splitOutputCSVs: boolean }) => {

  function rowColExport(step: TransferStepExport) {
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
    if (settings.splitOutputCSVs) {
      const zip = new JSZip();
      const outputPrioSets = [[1], [2], [3, 4, 5]];

      for (const set of outputPrioSets) {
        let steps: TransferStepExport[] = [];

        for (const prio of set) {
          const prioSteps = settings.transferMap.get(prio);
          if (prioSteps) {
            steps = steps.concat(prioSteps);
          }
        }

        if (steps.length > 0) {
          const rows = steps.map(step => rowColExport(step));
          const csvContent = generateCSV(rows);

          let suffix = '';
          switch (set[0]) {
            case 1:
              suffix = 'src-int1';
              break;
            case 2:
              suffix = 'int1-int2';
              break;
            case 3:
              suffix = 'all-dest';
              break;
            default:
              suffix = 'all';
          }

          zip.file(`transfer_list_${suffix}.csv`, csvContent);
        }
      }

      const content = await zip.generateAsync({ type: "blob" });
      const url = window.URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = `transfer_lists_${Date.now()}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

    } else {
      let allSteps: TransferStepExport[] = [];
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
  }

  return (
    <Button onClick={fetchForExport} variant='success'>
      Export {settings.splitOutputCSVs ? 'Files' : 'File'}
    </Button>
  );
};

export default TransferListDownload;