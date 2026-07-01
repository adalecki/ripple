import React, { useEffect, useState } from 'react';
import { Modal, Button, Form, ListGroup, Col, Row, Alert } from 'react-bootstrap';
import { AlertTriangle, ArrowLeft, Dot, Download, FileText, MoveRight, Save, Trash2, Upload } from 'lucide-react';
import { ReformatScheme } from '../utils/reformatUtils';
import { ImportableScheme, validateSchemeImport, downloadSchemesAsJson } from '../utils/validationUtils';
import FileUploadCard from '../../../components/FileUploadCard';

interface ReformatSchemesModalProps {
  show: boolean;
  onHide: () => void;
  schemes: ReformatScheme[];
  onSaveScheme: (name: string, description: string) => void;
  onDeleteScheme: (schemeId: number) => void;
  onLoadScheme: (scheme: ReformatScheme) => void;
  onImportSchemes: (schemes: ReformatScheme[]) => void;
  canSave: boolean;
  onLoadDefaults: () => void;
}

type ModalMode = 'manage' | 'import' | 'export';

const SchemeSummary: React.FC<{ scheme: ReformatScheme }> = ({ scheme }) => (
  <small className="text-muted">
    {scheme.srcPlateCount} src plate{scheme.srcPlateCount !== 1 ? 's' : ''} ({scheme.srcPlateSize}-well)
    <MoveRight size={16} strokeWidth={1} />
    {scheme.dstPlateCount} dst plate{scheme.dstPlateCount !== 1 ? 's' : ''} ({scheme.dstPlateSize}-well)
    <Dot size={16} strokeWidth={5} />
    {scheme.transfers.length} transfer{scheme.transfers.length !== 1 ? 's' : ''}
  </small>
);

