import React, { useContext, useMemo, useState } from 'react';
import { Container, Row, Col, Card, Accordion, Button } from 'react-bootstrap';
import { MappedPlatesContext } from '../../../contexts/Context';
import { curveFit } from '../utils/curveFit';
import * as Plot from '@observablehq/plot';
import { getTreatmentKey } from '../utils/resultsUtils';

interface TreatmentData {
  compoundId: string;
  concentrations: number[];
  responses: number[];
  wellIds: string[];
  plateBarcode: string;
  isSinglePoint: boolean;
}

interface DoseResponseData extends TreatmentData {
  curveParams?: number[];
  ec50?: number;
}

const ResultsTab: React.FC = () => {
  const { mappedPlates, curMappedPlateId, setCurMappedPlateId } = useContext(MappedPlatesContext);
  const [expandedAccordions, setExpandedAccordions] = useState<string[]>([]);

  // Filter plates based on selection
  const activePlates = useMemo(() => {
    if (curMappedPlateId !== null) {
      const selectedPlate = mappedPlates.find(p => p.id === curMappedPlateId);
      return selectedPlate ? [selectedPlate] : [];
    }
    return mappedPlates;
  }, [mappedPlates, curMappedPlateId]);

  // Extract and process treatment data
  const { doseResponseData, singlePointData } = useMemo(() => {
    const treatmentMap = new Map<string, TreatmentData>();

    // Collect all well data grouped by compound
    activePlates.forEach(plate => {
      for (const well of plate) {
        if (!well || well.getIsUnused() || well.rawResponse === null) continue;
        const key = getTreatmentKey(well);
        if (!treatmentMap.has(key)) {
            treatmentMap.set(key, {
              compoundId: key,
              concentrations: [],
              responses: [],
              wellIds: [],
              plateBarcode: plate.barcode,
              isSinglePoint: false
            });
          }
        const treatment = treatmentMap.get(key)!;
        (well.getContents().length > 0 ? treatment.concentrations.push(well.getContents()[0].concentration) : treatment.concentrations.push(0));
        treatment.responses.push(well.rawResponse!);
        treatment.wellIds.push(well.id);
      }
    });

    // Separate single point vs dose response data
    const drData: DoseResponseData[] = [];
    const spData: TreatmentData[] = [];

    treatmentMap.forEach(treatment => {
      const uniqueConcentrations = [...new Set(treatment.concentrations)].sort((a, b) => a - b);
      
      if (uniqueConcentrations.length >= 4) {
        // Dose response: aggregate responses for each concentration
        const concentrationResponseMap = new Map<number, number[]>();
        
        treatment.concentrations.forEach((conc, idx) => {
          if (!concentrationResponseMap.has(conc)) {
            concentrationResponseMap.set(conc, []);
          }
          concentrationResponseMap.get(conc)!.push(treatment.responses[idx]);
        });

        // Calculate mean response for each concentration
        const avgConcentrations: number[] = [];
        const avgResponses: number[] = [];
        
        concentrationResponseMap.forEach((responses, conc) => {
          avgConcentrations.push(conc);
          avgResponses.push(responses.reduce((sum, r) => sum + r, 0) / responses.length);
        });

        // Fit curve and calculate EC50
        let curveParams: number[] | undefined;
        let ec50: number | undefined;
        
        try {
          curveParams = curveFit(avgConcentrations, avgResponses);
          if (curveParams && curveParams.length >= 4) {
            // EC50 is parameter C from 4PL fit: (A - D) / (1 + (x/C)^B) + D
            ec50 = curveParams[2];
          }
        } catch (error) {
          console.warn(`Curve fitting failed for ${treatment.compoundId}:`, error);
        }

        drData.push({
          ...treatment,
          concentrations: avgConcentrations,
          responses: avgResponses,
          curveParams,
          ec50,
          isSinglePoint: false
        });
      } else {
        spData.push({
          ...treatment,
          isSinglePoint: true
        });
      }
    });

    return { doseResponseData: drData, singlePointData: spData };
  }, [activePlates]);

  // Handle accordion expansion
  const handleToggleAccordion = (compoundId: string) => {
    setExpandedAccordions(prev => 
      prev.includes(compoundId)
        ? prev.filter(id => id !== compoundId)
        : [...prev, compoundId]
    );
  };

  const handleExpandAll = () => {
    setExpandedAccordions(doseResponseData.map(d => d.compoundId));
  };

  const handleCollapseAll = () => {
    setExpandedAccordions([]);
  };

  const clearPlateSelection = () => {
    setCurMappedPlateId(null);
  };

  // Create dose response plot
  function createDoseResponsePlot(data: DoseResponseData): HTMLElement {
    const plotData = data.concentrations.map((conc, idx) => ({
      concentration: conc,
      response: data.responses[idx],
      type: 'observed'
    }));

    // Add fitted curve points if available
    if (data.curveParams) {
      const [A, B, C, D] = data.curveParams;
      const logMin = Math.log10(Math.min(...data.concentrations));
      const logMax = Math.log10(Math.max(...data.concentrations));
      const curvePoints = Array.from({ length: 100 }, (_, i) => {
        const logConc = logMin + (i / 99) * (logMax - logMin);
        const conc = Math.pow(10, logConc);
        const response = (A - D) / (1 + Math.pow(conc / C, B)) + D;
        return {
          concentration: conc,
          response,
          type: 'fitted'
        };
      });
      plotData.push(...curvePoints);
    }

    return Plot.plot({
      title: `${data.compoundId} Dose Response`,
      width: 400,
      height: 300,
      x: {
        type: "log",
        label: "Concentration (µM)"
      },
      y: {
        label: "Response"
      },
      marks: [
        Plot.dot(plotData.filter(d => d.type === 'observed'), {
          x: "concentration",
          y: "response",
          fill: "steelblue",
          r: 4
        }),
        data.curveParams ? Plot.line(plotData.filter(d => d.type === 'fitted'), {
          x: "concentration",
          y: "response",
          stroke: "red",
          strokeWidth: 2
        }) : null
      ].filter(Boolean)
    }) as HTMLElement;
  }

  // Create single point scatter plot
  function createSinglePointPlot(): HTMLElement | null {
    if (singlePointData.length === 0) return null;

    const plotData = singlePointData.flatMap(treatment =>
      treatment.responses.map((response, idx) => ({
        compoundId: treatment.compoundId,
        concentration: treatment.concentrations[idx],
        response,
        wellId: treatment.wellIds[idx]
      }))
    );

    return Plot.plot({
      title: "Single Point Data",
      width: 500,
      height: 400,
      x: {
        label: "Compound"
      },
      y: {
        label: "Response"
      },
      color: {
        legend: true
      },
      marks: [
        Plot.dot(plotData, {
          x: "compoundId",
          y: "response",
          fill: "compoundId",
          r: 5,
          title: d => `${d.compoundId}\nConc: ${d.concentration.toFixed(2)} µM\nResponse: ${d.response.toFixed(2)}\nWell: ${d.wellId}`
        })
      ]
    }) as HTMLElement;
  }

  // Render plot in React component
  const PlotComponent: React.FC<{ plotFn: () => HTMLElement | null }> = ({ plotFn }) => {
    const plotRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
      const plot = plotFn();
      if (plot && plotRef.current) {
        plotRef.current.innerHTML = '';
        plotRef.current.appendChild(plot);
      }
    }, [plotFn]);

    return <div ref={plotRef} />;
  };

  if (activePlates.length === 0) {
    return (
      <Container fluid>
        <Row>
          <Col>
            <Card>
              <Card.Body className="text-center py-5">
                <p className="text-muted">No plates available with response data.</p>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
    );
  }

  return (
    <Container fluid>
      <Row className="mb-3">
        <Col>
          <div className="d-flex justify-content-between align-items-center">
            <h4>Results Analysis</h4>
            <div>
              {curMappedPlateId && (
                <Button variant="outline-secondary" onClick={clearPlateSelection} className="me-2">
                  Show All Plates
                </Button>
              )}
              <span className="text-muted">
                {curMappedPlateId 
                  ? `Showing: ${activePlates[0]?.barcode || 'Selected Plate'}`
                  : `Showing: All Plates (${activePlates.length})`
                }
              </span>
            </div>
          </div>
        </Col>
      </Row>

      <Row>
        <Col md={7}>
          <Card>
            <Card.Header>
              <div className="d-flex justify-content-between align-items-center">
                <h6 className="mb-0">Dose Response Curves ({doseResponseData.length})</h6>
                <div>
                  <Button size="sm" variant="outline-primary" onClick={handleExpandAll} className="me-2">
                    Expand All
                  </Button>
                  <Button size="sm" variant="outline-secondary" onClick={handleCollapseAll}>
                    Collapse All
                  </Button>
                </div>
              </div>
            </Card.Header>
            <Card.Body style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              {doseResponseData.length === 0 ? (
                <p className="text-muted text-center">No dose response data available (requires ≥4 concentrations)</p>
              ) : (
                <Accordion>
                  {doseResponseData.map(data => (
                    <Accordion.Item key={data.compoundId} eventKey={data.compoundId}>
                      <Accordion.Header 
                        onClick={() => handleToggleAccordion(data.compoundId)}
                      >
                        <div className="w-100 d-flex justify-content-between align-items-center me-3">
                          <span>{data.compoundId}</span>
                          <div className="text-muted small">
                            {data.ec50 ? `EC50: ${data.ec50.toFixed(2)} µM` : 'Curve fit failed'}
                            <span className="ms-2">({data.concentrations.length} points)</span>
                          </div>
                        </div>
                      </Accordion.Header>
                      <Accordion.Body>
                        <PlotComponent plotFn={() => createDoseResponsePlot(data)} />
                        {data.curveParams && (
                          <div className="mt-3 small text-muted">
                            <strong>Curve Parameters:</strong> 
                            <span className="ms-2">
                              A={data.curveParams[0]?.toFixed(2)}, 
                              B={data.curveParams[1]?.toFixed(2)}, 
                              C={data.curveParams[2]?.toFixed(2)}, 
                              D={data.curveParams[3]?.toFixed(2)}
                            </span>
                          </div>
                        )}
                      </Accordion.Body>
                    </Accordion.Item>
                  ))}
                </Accordion>
              )}
            </Card.Body>
          </Card>
        </Col>

        <Col md={5}>
          <Card>
            <Card.Header>
              <h6 className="mb-0">Single Point Data ({singlePointData.length} compounds)</h6>
            </Card.Header>
            <Card.Body>
              {singlePointData.length === 0 ? (
                <p className="text-muted text-center">No single point data available</p>
              ) : (
                <PlotComponent plotFn={createSinglePointPlot} />
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default ResultsTab;