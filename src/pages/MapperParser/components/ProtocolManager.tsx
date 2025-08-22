import React, { useState, useEffect, useContext } from 'react';
import { Button, Form, Card, Row, Col, Accordion } from 'react-bootstrap';
import { Plus, Edit2, Trash2, Copy, Download, Upload } from 'lucide-react';
import {
  Protocol,
  MetadataField,
  //ControlDefinition,
  ParseFormat,
  //NormalizationType,
  //ControlType,
  FieldType,
  PARSE_FORMATS,
  PLATE_SIZES,
  BARCODE_LOCATIONS,
  FIELD_TYPES,
  //NORMALIZATION_TYPES,
  //CONTROL_TYPES,
  ParseStrategy
} from '../../../types/mapperTypes';
import { ProtocolsContext } from '../../../contexts/Context';
import { createNewProtocol, duplicateProtocol, updateProtocol, deleteProtocol, getCurrentProtocol } from '../utils/protocolUtils';
import ExportProtocolsModal from './ExportProtocolsModal';
import ImportProtocolsModal from './ImportProtocolsModal';
import InteractiveDataMapper from './InteractiveDataMapper';
import '../../../css/ProtocolManager.css';
import { PlateSize } from '../../../classes/PlateClass';
import InfoTooltip from '../../../components/InfoTooltip';
import InteractiveControlMapper from './InteractiveControlMapper';
import { ControlDefinition, ControlType, NormalizationType, CONTROL_TYPES, NORMALIZATION_TYPES } from '../../../types/mapperTypes';


