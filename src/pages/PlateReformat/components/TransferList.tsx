import React from 'react';
import { Card, ListGroup, Button } from 'react-bootstrap';
import type { TransferBlock, TransferStep } from '../../../utils/plateUtils';
import TransferListDownload from './TransferListDownload';

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
          <ListGroup variant="flush">
            {transferBlocks.map((transfer, index) => (
              <ListGroup.Item
                key={index}
                style={{
                  border: 'none',
                  paddingTop: '0',
                  paddingBottom: '0',
                  paddingLeft: '0',
                  paddingRight: '0'
                }}
              >
                <div className="d-flex align-items-start gap-2">
                  <div className="d-flex align-items-center justify-content-between" style={{ flex: 1, minWidth: 0 }}>
                    <div className="small mb-1">
                      <strong>{transfer.sourceBarcode}</strong>
                      {' → '}
                      <strong>{transfer.destinationBarcode}</strong>
                      <div
                        className="text-muted"
                        style={{
                          fontSize: '0.75rem',
                          lineHeight: '1.2',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {transfer.sourceBlock} → {transfer.destinationBlock}
                      </div>

                    </div>
                    <div
                      className="text-muted"
                      style={{ fontSize: '0.7rem', marginTop: '0.25rem' }}
                    >
                      {transfer.volume} nL · {transfer.transferSteps.length} steps
                    </div>



                  </div>

                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => onDeleteTransfer(index)}
                    style={{
                      padding: '0.25rem 0.5rem',
                      fontSize: '0.75rem',
                      lineHeight: '1'
                    }}
                  >
                    ×
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