const ReformatSchemesModal: React.FC<ReformatSchemesModalProps> = ({
  show,
  onHide,
  schemes,
  onSaveScheme,
  onDeleteScheme,
  onLoadScheme,
  onImportSchemes,
  canSave,
  onLoadDefaults
}) => {
  const [mode, setMode] = useState<ModalMode>('manage');
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validatedSchemes, setValidatedSchemes] = useState<ImportableScheme[]>([]);
  const [selectedImportIds, setSelectedImportIds] = useState<Set<number>>(new Set());
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [selectAllImport, setSelectAllImport] = useState(false);

  const [selectedExportIds, setSelectedExportIds] = useState<Set<number>>(new Set());
  const [selectAllExport, setSelectAllExport] = useState(false);

  const existingNames = schemes.flatMap(s => s.name)

  useEffect(() => {
    if (mode === 'export') {
      setSelectedExportIds(new Set(schemes.map(s => s.id)));
      setSelectAllExport(true);
    }
  }, [mode, schemes]);

  const handleSave = () => {
    if (!newName.trim()) return;
    onSaveScheme(newName.trim(), newDescription.trim());
    setNewName('');
    setNewDescription('');
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

  const resetImportState = () => {
    setSelectedFile(null);
    setValidatedSchemes([]);
    setValidationErrors([]);
    setSelectedImportIds(new Set());
    setSelectAllImport(false);
  };

  const handleFileChange = async (files: File[]) => {
    if (files && files.length === 1) {
      const file = files[0];
      setSelectedFile(file);

      try {
        const content = await file.text();
        const validation = validateSchemeImport(content, schemes);

        setValidatedSchemes(validation.schemes ?? []);
        setValidationErrors(validation.errors);

        if (validation.schemes && validation.schemes.length > 0) {
          const schemeIds = new Set(validation.schemes.map(s => s.id));
          setSelectedImportIds(schemeIds);
          setSelectAllImport(true);
        } else {
          setSelectedImportIds(new Set());
          setSelectAllImport(false);
        }
      } catch (error) {
        setValidatedSchemes([]);
        setValidationErrors(['Failed to read file']);
        setSelectedImportIds(new Set());
        setSelectAllImport(false);
      }
    } else {
      resetImportState();
    }
  };

  const handleImportToggle = (schemeId: number) => {
    const newSelected = new Set(selectedImportIds);
    if (newSelected.has(schemeId)) {
      newSelected.delete(schemeId);
    } else {
      newSelected.add(schemeId);
    }
    setSelectedImportIds(newSelected);
    setSelectAllImport(newSelected.size === validatedSchemes.length);
  };

  const handleSelectAllImportToggle = () => {
    if (selectAllImport) {
      setSelectedImportIds(new Set());
      setSelectAllImport(false);
    } else {
      setSelectedImportIds(new Set(validatedSchemes.map(s => s.id)));
      setSelectAllImport(true);
    }
  };

  const handleImport = () => {
    const schemesToImport = validatedSchemes
      .filter(s => selectedImportIds.has(s.id))
      .map(s => {
        const { isSelected, ...cleanScheme } = s;
        return cleanScheme;
      });

    if (schemesToImport.length > 0) {
      onImportSchemes(schemesToImport);
      resetImportState();
      setMode('manage');
    }
  };

  const handleExportToggle = (schemeId: number) => {
    const newSelected = new Set(selectedExportIds);
    if (newSelected.has(schemeId)) {
      newSelected.delete(schemeId);
    } else {
      newSelected.add(schemeId);
    }
    setSelectedExportIds(newSelected);
    setSelectAllExport(newSelected.size === schemes.length);
  };

  const handleSelectAllExportToggle = () => {
    if (selectAllExport) {
      setSelectedExportIds(new Set());
      setSelectAllExport(false);
    } else {
      setSelectedExportIds(new Set(schemes.map(s => s.id)));
      setSelectAllExport(true);
    }
  };

  const handleExport = () => {
    const schemesToExport = schemes.filter(s => selectedExportIds.has(s.id));
    if (schemesToExport.length > 0) {
      downloadSchemesAsJson(schemesToExport);
      setMode('manage');
    }
  };

  const handleClose = () => {
    setMode('manage');
    setDeleteConfirmId(null);
    setNewName('');
    setNewDescription('');
    resetImportState();
    onHide();
  };

  const selectedImportCount = selectedImportIds.size;
  const selectedExportCount = selectedExportIds.size;

  const titles: Record<ModalMode, string> = {
    manage: 'Manage Reformat Schemes',
    import: 'Import Reformat Schemes',
    export: 'Export Reformat Schemes'
  };

  return (
    <Modal show={show} onHide={handleClose} size="xl">
      <Modal.Header closeButton>
        <Modal.Title>{titles[mode]}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {mode === 'manage' && (
          <Row>
            <Col>
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
            </Col>
            <Col>
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
                            <SchemeSummary scheme={scheme} />
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
            </Col>
          </Row>
        )}

        {mode === 'import' && (
          <>
            <FileUploadCard
              key="reformatSchemeImport"
              onFilesSelected={handleFileChange}
              acceptedTypes=".json"
              title="Reformat Schemes"
              description="Exported from Ripple"
              multiple={false}
              name="reformatSchemesFile"
            >
              {selectedFile && (
                <div className="mt-2">
                  <small className="text-success">
                    Selected: {selectedFile.name}
                  </small>
                </div>
              )}
            </FileUploadCard>
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

            {validatedSchemes.length > 0 && (
              <>
                <div className="mb-3">
                  <Form.Check
                    type="checkbox"
                    label={`Select All (${validatedSchemes.length} schemes found)`}
                    checked={selectAllImport}
                    onChange={handleSelectAllImportToggle}
                    className="fw-bold"
                  />
                </div>

                <ListGroup style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  {validatedSchemes.map((scheme) => (
                    <ListGroup.Item
                      key={scheme.id}
                      className="d-flex align-items-center"
                    >
                      <Form.Check
                        type="checkbox"
                        checked={selectedImportIds.has(scheme.id)}
                        onChange={() => handleImportToggle(scheme.id)}
                        className="me-3"
                      />
                      <div className="flex-grow-1">
                        <div className="fw-bold">{scheme.name}</div>
                        {scheme.description && (
                          <small className="text-muted d-block">{scheme.description}</small>
                        )}
                        <SchemeSummary scheme={scheme} />
                      </div>
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              </>
            )}

            {selectedFile && validatedSchemes.length === 0 && validationErrors.length === 0 && (
              <div className="text-center py-4 text-muted">
                <FileText size={48} className="mb-2 opacity-50" />
                <div>Processing file...</div>
              </div>
            )}
          </>
        )}

        {mode === 'export' && (
          <>
            <div className="mb-3">
              <Form.Check
                type="checkbox"
                label={`Select All (${schemes.length} schemes)`}
                checked={selectAllExport}
                onChange={handleSelectAllExportToggle}
                className="fw-bold"
              />
            </div>

            <ListGroup style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {schemes.map((scheme) => (
                <ListGroup.Item
                  key={scheme.id}
                  className="d-flex align-items-center"
                >
                  <Form.Check
                    type="checkbox"
                    checked={selectedExportIds.has(scheme.id)}
                    onChange={() => handleExportToggle(scheme.id)}
                    className="me-3"
                  />
                  <div className="flex-grow-1">
                    <div className="fw-bold">{scheme.name}</div>
                    {scheme.description && (
                      <small className="text-muted d-block">{scheme.description}</small>
                    )}
                    <SchemeSummary scheme={scheme} />
                  </div>
                </ListGroup.Item>
              ))}
            </ListGroup>

            {schemes.length === 0 && (
              <div className="text-center py-4 text-muted">
                No schemes available to export
              </div>
            )}
          </>
        )}
      </Modal.Body>
      <Modal.Footer>
        {mode === 'manage' && (
          <>
            <Button
              variant="outline-primary"
              size="sm"
              onClick={onLoadDefaults}
            >
              Load Default Schemes
            </Button>
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={() => setMode('import')}
            >
              <Upload size={16} className="me-1" />
              Import
            </Button>
            <Button
              variant="outline-success"
              size="sm"
              onClick={() => setMode('export')}
              disabled={schemes.length === 0}
            >
              <Download size={16} className="me-1" />
              Export
            </Button>
            <Button variant="secondary" onClick={handleClose}>
              Close
            </Button>
          </>
        )}
        {mode === 'import' && (
          <>
            <div className="me-auto">
              {selectedImportCount > 0 && (
                <small className="text-muted">
                  {selectedImportCount} scheme{selectedImportCount !== 1 ? 's' : ''} selected
                </small>
              )}
            </div>
            <Button
              variant="secondary"
              onClick={() => { resetImportState(); setMode('manage'); }}
            >
              <ArrowLeft size={16} className="me-1" />
              Back
            </Button>
            <Button
              variant="primary"
              onClick={handleImport}
              disabled={selectedImportCount === 0}
            >
              <Upload size={16} className="me-1" />
              Import {selectedImportCount} Scheme{selectedImportCount !== 1 ? 's' : ''}
            </Button>
          </>
        )}
        {mode === 'export' && (
          <>
            <div className="me-auto">
              <small className="text-muted">
                {selectedExportCount} scheme{selectedExportCount !== 1 ? 's' : ''} selected
              </small>
            </div>
            <Button variant="secondary" onClick={() => setMode('manage')}>
              <ArrowLeft size={16} className="me-1" />
              Back
            </Button>
            <Button
              variant="success"
              onClick={handleExport}
              disabled={selectedExportCount === 0}
            >
              <Download size={16} className="me-1" />
              Download JSON
            </Button>
          </>
        )}
      </Modal.Footer>
    </Modal>
  );
};

export default ReformatSchemesModal;