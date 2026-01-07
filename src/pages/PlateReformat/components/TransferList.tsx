import React from 'react';
import { Card, ListGroup, Button } from 'react-bootstrap';
import type { TransferBlock, TransferStepExport } from '../../../utils/plateUtils';
import TransferListDownload from '../../../components/TransferListDownload';
import { MoveRight } from 'lucide-react';
import { Plate } from '../../../classes/PlateClass';

interface TransferListProps {
  transferBlocks: TransferBlock[];
  onDeleteTransfer: (index: number) => void;
  plates: Plate[];
}

const TransferList: React.FC<TransferListProps> = ({
  transferBlocks,
  onDeleteTransfer,
  plates
}) => {
  const transferMap: Map<number, TransferStepExport[]> = new Map()
  const plateBarcodeCache: Map<number, string> = new Map()

  for (const plate of plates) {
    plateBarcodeCache.set(plate.id, plate.barcode)
  }
  const transferSteps: TransferStepExport[] = []
  for (const block of transferBlocks) {
    const exportSteps = block.transferSteps.map((step) => ({
      sourceBarcode: plateBarcodeCache.get(step.sourcePlateId)!,
      sourceWellId: step.sourceWellId,
      destinationBarcode: plateBarcodeCache.get(step.destinationPlateId)!,
      destinationWellId: step.destinationWellId,
      volume: step.volume
    }))
    transferSteps.push(...exportSteps)
  }
  if (transferSteps.length > 0) transferMap.set(3, transferSteps)
  return (
    <Card className="mb-3">
      <Card.Body>
        <div className="d-flex align-items-center justify-content-between pb-2 border-bottom mb-2">
          <h6 className="mb-2 pb-2">Transfers</h6>
          {transferMap.size > 0 && <TransferListDownload transferMap={transferMap} splitOutputCSVs={false} />}
        </div>

        {transferBlocks.length === 0 ? (
          <div className="text-muted small ms-3">No transfers</div>
        ) : (
          <ListGroup>
            {transferBlocks.map((block, index) => (
              <ListGroup.Item
                key={index}
                style={{
                  border: 'none',
                  padding: '0'
                }}
              >
                <div className="d-flex align-items-start gap-2">
                  <div className="d-flex align-items-center justify-content-between" style={{ flex: 1, minWidth: 0 }}>
                    <div className="mb-1">
                      <strong>{plateBarcodeCache.get(block.sourcePlateId)!} </strong>
                      <MoveRight size={16} strokeWidth={1} />
                      <strong> {plateBarcodeCache.get(block.destinationPlateId)!}</strong>
                      <div className="text-muted">
                        {block.sourceBlock} <MoveRight size={16} strokeWidth={1} /> {block.destinationBlock}
                      </div>
                    </div>
                    <div className="text-muted">
                      {block.volume} nL
                    </div>
                  </div>

                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => onDeleteTransfer(index)}
                  >
                    x
                  </Button>
                </div>
              </ListGroup.Item>
            ))}
          </ListGroup>
        )}
      </Card.Body>
    </Card>
  );
};

export default TransferList;