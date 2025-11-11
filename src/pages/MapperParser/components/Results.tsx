import React, { useState, useEffect, useContext, useMemo } from 'react';
import { Col, Row, Container } from 'react-bootstrap';
import { MappedPlatesContext, ProtocolsContext } from '../../../contexts/Context';
import { currentPlate } from '../../EchoTransfer/utils/plateUtils';
import { Plate } from '../../../classes/PlateClass';
import { Protocol } from '../../../types/mapperTypes';
import { exportDestinationPlatesCSV } from '../utils/exportUtils';
import TreatmentCurves from './TreatmentCurves';
import ScatterPlot from './ScatterPlot';
import PlateResultsCard, { PlateResultsOptions } from './PlateResultsCard';
import { getPlatesWithData, getMaskedWells, getPlateData, yAxisDomains } from '../utils/resultsUtils';

const Results: React.FC = () => {
  const { mappedPlates, curMappedPlateId } = useContext(MappedPlatesContext);
  const { protocols } = useContext(ProtocolsContext);
  const [selectedProtocol, setSelectedProtocol] = useState<Protocol | null>(null);
  const [options, setOptions] = useState<PlateResultsOptions>({
    normalized: false,
    showFitParams: false,
    showAllWells: false,
    responseRangeMin: '',
    responseRangeMax: '',
    graphsPerRow: 2
  });

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

  function handleOptionsChange(updates: Partial<PlateResultsOptions>) {
    if (updates.responseRangeMin && Number.isNaN(updates.responseRangeMin)) {
      updates.responseRangeMin = 7
    }
    setOptions(prev => ({ ...prev, ...updates }));
  }

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
  const showExportButton = platesWithData.length > 0 && !!selectedProtocol;
 
  const { curveData, sPData } = useMemo(() => getPlateData(plate, options.normalized, selectedProtocol || undefined), [plate, options.normalized, selectedProtocol]);
  
  const { yLo: autoYLo, yHi: autoYHi } = useMemo(() => yAxisDomains(plate, options.normalized), [plate, options.normalized]);
  const yLo = (options.responseRangeMin !== '' && options.responseRangeMin !== null) ? Number(options.responseRangeMin) : autoYLo;
  const yHi = (options.responseRangeMax !== '' && options.responseRangeMax !== null) ? Number(options.responseRangeMax) : autoYHi;

  const filteredSPData = useMemo(() => {
    if (options.showAllWells) {
      const allDRCPoints = curveData.flatMap(curve => 
        curve.points.map(point => ({
          controlType: 'None' as const,
          contents: [{
            compoundId: curve.treatmentId,
            concentration: point.concentration
          }],
          responseValue: point.responseValue,
          wellId: point.wellId
        }))
      );
      return [...sPData, ...allDRCPoints];
    }
    return sPData;
  }, [sPData, curveData, options.showAllWells]);

  return (
    <Container fluid className="h-100 pb-2">
      <Row className="h-100" style={{ minHeight: 0}}>
        <Col
          md="4"
          className="d-flex flex-column h-100 overflow-auto"
        >
          <PlateResultsCard
            plate={plate}
            protocol={selectedProtocol}
            maskedWells={maskedWells}
            options={options}
            onOptionsChange={handleOptionsChange}
            onExportCSV={handleExportCSV}
            showExportButton={showExportButton}
          />
          
          <ScatterPlot
            key={`${plate.id}-${filteredSPData.length}`}
            sPData={filteredSPData} 
            yLo={yLo} 
            yHi={yHi} 
          />
        </Col>
        <Col md="8" className="d-flex h-100">
          <TreatmentCurves 
            plate={plate} 
            curveData={curveData} 
            yLo={yLo} 
            yHi={yHi} 
            protocol={selectedProtocol || undefined}
            showFitParams={options.showFitParams}
            gridSize={options.graphsPerRow}
          />
        </Col>
      </Row>
    </Container>
  );
};

export default Results;