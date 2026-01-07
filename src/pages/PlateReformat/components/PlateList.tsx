import type React from "react"
import type { ClipboardEvent, KeyboardEvent } from "react"
import { Card, ListGroup, Button, Form, Alert } from "react-bootstrap"
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
  srcPlateSize: PlateSize,
  setSrcPlateSize: React.Dispatch<React.SetStateAction<PlateSize>>,
  dstPlateSize: PlateSize,
  setDstPlateSize: React.Dispatch<React.SetStateAction<PlateSize>>
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
  srcPlateSize,
  setSrcPlateSize,
  dstPlateSize,
  setDstPlateSize,
  transferBlocks
}) => {
  const [reusedBarcodes, setReusedBarcodes] = useState<string[]>([])
  const [alertMessage, setAlertMessage] = useState<string>('')

  const BarcodeAlert = () => {
    return (
      <Alert show={reusedBarcodes.length > 0} variant="warning">
        {reusedBarcodes.join(', ')} {alertMessage}
        <div className="d-flex justify-content-end">
          <Button onClick={() => { setReusedBarcodes([]); setAlertMessage('') }}>
            Clear
          </Button>
        </div>
      </Alert>
    );
  }

  const renderList = (
    plates: Plate[],
    setPlates: React.Dispatch<React.SetStateAction<Plate[]>>,
    type: "src" | "dst",
    curPlateId: number | null,
    setCurPlateId: (value: React.SetStateAction<number | null>) => void,
    addPlate: () => void,
    updateBarcode: (plateId: number, barcode: string) => void,
    deletePlate: (plateId: number) => void
  ) => {
    return (
      <ListGroup variant="flush">
        {plates.map((plate, index) => (
          <ListGroup.Item
            key={plate.id}
            id={(type + (index + 1))}
            active={plate.id === curPlateId}
            style={{ cursor: 'pointer', paddingTop: '0.25rem', paddingBottom: '0.25rem' }}
            onClick={() => setCurPlateId(plate.id)}
          >
            <div
              onKeyDown={(e) => handleKeyDown(e, curPlateId, setCurPlateId, plates, addPlate, type)}
              className="d-flex align-items-center gap-2"
            >
              <span>{(type + (index + 1))}</span>
              <div style={{ flex: 1 }}>
                <input
                  id={plate.id.toString()}
                  type="text"
                  placeholder="Enter barcode"
                  value={plate.barcode || ''}
                  onChange={(e) => updateBarcode(plate.id, e.target.value)}
                  onPaste={(e) => handlePaste(e, plate.id, plates, setPlates)}
                  onBlur={() => handleBlur(plate.barcode, plates)}
                  onFocus={(e) => e.target.select()}
                  className="form-control form-control-sm"
                />
              </div>
              <Button
                variant="danger"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  deletePlate(plate.id);
                }}
                disabled={!!(transferBlocks.find(block => (type === "src" ? block.sourcePlateId == plate.id : block.destinationPlateId == plate.id)))}
                style={{ padding: '0.25rem 0.5rem' }}
              >
                x
              </Button>
            </div>
          </ListGroup.Item>
        ))}
      </ListGroup>
    )
  }

  const addSourcePlate = () => {
    const newPlate = new Plate({ plateSize: srcPlateSize });
    let inc = srcPlates.length + 1
    while (srcPlates.find((p) => p.barcode == 'src' + inc)) {
      inc += 1
    }
    newPlate.barcode = 'src' + inc
    setSrcPlates(prev => [...prev, newPlate]);
    setCurSrcPlateId(newPlate.id);
  };

  const addDestPlate = () => {
    const newPlate = new Plate({ plateSize: dstPlateSize });
    let inc = dstPlates.length + 1
    while (dstPlates.find((p) => p.barcode == 'dst' + inc)) {
      inc += 1
    }
    newPlate.barcode = 'dst' + inc
    setDstPlates(prev => [...prev, newPlate]);
    setCurDstPlateId(newPlate.id);
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

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>, curId: number | null, setCurId: (value: React.SetStateAction<number | null>) => void, plateList: Plate[], addPlate: () => void, srcOrDst: string) => {
    const currentIndex = plateList.findIndex(v => v.id === curId);

    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      if (currentIndex < plateList.length - 1) {
        setCurId(plateList[currentIndex + 1].id);
        const selectorGroup = document.getElementById(`${srcOrDst}${currentIndex + 2}`);
        if (selectorGroup) {
          const inputToFocus = selectorGroup.querySelector('input');
          if (inputToFocus) {
            inputToFocus.focus();
          }
        }
      } else {
        addPlate()
        //timeout to allow time to render new plate in list, then focus on the text field
        setTimeout(() => {
          const selectorGroup = document.getElementById(`${srcOrDst}${plateList.length + 1}`);
          if (selectorGroup) {
            const inputToFocus = selectorGroup.querySelector('input');
            if (inputToFocus) {
              inputToFocus.focus();
            }
          }
        }, 0);
      }
    } else if (e.key === 'ArrowUp' && currentIndex > 0) {
      e.preventDefault();
      setCurId(plateList[currentIndex - 1].id);
      const selectorGroup = document.getElementById(`${srcOrDst}${currentIndex}`);
      if (selectorGroup) {
        const inputToFocus = selectorGroup.querySelector('input');
        if (inputToFocus) {
          inputToFocus.focus();
        }
      }
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>, currentId: number, plates: Plate[], onChange: (plates: Plate[]) => void) => {
    const duplicateBarcodes: string[] = []
    const pasteData = e.clipboardData
      .getData('text')
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line !== '')
    if (pasteData.length < 1 || transferBlocks.length > 0) return

    if (pasteData.length == 1) {
      if (plates.some(p => p.barcode == pasteData[0])) {
        e.preventDefault()
        duplicateBarcodes.push(pasteData[0])
      }
      else {
        return
      }
    }

    if (pasteData.length > 1) {
      e.preventDefault();
      const currentIndex = plates.findIndex(p => p.id === currentId);
      const newPlates = [...plates];

      pasteData.forEach((barcode, index) => {
        const targetIndex = currentIndex + index;
        const reusedBarcode = plates.some(p => p.barcode == barcode)
        if (reusedBarcode) {
          duplicateBarcodes.push(barcode)
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
    setReusedBarcodes(prev => [...prev, ...duplicateBarcodes])
    setAlertMessage('already in list; skipped')
  };

  const handleBlur = (barcode: string, plates: Plate[]) => {
    if (plates.filter(p => p.barcode == barcode).length > 1) {
      setReusedBarcodes([barcode])
      setAlertMessage('already in plate list, change to avoid unexpected behavior')
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
          ) : (<div>{renderList(srcPlates, setSrcPlates, "src", curSrcPlateId, setCurSrcPlateId, addSourcePlate, updateSourceBarcode, deleteSourcePlate)}</div>)}
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
          ) : (<div>{renderList(dstPlates, setDstPlates, "dst", curDstPlateId, setCurDstPlateId, addDestPlate, updateDestBarcode, deleteDestPlate)}</div>)}
        </div>
      </Card.Body>
      <BarcodeAlert />
    </Card>
  )
}

export default PlateList