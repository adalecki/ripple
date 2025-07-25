import React, { useState, useRef } from 'react';
import { Modal, Button, Form, ListGroup, Alert } from 'react-bootstrap';
import { Upload, FileText, AlertTriangle } from 'lucide-react';
import { Protocol } from '../../../types/mapperTypes';
import { validateProtocolImport, ImportableProtocol } from '../utils/validationUtils';

interface ImportProtocolsModalProps {
  show: boolean;
  onHide: () => void;
  onImport: (protocols: Protocol[]) => void;
  existingProtocols: Protocol[];
}

const ImportProtocolsModal: React.FC<ImportProtocolsModalProps> = ({
  show,
  onHide,
  onImport,
  existingProtocols
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validatedProtocols, setValidatedProtocols] = useState<ImportableProtocol[]>([]);
  const [selectedProtocols, setSelectedProtocols] = useState<Set<number>>(new Set());
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (files: FileList | null) => {
    if (files && files.length === 1) {
      const file = files[0];
      setSelectedFile(file);
      
      try {
        const content = await file.text();
        const validation = validateProtocolImport(content, existingProtocols);
        
        if (validation.isValid && validation.protocols) {
          setValidatedProtocols(validation.protocols);
          setValidationErrors([]);
          
          // Select all valid protocols by default
          const protocolIds = new Set(validation.protocols.map(p => p.id));
          setSelectedProtocols(protocolIds);
          setSelectAll(true);
        } else {
          setValidatedProtocols([]);
          setValidationErrors(validation.errors);
          setSelectedProtocols(new Set());
          setSelectAll(false);
        }
      } catch (error) {
        setValidatedProtocols([]);
        setValidationErrors(['Failed to read file']);
        setSelectedProtocols(new Set());
        setSelectAll(false);
      }
    } else {
      setSelectedFile(null);
      setValidatedProtocols([]);
      setValidationErrors([]);
      setSelectedProtocols(new Set());
      setSelectAll(false);
    }
  };

  const handleProtocolToggle = (protocolId: number) => {
    const newSelected = new Set(selectedProtocols);
    if (newSelected.has(protocolId)) {
      newSelected.delete(protocolId);
    } else {
      newSelected.add(protocolId);
    }
    setSelectedProtocols(newSelected);
    setSelectAll(newSelected.size === validatedProtocols.length);
  };

  const handleSelectAllToggle = () => {
    if (selectAll) {
      setSelectedProtocols(new Set());
      setSelectAll(false);
    } else {
      setSelectedProtocols(new Set(validatedProtocols.map(p => p.id)));
      setSelectAll(true);
    }
  };

  const handleImport = () => {
    const protocolsToImport = validatedProtocols
      .filter(p => selectedProtocols.has(p.id))
      .map(p => {
        const { isSelected, ...cleanProtocol } = p;
        return cleanProtocol;
      });
    
    if (protocolsToImport.length > 0) {
      onImport(protocolsToImport);
      handleClose();
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setValidatedProtocols([]);
    setValidationErrors([]);
    setSelectedProtocols(new Set());
    setSelectAll(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onHide();
  };

  const selectedCount = selectedProtocols.size;

  return (
    <Modal show={show} onHide={handleClose} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>Import Protocols</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form.Group className="mb-3 protocol-file-upload">
          <Form.Label>
            <FileText size={16} className="me-1" />
            Select Protocol File (JSON)
          </Form.Label>
          <Form.Control
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={(e) => handleFileChange((e.target as HTMLInputElement).files)}
          />
        </Form.Group>

        {validationErrors.length > 0 && (
          <Alert variant="danger">
            <AlertTriangle size={16} className="me-1" />
            <strong>Validation Errors:</strong>
            <ul className="mb-0 mt-2">
              {validationErrors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </Alert>
        )}

        {validatedProtocols.length > 0 && (
          <>
            <div className="mb-3">
              <Form.Check
                type="checkbox"
                label={`Select All (${validatedProtocols.length} protocols found)`}
                checked={selectAll}
                onChange={handleSelectAllToggle}
                className="fw-bold"
              />
            </div>
            
            <ListGroup style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {validatedProtocols.map((protocol) => (
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
          </>
        )}

        {selectedFile && validatedProtocols.length === 0 && validationErrors.length === 0 && (
          <div className="text-center py-4 text-muted">
            <FileText size={48} className="mb-2 opacity-50" />
            <div>Processing file...</div>
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <div className="me-auto">
          {selectedCount > 0 && (
            <small className="text-muted">
              {selectedCount} protocol{selectedCount !== 1 ? 's' : ''} selected
            </small>
          )}
        </div>
        <Button variant="secondary" onClick={handleClose}>
          Cancel
        </Button>
        <Button 
          variant="primary" 
          onClick={handleImport}
          disabled={selectedCount === 0}
        >
          <Upload size={16} className="me-1" />
          Import {selectedCount} Protocol{selectedCount !== 1 ? 's' : ''}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default ImportProtocolsModal;