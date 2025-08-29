import React, { useState, useEffect, useContext, useMemo } from 'react';
import { Button, Col, Row, Container, Card, Form } from 'react-bootstrap';
import { MappedPlatesContext, ProtocolsContext } from '../../../contexts/Context';
import { currentPlate } from '../../EchoTransfer/utils/plateUtils';
import { Plate } from '../../../classes/PlateClass';
import { Protocol } from '../../../types/mapperTypes';
import { exportDestinationPlatesCSV } from '../utils/exportUtils';
import TreatmentCurves from './TreatmentCurves';
import ScatterPlot from './ScatterPlot';
import { getPlatesWithData, getMaskedWells, getPlateData, yAxisDomains } from '../utils/resultsUtils';

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
 
  const {curveData, sPData} = useMemo(() => getPlateData(plate, normalizedResponse, selectedProtocol || undefined), [plate, normalizedResponse, selectedProtocol]);
  const { yLo, yHi } = useMemo(() => yAxisDomains(plate, normalizedResponse), [plate, normalizedResponse]);

  return (
    <Container fluid className="h-100" >
      <Row className="h-100">
        <Col
          md="4"
          className="d-flex flex-column h-100"
        >
          <Card className="mb-2">
            <Card.Header>
              <h5 className="mb-0">Plate Results</h5>
            </Card.Header>
            <Card.Body>
              <div className="d-flex justify-content-between align-items-center mb-2">
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
                {showExportButton && (
                  <Button onClick={handleExportCSV} variant='success' className="w-100">
                    Export Results CSV
                  </Button>
                )}
              </div>
              {selectedProtocol && selectedProtocol.dataProcessing.controls.length > 0 && (
                <div className="p-2 bg-light rounded d-flex justify-content-between">
                  <div>
                    <div className="small fw-bold mb-1">Control Wells:</div>
                    {selectedProtocol.dataProcessing.controls.map((control, index) => (
                      <div key={index} className="small text-muted">
                        {control.type}: {control.wells}
                      </div>
                    ))}
                    <div className="small text-muted mt-1">
                      <em>Controls are excluded from DRCs</em>
                    </div>
                  </div>
                  {maskedWells.length > 0 && (
                    <div className="small text-muted">
                      <strong>Masked Wells:</strong> {maskedWells.join(', ')}
                    </div>
                  )}
                  <div>
                    {plate && (
                      <div className="small text-muted">
                        <div><strong>Plate ID:</strong> {plate.id}</div>
                        <div><strong>Barcode:</strong> {plate.barcode || 'None'}</div>
                        <div><strong>Wells:</strong> {Object.keys(plate.getWells()).length}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </Card.Body>
          </Card>
          
          <ScatterPlot 
            sPData={sPData} 
            yLo={yLo} 
            yHi={yHi} 
          />
        </Col>
        <Col md="8" className="d-flex h-100">
          <TreatmentCurves plate={plate} curveData={curveData} yLo={yLo} yHi={yHi} protocol={selectedProtocol || undefined} />
        </Col>
      </Row>
    </Container>
  );
};

export default Results;