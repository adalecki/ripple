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
          <h6>Transfers</h6>
          {transferMap.size > 0 && <TransferListDownload transferMap={transferMap} splitOutputCSVs={false} />}
        </div>

        {transferBlocks.length === 0 ? (
          <div className="text-muted small ms-3">No transfers</div>
        ) : (
          <ListGroup variant="flush" className="d-flex flex-column ">
            {transferBlocks.map((block, index) => (
              <ListGroup.Item
                key={index}
                className="d-flex align-items-center p-1"
              >
                <div className="flex-grow-1 small" style={{ lineHeight: 1.3, minWidth: 0 }}>
                  <div className="d-flex align-items-center gap-1">
                    <strong>{plateBarcodeCache.get(block.sourcePlateId)}</strong>
                    <MoveRight size={12} strokeWidth={1.5} />
                    <strong>{plateBarcodeCache.get(block.destinationPlateId)}</strong>
                    <span className="text-muted ms-2">{block.volume} nL</span>
                  </div>
                  <div className="text-muted d-flex align-items-center gap-1">
                    <span className="flex-shrink-0">{block.sourceBlock}</span>
                    <MoveRight size={10} strokeWidth={1.5} />
                    <span className="transfer-list-item">{block.destinationBlock}</span>
                  </div>
                </div>

                <Button
                  variant="outline-danger"
                  size="sm"
                  onClick={() => onDeleteTransfer(index)}
                  style={{ padding: '0.15rem 0.4rem', lineHeight: 1 }}
                >
                  ×
                </Button>
              </ListGroup.Item>
            ))}
          </ListGroup>
        )}
      </Card.Body>
    </Card>
  );
};

export default TransferList;