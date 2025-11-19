import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, ListGroup } from 'react-bootstrap';
import { Download } from 'lucide-react';
import { Protocol } from '../../../types/mapperTypes';
import { downloadProtocolsAsJson } from '../utils/validationUtils';

interface ExportProtocolsModalProps {
  show: boolean;
  onHide: () => void;
  protocols: Protocol[];
}

const ExportProtocolsModal: React.FC<ExportProtocolsModalProps> = ({
  show,
  onHide,
  protocols
}) => {
  const [selectedProtocols, setSelectedProtocols] = useState<Set<number>>(new Set());
  const [selectAll, setSelectAll] = useState(false);

  useEffect(() => {
    if (show) {
      setSelectedProtocols(new Set(protocols.map(p => p.id)));
      setSelectAll(true);
    }
  }, [show, protocols]);

  const handleProtocolToggle = (protocolId: number) => {
    const newSelected = new Set(selectedProtocols);
    if (newSelected.has(protocolId)) {
      newSelected.delete(protocolId);
    } else {
      newSelected.add(protocolId);
    }
    setSelectedProtocols(newSelected);
    setSelectAll(newSelected.size === protocols.length);
  };

  const handleSelectAllToggle = () => {
    if (selectAll) {
      setSelectedProtocols(new Set());
      setSelectAll(false);
    } else {
      setSelectedProtocols(new Set(protocols.map(p => p.id)));
      setSelectAll(true);
    }
  };

  const handleExport = () => {
    const protocolsToExport = protocols.filter(p => selectedProtocols.has(p.id));
    if (protocolsToExport.length > 0) {
      downloadProtocolsAsJson(protocolsToExport);
      onHide();
    }
  };

  const selectedCount = selectedProtocols.size;

  return (
    <Modal show={show} onHide={onHide} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>Export Protocols</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="mb-3">
          <Form.Check
            type="checkbox"
            label={`Select All (${protocols.length} protocols)`}
            checked={selectAll}
            onChange={handleSelectAllToggle}
            className="fw-bold"
          />
        </div>
        
        <ListGroup style={{ maxHeight: '400px', overflowY: 'auto' }}>
          {protocols.map((protocol) => (
            <ListGroup.Item
              key={protocol.id}
              className="d-flex align-items-center"
            >
              <Form.Check
                type="checkbox"
                checked={selectedProtocols.has(protocol.id)}
                onChange={() => handleProtocolToggle(protocol.id)}
                className="me-3"
              />
              <div className="flex-grow-1">
                <div className="fw-bold">{protocol.name}</div>
                <small className="text-muted">
                  {protocol.parseStrategy.format} format • {protocol.parseStrategy.plateSize} wells
                  {protocol.description && ` • ${protocol.description}`}
                </small>
              </div>
            </ListGroup.Item>
          ))}
        </ListGroup>
        
        {protocols.length === 0 && (
          <div className="text-center py-4 text-muted">
            No protocols available to export
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <div className="me-auto">
          <small className="text-muted">
            {selectedCount} protocol{selectedCount !== 1 ? 's' : ''} selected
          </small>
        </div>
        <Button variant="secondary" onClick={onHide}>
          Cancel
        </Button>
        <Button 
          variant="success" 
          onClick={handleExport}
          disabled={selectedCount === 0}
        >
          <Download size={16} className="me-1" />
          Download JSON
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default ExportProtocolsModal;