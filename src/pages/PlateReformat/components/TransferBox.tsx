import React, { useState } from 'react';
import { Card, Button } from 'react-bootstrap';
import { Plate } from '../../../classes/PlateClass';
import { formatWellBlock, type TransferBlock } from '../../../utils/plateUtils';
import { FormField } from '../../../components/FormField';
import { MoveRight } from 'lucide-react';
import { getTileScheme } from '../../../utils/designUtils';
import InfoTooltip from '../../../components/InfoTooltip';
import { calculateTransferBlock } from '../utils/reformatUtils';

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
  const [volume, setVolume] = useState<string>('100')
  const [treatIdentical, setTreatIdentical] = useState(false)
  const sourceBlock = formatWellBlock(selectedSrcWells)
  const destinationBlock = formatWellBlock(selectedDstWells)
  const tileScheme = getTileScheme(sourceBlock, destinationBlock)

  const canAdd =
    (
      sourcePlate !== null &&
      destPlate !== null &&
      selectedSrcWells.length > 0 &&
      (!treatIdentical ? (selectedDstWells.length >= selectedSrcWells.length &&
        (selectedDstWells.length == selectedSrcWells.length || tileScheme.canTile)) :
        selectedDstWells.length > 0) &&
      !isNaN(parseFloat(volume)) &&
      parseFloat(volume) > 0 &&
      parseFloat(volume) % 2.5 == 0
    );

  const handleAddTransfer = () => {
    if (!canAdd || !sourcePlate || !destPlate) return;
    const transferBlock = calculateTransferBlock(sourcePlate,destPlate,sourceBlock,destinationBlock,parseFloat(volume),treatIdentical,selectedSrcWells,selectedDstWells)
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
        <span className="d-flex">
          <FormField
            key={'identical'}
            id={'identical'}
            name={'Identical'}
            type={'switch'}
            label={'Treat source wells as identical'}
            value={treatIdentical}
            onChange={(value) => setTreatIdentical(value)}
            required={true}
            className='default-label-text'
          />
          <InfoTooltip text="Source wells will be depleted evenly to apply to all selected destination wells. Source layout isn't preserved on destination." />
        </span>

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