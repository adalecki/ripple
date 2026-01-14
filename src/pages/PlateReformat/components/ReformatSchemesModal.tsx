import React, { useState } from 'react';
import { Modal, Button, Form, ListGroup, Tab, Tabs } from 'react-bootstrap';
import { Dot, MoveRight, Save, Trash2 } from 'lucide-react';
import { ReformatScheme } from '../utils/reformatUtils';

interface ReformatSchemesModalProps {
  show: boolean;
  onHide: () => void;
  schemes: ReformatScheme[];
  onSaveScheme: (name: string, description: string) => void;
  onDeleteScheme: (schemeId: number) => void;
  onLoadScheme: (scheme: ReformatScheme) => void;
  canSave: boolean;
}

const ReformatSchemesModal: React.FC<ReformatSchemesModalProps> = ({
  show,
  onHide,
  schemes,
  onSaveScheme,
  onDeleteScheme,
  onLoadScheme,
  canSave
}) => {
  const [activeTab, setActiveTab] = useState<string>('save');
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const existingNames = schemes.flatMap(s => s.name)

  const handleSave = () => {
    if (!newName.trim()) return;
    onSaveScheme(newName.trim(), newDescription.trim());
    setNewName('');
    setNewDescription('');
    setActiveTab('browse');
  };

  const handleDelete = (schemeId: number) => {
    if (deleteConfirmId === schemeId) {
      onDeleteScheme(schemeId);
      setDeleteConfirmId(null);
    } else {
      setDeleteConfirmId(schemeId);
    }
  };

  const handleLoad = (scheme: ReformatScheme) => {
    onLoadScheme(scheme);
    onHide();
  };

  const handleClose = () => {
    setDeleteConfirmId(null);
    setNewName('');
    setNewDescription('');
    onHide();
  };

  return (
    <Modal show={show} onHide={handleClose} size="xl">
      <Modal.Header closeButton>
        <Modal.Title>Manage Reformat Schemes</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Tabs activeKey={activeTab} onSelect={(k) => setActiveTab(k || 'save')}>
          <Tab eventKey="save" title="Save Current">
            <div className="pt-3">
              {!canSave ? (
                <p className="text-muted">
                  Add at least one transfer to save the current scheme.
                </p>
              ) : (
                <Form>
                  <Form.Group className="mb-3">
                    <Form.Label>Scheme Name</Form.Label>
                    <Form.Control
                      type="text"
                      placeholder="Enter scheme name"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                    />
                  </Form.Group>
                  <Form.Group className="mb-3">
                    <Form.Label>Description (optional)</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={2}
                      placeholder="Brief description of this scheme"
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                    />
                  </Form.Group>
                  <Button
                    variant="primary"
                    onClick={handleSave}
                    disabled={!newName.trim() || existingNames.includes(newName.trim())}
                  >
                    <Save size={16} className="me-1" />
                    Save Scheme
                  </Button>
                </Form>
              )}
            </div>
          </Tab>
          <Tab eventKey="browse" title={`Saved Schemes (${schemes.length})`}>
            <div className="pt-3">
              {schemes.length === 0 ? (
                <p className="text-muted">No saved schemes yet.</p>
              ) : (
                <ListGroup style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  {schemes.map(scheme => (
                    <ListGroup.Item key={scheme.id}>
                      <div className="d-flex justify-content-between align-items-start">
                        <div className="flex-grow-1">
                          <div className="fw-bold">{scheme.name}</div>
                          {scheme.description && (
                            <small className="text-muted d-block">{scheme.description}</small>
                          )}
                          <small className="text-muted">
                            {scheme.srcPlateCount} source plate{scheme.srcPlateCount !== 1 ? 's' : ''} ({scheme.srcPlateSize}-well)
                            <MoveRight size={16} strokeWidth={1} />
                            {scheme.dstPlateCount} destination plate{scheme.dstPlateCount !== 1 ? 's' : ''} ({scheme.dstPlateSize}-well)
                            <Dot size={16} strokeWidth={5} />
                            {scheme.transfers.length} transfer{scheme.transfers.length !== 1 ? 's' : ''}
                          </small>
                        </div>
                        <div className="d-flex gap-2">
                          <Button
                            variant="outline-primary"
                            size="sm"
                            onClick={() => handleLoad(scheme)}
                          >
                            Load
                          </Button>
                          <Button
                            variant={deleteConfirmId === scheme.id ? 'danger' : 'outline-danger'}
                            size="sm"
                            onClick={() => handleDelete(scheme.id)}
                            onBlur={() => setDeleteConfirmId(null)}
                          >
                            {deleteConfirmId === scheme.id ? 'Confirm?' : <Trash2 size={14} />}
                          </Button>
                        </div>
                      </div>
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              )}
            </div>
          </Tab>
        </Tabs>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default ReformatSchemesModal;