import { Button } from 'react-bootstrap';
import JSZip from 'jszip';
import { generateTransferListCSV, rowColExport, TransferStepExport } from '../utils/plateUtils';

const TransferListDownload = (settings: { transferMap: Map<number, TransferStepExport[]>, splitOutputCSVs: boolean }) => {

  async function fetchForExport() {
    if (settings.splitOutputCSVs) {
      const zip = new JSZip();
      const outputPrioSets = [[1], [2], [3], [4, 5]];

      for (const set of outputPrioSets) {
        let steps: TransferStepExport[] = [];

        for (const prio of set) {
          const prioSteps = settings.transferMap.get(prio);
          if (prioSteps) {
            steps = steps.concat(prioSteps);
          }
        }

        if (steps.length > 0) {
          const hasPlateType = steps.some(s => s.sourcePlateType != undefined)
          const rows = steps.map(step => rowColExport(step, hasPlateType));
          const csvContent = generateTransferListCSV(rows);

          let suffix = '';
          switch (set[0]) {
            case 1:
              suffix = 'src-int1';
              break;
            case 2:
              suffix = 'int1-int2';
              break;
            case 3:
              suffix = 'src-dest';
              break;
            case 4:
              suffix = 'int-dest';
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

      const hasPlateType = allSteps.some(s => s.sourcePlateType != undefined)
      const rows = allSteps.map(step => rowColExport(step, hasPlateType));
      const csvContent = generateTransferListCSV(rows);

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
      Export Echo Transfer List
    </Button>
  );
};

export default TransferListDownload;