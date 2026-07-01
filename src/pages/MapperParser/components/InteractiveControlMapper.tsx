import React, { useState, useRef } from 'react';
import { Modal, Button, Alert, Badge, Container, Col, Row } from 'react-bootstrap';
import { ControlDefinition, ControlType, CONTROL_TYPES } from '../../../types/mapperTypes';
import { Plate, PlateSize } from '../../../classes/PlateClass';
import PlateViewCanvas from '../../../components/PlateViewCanvas';
import { FormField } from '../../../components/FormField';
import { ColorConfig } from '../../../utils/wellColors';
import { HslStringType } from '../../../classes/PatternClass';
import { formatWellBlock, getCoordsFromWellId, getWellIdFromCoords, numberToLetters } from '../../../utils/plateUtils';
import { labelDrag, selectorHelper } from '../../../utils/designUtils';
import '../../../css/InteractiveControlMapper.css';

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

function buildPlateFromControls(controls: ControlDefinition[], plateSize: PlateSize): Plate {
  const plate = new Plate({ plateSize: plateSize.toString() as PlateSize });
  controls.forEach(control => {
    if (!control.wells) return;
    try {
      plate.getSomeWells(control.wells).forEach(well => well.applyPattern(control.type, 1));
    } catch {
      console.warn(`Invalid well range for ${control.type}: ${control.wells}`);
    }
  });
  return plate;
}

