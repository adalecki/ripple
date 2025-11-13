import React, { useState, useEffect } from 'react';
import { Modal, Row, Col, Button, Card, Accordion, Form } from 'react-bootstrap';
import { CheckpointTracker } from '../classes/CheckpointTrackerClass';
import { EchoPreCalculator } from '../classes/EchoPreCalculatorClass';

type CheckStatus = 'Pending' | 'Passed' | 'Failed' | 'Warning';
interface CheckResult {
  status: CheckStatus;
  message: string[];
}

interface CheckpointDisplayProps {
  showModal: boolean;
  checkpointTracker: CheckpointTracker;
  echoPreCalc: EchoPreCalculator | null;
  handleClose: () => void;
  handleCancel: () => void;
  handleContinue: () => void;
  setEchoPreCalc: React.Dispatch<React.SetStateAction<EchoPreCalculator | null>>;
  setCheckpointTracker: React.Dispatch<React.SetStateAction<CheckpointTracker>>;
}

interface CheckpointSectionProps {
  checkpoint: [name: string, result: CheckResult]
  eventKey: string
}

interface CheckpointSummaryProps {
  echoPreCalc: EchoPreCalculator
}


const getStatusIcon = (status: CheckStatus) => {
  switch (status) {
    case 'Passed': return '✅';
    case 'Failed': return '❌';
    case 'Warning': return '⚠️';
    default: return '⏳';
  }
};


const CheckpointSection: React.FC<CheckpointSectionProps> = ({ checkpoint, eventKey }) => {
  return (
    <Accordion.Item eventKey={eventKey}>
      <Accordion.Header>
        {getStatusIcon(checkpoint[1].status)} {checkpoint[0]}
      </Accordion.Header>
      {checkpoint[1].message.length > 0 ? 
      <Accordion.Body>
        <ul>
          {checkpoint[1].message.map((m, idx) => <li key={idx}>{m}</li>)}
        </ul>
      </Accordion.Body> : null
      }
    </Accordion.Item>
  );
};

const CheckpointSummary: React.FC<CheckpointSummaryProps> = ({ echoPreCalc }) => {

  if (!echoPreCalc) return null;

  let totalCompounds = 0;
  for (const [_,patternGroup] of echoPreCalc.srcCompoundInventory) {
    for (const [_,compoundGroup] of patternGroup) {
      if (compoundGroup.locations.some(l => l.concentration != 0)) {
        totalCompounds += 1
        break
      }
    }
  }

  return (
    <Card className="mt-4">
      <Card.Header as="h5">Calculation Summary</Card.Header>
      <Card.Body>
        <Row>
          <Col md={6}>
            <p><strong>Destination Plates:</strong> {echoPreCalc.destinationPlatesCount}</p>
            <p><strong>Total Compounds:</strong> {totalCompounds}</p>
            <p><strong>Total Patterns:</strong> {echoPreCalc.dilutionPatterns.size}</p>
          </Col>
          <Col md={6}>
            <p><strong>DMSO Required (estimated):</strong> {echoPreCalc.totalDMSOBackfillVol.toFixed(2)} nL</p>
            <p><strong>DMSO Max Per Well (estimated):</strong> {echoPreCalc.maxDMSOVol.toFixed(2)} nL</p>
            <p><strong>DMSO on Source (usable):</strong> {(echoPreCalc.dmsoUsableVolume / 1000).toFixed(1)} µL ({echoPreCalc.dmsoSourceWells} well{echoPreCalc.dmsoSourceWells === 1 ? '' : 's'}) </p>
          </Col>
        </Row>
      </Card.Body>
    </Card>
  );
};

