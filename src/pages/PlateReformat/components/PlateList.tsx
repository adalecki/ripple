import type React from "react"
import type { ClipboardEvent } from "react"
import { Card, ListGroup, Button, Form, InputGroup, Alert } from "react-bootstrap"
import { Plate, type PlateSize } from "../../../classes/PlateClass"
import { Plus } from "lucide-react"
import { useState } from "react"
import { clonePlate, currentPlate, modifyPlate, TransferBlock } from "../../../utils/plateUtils"

interface PlateListProps {
  srcPlates: Plate[],
  setSrcPlates: React.Dispatch<React.SetStateAction<Plate[]>>,
  dstPlates: Plate[],
  setDstPlates: React.Dispatch<React.SetStateAction<Plate[]>>,
  curSrcPlateId: number | null,
  setCurSrcPlateId: React.Dispatch<React.SetStateAction<number | null>>,
  curDstPlateId: number | null,
  setCurDstPlateId: React.Dispatch<React.SetStateAction<number | null>>,
  transferBlocks: TransferBlock[]
}

const PlateList: React.FC<PlateListProps> = ({
  srcPlates,
  setSrcPlates,
  dstPlates,
  setDstPlates,
  curSrcPlateId,
  setCurSrcPlateId,
  curDstPlateId,
  setCurDstPlateId,
  transferBlocks
}) => {
  const [srcPlateSize, setSrcPlateSize] = useState<PlateSize>('384')
  const [dstPlateSize, setDstPlateSize] = useState<PlateSize>('384')
  const [reusedBarcodes, setReusedBarcodes] = useState<string[]>([])

  //fix this, need to also trigger when pasting in singular barcodes
  //finish adapting the arrow key movements from editablevaluetable
  const AlertDismissible = () => {
    return (
      <Alert show={reusedBarcodes.length > 0} variant="warning">
        {reusedBarcodes.join(', ')} already in list; skipped
        <div className="d-flex justify-content-end">
          <Button onClick={() => setReusedBarcodes([])}>
            Clear
          </Button>
        </div>
      </Alert>
    );
  }

  const addSourcePlate = () => {
    const newPlate = new Plate({ plateSize: srcPlateSize });
    let inc = srcPlates.length + 1
    while (srcPlates.find((p) => p.barcode == 'src' + inc)) {
      inc += 1
    }
    newPlate.barcode = 'src' + inc
    setSrcPlates(prev => [...prev, newPlate]);

    if (!curSrcPlateId) setCurSrcPlateId(newPlate.id);
  };

  const addDestPlate = () => {
    const newPlate = new Plate({ plateSize: dstPlateSize });
    let inc = dstPlates.length + 1
    while (dstPlates.find((p) => p.barcode == 'dst' + inc)) {
      inc += 1
    }
    newPlate.barcode = 'dst' + inc
    setDstPlates(prev => [...prev, newPlate]);
    if (!curDstPlateId) setCurDstPlateId(newPlate.id);
  };

  const deleteSourcePlate = (plateId: number) => {
    setSrcPlates(prev => prev.filter(p => p.id !== plateId));
    if (curSrcPlateId === plateId) {
      setCurSrcPlateId(srcPlates.length > 1 ? srcPlates[0].id : null);
    }
  };

  const deleteDestPlate = (plateId: number) => {
    setDstPlates(prev => prev.filter(p => p.id !== plateId));
    if (curDstPlateId === plateId) {
      setCurDstPlateId(dstPlates.length > 1 ? dstPlates[0].id : null);
    }
  };

  const updateSourceBarcode = (plateId: number, barcode: string) => {
    const plate = currentPlate(srcPlates, plateId)
    if (!plate) return
    const clonedPlate = clonePlate(plate)
    clonedPlate.barcode = barcode
    modifyPlate(clonedPlate, srcPlates, setSrcPlates, plateId)
  };

  const updateDestBarcode = (plateId: number, barcode: string) => {
    const plate = currentPlate(dstPlates, plateId)
    if (!plate) return
    const clonedPlate = clonePlate(plate)
    clonedPlate.barcode = barcode
    modifyPlate(clonedPlate, dstPlates, setDstPlates, plateId)
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>, currentId: number, plates: Plate[], onChange: (plates: Plate[]) => void) => {

    const pasteData = e.clipboardData
      .getData('text')
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line !== '')
    if (pasteData.length <= 1 || transferBlocks.length > 0) return

    if (pasteData.length > 1) {
      e.preventDefault();
      const currentIndex = plates.findIndex(p => p.id === currentId);
      const newPlates = [...plates];

      pasteData.forEach((barcode, index) => {
        const targetIndex = currentIndex + index;
        const reusedBarcode = plates.some(p => p.barcode == barcode)
        if (reusedBarcode) {
          setReusedBarcodes(prev => [...prev, barcode])
        }
        else {
          if (targetIndex < newPlates.length) {
            newPlates[targetIndex].barcode = barcode
          } else {
            newPlates.push(new Plate({ id: Date.now() + index, plateSize: dstPlateSize, barcode: barcode }));
          }
        }
      });

      onChange(newPlates);
    }
  };

  return (
    <Card className="mb-3">
      <Card.Body>
        <div className="mb-4">
          <div className="d-flex align-items-center mb-2 border-bottom">
            <h6 className="flex-grow-1">Source Plates</h6>
            <span>
              <Form.Select
                size="sm"
                value={srcPlateSize}
                onChange={(e) => { setSrcPlateSize(e.target.value as PlateSize); }}
                disabled={srcPlates.length > 0}
              >
                {['384', '1536'].map(size => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </Form.Select>
            </span>
            <Plus
              color="#18bc9c"
              onClick={addSourcePlate}
              style={{ cursor: 'pointer' }}
            />
          </div>

          {srcPlates.length === 0 ? (
            <div className="text-muted small ms-3">No source plates</div>
          ) : (
            <ListGroup variant="flush">
              {srcPlates.map((plate, index) => (
                <ListGroup.Item
                  key={plate.id}
                  active={plate.id === curSrcPlateId}
                  style={{ cursor: 'pointer', border: 'none', paddingTop: '0.25rem', paddingBottom: '0.25rem' }}
                  onClick={() => setCurSrcPlateId(plate.id)}
                >
                  <div className="d-flex align-items-center gap-2">
                    <span>src{index + 1}</span>

                    <input
                      id={plate.id.toString()}
                      type="text"
                      placeholder="Enter barcode"
                      value={plate.barcode || ''}
                      onChange={(e) => updateSourceBarcode(plate.id, e.target.value)}

                      onPaste={(e) => handlePaste(e, plate.id, srcPlates, setSrcPlates)}
                      disabled={!!(transferBlocks.find(block => block.sourceBarcode == plate.barcode))}
                      onFocus={(e) => e.target.select()}
                    />
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSourcePlate(plate.id);
                      }}
                      disabled={!!(transferBlocks.find(block => block.sourceBarcode == plate.barcode))}
                      style={{ padding: '0.25rem 0.5rem' }}
                    >
                      x
                    </Button>
                  </div>
                </ListGroup.Item>
              ))}
            </ListGroup>
          )}
        </div>

        <div className="mb-4">
          <div className="d-flex align-items-center mb-2 border-bottom">
            <h6 className="flex-grow-1">Destination Plates</h6>
            <span>
              <Form.Select
                size="sm"
                value={dstPlateSize}
                onChange={(e) => { setDstPlateSize(e.target.value as PlateSize); }}
                disabled={dstPlates.length > 0}
              >
                {['12', '24', '48', '96', '384', '1536'].map(size => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </Form.Select>
            </span>
            <Plus
              color="#18bc9c"
              onClick={addDestPlate}
              style={{ cursor: 'pointer' }}
            />
          </div>

          {dstPlates.length === 0 ? (
            <div className="text-muted small ms-3">No destination plates</div>
          ) : (
            <ListGroup variant="flush">
              {dstPlates.map((plate, index) => (
                <ListGroup.Item
                  key={plate.id}
                  active={plate.id === curDstPlateId}
                  style={{ cursor: 'pointer', border: 'none', paddingTop: '0.25rem', paddingBottom: '0.25rem' }}
                  onClick={() => setCurDstPlateId(plate.id)}
                >
                  <div className="d-flex align-items-center gap-2">
                    <span>dst{index + 1}</span>
                    <InputGroup size="sm" style={{ flex: 1 }}>
                      <Form.Control
                        type="text"
                        placeholder="Enter barcode"
                        value={plate.barcode || ''}
                        onChange={(e) => updateDestBarcode(plate.id, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        disabled={!!(transferBlocks.find(block => block.destinationBarcode == plate.barcode))}
                      />
                    </InputGroup>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteDestPlate(plate.id);
                      }}
                      disabled={!!(transferBlocks.find(block => block.destinationBarcode == plate.barcode))}
                    >
                      x
                    </Button>
                  </div>
                </ListGroup.Item>
              ))}
            </ListGroup>
          )}
        </div>
      </Card.Body>
      <AlertDismissible />
    </Card>
  )
}

export default PlateList