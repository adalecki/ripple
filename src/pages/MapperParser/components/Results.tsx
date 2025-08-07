import React, { useState, useEffect, useContext } from 'react';
import { Button, Col, Row, Container, Card, Form } from 'react-bootstrap';
import { MappedPlatesContext, ProtocolsContext } from '../../../contexts/Context';
import { currentPlate } from '../../EchoTransfer/utils/plateUtils';
import { Plate } from '../../../classes/PlateClass';
import { Protocol } from '../../../types/mapperTypes';
import { exportDestinationPlatesCSV } from '../utils/exportUtils';
import TreatmentCurves from './TreatmentCurves';
import { hasResponseData } from '../utils/parserUtils';
import { getPlatesWithData, getMaskedWells, hasCompounds } from '../utils/resultsUtils';

const Results: React.FC = () => {
  const { mappedPlates, curMappedPlateId } = useContext(MappedPlatesContext);
  const { protocols } = useContext(ProtocolsContext);
  const [selectedProtocol, setSelectedProtocol] = useState<Protocol | null>(null);
  const [normalizedResponse, setNormalizedResponse] = useState<Boolean>(false)

  let plate = currentPlate(mappedPlates, curMappedPlateId);
  if (plate == null) { plate = new Plate({}); }

  useEffect(() => {
    if (protocols.length === 1 && !selectedProtocol) {
      setSelectedProtocol(protocols[0]);
    } else if (plate?.metadata?.protocolId) {
      const protocol = protocols.find(p => p.id === plate.metadata.protocolId);
      if (protocol && (!selectedProtocol || selectedProtocol.id !== protocol.id)) {
        setSelectedProtocol(protocol);
      }
    }
  }, [protocols, plate?.metadata?.protocolId, selectedProtocol]);

  const handleNormalizationChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setNormalizedResponse(event.target.value === 'true');
  };

  const handleExportCSV = () => {
    if (!selectedProtocol) {
      alert('Please select a protocol before exporting');
      return;
    }

    const platesWithData = getPlatesWithData(mappedPlates);
    if (platesWithData.length === 0) {
      alert('No plates with response data found for export');
      return;
    }

    try {
      exportDestinationPlatesCSV(platesWithData, selectedProtocol);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please check the console for details.');
    }
  }

  const maskedWells = getMaskedWells(plate);
  const platesWithData = getPlatesWithData(mappedPlates);
  const showExportButton = platesWithData.length > 0 && selectedProtocol;

  return (
    <Container fluid>
      <Row>
        <Col md="4">
          <Card>
            <Card.Header>
              <h5 className="mb-0">Plate Results</h5>
            </Card.Header>
            <Card.Body>
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
              <br />
              {showExportButton && (
                <div className="mb-3">
                  <div className="text-muted small mb-2">
                    {platesWithData.length} plate{platesWithData.length !== 1 ? 's' : ''} with data
                  </div>
                  <Button onClick={handleExportCSV} variant='success' className="w-100">
                    Export Results CSV
                  </Button>
                </div>
              )}

              {/* Masked Wells */}
              {maskedWells.length > 0 && (
                <div className="small text-muted">
                  <strong>Masked Wells:</strong> {maskedWells.join(', ')}
                </div>
              )}

              {/* Plate Info */}
              {plate && (
                <div className="mt-3 small text-muted">
                  <div><strong>Plate ID:</strong> {plate.id}</div>
                  <div><strong>Barcode:</strong> {plate.barcode || 'None'}</div>
                  <div><strong>Wells:</strong> {Object.keys(plate.getWells()).length}</div>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>

        <Col md="8">
          {!plate ? (
            <Card>
              <Card.Body className="text-center py-5">
                <p className="text-muted">No plate selected. Please use the Plate Mapper to create plates first.</p>
              </Card.Body>
            </Card>
          ) : !hasResponseData([plate]) ? (
            <Card>
              <Card.Body className="text-center py-5">
                <h5>No Response Data</h5>
                <p className="text-muted">Upload and parse data files using the Data Parser to see response curves.</p>
              </Card.Body>
            </Card>
          ) : !hasCompounds(plate) ? (
            <Card>
              <Card.Body className="text-center py-5">
                <h5>No Compounds Found</h5>
                <p className="text-muted">Wells need compound information with concentrations to generate dose-response curves.</p>
              </Card.Body>
            </Card>
          ) : (
            <Card>
              <Card.Header>
                <h5 className="mb-0">Dose-Response Curves</h5>
              </Card.Header>
              <Card.Body>
                <TreatmentCurves plate={plate} normalized={normalizedResponse} />
              </Card.Body>
            </Card>
          )}
        </Col>
      </Row>
    </Container>
  );
};

export default Results;