const ProtocolManager: React.FC = () => {
  const { protocols, setProtocols, selectedProtocolId, setSelectedProtocolId } = useContext(ProtocolsContext);
  const [isEditing, setIsEditing] = useState(false);
  const [isNewProtocol, setIsNewProtocol] = useState(false);
  const [editingProtocol, setEditingProtocol] = useState<Protocol | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showInteractiveMapper, setShowInteractiveMapper] = useState(false);
  const [showInteractiveControlMapper, setShowInteractiveControlMapper] = useState(false);

  useEffect(() => {
    const selectedProtocol = getCurrentProtocol(protocols, selectedProtocolId);
    if (selectedProtocol) {
      setEditingProtocol(JSON.parse(JSON.stringify(selectedProtocol)));
    } else {
      setEditingProtocol(null);
    }
    if (!isNewProtocol) {
      setIsEditing(false);
    }
    setIsNewProtocol(false);
  }, [selectedProtocolId, protocols]);

  const handleCancelEdit = () => {
    const selectedProtocol = getCurrentProtocol(protocols, selectedProtocolId);
    if (selectedProtocol) {
      setEditingProtocol(JSON.parse(JSON.stringify(selectedProtocol)));
    }
    setIsEditing(false);
  };

  const handleAddProtocol = () => {
    const newProtocol = createNewProtocol(protocols);
    setProtocols([...protocols, newProtocol]);
    setSelectedProtocolId(newProtocol.id);
    setIsNewProtocol(true);
    setIsEditing(true);
  };

  const handleDuplicateProtocol = () => {
    if (editingProtocol) {
      const duplicated = duplicateProtocol(editingProtocol);
      setProtocols([...protocols, duplicated]);
      setSelectedProtocolId(duplicated.id);
    }
  };

  const handleSaveProtocol = () => {
    if (editingProtocol) {
      setProtocols(updateProtocol(protocols, editingProtocol.id, editingProtocol));
      setIsEditing(false);
    }
  };

  const handleDeleteProtocol = () => {
    if (editingProtocol && window.confirm(`Are you sure you want to delete "${editingProtocol.name}"?`)) {
      setProtocols(deleteProtocol(protocols, editingProtocol.id));
      if (selectedProtocolId === editingProtocol.id) {
        setSelectedProtocolId(null);
      }
    }
  };

  const handleImportProtocols = (importedProtocols: Protocol[]) => {
    setProtocols([...protocols, ...importedProtocols]);
  };

  const handleAddMetadataField = () => {
    if (editingProtocol) {
      const newField: MetadataField = {
        name: 'New Field',
        type: 'Free Text',
        required: false
      };
      setEditingProtocol({
        ...editingProtocol,
        metadataFields: [...editingProtocol.metadataFields, newField]
      });
    }
  };

  const handleUpdateMetadataField = (index: number, field: Partial<MetadataField>) => {
    if (editingProtocol) {
      const updatedFields = [...editingProtocol.metadataFields];
      updatedFields[index] = { ...updatedFields[index], ...field };
      setEditingProtocol({
        ...editingProtocol,
        metadataFields: updatedFields
      });
    }
  };

  const handleRemoveMetadataField = (index: number) => {
    if (editingProtocol) {
      setEditingProtocol({
        ...editingProtocol,
        metadataFields: editingProtocol.metadataFields.filter((_, i) => i !== index)
      });
    }
  };

  const handleOpenInteractiveMapper = () => {
    if (!editingProtocol) return;
    setShowInteractiveMapper(true);
  };

  const handleConfirmInteractiveMap = (newStrategyRanges: Partial<ParseStrategy>) => {
    if (editingProtocol) {
      setEditingProtocol(prev => {
        if (!prev) return null;
        return {
          ...prev,
          parseStrategy: {
            ...prev.parseStrategy,
            ...newStrategyRanges // Merge the new ranges
          }
        };
      });
    }
    setShowInteractiveMapper(false);
  };

  const handleAddControl = () => {
    if (editingProtocol) {
      const newControl: ControlDefinition = {
        type: 'MaxCtrl',
        wells: ''
      };
      setEditingProtocol({
        ...editingProtocol,
        dataProcessing: {
          ...editingProtocol.dataProcessing,
          controls: [...editingProtocol.dataProcessing.controls, newControl]
        }
      });
    }
  };

  const handleUpdateControl = (index: number, control: Partial<ControlDefinition>) => {
    if (editingProtocol) {
      const updatedControls = [...editingProtocol.dataProcessing.controls];
      updatedControls[index] = { ...updatedControls[index], ...control };
      setEditingProtocol({
        ...editingProtocol,
        dataProcessing: {
          ...editingProtocol.dataProcessing,
          controls: updatedControls
        }
      });
    }
  };

  const handleRemoveControl = (index: number) => {
    if (editingProtocol) {
      setEditingProtocol({
        ...editingProtocol,
        dataProcessing: {
          ...editingProtocol.dataProcessing,
          controls: editingProtocol.dataProcessing.controls.filter((_, i) => i !== index)
        }
      });
    }
  };

  const handleConfirmControlMapping = (controls: ControlDefinition[]) => {
    if (editingProtocol) {
      setEditingProtocol({
        ...editingProtocol,
        dataProcessing: {
          ...editingProtocol.dataProcessing,
          controls: controls
        }
      });
    }
    setShowInteractiveControlMapper(false);
  };

  const renderBarcodeLocationFields = () => {
    if (!editingProtocol) return null;

    const { parseStrategy } = editingProtocol;

    const barcodeLocationCol = (
      <Col md={6} key="barcode-location">
        <Form.Group className="mb-3">
          <Form.Label>Barcode Location</Form.Label>
          <Form.Select
            value={parseStrategy.plateBarcodeLocation || 'filename'}
            onChange={(e) => setEditingProtocol({
              ...editingProtocol,
              parseStrategy: {
                ...parseStrategy,
                plateBarcodeLocation: e.target.value as 'filename' | 'cell'
              }
            })}
            disabled={!isEditing}
          >
            {BARCODE_LOCATIONS.map(location => (
              <option key={location} value={location}>
                {location === 'filename' ? 'Filename' : 'Cell in file'}
              </option>
            ))}
          </Form.Select>
        </Form.Group>
      </Col>
    );

    let additionalCols: JSX.Element[] = [];

    if (parseStrategy.plateBarcodeLocation === 'cell') {
      additionalCols.push(
        <Col md={6} key="barcode-cell">
          <Form.Group className="mb-3">
            <Form.Label>Barcode Cell</Form.Label>
            <Form.Control
              type="text"
              placeholder="e.g., A01"
              value={parseStrategy.plateBarcodeCell || ''}
              onChange={(e) => setEditingProtocol({
                ...editingProtocol,
                parseStrategy: {
                  ...parseStrategy,
                  plateBarcodeCell: e.target.value
                }
              })}
              disabled={!isEditing}
            />
          </Form.Group>
        </Col>
      );
    } else {
      additionalCols.push(
        <Col md={2} key="full-filename">
          <Form.Group className="mb-3">
            <Form.Label>Full filename?</Form.Label>
            <Form.Switch
              checked={parseStrategy.barcodeDelimiter == null}
              onChange={(e) => setEditingProtocol({
                ...editingProtocol,
                parseStrategy: {
                  ...parseStrategy,
                  barcodeDelimiter: e.target.checked ? null : ''
                }
              })}
              disabled={!isEditing}
              id="fullFilenameSwitch"
            />
          </Form.Group>
        </Col>
      );

      if (parseStrategy.barcodeDelimiter != null) {
        additionalCols.push(
          <Col md={2} key="delimiter">
            <Form.Group className="mb-3">
              <Form.Label>Delimiter</Form.Label>
              <Form.Control
                type="text"
                placeholder="e.g., _"
                value={parseStrategy.barcodeDelimiter || ''}
                onChange={(e) => setEditingProtocol({
                  ...editingProtocol,
                  parseStrategy: {
                    ...parseStrategy,
                    barcodeDelimiter: e.target.value
                  }
                })}
                disabled={!isEditing}
              />
            </Form.Group>
          </Col>,
          <Col md={2} key="chunk">
            <Form.Group className="mb-3">
              <Form.Label>Chunk</Form.Label>
              <Form.Control
                type="number"
                placeholder="0"
                value={parseStrategy.barcodeChunk || 1}
                onChange={(e) =>
                  setEditingProtocol({
                    ...editingProtocol,
                    parseStrategy: {
                      ...parseStrategy,
                      barcodeChunk: parseInt(e.target.value)
                    }
                  })}

                disabled={!isEditing}
              />
            </Form.Group>
          </Col>
        );
      }
    }

    return [barcodeLocationCol, ...additionalCols];
  };


  return (
    <div className="protocol-manager">
      <Row>
        <Col md={8}>
          {editingProtocol ? (
            <>
              <div className="d-flex justify-content-between align-items-center">
                <h5 className="mb-0">{editingProtocol.name}</h5>
                <div>
                  {isEditing ? (
                    <>
                      <Button size="sm" variant="success" onClick={handleSaveProtocol} className="me-2">
                        Save
                      </Button>
                      <Button size="sm" variant="secondary" onClick={handleCancelEdit}>
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button size="sm" variant="primary" onClick={() => setIsEditing(true)} className="me-2">
                        <Edit2 size={16} /> Edit
                      </Button>
                      <Button size="sm" variant="info" onClick={handleDuplicateProtocol} className="me-2">
                        <Copy size={16} /> Duplicate
                      </Button>
                      <Button size="sm" variant="danger" onClick={handleDeleteProtocol}>
                        <Trash2 size={16} /> Delete
                      </Button>
                    </>
                  )}
                </div>
              </div>
              <Accordion defaultActiveKey={['0', '1', '2']} alwaysOpen>
                <Accordion.Item eventKey="0">
                  <Accordion.Header>Basic Information</Accordion.Header>
                  <Accordion.Body>
                    <Row>
                      <Col md={4}>
                        <Form.Group className="mb-3">
                          <Form.Label>Name</Form.Label>
                          <Form.Control
                            type="text"
                            value={editingProtocol.name}
                            onChange={(e) => setEditingProtocol({ ...editingProtocol, name: e.target.value })}
                            disabled={!isEditing}
                          />
                        </Form.Group>
                      </Col>
                      <Col md={3}>
                        <Form.Group className="mb-3">
                          <Form.Label>Format</Form.Label>
                          <Form.Select
                            value={editingProtocol.parseStrategy.format}
                            onChange={(e) => setEditingProtocol({
                              ...editingProtocol,
                              parseStrategy: {
                                ...editingProtocol.parseStrategy,
                                format: e.target.value as ParseFormat
                              }
                            })}
                            disabled={!isEditing}
                          >
                            {PARSE_FORMATS.map(format => (
                              <option key={format} value={format}>{format}</option>
                            ))}
                          </Form.Select>
                        </Form.Group>
                      </Col>

                      <Col md={3}>
                        <Form.Group className="mb-3">
                          <Form.Label>Plate Size</Form.Label>
                          <Form.Select
                            value={editingProtocol.parseStrategy.plateSize}
                            onChange={(e) => setEditingProtocol({
                              ...editingProtocol,
                              parseStrategy: {
                                ...editingProtocol.parseStrategy,
                                plateSize: e.target.value as PlateSize
                              }
                            })}
                            disabled={!isEditing}
                          >
                            {PLATE_SIZES.map(size => (
                              <option key={size} value={size}>{size}</option>
                            ))}
                          </Form.Select>
                        </Form.Group>
                      </Col>
                      <Col md={2}>
                        <Form.Group className="mb-3">
                          <Form.Label>Auto-Parse?</Form.Label><span style={{ float: 'right' }}><InfoTooltip text='Attempts to find the most likely matrix present in a file, biasing toward full plates and proportion of numeric cells.' /></span>
                          <Form.Switch
                            checked={editingProtocol.parseStrategy.autoParse}
                            onChange={(e) => setEditingProtocol({
                              ...editingProtocol,
                              parseStrategy: {
                                ...editingProtocol.parseStrategy,
                                autoParse: e.target.checked
                              }
                            })}
                            disabled={!isEditing}
                            id="autoParseSwitch"
                          />
                        </Form.Group>
                      </Col>
                    </Row>

                    <Form.Group className="mb-3">
                      <Form.Label>Description</Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={2}
                        value={editingProtocol.description || ''}
                        onChange={(e) => setEditingProtocol({ ...editingProtocol, description: e.target.value })}
                        disabled={!isEditing}
                      />
                    </Form.Group>
                    <Row>{renderBarcodeLocationFields()}</Row>
                    {isEditing && editingProtocol.parseStrategy.format == 'Matrix' && !editingProtocol.parseStrategy.autoParse && (
                      <Button
                        variant="outline-primary"
                        size="sm"
                        className="mb-3"
                        onClick={handleOpenInteractiveMapper}
                      >
                        Define Data Layout Interactively
                      </Button>
                    )}
                    {!editingProtocol.parseStrategy.autoParse ? (
                      <>
                        <Form.Group className="mb-3">
                          <Form.Label>Raw Data Range</Form.Label>
                          <Form.Control
                            type="text"
                            placeholder="e.g., B10:Y25"
                            value={editingProtocol.parseStrategy.rawData}
                            onChange={(e) => setEditingProtocol({
                              ...editingProtocol,
                              parseStrategy: {
                                ...editingProtocol.parseStrategy,
                                rawData: e.target.value
                              }
                            })}
                            disabled={!isEditing}
                          />
                        </Form.Group>

                        {editingProtocol.parseStrategy.format === 'Matrix' ? (
                          <Row>
                            <Col md={6}>
                              <Form.Group className="mb-3">
                                <Form.Label>X Labels (Columns)</Form.Label><span style={{ float: 'right' }}><InfoTooltip text='Only necessary if reading a partial plate' /></span>
                                <Form.Control
                                  type="text"
                                  placeholder="e.g., A09:X09"
                                  value={editingProtocol.parseStrategy.xLabels || ''}
                                  onChange={(e) => setEditingProtocol({
                                    ...editingProtocol,
                                    parseStrategy: {
                                      ...editingProtocol.parseStrategy,
                                      xLabels: e.target.value
                                    }
                                  })}
                                  disabled={!isEditing}
                                />
                              </Form.Group>
                            </Col>
                            <Col md={6}>
                              <Form.Group className="mb-3">
                                <Form.Label>Y Labels (Rows)</Form.Label><span style={{ float: 'right' }}><InfoTooltip text='Only necessary if reading a partial plate' /></span>
                                <Form.Control
                                  type="text"
                                  placeholder="e.g., A10:A25"
                                  value={editingProtocol.parseStrategy.yLabels || ''}
                                  onChange={(e) => setEditingProtocol({
                                    ...editingProtocol,
                                    parseStrategy: {
                                      ...editingProtocol.parseStrategy,
                                      yLabels: e.target.value
                                    }
                                  })}
                                  disabled={!isEditing}
                                />
                              </Form.Group>
                            </Col>
                          </Row>
                        ) : (
                          <Form.Group className="mb-3">
                            <Form.Label>Well IDs Column</Form.Label>
                            <Form.Control
                              type="text"
                              placeholder="e.g., E02:E385"
                              value={editingProtocol.parseStrategy.wellIDs || ''}
                              onChange={(e) => setEditingProtocol({
                                ...editingProtocol,
                                parseStrategy: {
                                  ...editingProtocol.parseStrategy,
                                  wellIDs: e.target.value
                                }
                              })}
                              disabled={!isEditing}
                            />
                          </Form.Group>
                        )}
                      </>
                    ) : ''}
                  </Accordion.Body>
                </Accordion.Item>

                <Accordion.Item eventKey="1">
                  <Accordion.Header>Metadata Fields</Accordion.Header>
                  <Accordion.Body>
                    {editingProtocol.metadataFields.map((field, index) => (
                      <Card key={index} className="mb-2 sub-card">
                        <Card.Body>
                          <Row>
                            <Col md={4}>
                              <Form.Group>
                                <Form.Label>Field Name</Form.Label>
                                <Form.Control
                                  type="text"
                                  value={field.name}
                                  onChange={(e) => handleUpdateMetadataField(index, { name: e.target.value })}
                                  disabled={!isEditing}
                                />
                              </Form.Group>
                            </Col>
                            <Col md={3}>
                              <Form.Group>
                                <Form.Label>Type</Form.Label>
                                <Form.Select
                                  value={field.type}
                                  onChange={(e) => handleUpdateMetadataField(index, { type: e.target.value as FieldType })}
                                  disabled={!isEditing}
                                >
                                  {FIELD_TYPES.map(type => (
                                    <option key={type} value={type}>{type}</option>
                                  ))}
                                </Form.Select>
                              </Form.Group>
                            </Col>
                            <Col md={2}>
                              <Form.Group>
                                <Form.Label>Required</Form.Label>
                                <Form.Check
                                  type="checkbox"
                                  checked={field.required}
                                  onChange={(e) => handleUpdateMetadataField(index, { required: e.target.checked })}
                                  disabled={!isEditing}
                                />
                              </Form.Group>
                            </Col>
                            <Col md={2}>
                              <Form.Group>
                                <Form.Label>Default</Form.Label>
                                <Form.Control
                                  type="text"
                                  value={field.defaultValue?.toString() || ''}
                                  onChange={(e) => handleUpdateMetadataField(index, { defaultValue: e.target.value })}
                                  disabled={!isEditing}
                                />
                              </Form.Group>
                            </Col>
                            <Col md={1} className="d-flex align-items-end">
                              {isEditing && (
                                <Button
                                  size="sm"
                                  variant="danger"
                                  onClick={() => handleRemoveMetadataField(index)}
                                >
                                  <Trash2 size={16} />
                                </Button>
                              )}
                            </Col>
                          </Row>
                          {field.type === 'PickList' && (
                            <Row className="mt-2">
                              <Col md={4}>
                                <Form.Group>
                                  <Form.Label>Add Value</Form.Label>
                                  <Form.Control
                                    type="text"
                                    placeholder="Type value and press Enter"
                                    disabled={!isEditing}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' || e.key === 'Return') {
                                        e.preventDefault();
                                        const input = e.target as HTMLInputElement;
                                        const newValue = input.value.trim();
                                        if (newValue && !(field.values || []).includes(newValue)) {
                                          handleUpdateMetadataField(index, {
                                            values: [...(field.values || []), newValue]
                                          });
                                          input.value = '';
                                        }
                                      }
                                    }}
                                  />
                                </Form.Group>
                              </Col>
                              <Col md={8}>
                                <Form.Group>
                                  <Form.Label>Current Values</Form.Label>
                                  <div className="d-flex flex-wrap gap-1 p-2 border rounded" style={{ minHeight: '38px', alignItems: 'flex-start' }}>
                                    {(field.values || []).map((value, valueIndex) => (
                                      <span
                                        key={valueIndex}
                                        className="badge bg-secondary d-flex align-items-center"
                                        style={{ fontSize: '0.75rem' }}
                                      >
                                        {value}
                                        {isEditing && (
                                          <button
                                            type="button"
                                            className="btn-close btn-close-white ms-1"
                                            style={{ fontSize: '0.5rem', padding: '0', margin: '0' }}
                                            onClick={() => handleUpdateMetadataField(index, {
                                              values: field.values?.filter((_, i) => i !== valueIndex) || []
                                            })}
                                          />
                                        )}
                                      </span>
                                    ))}
                                    {(!field.values || field.values.length === 0) && (
                                      <span className="text-muted small">No values added</span>
                                    )}
                                  </div>
                                </Form.Group>
                              </Col>
                            </Row>
                          )}
                        </Card.Body>
                      </Card>
                    ))}
                    {isEditing && (
                      <Button variant="primary" onClick={handleAddMetadataField}>
                        <Plus size={16} /> Add Field
                      </Button>
                    )}
                  </Accordion.Body>
                </Accordion.Item>

                <Accordion.Item eventKey="2">
                  <Accordion.Header>Data Processing</Accordion.Header>
                  <Accordion.Body>
                    <Form.Group className="mb-3">
                      <Form.Label>Normalization</Form.Label>
                      <Form.Select
                        value={editingProtocol.dataProcessing.normalization}
                        onChange={(e) => setEditingProtocol({
                          ...editingProtocol,
                          dataProcessing: {
                            ...editingProtocol.dataProcessing,
                            normalization: e.target.value as NormalizationType
                          }
                        })}
                        disabled={!isEditing}
                      >
                        {NORMALIZATION_TYPES.map(type => (
                          <option key={type} value={type}>
                            {type === 'PctOfCtrl' ? 'Percent of Control' : type}
                          </option>
                        ))}
                      </Form.Select>
                    </Form.Group>

                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <h6 className="mb-0">Controls <InfoTooltip text='"MinCtrl" is the lowest response value, and "MaxCtrl" is the highest response value. "Blank" is subtracted from every well before normalization.' /></h6>
                      {isEditing && (
                        <Button size="sm" variant="outline-primary" onClick={() => setShowInteractiveControlMapper(true)}>
                          Interactive Selection
                        </Button>
                      )}
                    </div>

                    {editingProtocol.dataProcessing.controls.map((control, index) => (
                      <Card key={index} className="mb-2 sub-card">
                        <Card.Body>
                          <Row>
                            <Col md={4}>
                              <Form.Group>
                                <Form.Label>Type</Form.Label>
                                <Form.Select
                                  value={control.type}
                                  onChange={(e) => handleUpdateControl(index, { type: e.target.value as ControlType })}
                                  disabled={!isEditing}
                                >
                                  {CONTROL_TYPES.map(type => (
                                    <option key={type} value={type}>
                                      {type}
                                    </option>
                                  ))}
                                </Form.Select>
                              </Form.Group>
                            </Col>
                            <Col md={6}>
                              <Form.Group>
                                <Form.Label>Wells</Form.Label>
                                <Form.Control
                                  type="text"
                                  placeholder="e.g., A01:A24 or A01:B12;P01:P24"
                                  value={control.wells || ''}
                                  onChange={(e) => handleUpdateControl(index, { wells: e.target.value })}
                                  disabled={!isEditing}
                                />
                              </Form.Group>
                            </Col>
                            <Col md={2} className="d-flex align-items-end">
                              {isEditing && (
                                <Button
                                  size="sm"
                                  variant="danger"
                                  onClick={() => handleRemoveControl(index)}
                                >
                                  <Trash2 size={16} />
                                </Button>
                              )}
                            </Col>
                          </Row>
                        </Card.Body>
                      </Card>
                    ))}
                    {isEditing && (
                      <Button variant="primary" onClick={handleAddControl}>
                        <Plus size={16} /> Add Control
                      </Button>
                    )}
                  </Accordion.Body>
                </Accordion.Item>
              </Accordion>
            </>
          ) : (
            <Card>
              <Card.Body className="text-center py-5">
                <p className="text-muted">Select a protocol to view details</p>
              </Card.Body>
            </Card>
          )}
        </Col>

        <Col md={4}>
          <Card>
            <Card.Header>
              <h6 className="mb-0">Protocol Management</h6>
            </Card.Header>
            <Card.Body>
              <div className="d-grid gap-2">
                <Button variant="success" onClick={handleAddProtocol}>
                  <Plus size={16} className="me-1" />
                  New Protocol
                </Button>

                <hr className="my-3" />

                <Button
                  variant="primary"
                  onClick={() => setShowExportModal(true)}
                  disabled={protocols.length === 0}
                >
                  <Download size={16} className="me-1" />
                  Export Protocols
                </Button>

                <Button variant="outline-primary" onClick={() => setShowImportModal(true)}>
                  <Upload size={16} className="me-1" />
                  Import Protocols
                </Button>
              </div>

              {protocols.length === 0 && (
                <div className="text-center mt-3">
                  <small className="text-muted">
                    No protocols available.<br />
                    Create a new protocol or import existing ones.
                  </small>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <ExportProtocolsModal
        show={showExportModal}
        onHide={() => setShowExportModal(false)}
        protocols={protocols}
      />

      <ImportProtocolsModal
        show={showImportModal}
        onHide={() => setShowImportModal(false)}
        onImport={handleImportProtocols}
        existingProtocols={protocols}
      />

      {editingProtocol && (
        <InteractiveDataMapper
          show={showInteractiveMapper}
          onHide={() => setShowInteractiveMapper(false)}
          currentParseStrategy={editingProtocol.parseStrategy}
          onConfirm={handleConfirmInteractiveMap}
        />
      )}
      {editingProtocol && (
        <InteractiveControlMapper
          show={showInteractiveControlMapper}
          onHide={() => setShowInteractiveControlMapper(false)}
          currentControls={editingProtocol.dataProcessing.controls}
          plateSize={editingProtocol.parseStrategy.plateSize}
          onConfirm={handleConfirmControlMapping}
        />
      )}
    </div>
  );
};

export default ProtocolManager;