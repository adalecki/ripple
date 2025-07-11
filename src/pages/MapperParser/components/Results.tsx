import React, { useContext, useState, useMemo, useEffect } from 'react';
import { Form, Container, Row, Col, Card, Alert, Spinner } from 'react-bootstrap';
import { MappedPlatesContext } from '../../../contexts/Context';
import { Plate } from '../../../classes/PlateClass';
import { groupDataByTreatment, identifyAssayType, PlottingData, AssayType } from '../utils/resultsUtils'
import ScatterPlot from './ScatterPlot';
import DoseResponseCurve from './DoseResponseCurve';
import { currentPlate } from '../../EchoTransfer/utils/plateUtils'; // Assuming this utility function exists and is appropriate

const ResultsTab: React.FC = () => {
  const { mappedPlates, curMappedPlateId } = useContext(MappedPlatesContext);
  
  const [selectedTreatmentKey, setSelectedTreatmentKey] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const activePlate: Plate | null = useMemo(() => {
    return currentPlate(mappedPlates, curMappedPlateId);
  }, [mappedPlates, curMappedPlateId]);

  const treatmentDataMap: Map<string, PlottingData> | null = useMemo(() => {
    if (!activePlate) return null;
    setIsLoading(true);
    try {
      const data = groupDataByTreatment(activePlate);
      return data;
    } catch (error) {
      console.error("Error grouping data by treatment:", error);
      return null;
    } finally {
      // A slight delay to ensure UI updates if processing is very fast
      setTimeout(() => setIsLoading(false), 100);
    }
  }, [activePlate]);

  // Reset selected treatment if plate changes or data reloads
  useEffect(() => {
    setSelectedTreatmentKey(undefined);
    if (treatmentDataMap && treatmentDataMap.size > 0) {
      // Select the first treatment by default
      setSelectedTreatmentKey(treatmentDataMap.keys().next().value);
    }
  }, [treatmentDataMap]);

  const currentTreatmentPlotData: PlottingData | null = useMemo(() => {
    if (!treatmentDataMap || !selectedTreatmentKey) return null;
    return treatmentDataMap.get(selectedTreatmentKey) || null;
  }, [treatmentDataMap, selectedTreatmentKey]);

  const currentAssayType: AssayType | null = useMemo(() => {
    if (!currentTreatmentPlotData) return null;
    return identifyAssayType(currentTreatmentPlotData);
  }, [currentTreatmentPlotData]);

  const handleTreatmentChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedTreatmentKey(event.target.value);
  };

  if (!activePlate) {
    return <Alert variant="info">Please select a plate from the sidebar to view results.</Alert>;
  }

  if (isLoading) {
    return (
      <Container className="text-center py-5">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading results...</span>
        </Spinner>
        <p className="mt-2">Processing plate data...</p>
      </Container>
    );
  }
  
  if (!treatmentDataMap || treatmentDataMap.size === 0) {
    return <Alert variant="warning">No parsable treatment data found on this plate, or the plate has no wells with responses.</Alert>;
  }

  return (
    <Container fluid>
      <Row className="mb-3">
        <Col>
          <Card>
            <Card.Header>
              <Row className="align-items-center">
                <Col md={8}>
                  <Card.Title as="h5" className="mb-0">Results for Plate: {activePlate.barcode || `ID ${activePlate.id}`}</Card.Title>
                </Col>
                <Col md={4}>
                  <Form.Group controlId="treatmentSelector">
                    <Form.Label className="me-2 sr-only">Select Treatment:</Form.Label>
                    <Form.Select onChange={handleTreatmentChange} value={selectedTreatmentKey || ''}>
                      <option value="" disabled>Select a treatment...</option>
                      {Array.from(treatmentDataMap.keys()).map(key => (
                        <option key={key} value={key}>
                          {key} ({treatmentDataMap.get(key)?.concentrations.length || 0} wells)
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
              </Row>
            </Card.Header>
            <Card.Body style={{ minHeight: '550px' }}> {/* Ensure Card Body has enough height for charts */}
              {selectedTreatmentKey && currentTreatmentPlotData ? (
                <>
                  {currentAssayType === 'singlePoint' && (
                    <ScatterPlot 
                      plotData={currentTreatmentPlotData.concentrations.map((conc, index) => ({
                        x: conc, // For scatter, x is concentration, but plot uses index.
                                // The ScatterPlot component itself will use index for X-axis.
                        y: currentTreatmentPlotData.responses[index],
                        wellId: currentTreatmentPlotData.wellIds[index]
                      }))}
                      treatmentKey={selectedTreatmentKey} 
                    />
                  )}
                  {currentAssayType === 'doseResponse' && (
                    <DoseResponseCurve 
                      plotData={currentTreatmentPlotData.concentrations.map((conc, index) => ({
                        x: conc, // For DR, x is concentration.
                        y: currentTreatmentPlotData.responses[index],
                        wellId: currentTreatmentPlotData.wellIds[index]
                      }))}
                      treatmentKey={selectedTreatmentKey}
                    />
                  )}
                </>
              ) : (
                <p className="text-center text-muted">
                  {treatmentDataMap.size > 0 ? 'Please select a treatment to view its results.' : 'No treatments available to display.'}
                </p>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default ResultsTab;
