import React, { useState, useMemo } from 'react';
import { Card, Form, Button, InputGroup } from 'react-bootstrap';
import { Plate } from '../../../classes/PlateClass';
import { formatWellBlock, type TransferBlock, type TransferStep } from '../../../utils/plateUtils';

interface TransferBoxProps {
  sourcePlate: Plate | null;
  destPlate: Plate | null;
  selectedSrcWells: string[];
  selectedDstWells: string[];
  onAddTransfer: (transferBlock: TransferBlock) => void;
  onClearSelection?: () => void;
}

const TransferBox: React.FC<TransferBoxProps> = ({
  sourcePlate,
  destPlate,
  selectedSrcWells,
  selectedDstWells,
  onAddTransfer,
  onClearSelection
}) => {
  const [volume, setVolume] = useState<string>('100');

  const sourceBlock = useMemo(() =>
    formatWellBlock(selectedSrcWells),
    [selectedSrcWells]
  );

  const destBlock = useMemo(() =>
    formatWellBlock(selectedDstWells),
    [selectedDstWells]
  );

  const canAdd = useMemo(() => {
    return (
      sourcePlate !== null &&
      destPlate !== null &&
      selectedSrcWells.length > 0 &&
      selectedDstWells.length > 0 &&
      selectedSrcWells.length === selectedDstWells.length &&
      !isNaN(parseFloat(volume)) &&
      parseFloat(volume) > 0
    );
  }, [sourcePlate, destPlate, selectedSrcWells, selectedDstWells, volume]);

  const handleAddTransfer = () => {
    if (!canAdd || !sourcePlate || !destPlate) return;

    const volumeNum = parseFloat(volume);
    const transferSteps: TransferStep[] = [];

    // Create transfer steps by pairing each source well with corresponding dest well
    for (let i = 0; i < selectedSrcWells.length; i++) {
      transferSteps.push({
        sourceBarcode: sourcePlate.barcode || '',
        sourceWellId: selectedSrcWells[i],
        destinationBarcode: destPlate.barcode || '',
        destinationWellId: selectedDstWells[i],
        volume: volumeNum
      });
    }

    const transferBlock: TransferBlock = {
      sourceBarcode: sourcePlate.barcode || '',
      sourceBlock,
      destinationBarcode: destPlate.barcode || '',
      destinationBlock: destBlock,
      volume: volumeNum,
      transferSteps
    };

    onAddTransfer(transferBlock);

    // Clear selection after adding
    if (onClearSelection) {
      onClearSelection();
    }
  };

  return (
    <Card className="mb-3">
      <Card.Body>
        <div className="d-flex align-items-center justify-content-between pb-2 border-bottom mb-2">
          <h6 >Add Transfer</h6>
          <InputGroup size="sm" style={{ width: 'auto', maxWidth: '120px' }}>
            <Form.Control
              type="number"
              value={volume}
              onChange={(e) => setVolume(e.target.value)}
              placeholder="Volume"
              min="2.5"
              step="2.5"
            />
            <InputGroup.Text>nL</InputGroup.Text>
          </InputGroup>
        </div>

        <div className="mb-2">
          <div className="mb-2">
            <div className="d-flex gap-2">
              <div style={{ flex: 1 }}>
                <div className="mb-1">{sourcePlate?.barcode || 'Source'}</div>
                <div
                  className="border rounded p-2 bg-light text-center"
                  style={{
                    minHeight: '2.5rem',
                    fontSize: '0.75rem',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >
                  {sourceBlock || '-'}
                </div>
              </div>
              {' → '}
              <div style={{ flex: 1 }}>
                <div className="mb-1">{destPlate?.barcode || 'Destination'}</div>
                <div
                  className="border rounded p-2 bg-light text-center"
                  style={{
                    minHeight: '2.5rem',
                    fontSize: '0.75rem',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >
                  {destBlock || '-'}
                </div>
              </div>
            </div>
          </div>

          {/* Status and add button */}
          <div className="d-flex justify-content-between align-items-center">
            <span className="text-muted small">
              {selectedSrcWells.length > 0 || selectedDstWells.length > 0 ? (
                <>
                  {selectedSrcWells.length} → {selectedDstWells.length} wells
                  {selectedSrcWells.length !== selectedDstWells.length &&
                    selectedSrcWells.length > 0 &&
                    selectedDstWells.length > 0 && (
                      <span className="text-danger ms-1">(size mismatch)</span>
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