const CheckpointDisplayModal: React.FC<CheckpointDisplayProps> = ({
  showModal,
  checkpointTracker,
  echoPreCalc,
  handleClose,
  handleCancel,
  handleContinue,
  setEchoPreCalc,
  setCheckpointTracker
}) => {
  const [activeKeys, setActiveKeys] = useState<string[]>([]);
  const [editableDeadVolumes, setEditableDeadVolumes] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    if (echoPreCalc && echoPreCalc.plateDeadVolumes) {
      setEditableDeadVolumes(new Map(echoPreCalc.plateDeadVolumes));
    }
  }, [echoPreCalc]);

  const handleDeadVolumeChange = (barcode: string, value: string) => {
    const newVolumeNL = parseFloat(value) * 1000;
    if (!isNaN(newVolumeNL) && newVolumeNL >= 0) {
      setEditableDeadVolumes(prevMap => new Map(prevMap).set(barcode, newVolumeNL));
    }
  };

  const handleUpdateDeadVolumes = () => {
    if (!echoPreCalc || !setEchoPreCalc || !setCheckpointTracker) return;
    let hasChanges = false;
    editableDeadVolumes.forEach((newVolumeNL, barcode) => {
      if (echoPreCalc.plateDeadVolumes.get(barcode) !== newVolumeNL) {
        echoPreCalc.updateDeadVolume(barcode, newVolumeNL);
        hasChanges = true;
      }
    });
    if (hasChanges) {
      const newEchoPreCalcInstance = Object.assign(Object.create(Object.getPrototypeOf(echoPreCalc)), echoPreCalc);
      setEchoPreCalc(newEchoPreCalcInstance);
      setCheckpointTracker(newEchoPreCalcInstance.checkpointTracker);
    }
  };

  const canContinue = !Array.from(checkpointTracker.checkpoints.values()).some(check => check.status === 'Failed');

  const handleAccordionToggle = (eventKey: string | string[] | undefined | null) => {
    if (typeof eventKey === 'string') {
      setActiveKeys(prevKeys => 
        prevKeys.includes(eventKey)
          ? prevKeys.filter(key => key !== eventKey)
          : [...prevKeys, eventKey]
      );
    }
  };

  return (
    <Modal show={showModal} onHide={handleClose} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>Calculation Checkpoints</Modal.Title>
      </Modal.Header>
      <Modal.Body>

        <h5>Checkpoint Results</h5>
        <Accordion activeKey={activeKeys} onSelect={handleAccordionToggle}>
          {Array.from(checkpointTracker.checkpoints).map((checkpoint, index) => (
            <CheckpointSection 
              key={checkpoint[0]} 
              checkpoint={checkpoint} 
              eventKey={index.toString()} 
            />
          ))}
        </Accordion>

        {echoPreCalc ? <CheckpointSummary echoPreCalc={echoPreCalc} /> : null}

        {echoPreCalc && echoPreCalc.plateDeadVolumes && echoPreCalc.plateDeadVolumes.size > 0 && (
          <>
            <h5 className="mt-3">Source Plate Dead Volumes (µL)</h5>
            <Accordion className="mt-2">
              <Accordion.Item eventKey="deadVolumesAccordion">
                <Accordion.Header>Edit Source Plate Dead Volumes</Accordion.Header>
                <Accordion.Body>
                  {Array.from(editableDeadVolumes.entries()).map(([barcode, deadVolumeNL]) => (
                    <Row key={barcode} className="mb-2 align-items-center">
                      <Col md={5}><Form.Label htmlFor={`deadvol-${barcode}`} className="mb-0">{barcode}</Form.Label></Col>
                      <Col md={7}>
                        <Form.Control
                          type="number"
                          id={`deadvol-${barcode}`}
                          value={deadVolumeNL / 1000}
                          onChange={(e) => handleDeadVolumeChange(barcode, e.target.value)}
                          step="0.1"
                          min="0"
                        />
                      </Col>
                    </Row>
                  ))}
                </Accordion.Body>
              </Accordion.Item>
            </Accordion>
          </>
        )}

        <div className="d-flex justify-content-end mt-4">
          <Button variant="info" onClick={handleUpdateDeadVolumes} className="me-2" disabled={!echoPreCalc}>
            Update Dead Volumes
          </Button>
          <Button variant="secondary" onClick={handleCancel} className="me-2">
            Cancel
          </Button>
          <Button onClick={handleContinue} disabled={!canContinue}>
            {canContinue ? 'Continue' : 'Cannot Continue'}
          </Button>
        </div>
      </Modal.Body>
    </Modal>
  );
};

export default CheckpointDisplayModal;