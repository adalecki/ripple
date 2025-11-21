import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { Modal, Button, Form, Alert, Badge, Container, Col, Row } from 'react-bootstrap';
import { ControlDefinition, ControlType, CONTROL_TYPES } from '../../../types/mapperTypes';
import { Plate, PlateSize } from '../../../classes/PlateClass';
import PlateView from '../../../components/PlateView';
import { ColorConfig } from '../../../utils/wellColors';
import { HslStringType } from '../../../classes/PatternClass';
import { formatWellBlock, getCoordsFromWellId, numberToLetters } from '../../../utils/plateUtils';
import '../../../css/InteractiveControlMapper.css';
import { checkWellsInSelection } from '../../../utils/designUtils';

interface InteractiveControlMapperProps {
  show: boolean;
  onHide: () => void;
  currentControls: ControlDefinition[];
  plateSize: PlateSize;
  onConfirm: (controls: ControlDefinition[]) => void;
}

const CONTROL_COLORS: Record<ControlType, HslStringType> = {
  'MaxCtrl': 'hsl(120, 70%, 50%)',
  'MinCtrl': 'hsl(0, 70%, 50%)',
  'Blank': 'hsl(60, 70%, 50%)'
} as const;

const InteractiveControlMapper: React.FC<InteractiveControlMapperProps> = ({
  show,
  onHide,
  currentControls,
  plateSize,
  onConfirm
}) => {
  const [tempPlate, setTempPlate] = useState(() => new Plate({ plateSize: plateSize.toString() as PlateSize }));
  const [selectedWells, setSelectedWells] = useState<string[]>([]);
  const [selectedControlType, setSelectedControlType] = useState<ControlType>('MaxCtrl');
  const [definedControls, setDefinedControls] = useState<ControlDefinition[]>([...currentControls]);
  const [error, setError] = useState<string | null>(null);


  const selectionRef = useRef<HTMLDivElement | null>(null);
  const dragState = useRef({ dragging: false, startX: 0, startY: 0, endX: 0, endY: 0 });

  useEffect(() => {
    document.addEventListener('mousedown', handlePageDblClick, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handlePageDblClick);
    };
  }, []);

  const handlePageDblClick = useCallback((e: any) => {
    if (e.detail > 1) {
      setSelectedWells(prev => (prev.length ? [] : prev));
    }
  }, [])

  const colorMap = useMemo(() => {
    const map = new Map<string, HslStringType>();
    definedControls.forEach(control => {
      map.set(control.type, CONTROL_COLORS[control.type]);
    });
    return map;
  }, [definedControls]);

  const colorConfig: ColorConfig = {
    scheme: 'pattern',
    colorMap: colorMap
  };

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const start = { x: e.clientX + window.scrollX, y: e.clientY + window.scrollY };

    dragState.current.dragging = true;
    dragState.current.startX = start.x;
    dragState.current.startY = start.y
    dragState.current.endX = start.x
    dragState.current.endY = start.y
    const el = selectionRef.current;
    if (el) {
      el.style.display = 'block';
      el.style.left = `${start.x}px`;
      el.style.top = `${start.y}px`;
      el.style.width = '0px';
      el.style.height = '0px';
      el.className = 'selection-rectangle';
    }
  }, []);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragState.current.dragging) return
    const end = { x: e.clientX + window.scrollX, y: e.clientY + window.scrollY };
    dragState.current.endX = end.x
    dragState.current.endY = end.y
    const left = Math.min(dragState.current.startX, dragState.current.endX)
    const top = Math.min(dragState.current.startY, dragState.current.endY)
    const width = Math.abs(dragState.current.startX - dragState.current.endX)
    const height = Math.abs(dragState.current.startY - dragState.current.endY)
    const el = selectionRef.current;
    if (el) {
      el.style.left = `${left}px`;
      el.style.top = `${top}px`;
      el.style.width = `${width}px`;
      el.style.height = `${height}px`;
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!dragState.current.dragging) return
    dragState.current.dragging = false
    const el = selectionRef.current;
    if (el) el.style.display = 'none';

    const startWell = document.elementFromPoint(dragState.current.startX, dragState.current.startY)
    if (startWell && startWell.closest("[data-view]")) {
      const parentPlate = startWell.closest("[data-view]")
      if (!parentPlate) return
      const wells = parentPlate.querySelectorAll('[data-wellid]')
      let wellArr = checkWellsInSelection({ x: dragState.current.startX, y: dragState.current.startY }, { x: dragState.current.endX, y: dragState.current.endY }, wells);
      selectorHelper(e, wellArr, selectedWells, setSelectedWells)
    }
  };

  const selectorHelper = useCallback((e: React.MouseEvent, wellArr: string[], selectedWells: string[], setSelectedWells: React.Dispatch<React.SetStateAction<string[]>>) => {
    let newSelection = [...selectedWells]
    if (!e.shiftKey) {
      setSelectedWells(wellArr)
    }
    else {
      for (let wellId of wellArr) {
        let idx = newSelection.indexOf(wellId)
        if (idx > -1) {
          newSelection.splice(idx, 1)
        }
        else {
          newSelection.push(wellId)
        }
      }
      setSelectedWells(newSelection)
    }
  }, [])

  const handleLabelClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const newSelection = new Set<string>();
    const target = e.target as HTMLDivElement;
    const targetLabel = target.innerText;
    const parentPlate = target.closest("[data-view]")
    if (!parentPlate) return
    const wells = parentPlate.querySelectorAll('[data-wellid]')
    wells.forEach(wellElement => {
      if (!wellElement) return
      const wellId = wellElement.getAttribute('data-wellid')
      if (!wellId) return
      if (target.className.includes('all-wells-container')) {
        newSelection.add(wellId)
      }
      else {
        const wellCoords = getCoordsFromWellId(wellId)
        const shouldSelect = isNaN(parseInt(targetLabel))
          ? numberToLetters(wellCoords.row) === targetLabel
          : (wellCoords.col + 1).toString() === targetLabel;

        if (shouldSelect) {
          newSelection.add(wellId);
        }
      }
    })
    if (target.className.includes('all-wells-container') && Array.from(newSelection).length == selectedWells.length) {
      newSelection.clear()
    }
    selectorHelper(e, Array.from(newSelection), selectedWells, setSelectedWells)
  }

  function rebuildPlateFromControls(controls: ControlDefinition[]) {
    const newPlate = new Plate({ plateSize: plateSize.toString() as PlateSize });

    controls.forEach(control => {
      if (control.wells) {
        try {
          const wells = newPlate.getSomeWells(control.wells);
          wells.forEach(well => {
            well.applyPattern(control.type, 1);
          });
        } catch (error) {
          console.warn(`Invalid well range for ${control.type}: ${control.wells}`);
        }
      }
    });

    setTempPlate(newPlate);
  };

  const assignSelectionToControl = () => {
    if (selectedWells.length === 0) {
      setError('Please select wells first');
      return;
    }

    const existingControlIndex = definedControls.findIndex(c => c.type === selectedControlType);

    if (existingControlIndex >= 0) {
      const oldWellIds = tempPlate.getSomeWells(definedControls[existingControlIndex].wells).map(well => well.id)
      const wellBlock = formatWellBlock([...selectedWells, ...oldWellIds])
      const updatedControls = [...definedControls];
      updatedControls[existingControlIndex] = {
        ...updatedControls[existingControlIndex],
        wells: wellBlock
      };
      setDefinedControls(updatedControls);
    } else {
      const wellBlock = formatWellBlock(selectedWells);
      setDefinedControls(prev => [...prev, {
        type: selectedControlType,
        wells: wellBlock
      }]);
    }

    setSelectedWells([]);
    setError(null);
  };

  const removeControlsFromSelection = () => {
    if (selectedWells.length === 0) {
      setError('Please select wells first');
      return;
    }

    const existingControlIndex = definedControls.findIndex(c => c.type === selectedControlType);
    if (existingControlIndex >= 0) {
      const oldWellIds = tempPlate.getSomeWells(definedControls[existingControlIndex].wells).map(well => well.id);
      const remainingWellIds = oldWellIds.filter(i => !selectedWells.includes(i));
      const wellBlock = formatWellBlock(remainingWellIds);

      const updatedControls = [...definedControls];
      updatedControls[existingControlIndex] = {
        ...updatedControls[existingControlIndex],
        wells: wellBlock
      };

      setDefinedControls(updatedControls);
      rebuildPlateFromControls(updatedControls);
      setSelectedWells([]);
      setError(null);
    }
  };

  const removeControl = (controlType: ControlType) => {
    setDefinedControls(prev => prev.filter(c => c.type !== controlType));
  };

  const handleConfirm = () => {
    onConfirm(definedControls);
    onHide();
  };

  const handleReset = () => {
    setDefinedControls([...currentControls]);
    setSelectedWells([]);
    setError(null);
  };

  useEffect(() => {
    const newPlate = new Plate({ plateSize: plateSize.toString() as PlateSize });
    definedControls.forEach(control => {
      if (control.wells) {
        try {
          const wells = newPlate.getSomeWells(control.wells);
          wells.forEach(well => {
            well.applyPattern(control.type, 1);
          });
        } catch (error) {
          console.warn(`Invalid well range for ${control.type}: ${control.wells}`);
        }
      }
    });

    setTempPlate(newPlate);
  }, [definedControls, plateSize]);

  return (
    <Modal show={show} onHide={onHide} size="xl" className="interactive-control-mapper-modal">
      <Modal.Header closeButton>
        <Modal.Title>Define Control Wells</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Container fluid className='noselect'>
          {error && <Alert variant="danger" className="mb-3">{error}</Alert>}
          <div
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
          >
            <Row>
              <Col md="2">
                <div>

                  <Form.Group className="mb-3">
                    <Form.Label>Control Type</Form.Label>
                    <Form.Select
                      value={selectedControlType}
                      onChange={(e) => setSelectedControlType(e.target.value as ControlType)}
                    >
                      {CONTROL_TYPES.map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </Form.Select>
                  </Form.Group>

                  <div className="d-grid gap-2">
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={assignSelectionToControl}
                      disabled={selectedWells.length === 0}
                    >
                      Assign Selection ({selectedWells.length} wells)
                    </Button>

                    <Button
                      size="sm"
                      variant="outline-secondary"
                      onClick={removeControlsFromSelection}
                      disabled={selectedWells.length === 0}
                    >
                      Remove Controls from Selection
                    </Button>
                  </div>

                  {definedControls.length === 0 ? (
                    <p className="text-muted small">No controls defined</p>
                  ) : (
                    <div className="d-flex flex-column gap-2">
                      {definedControls.map(control => (
                        <div key={control.type} className="d-flex align-items-center justify-content-between">
                          <div>
                            <Badge
                              style={{ backgroundColor: CONTROL_COLORS[control.type] }}
                              className="text-white"
                            >
                              {control.type}
                            </Badge>
                            <div className="small text-muted mt-1">
                              {control.wells || 'No wells'}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline-danger"
                            onClick={() => removeControl(control.type)}
                          >
                            x
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Col>
              <Col md="8">
                <PlateView
                  plate={tempPlate}
                  view="controlMapping"
                  colorConfig={colorConfig}
                  selectedWells={selectedWells}
                  handleMouseDown={handleMouseDown}
                  handleLabelClick={handleLabelClick}
                />
              </Col>
            </Row>
          </div>
        </Container>
        <div ref={selectionRef} style={{ position: 'fixed', pointerEvents: 'none', display: 'none' }} />
      </Modal.Body>

      <Modal.Footer>
        <Button variant="outline-secondary" onClick={handleReset}>
          Reset to Original
        </Button>
        <Button variant="secondary" onClick={() => { handleReset(); onHide() }}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleConfirm}>
          Confirm Controls
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default InteractiveControlMapper;