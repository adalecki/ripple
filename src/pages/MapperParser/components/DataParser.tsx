import React, { useContext, useState, useEffect } from 'react';
import { Container, Row, Col, Form, Button, Alert, Card, Badge, Accordion } from 'react-bootstrap';
import { FileText, CheckCircle, XCircle, AlertTriangle, Download, Settings } from 'lucide-react';
import { MappedPlatesContext, ProtocolsContext } from '../../../contexts/Context';
import { Protocol } from '../../../types/mapperTypes';
import { parseDataFile, applyParsedDataToPlates, ParsedData, hasResponseData, getPlatesWithResponseData } from '../utils/parserUtils';
import { exportDestinationPlatesCSV } from '../utils/exportUtils';
import { currentPlate } from '../../../utils/plateUtils';
import PlateView from '../../../components/PlateView';
import { ColorConfig } from '../../../utils/wellColors';
import '../../../css/DataParser.css';
import FileUploadCard from '../../../components/FileUploadCard';

interface FileUploadStatus {
  file: File;
  status: 'pending' | 'success' | 'error';
  message?: string;
  parsedData?: ParsedData[];
}

interface MetadataValues {
  [fieldName: string]: string | number;
}

const DataParser: React.FC = () => {
  const { mappedPlates, setMappedPlates, curMappedPlateId } = useContext(MappedPlatesContext);
  const { protocols } = useContext(ProtocolsContext);

  const [selectedProtocol, setSelectedProtocol] = useState<Protocol | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<FileUploadStatus[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [metadataValues, setMetadataValues] = useState<MetadataValues>({});
  const plate = currentPlate(mappedPlates, curMappedPlateId);
  const [normalizedResponse, setNormalizedResponse] = useState<Boolean>(false)

  useEffect(() => {
    if (selectedProtocol) {
      const curPro = protocols.find(p => p.id == selectedProtocol!.id)
      if (curPro) setSelectedProtocol(curPro)
    }
    else if (protocols.length > 0 && !selectedProtocol) {
      setSelectedProtocol(protocols[0]);
    }
  }, [protocols]);

  useEffect(() => {
    if (selectedProtocol) {
      const newMetadataValues: MetadataValues = {};
      selectedProtocol.metadataFields.forEach(field => {
        newMetadataValues[field.name] = field.defaultValue || '';
      });
      setMetadataValues(newMetadataValues);
    }
  }, [selectedProtocol]);

  const handleNormalizationChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setNormalizedResponse(event.target.value === 'true');
  };

  async function handleFiles(files: File[]) {
    if (!selectedProtocol) {
      setErrors(['Please select a protocol before uploading files']);
      return;
    }

    const newFiles: FileUploadStatus[] = files.map(file => ({
      file,
      status: 'pending' as const
    }));
    setUploadedFiles(prev => [...prev, ...newFiles]);

    for (let i = 0; i < newFiles.length; i++) {
      const fileStatus = newFiles[i];
      const result = await parseDataFile(fileStatus.file, selectedProtocol);

      const updatedStatus: FileUploadStatus = {
        ...fileStatus,
        status: result.success ? 'success' : 'error',
        message: result.success ? `Parsed ${result.data?.length || 0} plate(s)` : result.errors.join(', '),
        parsedData: result.data
      };

      setUploadedFiles(prev => {
        const updated = [...prev];
        const index = prev.findIndex(f => f.file === fileStatus.file);
        if (index >= 0) {
          updated[index] = updatedStatus;
        }
        return updated;
      });
    }
  }

  const handleMetadataChange = (fieldName: string, value: string | number) => {
    setMetadataValues(prev => ({
      ...prev,
      [fieldName]: value
    }));
  }

  function validateMetadata(): string[] {
    const validationErrors: string[] = [];
    if (selectedProtocol) {
      selectedProtocol.metadataFields.forEach(field => {
        if (field.required) {
          const value = metadataValues[field.name];
          if (value === undefined || value === null || value === '') {
            validationErrors.push(`${field.name} is required`);
          }
        }
      });
    }
    return validationErrors;
  }

  const handleApplyData = () => {
    if (!selectedProtocol) return;
    setErrors([]);

    const metadataErrors = validateMetadata();
    if (metadataErrors.length > 0) {
      setErrors(metadataErrors);
      return;
    }

    const allParsedData: ParsedData[] = [];
    uploadedFiles.forEach(fileStatus => {
      if (fileStatus.status === 'success' && fileStatus.parsedData) {
        allParsedData.push(...fileStatus.parsedData);
      }
    });

    if (allParsedData.length === 0) {
      setErrors(['No successfully parsed data to apply']);
      return;
    }

    const { updatedPlates, errors: applyErrors } = applyParsedDataToPlates(
      mappedPlates,
      allParsedData,
      selectedProtocol
    );

    if (applyErrors.length > 0) {
      setErrors(applyErrors);
    } else {
      const currentParsedBarcodes = new Set(
        allParsedData.map(data => data.barcode)
      );

      const platesCopy = updatedPlates.map(plate => {
        const plateCopy = plate.clone();

        if (currentParsedBarcodes.has(plateCopy.barcode)) {
          const hasResponseData = Object.values(plateCopy.getWells()).some(well =>
            well && well.rawResponse !== null
          );

          if (hasResponseData) {
            Object.entries(metadataValues).forEach(([fieldName, value]) => {
              plateCopy.metadata[fieldName] = value;
            });
          }
        }
        return plateCopy;
      });

      setMappedPlates(platesCopy);
      setUploadedFiles([]);
    }
  }

  const handleExportCSV = () => {
    if (!selectedProtocol) {
      setErrors(['Please select a protocol before exporting']);
      return;
    }

    const platesWithData = getPlatesWithResponseData(mappedPlates);
    if (platesWithData.length === 0) {
      setErrors(['No destination plates with response data found for export']);
      return;
    }

    exportDestinationPlatesCSV(platesWithData, selectedProtocol);
  }

  function removeFile(index: number) {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  }

  const showExportButton = hasResponseData(mappedPlates) && selectedProtocol;
  const platesWithDataCount = getPlatesWithResponseData(mappedPlates).length;

  const colorConfig: ColorConfig = {
    scheme: (normalizedResponse ? 'normalizedResponse' : 'rawResponse'),
    colorMap: new Map(),
    responseRange: plate?.metadata.globalMinResponse !== undefined && plate?.metadata.globalMaxResponse !== undefined
      ? { min: plate.metadata.globalMinResponse, max: plate.metadata.globalMaxResponse }
      : undefined
  };

  const hasResponseDataForPlate = plate && Object.values(plate.getWells()).some(well =>
    well.rawResponse !== null || well.normalizedResponse !== null
  );

  function renderFileInformation() {
    if (uploadedFiles.length < 1) return null;

    return (
      <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
        {uploadedFiles.map((fileStatus, index) => (
          <div key={index} className="d-flex align-items-center p-1 border-bottom">
            <FileText size={12} className="me-2 text-muted" />
            <div className="flex-grow-1" style={{ minWidth: 0 }}>
              <div className="small text-truncate">{fileStatus.file.name}</div>
              {fileStatus.message && (
                <div className={`small ${fileStatus.status === 'error' ? 'text-danger' : 'text-success'}`}>
                  {fileStatus.message}
                </div>
              )}
            </div>
            <div className="ms-2">
              {fileStatus.status === 'pending' && <Badge bg="secondary" className="small">...</Badge>}
              {fileStatus.status === 'success' && <CheckCircle size={16} className="text-success" />}
              {fileStatus.status === 'error' && <XCircle size={16} className="text-danger" />}
            </div>
            <Button
              size="sm"
              variant="link"
              className="text-danger ms-1 p-0"
              onClick={() => removeFile(index)}
            >
              x
            </Button>
          </div>
        ))}
        <Button
          size="sm"
          variant="primary"
          className="w-100 mt-2"
          onClick={handleApplyData}
          disabled={!uploadedFiles.some(f => f.status === 'success')}
        >
          Apply Data to Plates
        </Button>
      </div>
    )
  }

  function renderMetadataForm() {
    if (!selectedProtocol || selectedProtocol.metadataFields.length === 0) {
      return null;
    }

    return (
      <Accordion className="mb-3">
        <Accordion.Item eventKey="0">
          <Accordion.Header>
            <Settings size={16} className="me-2" />
            Metadata ({selectedProtocol.metadataFields.length} fields)
          </Accordion.Header>
          <Accordion.Body>
            <Row>
              {selectedProtocol.metadataFields.map(field => (
                <Col md={6} key={field.name} className="mb-2">
                  <Form.Group >
                    <Form.Label className="small">
                      {field.name}
                      {field.required && <span className="text-danger ms-1">*</span>}
                    </Form.Label>
                    {field.type === 'PickList' && field.values ? (
                      <Form.Select
                        size="sm"
                        value={metadataValues[field.name] || ''}
                        onChange={(e) => handleMetadataChange(field.name, e.target.value)}
                      >
                        <option value="">Select...</option>
                        {field.values.map(value => (
                          <option key={value} value={value}>{value}</option>
                        ))}
                      </Form.Select>
                    ) : (
                      <Form.Control
                        size="sm"
                        type="text"
                        value={metadataValues[field.name] || ''}
                        onChange={(e) => handleMetadataChange(field.name, e.target.value)}
                        placeholder={field.defaultValue?.toString() || ''}
                      />
                    )}
                  </Form.Group>
                </Col>
              ))}
            </Row>
          </Accordion.Body>
        </Accordion.Item>
      </Accordion>
    );
  };

  return (
    <Container fluid className='h-100'>
      <Row className='h-100'>
        <Col md={4} className='d-flex flex-column h-100 overflow-auto' style={{ scrollbarGutter: 'stable' }}>
          <h4>Data Parser</h4>
          <p>Upload data files and parse them according to the selected protocol</p>
          <Row className="mb-3" >
            <Col>
              <Form.Group>
                <Form.Label className="small fw-bold">Protocol</Form.Label>
                <Form.Select
                  size="sm"
                  value={selectedProtocol?.id || ''}
                  onChange={(e) => {
                    const protocol = protocols.find(p => p.id === parseInt(e.target.value));
                    setSelectedProtocol(protocol || null);
                  }}
                  disabled={uploadedFiles.length > 0}
                >
                  <option value="">Select protocol...</option>
                  {protocols.map(protocol => (
                    <option key={protocol.id} value={protocol.id}>
                      {protocol.name}
                    </option>
                  ))}
                </Form.Select>
                {selectedProtocol && (
                  <Form.Text className="text-muted">
                    {selectedProtocol.parseStrategy.format} | {selectedProtocol.parseStrategy.plateSize} wells
                  </Form.Text>
                )}
              </Form.Group>
            </Col>
          </Row>

          {renderMetadataForm()}

          <FileUploadCard onFilesSelected={handleFiles} title='Raw Data Files'>{renderFileInformation()}</FileUploadCard>

          {showExportButton && (
            <Card className="mb-3">
              <Card.Body className="p-2">
                <div className='d-flex justify-content-between align-items-center'>
                  <Form>
                    <Form.Check
                      type="radio"
                      label="Normalized"
                      name="dataType"
                      value="true"
                      checked={normalizedResponse === true}
                      onChange={handleNormalizationChange}
                      inline
                    />
                    <Form.Check
                      type="radio"
                      label="Raw Data"
                      name="dataType"
                      value="false"
                      checked={normalizedResponse === false}
                      onChange={handleNormalizationChange}
                      inline
                    />
                  </Form>
                  {hasResponseDataForPlate && colorConfig.responseRange && (
                    <div className="text-center">
                      <small className="text-muted">
                        Response Range: {colorConfig.responseRange.min.toFixed(2)} - {colorConfig.responseRange.max.toFixed(2)}
                      </small>
                    </div>
                  )}
                </div>
                <div className="mb-1">
                  <small className="text-muted">
                    {platesWithDataCount} plate{platesWithDataCount !== 1 ? 's' : ''} with data
                  </small>
                </div>
                <div className="d-flex align-items-center gap-2">
                  <Button
                    variant="success"
                    className="w-50"
                    onClick={handleExportCSV}
                  >
                    <Download size={14} className="me-1" />
                    Export CSV
                  </Button>
                  <Button variant="outline-danger" className="w-50" onClick={() => setMappedPlates([])}>Clear Plates</Button>
                </div>
              </Card.Body>
            </Card>
          )}

          {errors.length > 0 && (
            <Alert variant="danger" dismissible onClose={() => setErrors([])} className="p-2">
              <div className="d-flex align-items-start">
                <AlertTriangle size={16} className="me-2 mt-1" />
                <div>
                  <div className="small fw-bold">Errors:</div>
                  {errors.map((error, index) => (
                    <div key={index} className="small">{error}</div>
                  ))}
                </div>
              </div>
            </Alert>
          )}
        </Col>
        <Col md={8} className='d-flex flex-column h-100 overflow-auto' style={{ scrollbarGutter: 'stable' }}>
          {plate ? (
            <PlateView
              plate={plate}
              view="response"
              colorConfig={colorConfig}
            />
          ) : (
            <Card>
              <Card.Body className="text-center py-5">
                <p className="text-muted">No plates available. Please use the Plate Mapper first.</p>
              </Card.Body>
            </Card>
          )}
        </Col>
      </Row>
    </Container>
  );
};

export default DataParser;