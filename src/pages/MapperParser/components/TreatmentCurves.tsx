import React, { useState, useMemo } from 'react';
import { Button, Accordion } from 'react-bootstrap';
import CurveCard from './CurveCard';
import { Plate } from '../../../classes/PlateClass';
import { Protocol } from '../../../types/mapperTypes';
import { getCurveData, yAxisDomains } from '../utils/resultsUtils';

interface TreatmentCurvesProps {
  plate: Plate;
  normalized: Boolean;
  protocol?: Protocol;
}

const TreatmentCurves: React.FC<TreatmentCurvesProps> = ({ plate, normalized, protocol }) => {
  const [activeKeys, setActiveKeys] = useState<string[]>([]);
  
  const curveData = useMemo( () => getCurveData(plate, normalized, protocol), [plate,normalized,protocol]);
  const {yLo, yHi} = useMemo( () => yAxisDomains(plate, normalized), [plate,normalized]);

  const toggleExpandAll = () => {
    if (activeKeys.length === curveData.length) {
      setActiveKeys([]);
    } else {
      setActiveKeys(curveData.map((curve) => curve.treatmentId));
    }
  };

  if (curveData.length === 0) {
    return (
      <div className="text-center text-muted p-4">
        <p>No dose-response curves found.</p>
        <small>Curves require compounds with more than 4 concentration levels.</small>
        {protocol && protocol.dataProcessing.controls.length > 0 && (
          <div className="mt-2">
            <small>Control wells are excluded from dose-response analysis.</small>
          </div>
        )}
      </div>
    );
  }

  const treatmentCurves = curveData.map((curve) => (
    <CurveCard 
      key={curve.treatmentId} 
      eventKey={curve.treatmentId} 
      yLo={yLo}
      yHi={yHi}
      curveData={curve} 
    />
  ));

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-2">
        <span className="text-muted">
          {curveData.length} curve{curveData.length !== 1 ? 's' : ''} found
          {protocol && protocol.dataProcessing.controls.length > 0 && (
            <span className="ms-2 small">(controls excluded)</span>
          )}
        </span>
        <Button size="sm" onClick={toggleExpandAll}>
          {activeKeys.length === curveData.length ? 'Collapse All' : 'Expand All'}
        </Button>
      </div>
      <Accordion 
        flush 
        alwaysOpen 
        activeKey={activeKeys} 
        onSelect={(eventKey) => {
          setActiveKeys(eventKey as string[]);
        }}
        
      >
        {treatmentCurves}
      </Accordion>
    </div>
  );
};

export default TreatmentCurves;