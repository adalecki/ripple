import React, { useContext, useState, useRef, useEffect } from 'react';
import { Container, Row, Col, Form, Button, Alert, Card, ListGroup, Badge } from 'react-bootstrap';
import { Upload, FileText, CheckCircle, XCircle, AlertTriangle, Download } from 'lucide-react';
import { MappedPlatesContext, ProtocolsContext } from '../../../contexts/Context';
import { Protocol } from '../../../types/mapperTypes';
import { parseDataFile, applyParsedDataToPlates, ParsedData } from '../utils/parserUtils';
import { exportDestinationPlatesCSV, getDestinationPlates } from '../utils/exportUtils';
import { currentPlate } from '../../EchoTransfer/utils/plateUtils';
import PlateView from '../../../components/PlateView';
import { ColorConfig } from '../../EchoTransfer/utils/wellColors';
import '../../../css/DataParser.css';

interface FileUploadStatus {
  file: File;
  status: 'pending' | 'success' | 'error';
  message?: string;
  parsedData?: ParsedData[];
}

function hasResponseData(plates: any[]): boolean {
  const destinationPlates = getDestinationPlates(plates);
  return destinationPlates.some(plate => 
    Object.values(plate.getWells()).some((well: any) => 
      well && (well.rawResponse !== null || well.normalizedResponse !== null)
    )
  );
}

function getPlatesWithResponseData(plates: any[]) {
  const destinationPlates = getDestinationPlates(plates);
  return destinationPlates.filter(plate => 
    Object.values(plate.getWells()).some((well: any) => 
      well && (well.rawResponse !== null || well.normalizedResponse !== null)
    )
  );
}

