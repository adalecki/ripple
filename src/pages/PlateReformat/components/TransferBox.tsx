import React, { useState } from 'react';
import { Card, Button } from 'react-bootstrap';
import { Plate } from '../../../classes/PlateClass';
import { formatWellBlock, type TransferBlock, type TransferStep } from '../../../utils/plateUtils';
import { FormField } from '../../../components/FormField';
import { MoveRight } from 'lucide-react';
import { getTileScheme, tileTransfers } from '../../../utils/designUtils';

interface TransferBoxProps {
  sourcePlate: Plate | null;
  destPlate: Plate | null;
  selectedSrcWells: string[];
  selectedDstWells: string[];
  onAddTransfer: (transferBlock: TransferBlock) => void;
}

const TransferBox: React.FC<TransferBoxProps> = ({
  sourcePlate,
  destPlate,
  selectedSrcWells,
  selectedDstWells,
  onAddTransfer,
}) => {
  const [volume, setVolume] = useState<string>('100');
  const sourceBlock = formatWellBlock(selectedSrcWells)
  const destinationBlock = formatWellBlock(selectedDstWells)
  const tileScheme = getTileScheme(sourceBlock, destinationBlock)

  const canAdd =
    (
      sourcePlate !== null &&
      destPlate !== null &&
      selectedSrcWells.length > 0 &&
      selectedDstWells.length >= selectedSrcWells.length &&
      (selectedDstWells.length == selectedSrcWells.length || tileScheme.canTile) &&
      !isNaN(parseFloat(volume)) &&
      parseFloat(volume) > 0
    );

  const handleAddTransfer = () => {
    if (!canAdd || !sourcePlate || !destPlate) return;
    console.log(tileScheme)

    const volumeNum = parseFloat(volume);
    const transferSteps: TransferStep[] = [];

    if (tileScheme.canTile) {
      const tileTsfrs = tileTransfers(selectedSrcWells, tileScheme)
      for (const tsfr of tileTsfrs) {
        transferSteps.push({
          sourceBarcode: sourcePlate.barcode || '',
          sourceWellId: tsfr[0],
          destinationBarcode: destPlate.barcode || '',
          destinationWellId: tsfr[1],
          volume: volumeNum
        })
      }
    }
    else {
      for (let i = 0; i < selectedSrcWells.length; i++) {
        transferSteps.push({
          sourceBarcode: sourcePlate.barcode || '',
          sourceWellId: selectedSrcWells[i],
          destinationBarcode: destPlate.barcode || '',
          destinationWellId: selectedDstWells[i],
          volume: volumeNum
        });
      }
    }

    const transferBlock: TransferBlock = {
      sourceBarcode: sourcePlate.barcode || '',
      sourceBlock,
      destinationBarcode: destPlate.barcode || '',
      destinationBlock,
      volume: volumeNum,
      transferSteps
    };

    onAddTransfer(transferBlock);
  };

  return (
    <Card className="mb-3">
      <Card.Body>
        <FormField
          key={'volume'}
          id={'volume'}
          name={'Volume'}
          type={'number'}
          label={'Add Transfer'}
          value={volume}
          onChange={(value) => setVolume(value)}
          required={true}
          unit={'nL'}
          step={2.5}
          className='default-label-text border-bottom pb-2 mb-2'
        />

        <div className="mb-2">
          <div className="mb-2">
            <div className="d-flex gap-2">
              <div style={{ flex: 1 }}>
                <div className="mb-1">{sourcePlate?.barcode || 'Source'}</div>
                <div className="border rounded p-2 bg-light text-center">
                  {sourceBlock || '-'}
                </div>
              </div>
              <MoveRight />
              <div style={{ flex: 1 }}>
                <div className="mb-1">{destPlate?.barcode || 'Destination'}</div>
                <div className="border rounded p-2 bg-light text-center">
                  {destinationBlock || '-'}
                </div>
              </div>
            </div>
          </div>

          <div className="d-flex justify-content-between align-items-center">
            <span className="text-muted small">
              {selectedSrcWells.length > 0 || selectedDstWells.length > 0 ? (
                <>
                  {selectedSrcWells.length} <MoveRight size={16} strokeWidth={2} /> {selectedDstWells.length} wells
                  {selectedDstWells.length % selectedSrcWells.length != 0 && (
                    <span className="text-danger ms-1">(size mismatch)</span>
                  )}
                  {selectedDstWells.length > selectedSrcWells.length &&
                    selectedDstWells.length % selectedSrcWells.length === 0 &&
                    (tileScheme.canTile ?
                      <span className="text-warning ms-1">(repeated transfer blocks)</span> :
                      <span className="text-danger ms-1">(not contiguous blocks)</span>
                    )}
                </>
              ) : (
                'Select wells to add transfer'
              )}
            </span>
            <Button
              variant="primary"
              size="sm"
              onClick={handleAddTransfer}
              disabled={!canAdd}
            >
              Add
            </Button>
          </div>
        </div>
      </Card.Body>
    </Card>
  );
};

export default TransferBox;