import React from 'react';
import { Card, ListGroup, Button } from 'react-bootstrap';
import type { TransferBlock, TransferStep } from '../../../utils/plateUtils';
import TransferListDownload from '../../../components/TransferListDownload';
import { MoveRight } from 'lucide-react';

interface TransferListProps {
  transferBlocks: TransferBlock[];
  onDeleteTransfer: (index: number) => void;
}

const TransferList: React.FC<TransferListProps> = ({
  transferBlocks,
  onDeleteTransfer
}) => {
  const transferMap: Map<number, TransferStep[]> = new Map()
  const transferSteps: TransferStep[] = []
  for (const block of transferBlocks) {
    transferSteps.push(...block.transferSteps)
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
            {transferBlocks.map((transfer, index) => (
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
                      <strong>{transfer.sourceBarcode} </strong>
                      <MoveRight size={16} strokeWidth={1} />
                      <strong> {transfer.destinationBarcode}</strong>
                      <div className="text-muted">
                        {transfer.sourceBlock} <MoveRight size={16} strokeWidth={1} /> {transfer.destinationBlock}
                      </div>
                    </div>
                    <div className="text-muted">
                      {transfer.volume} nL
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