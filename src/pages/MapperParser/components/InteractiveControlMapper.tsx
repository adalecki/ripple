import React, { useState, useRef, useCallback, useMemo } from 'react';
import { Modal, Button, Form, Alert, Card, Badge } from 'react-bootstrap';
import { ControlDefinition, ControlType, CONTROL_TYPES } from '../../../types/mapperTypes';
import { Plate, PlateSize } from '../../../classes/PlateClass';
import PlateView from '../../../components/PlateView';
import { ColorConfig } from '../../EchoTransfer/utils/wellColors';
import { HslStringType } from '../../../classes/PatternClass';
import { formatWellBlock, getCoordsFromWellId, numberToLetters } from '../../EchoTransfer/utils/plateUtils';
import '../../../css/InteractiveControlMapper.css';

interface InteractiveControlMapperProps {
  show: boolean;
  onHide: () => void;
  currentControls: ControlDefinition[];
  plateSize: PlateSize;
  onConfirm: (controls: ControlDefinition[]) => void;
}

interface Point {
  x: number;
  y: number;
}

interface Rectangle {
  left: number;
  top: number;
  right: number;
  bottom: number;
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
  const [tempPlate] = useState(() => new Plate({ plateSize: plateSize.toString() as PlateSize }));
  const [selectedWells, setSelectedWells] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [startPoint, setStartPoint] = useState<Point>({ x: 0, y: 0 });
  const [endPoint, setEndPoint] = useState<Point>({ x: 0, y: 0 });
  const [selectedControlType, setSelectedControlType] = useState<ControlType>('MaxCtrl');
  const [definedControls, setDefinedControls] = useState<ControlDefinition[]>([...currentControls]);
  const [error, setError] = useState<string | null>(null);
  
  const wellsRef = useRef<(HTMLDivElement)[]>([]);

  // Generate color map for visualization
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

  const rectanglesOverlap = (rect1: Rectangle, rect2: Rectangle): boolean => {
    return !(rect1.right < rect2.left ||
      rect1.left > rect2.right ||
      rect1.bottom < rect2.top ||
      rect1.top > rect2.bottom);
  };

  const checkWellsInSelection = useCallback((): string[] => {
    const wellArr: string[] = [];
    const selectionRect: Rectangle = {
      left: Math.min(startPoint.x, endPoint.x),
      top: Math.min(startPoint.y, endPoint.y),
      right: Math.max(startPoint.x, endPoint.x),
      bottom: Math.max(startPoint.y, endPoint.y)
    };
    
    wellsRef.current.forEach(wellElement => {
      if (wellElement) {
        const rect = wellElement.getBoundingClientRect();
        const wellRect: Rectangle = {
          left: rect.left + window.scrollX,
          top: rect.top + window.scrollY,
          right: rect.right + window.scrollX,
          bottom: rect.bottom + window.scrollY
        };

        if (rectanglesOverlap(wellRect, selectionRect)) {
          const wellId = wellElement.getAttribute('data-wellid');
          if (wellId) {
            wellArr.push(wellId);
          }
        }
      }
    });

    return wellArr;
  }, [startPoint, endPoint]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(true);
    const start = { x: e.clientX + window.scrollX, y: e.clientY + window.scrollY };
    setStartPoint(start);
    setEndPoint(start);
  }, []);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (dragging) {
      setEndPoint({ x: e.clientX + window.scrollX, y: e.clientY + window.scrollY });
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (dragging) {
      setDragging(false);
      const wellArr = checkWellsInSelection();
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

  const assignSelectionToControl = () => {
    if (selectedWells.length === 0) {
      setError('Please select wells first');
      return;
    }

    const wellBlock = formatWellBlock(selectedWells);
    const existingControlIndex = definedControls.findIndex(c => c.type === selectedControlType);
    
    if (existingControlIndex >= 0) {
      // Update existing control
      const updatedControls = [...definedControls];
      updatedControls[existingControlIndex] = {
        ...updatedControls[existingControlIndex],
        wells: wellBlock
      };
      setDefinedControls(updatedControls);
    } else {
      // Add new control
      setDefinedControls(prev => [...prev, {
        type: selectedControlType,
        wells: wellBlock
      }]);
    }

    setSelectedWells([]);
    setError(null);
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

  // Apply control patterns to temp plate for visualization
  React.useEffect(() => {
    // Clear existing patterns
    for (const well of tempPlate) {
      if (well) {
        well.clearContents();
      }
    }

    // Apply control patterns
    definedControls.forEach(control => {
      if (control.wells) {
        try {
          const wells = tempPlate.getSomeWells(control.wells);
          wells.forEach(well => {
            well.applyPattern(control.type, 1); // Concentration doesn't matter for visualization
          });
        } catch (error) {
          console.warn(`Invalid well range for ${control.type}: ${control.wells}`);
        }
      }
    });
  }, [definedControls, tempPlate]);

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
        {error && <Alert variant="danger" className="mb-3">{error}</Alert>}
        
        <div className="d-flex gap-4">
          <div style={{ flex: '0 0 200px' }}>
            <Card className="mb-3">
              <Card.Header>
                <h6 className="mb-0">Control Selection</h6>
              </Card.Header>
              <Card.Body>
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
                    onClick={() => setSelectedWells([])}
                    disabled={selectedWells.length === 0}
                  >
                    Clear Selection
                  </Button>
                </div>
              </Card.Body>
            </Card>

            <Card>
              <Card.Header>
                <h6 className="mb-0">Defined Controls</h6>
              </Card.Header>
              <Card.Body>
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
                          ×
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </Card.Body>
            </Card>
          </div>

          <div className="flex-grow-1">
            <div 
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
            >
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
            
            <div className="mt-3 text-center">
              <small className="text-muted">
                Click and drag to select wells. Hold Shift to add/remove from selection.
                <br />
                Click row/column labels to select entire rows/columns.
              </small>
            </div>
          </div>
        </div>
      </Modal.Body>
      
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={handleReset}>
          Reset to Original
        </Button>
        <Button variant="secondary" onClick={onHide}>
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