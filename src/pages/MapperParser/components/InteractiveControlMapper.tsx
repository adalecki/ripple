import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { Modal, Button, Form, Alert, Badge, Container, Col, Row } from 'react-bootstrap';
import { ControlDefinition, ControlType, CONTROL_TYPES } from '../../../types/mapperTypes';
import { Plate, PlateSize } from '../../../classes/PlateClass';
import PlateView from '../../../components/PlateView';
import { ColorConfig } from '../../EchoTransfer/utils/wellColors';
import { HslStringType } from '../../../classes/PatternClass';
import { formatWellBlock, getCoordsFromWellId, numberToLetters } from '../../EchoTransfer/utils/plateUtils';
import '../../../css/InteractiveControlMapper.css';
import { checkWellsInSelection, Point } from '../../EchoTransfer/utils/designUtils';

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
  const [dragging, setDragging] = useState(false);
  const [startPoint, setStartPoint] = useState<Point>({ x: 0, y: 0 });
  const [endPoint, setEndPoint] = useState<Point>({ x: 0, y: 0 });
  const [selectedControlType, setSelectedControlType] = useState<ControlType>('MaxCtrl');
  const [definedControls, setDefinedControls] = useState<ControlDefinition[]>([...currentControls]);
  const [error, setError] = useState<string | null>(null);

  const wellsRef = useRef<(HTMLDivElement)[]>([]);
  const plateContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.addEventListener('mousedown', (e) => handlePageDblClick(e));
    return () => {
      document.removeEventListener('mousedown', (e) => handlePageDblClick(e));
    };
  }, []);

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

  // Calculate coordinates relative to the plate container instead of the page
  const getRelativeCoordinates = (e: React.MouseEvent): Point => {
    if (plateContainerRef.current) {
      const containerRect = plateContainerRef.current.getBoundingClientRect();
      return {
        x: e.clientX - containerRect.left,
        y: e.clientY - containerRect.top
      };
    }
    return { x: e.clientX + window.scrollX, y: e.clientY + window.scrollY };
  };

  const handlePageDblClick = (e: any) => {
    if (e.detail > 1) {
      setSelectedWells([])
    }
  }

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(true);
    const start = getRelativeCoordinates(e);
    setStartPoint(start);
    setEndPoint(start);
  }, []);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (dragging) {
      setEndPoint(getRelativeCoordinates(e));
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (dragging) {
      setDragging(false);
      // For well selection, we still need to use the original method that works with absolute coordinates
      const absoluteStart = { x: e.clientX + window.scrollX, y: e.clientY + window.scrollY };
      const absoluteEnd = { x: e.clientX + window.scrollX, y: e.clientY + window.scrollY };

      const relativeEnd = getRelativeCoordinates(e);

      // Convert back to absolute coordinates for well selection
      const containerRect = plateContainerRef.current?.getBoundingClientRect();
      if (containerRect) {
        absoluteStart.x = startPoint.x + containerRect.left + window.scrollX;
        absoluteStart.y = startPoint.y + containerRect.top + window.scrollY;
        absoluteEnd.x = relativeEnd.x + containerRect.left + window.scrollX;
        absoluteEnd.y = relativeEnd.y + containerRect.top + window.scrollY;
      }

      const wellArr = checkWellsInSelection(absoluteStart, absoluteEnd, wellsRef);
      if (!e.shiftKey) {
        setSelectedWells(wellArr);
      } else {
        setSelectedWells(prev => {
          const newSelection = [...prev];
          for (const wellId of wellArr) {
            const idx = newSelection.indexOf(wellId);
            if (idx > -1) {
              newSelection.splice(idx, 1);
            } else {
              newSelection.push(wellId);
            }
          }
          return newSelection;
        });
      }
    }
  };

  const handleLabelClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    const targetLabel = target.innerText;
    const isRow = isNaN(parseInt(targetLabel));

    const newSelection: string[] = [];
    wellsRef.current.forEach(wellElement => {
      if (wellElement) {
        const wellId = wellElement.getAttribute('data-wellid');
        if (!wellId) return;
        const wellCoords = getCoordsFromWellId(wellId);
        const shouldSelect = isRow
          ? numberToLetters(wellCoords.row) === targetLabel
          : (wellCoords.col + 1).toString() === targetLabel;

        if (shouldSelect) {
          newSelection.push(wellId);
        }
      }
    });

    if (!e.shiftKey) {
      setSelectedWells(newSelection);
    } else {
      setSelectedWells(prev => {
        const updatedSelection = new Set(prev);
        for (const wellId of newSelection) {
          if (updatedSelection.has(wellId)) {
            updatedSelection.delete(wellId);
          } else {
            updatedSelection.add(wellId);
          }
        }
        return Array.from(updatedSelection);
      });
    }
  }, []);

  function rebuildPlateFromControls(controls: ControlDefinition[]) {
    const newPlate = new Plate({ plateSize: plateSize.toString() as PlateSize });

    controls.forEach(control => {
      if (control.wells) {
        try {
          const wells = newPlate.getSomeWells(control.wells);
          wells.forEach(well => {
            well.applyPattern(control.type, 1); // Concentration doesn't matter for visualization
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
      // Update existing control
      const oldWellIds = tempPlate.getSomeWells(definedControls[existingControlIndex].wells).map(well => well.id)
      const wellBlock = formatWellBlock([...selectedWells, ...oldWellIds])
      const updatedControls = [...definedControls];
      updatedControls[existingControlIndex] = {
        ...updatedControls[existingControlIndex],
        wells: wellBlock
      };
      setDefinedControls(updatedControls);
    } else {
      // Add new control
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
            well.applyPattern(control.type, 1); // Concentration doesn't matter for visualization
          });
        } catch (error) {
          console.warn(`Invalid well range for ${control.type}: ${control.wells}`);
        }
      }
    });

    setTempPlate(newPlate);
  }, [definedControls, plateSize]);

  const selectionStyle = dragging ? {
    left: Math.min(startPoint.x, endPoint.x),
    top: Math.min(startPoint.y, endPoint.y),
    width: Math.abs(startPoint.x - endPoint.x),
    height: Math.abs(startPoint.y - endPoint.y),
  } : undefined;

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
                <div ref={plateContainerRef} style={{ position: 'relative' }}>
                  <PlateView
                    plate={tempPlate}
                    view="controlMapping"
                    colorConfig={colorConfig}
                    selectedWells={selectedWells}
                    handleMouseDown={handleMouseDown}
                    handleLabelClick={handleLabelClick}
                    selectionStyle={selectionStyle}
                    ref={wellsRef}
                  />
                </div>
              </Col>
            </Row>
          </div>
        </Container>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="outline-secondary" onClick={handleReset}>
          Reset to Original
        </Button>
        <Button variant="secondary" onClick={() => {handleReset();onHide()}}>
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