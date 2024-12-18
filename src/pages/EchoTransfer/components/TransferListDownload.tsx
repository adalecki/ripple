import { Button, Container } from 'react-bootstrap';
import JSZip from 'jszip';
import { TransferStep } from '../classes/EchoCalculatorClass';

const TransferListDownload = (settings: { transferMap: Map<number,TransferStep[]>, splitOutputCSVs: boolean }) => {

  function rowColExport(step: TransferStep) {
    const sourceRow = step.sourceWellId.charCodeAt(0) - 64
    const sourceCol = parseInt(step.sourceWellId.slice(1))
    const destRow = step.destinationWellId.charCodeAt(0) - 64
    const destCol = parseInt(step.destinationWellId.slice(1))
    return {
      'Source Plate Barcode': step.sourceBarcode,
      'Source Row': sourceRow,
      'Source Column': sourceCol,
      'Destination Plate Barcode': step.destinationBarcode,
      'Destination Row': destRow,
      'Destination Column': destCol,
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
      const outputPrioSets = [[1], [2], [3,4,5]];
      
      for (const set of outputPrioSets) {
        let steps: TransferStep[] = [];
        
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
      const allSteps: TransferStep[] = [];
      for (const steps of settings.transferMap.values()) {
        allSteps.push(...steps);
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
    <Container>
      <Button onClick={fetchForExport} variant='success'>
        Export {settings.splitOutputCSVs ? 'Files' : 'File'}
      </Button>
    </Container>
  );
};

export default TransferListDownload;