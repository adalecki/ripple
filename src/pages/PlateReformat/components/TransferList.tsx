import React, { useState } from 'react';
import { Card, ListGroup, Button } from 'react-bootstrap';
import type { TransferBlock, TransferStepExport } from '../../../utils/plateUtils';
import TransferListDownload from '../../../components/TransferListDownload';
import { MoveRight, Pencil, Check } from 'lucide-react';
import { Plate } from '../../../classes/PlateClass';

interface TransferListProps {
  transferBlocks: TransferBlock[];
  onDeleteTransfer: (index: number) => void;
  setTransferBlocks: React.Dispatch<React.SetStateAction<TransferBlock[]>>;
  plates: Plate[];
}

const TransferList: React.FC<TransferListProps> = ({
  transferBlocks,
  onDeleteTransfer,
  setTransferBlocks,
  plates
}) => {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingVolume, setEditingVolume] = useState<string>('');

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

  const handleStartEdit = (index: number, currentVolume: number) => {
    setEditingIndex(index);
    setEditingVolume(currentVolume.toString());
  };

  const handleSaveEdit = (index: number) => {
    const volume = parseFloat(editingVolume);
    if (!isNaN(volume) && volume % 2.5 === 0) {
      setTransferBlocks(prev => prev.map((block, i) => {
        if (i === index) {
          return {
            ...block,
            volume,
            transferSteps: block.transferSteps.map(step => ({
              ...step,
              volume
            }))
          };
        }
        return block;
      }));
      setEditingIndex(null);
      setEditingVolume('');
    }
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditingVolume('');
  };
  const volumeFloat = parseFloat(editingVolume)
  const invalidEditingVolume = (isNaN(volumeFloat) || volumeFloat % 2.5 !== 0 || volumeFloat <= 0)

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
                    {editingIndex === index ? (
                      <input
                        type="number"
                        value={editingVolume}
                        onChange={(e) => setEditingVolume(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveEdit(index);
                          if (e.key === 'Escape') handleCancelEdit();
                        }}
                        step={2.5}
                        className={`form-control form-control-sm ms-2 ${invalidEditingVolume ? 'is-invalid': ''}`}
                        style={{ width: '100px', display: 'inline-block' }}
                        autoFocus
                      />
                    ) : (
                      <span className="text-muted ms-2">{block.volume} nL</span>
                    )}
                  </div>
                  <div className="text-muted d-flex align-items-center gap-1">
                    <span className="transfer-list-item">{block.sourceBlock}</span>
                    <MoveRight size={10} strokeWidth={1.5} className='transfer-list-item'/>
                    <span className="transfer-list-item">{block.destinationBlock}</span>
                  </div>
                </div>

                <div className="d-flex gap-1">
                  {editingIndex === index ? (
                    <Button
                      variant="outline-success"
                      size="sm"
                      onClick={() => handleSaveEdit(index)}
                      disabled={invalidEditingVolume}
                      style={{ padding: '0.15rem 0.4rem', lineHeight: 1 }}
                    >
                      <Check size={14} />
                    </Button>
                  ) : (
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      onClick={() => handleStartEdit(index, block.volume)}
                      style={{ padding: '0.15rem 0.4rem', lineHeight: 1 }}
                    >
                      <Pencil size={14} />
                    </Button>
                  )}
                  <Button
                    variant="outline-danger"
                    size="sm"
                    onClick={() => onDeleteTransfer(index)}
                    style={{ padding: '0.15rem 0.4rem', lineHeight: 1 }}
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