const InteractiveControlMapper: React.FC<InteractiveControlMapperProps> = ({
  show,
  onHide,
  currentControls,
  plateSize,
  onConfirm
}) => {
  const [selectedWells, setSelectedWells] = useState<string[]>([]);
  const [selectedControlType, setSelectedControlType] = useState<ControlType>('MaxCtrl');
  const [definedControls, setDefinedControls] = useState<ControlDefinition[]>([...currentControls]);
  const [error, setError] = useState<string | null>(null);

  const selectionRef = useRef<HTMLDivElement | null>(null);
  const dragState = useRef({ mouseDown: false, dragging: false, startX: 0, startY: 0, endX: 0, endY: 0 });

  const tempPlate = buildPlateFromControls(definedControls, plateSize);

  const colorMap = new Map<string, HslStringType>();
  definedControls.forEach(control => colorMap.set(control.type, CONTROL_COLORS[control.type]));
  const colorConfig: ColorConfig = { scheme: 'pattern', colorMap };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    dragState.current.mouseDown = true;
    dragState.current.dragging = false;
    dragState.current.startX = e.clientX;
    dragState.current.startY = e.clientY;
    dragState.current.endX = e.clientX;
    dragState.current.endY = e.clientY;

    const el = selectionRef.current;
    if (el) {
      el.style.left = `${e.clientX}px`;
      el.style.top = `${e.clientY}px`;
      el.style.width = '0px';
      el.style.height = '0px';
      el.className = 'selection-rectangle';
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragState.current.mouseDown) return;
    dragState.current.dragging = true;
    dragState.current.endX = e.clientX;
    dragState.current.endY = e.clientY;

    const left = Math.min(dragState.current.startX, dragState.current.endX);
    const top = Math.min(dragState.current.startY, dragState.current.endY);
    const width = Math.abs(dragState.current.startX - dragState.current.endX);
    const height = Math.abs(dragState.current.startY - dragState.current.endY);

    const el = selectionRef.current;
    if (el) {
      el.style.display = 'block';
      el.style.left = `${left}px`;
      el.style.top = `${top}px`;
      el.style.width = `${width}px`;
      el.style.height = `${height}px`;
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!dragState.current.mouseDown) return;
    dragState.current.mouseDown = false;
    dragState.current.dragging = false;

    const el = selectionRef.current;
    if (el) el.style.display = 'none';

    const parent = (e.target as HTMLElement).closest('[data-view]');
    if (!parent) return;

    const region = {
      x1: Math.min(dragState.current.startX, dragState.current.endX),
      y1: Math.min(dragState.current.startY, dragState.current.endY),
      x2: Math.max(dragState.current.startX, dragState.current.endX),
      y2: Math.max(dragState.current.startY, dragState.current.endY)
    };

    const startEl = document.elementFromPoint(region.x1, region.y1);
    const endEl = document.elementFromPoint(region.x2, region.y2);
    const labelWells = labelDrag(startEl, endEl, tempPlate);
    if (labelWells.length > 0) {
      selectorHelper(e, labelWells, selectedWells, setSelectedWells);
      return;
    }

    const canvas = parent.getElementsByTagName('canvas')[0];
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cellWidth = rect.width / tempPlate.columns;
    const cellHeight = rect.height / tempPlate.rows;

    const selLeft = region.x1 - rect.left;
    const selTop = region.y1 - rect.top;
    const selRight = region.x2 - rect.left;
    const selBottom = region.y2 - rect.top;

    const newSelected: string[] = [];
    for (let r = 0; r < tempPlate.rows; r++) {
      for (let c = 0; c < tempPlate.columns; c++) {
        const wx1 = c * cellWidth;
        const wy1 = r * cellHeight;
        const wx2 = wx1 + cellWidth;
        const wy2 = wy1 + cellHeight;

        if (wx2 >= selLeft && wx1 <= selRight && wy2 >= selTop && wy1 <= selBottom) {
          newSelected.push(getWellIdFromCoords(r, c));
        }
      }
    }
    selectorHelper(e, newSelected, selectedWells, setSelectedWells);
  };

  const handleLabelClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    const targetLabel = target.innerText;
    const newSelected: string[] = [];

    if (target.className.includes('all-wells-container')) {
      for (let r = 0; r < tempPlate.rows; r++) {
        for (let c = 0; c < tempPlate.columns; c++) {
          newSelected.push(getWellIdFromCoords(r, c));
        }
      }
      if (newSelected.length === selectedWells.length) newSelected.length = 0;
      setSelectedWells(newSelected);
      return;
    }

    for (let r = 0; r < tempPlate.rows; r++) {
      for (let c = 0; c < tempPlate.columns; c++) {
        const wellId = getWellIdFromCoords(r, c);
        const coords = getCoordsFromWellId(wellId);
        const shouldSelect = isNaN(parseInt(targetLabel))
          ? numberToLetters(coords.row) === targetLabel
          : (coords.col + 1).toString() === targetLabel;
        if (shouldSelect) newSelected.push(wellId);
      }
    }
    selectorHelper(e, newSelected, selectedWells, setSelectedWells);
  };

  const handleClearSelection = () => setSelectedWells(prev => (prev.length ? [] : prev));

  const assignSelectionToControl = () => {
    if (selectedWells.length === 0) {
      setError('Please select wells first');
      return;
    }

    const existingControlIndex = definedControls.findIndex(c => c.type === selectedControlType);

    if (existingControlIndex >= 0) {
      const oldWellIds = tempPlate.getSomeWells(definedControls[existingControlIndex].wells).map(well => well.id);
      const updatedControls = [...definedControls];
      updatedControls[existingControlIndex] = {
        ...updatedControls[existingControlIndex],
        wells: formatWellBlock([...selectedWells, ...oldWellIds])
      };
      setDefinedControls(updatedControls);
    } else {
      setDefinedControls(prev => [...prev, {
        type: selectedControlType,
        wells: formatWellBlock(selectedWells)
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
    if (existingControlIndex < 0) return;

    const oldWellIds = tempPlate.getSomeWells(definedControls[existingControlIndex].wells).map(well => well.id);
    const remainingWellIds = oldWellIds.filter(id => !selectedWells.includes(id));

    const updatedControls = [...definedControls];
    updatedControls[existingControlIndex] = {
      ...updatedControls[existingControlIndex],
      wells: formatWellBlock(remainingWellIds)
    };

    setDefinedControls(updatedControls);
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

  return (
    <Modal show={show} onHide={onHide} size="xl" className="interactive-control-mapper-modal">
      <Modal.Header closeButton>
        <Modal.Title>Define Control Wells</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Container fluid className="noselect">
          {error && <Alert variant="danger" className="mb-3">{error}</Alert>}
          <Row
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <Col md={3} className="d-flex flex-column gap-3">
              <FormField
                id="control-type"
                name="control-type"
                type="select"
                label="Control Type"
                value={selectedControlType}
                onChange={(value) => setSelectedControlType(value as ControlType)}
                options={CONTROL_TYPES.map(type => ({ value: type, label: type }))}
              />

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
                  Remove from Selection
                </Button>
              </div>

              {definedControls.length === 0 ? (
                <p className="text-muted small mb-0">No controls defined</p>
              ) : (
                <div className="d-flex flex-column gap-2">
                  {definedControls.map(control => (
                    <div key={control.type} className="d-flex align-items-center justify-content-between">
                      <div>
                        <Badge style={{ backgroundColor: CONTROL_COLORS[control.type] }} className="text-white">
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
                        &times;
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Col>
            <Col md={9} onMouseDown={handleMouseDown} onDoubleClick={handleClearSelection}>
              <div
                style={{
                  width: '100%',
                  maxWidth: `calc(58vh * ${tempPlate.columns} / ${tempPlate.rows})`,
                  margin: '0 auto'
                }}
              >
                <PlateViewCanvas
                  plate={tempPlate}
                  view="controlMapping"
                  colorConfig={colorConfig}
                  selectedWells={selectedWells}
                  handleLabelClick={handleLabelClick}
                />
              </div>
              <small className="text-muted">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.25rem' }}>
                  <span><kbd>LeftClick</kbd> to select wells, drag to select groups</span>
                  <span><kbd>LeftClick</kbd> on labels to select rows or columns</span>
                  <span><kbd>LeftClick</kbd> + <kbd>Ctrl</kbd> to add to current selection</span>
                  <span><kbd>DoubleClick</kbd> to clear the selection</span>
                </div>
              </small>
            </Col>
          </Row>
        </Container>
        <div ref={selectionRef} style={{ position: 'fixed', pointerEvents: 'none', display: 'none' }} />
      </Modal.Body>

      <Modal.Footer>
        <Button variant="outline-secondary" onClick={handleReset}>
          Reset to Original
        </Button>
        <Button variant="secondary" onClick={() => { handleReset(); onHide(); }}>
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