const DataParser: React.FC = () => {
  const { mappedPlates, setMappedPlates, curMappedPlateId } = useContext(MappedPlatesContext);
  const { protocols } = useContext(ProtocolsContext);
  
  const [selectedProtocol, setSelectedProtocol] = useState<Protocol | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<FileUploadStatus[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  //const [showNormalized, setShowNormalized] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const plate = currentPlate(mappedPlates, curMappedPlateId);

  useEffect(() => {
    if (selectedProtocol) {
      const curPro = protocols.find(p => p.id == selectedProtocol!.id)
      if (curPro) setSelectedProtocol(curPro)
    }
    else if (protocols.length > 0 && !selectedProtocol) {
      setSelectedProtocol(protocols[0]);
    }
  }, [protocols]);

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      handleFiles(files);
    }
  }

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
    
    // Parse each file
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

  function handleApplyData() {
    if (!selectedProtocol) return;
    setErrors([]);
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
      selectedProtocol.dataProcessing.normalization
    );
    
    if (applyErrors.length > 0) {
      setErrors(applyErrors);
    } else {
      setMappedPlates(updatedPlates);
      setUploadedFiles([]); // Clear files after successful application
    }
  }

  function handleExportCSV() {
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

  function handleClearFiles() {
    setUploadedFiles([]);
    setErrors([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  function removeFile(index: number) {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  }

  const showExportButton = hasResponseData(mappedPlates) && selectedProtocol;
  const platesWithDataCount = getPlatesWithResponseData(mappedPlates).length;

  const colorConfig: ColorConfig = {
    scheme: 'response',
    colorMap: new Map(),
    responseRange: plate?.metadata.globalMinResponse !== undefined && plate?.metadata.globalMaxResponse !== undefined
      ? { min: plate.metadata.globalMinResponse, max: plate.metadata.globalMaxResponse }
      : undefined
  };

  const hasResponseDataForPlate = plate && Object.values(plate.getWells()).some(well => 
    well.rawResponse !== null || well.normalizedResponse !== null
  );


  return (
    <Container fluid>
      <Row className="mb-3">
        <Col md={12}>
          <h4>Data Parser</h4>
          <p>Upload data files and parse them according to the selected protocol</p>
        </Col>
      </Row>

      <Row>
        <Col md={3}>
          <Card className="mb-3">
            <Card.Header>Protocol Selection</Card.Header>
            <Card.Body>
              <Form.Group>
                <Form.Label>Select Protocol</Form.Label>
                <Form.Select
                  value={selectedProtocol?.id || ''}
                  onChange={(e) => {
                    const protocol = protocols.find(p => p.id === parseInt(e.target.value));
                    setSelectedProtocol(protocol || null);
                  }}
                  disabled={uploadedFiles.length > 0}
                >
                  <option value="">Select a protocol...</option>
                  {protocols.map(protocol => (
                    <option key={protocol.id} value={protocol.id}>
                      {protocol.name} ({protocol.parseStrategy.format})
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
              {selectedProtocol && (
                <div className="mt-2">
                  <small className="text-muted">
                    Format: {selectedProtocol.parseStrategy.format}<br />
                    Plate Size: {selectedProtocol.parseStrategy.plateSize} wells<br />
                    Barcode: {selectedProtocol.parseStrategy.plateBarcodeLocation === 'filename' ? 'From filename' : `Cell ${selectedProtocol.parseStrategy.plateBarcodeCell}`}
                  </small>
                </div>
              )}
            </Card.Body>
          </Card>

          <Card className="mb-3">
            <Card.Header>File Upload</Card.Header>
            <Card.Body>
              <div
                className={`drop-zone ${isDragging ? 'dragging' : ''}`}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={48} className="mb-2" />
                <p>Drag and drop files here or click to browse</p>
                <small className="text-muted">(.csv, .tsv, .txt)</small>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".csv,.tsv,.txt"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
            </Card.Body>
          </Card>

          {uploadedFiles.length > 0 && (
            <Card className="mb-3">
              <Card.Header>
                <div className="d-flex justify-content-between align-items-center">
                  <span>Uploaded Files</span>
                  <Button size="sm" variant="outline-danger" onClick={handleClearFiles}>
                    Clear All
                  </Button>
                </div>
              </Card.Header>
              <ListGroup variant="flush">
                {uploadedFiles.map((fileStatus, index) => (
                  <ListGroup.Item key={index} className="d-flex align-items-center">
                    <FileText size={20} className="me-2" />
                    <div className="flex-grow-1">
                      <div>{fileStatus.file.name}</div>
                      {fileStatus.message && (
                        <small className={fileStatus.status === 'error' ? 'text-danger' : 'text-success'}>
                          {fileStatus.message}
                        </small>
                      )}
                    </div>
                    <div className="ms-2">
                      {fileStatus.status === 'pending' && <Badge bg="secondary">Parsing...</Badge>}
                      {fileStatus.status === 'success' && <CheckCircle size={20} className="text-success" />}
                      {fileStatus.status === 'error' && <XCircle size={20} className="text-danger" />}
                    </div>
                    <Button
                      size="sm"
                      variant="link"
                      className="text-danger ms-2"
                      onClick={() => removeFile(index)}
                    >
                      ×
                    </Button>
                  </ListGroup.Item>
                ))}
              </ListGroup>
              <Card.Body>
                <Button
                  variant="primary"
                  className="w-100"
                  onClick={handleApplyData}
                  disabled={!uploadedFiles.some(f => f.status === 'success')}
                >
                  Apply Data to Plates
                </Button>
              </Card.Body>
            </Card>
          )}

          {showExportButton && (
            <Card className="mb-3">
              <Card.Header>Export Results</Card.Header>
              <Card.Body>
                <div className="mb-2">
                  <small className="text-muted">
                    {platesWithDataCount} destination plate{platesWithDataCount !== 1 ? 's' : ''} with response data
                  </small>
                </div>
                <Button
                  variant="success"
                  className="w-100"
                  onClick={handleExportCSV}
                >
                  <Download size={16} className="me-1" />
                  Export to CSV
                </Button>
              </Card.Body>
            </Card>
          )}

          {errors.length > 0 && (
            <Alert variant="danger" dismissible onClose={() => setErrors([])}>
              <AlertTriangle size={16} className="me-1" />
              <strong>Errors:</strong>
              <ul className="mb-0 mt-2">
                {errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </Alert>
          )}
        </Col>

        <Col md={8}>
          {plate ? (
            <>
              <PlateView
                plate={plate}
                view="response"
                colorConfig={colorConfig}
              />
              {hasResponseDataForPlate && colorConfig.responseRange && (
                <div className="mt-3 text-center">
                  <small className="text-muted">
                    Response Range: {colorConfig.responseRange.min.toFixed(2)} - {colorConfig.responseRange.max.toFixed(2)}
                  </small>
                </div>
              )}
            </>
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