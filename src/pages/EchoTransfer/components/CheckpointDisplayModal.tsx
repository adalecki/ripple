import React, { useState } from 'react';
import { Modal, Row, Col, Button, Card, Accordion } from 'react-bootstrap';
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

  return (
    <Card className="mt-4">
      <Card.Header as="h5">Calculation Summary</Card.Header>
      <Card.Body>
        <Row>
          <Col md={6}>
            <p><strong>Destination Plates:</strong> {echoPreCalc.destinationPlatesCount}</p>
            <p><strong>Estimated Total DMSO:</strong> {echoPreCalc.totalDMSOBackfillVol.toFixed(2)} nL</p>
            <p><strong>Estimated Max DMSO per Well:</strong> {echoPreCalc.maxDMSOVol.toFixed(2)} nL</p>
          </Col>
          <Col md={6}>
            <p><strong>Total Compounds:</strong> {echoPreCalc.srcCompoundInventory.size}</p>
            <p><strong>Total Patterns:</strong> {echoPreCalc.dilutionPatterns.size}</p>
          </Col>
        </Row>
      </Card.Body>
    </Card>
  );
};

const CheckpointDisplayModal: React.FC<CheckpointDisplayProps> = ({ showModal, checkpointTracker, echoPreCalc, handleClose, handleCancel, handleContinue }) => {
  const [activeKeys, setActiveKeys] = useState<string[]>([]);


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

        <div className="d-flex justify-content-end mt-4">
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