import React, { useState } from 'react';
import { Button, Accordion } from 'react-bootstrap';
import CurveCard from './CurveCard';
import { Plate } from '../../../classes/PlateClass';
import { getCurveData, yAxisDomains } from '../utils/resultsUtils';

interface TreatmentCurvesProps {
  plate: Plate;
  normalized: Boolean;
}

const TreatmentCurves: React.FC<TreatmentCurvesProps> = ({ plate, normalized }) => {
  const [activeKeys, setActiveKeys] = useState<string[]>([]);
  
  const curveData = getCurveData(plate,normalized);
  const {yLo, yHi} = yAxisDomains(plate,normalized)

  const toggleExpandAll = () => {
    if (activeKeys.length === curveData.length) {
      setActiveKeys([]);
    } else {
      setActiveKeys(curveData.map((curve) => curve.compoundId));
    }
  };

  if (curveData.length === 0) {
    return (
      <div className="text-center text-muted p-4">
        <p>No dose-response curves found.</p>
        <small>Curves require compounds with more than 4 concentration levels.</small>
      </div>
    );
  }

  const treatmentCurves = curveData.map((curve) => (
    <CurveCard 
      key={curve.compoundId} 
      eventKey={curve.compoundId} 
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