import { Button } from 'react-bootstrap';
import { getCoordsFromWellId } from '../../../utils/plateUtils';
import { Plate } from '../../../classes/PlateClass';
import React from 'react';

interface DestMapDownloadProps {
  destinationPlates: Plate[]
}

const DestMapDownload: React.FC<DestMapDownloadProps> = ({destinationPlates}) => {

  function generateDestinationMapCSV(plates: Plate[]): string {
    let maxContents = 0;
    for (const plate of plates) {
      for (const well of plate) {
        if (well) {
          maxContents = Math.max(maxContents, well.getContents().length);
        }
      }
    }

    const headers: string[] = ['Barcode', 'Well ID'];
    for (let i = 0; i < maxContents; i++) {
      headers.push(`Compound ${i + 1} ID`);
      headers.push(`Compound ${i + 1} Concentration (µM)`);
    }
    headers.push('Volume (µL)', 'Labware');

    const rows: string[][] = [];
    for (const plate of plates) {
      const plateSize = `${plate.rows * plate.columns}`;
      const sortedWells = Object.values(plate.getWells())
        .sort((a, b) => {
          const coordsA = getCoordsFromWellId(a.id);
          const coordsB = getCoordsFromWellId(b.id);
          return coordsA.col === coordsB.col
            ? coordsA.row - coordsB.row
            : coordsA.col - coordsB.col;
        });

      for (const well of sortedWells) {
        const row: string[] = [];
        row.push(plate.barcode);
        row.push(well.id);

        const contents = well.getContents();
        for (let i = 0; i < maxContents; i++) {
          if (i < contents.length) {
            row.push(contents[i].compoundId || '');
            row.push(contents[i].concentration.toFixed(6));
          } else {
            row.push('');
            row.push('');
          }
        }

        row.push((well.getTotalVolume() / 1000).toFixed(4));
        row.push(plateSize);
        rows.push(row);
      }
    }

    return [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
  }

  function exportDestinationMap() {
    if (!destinationPlates || destinationPlates.length === 0) return;

    const csvContent = generateDestinationMapCSV(destinationPlates);
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `destination_plate_map_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  return (
    <Button onClick={exportDestinationMap} variant='outline-success'>
      Export Destination {destinationPlates.length > 1 ? 'Plates' : 'Plate'} Map
    </Button>
  );
};

export default DestMapDownload;