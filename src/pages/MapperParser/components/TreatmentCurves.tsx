import React, { useCallback, useEffect, useState } from 'react';
import { Row, Card, Form } from 'react-bootstrap';
import CurveCard from './CurveCard';
import { Plate } from '../../../classes/PlateClass';
import { Protocol } from '../../../types/mapperTypes';
import { CurveData, hasResponseData } from '../utils/resultsUtils';

interface TreatmentCurvesProps {
  plate: Plate;
  curveData: CurveData[];
  yLo: number;
  yHi: number;
  protocol?: Protocol;
}

const TreatmentCurves: React.FC<TreatmentCurvesProps> = ({ plate, curveData, yLo, yHi, protocol }) => {
  const [curvesNode, setCurvesNode] = useState<HTMLDivElement | null>(null)
  const [dimensions, setDimensions] = useState({ width: 1100, height: 1100 })
  const [gridSize, setGridSize] = useState(2)
  const [showFitParams, setShowFitParams] = useState('false')

  const curvesRef = useCallback((node: HTMLDivElement) => {
    if (node !== null) {
      setCurvesNode(node);
    }
  }, []);

  useEffect(() => {
    if (curvesNode) {
      const updateDimensions = () => {
        const rect = curvesNode.getBoundingClientRect();
        if (rect.height != 0 && rect.width != 0) {
        setDimensions({
          width: rect.width,
          height: rect.height
        });
      }
      };
      updateDimensions();
      const resizeObserver = new ResizeObserver(updateDimensions);
      resizeObserver.observe(curvesNode);
      return () => {
        resizeObserver.disconnect();
      };
    }
  }, [curvesNode])

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

  const curveWidth = (((dimensions.width - 8) - (gridSize * 8)) / gridSize) - 8
  if (curveWidth < 0) console.log(curveWidth, dimensions, gridSize)

  const treatmentCurves = curveData.map((curve) => (
    <CurveCard
      key={curve.treatmentId}
      treatmentKey={curve.treatmentId}
      yLo={yLo}
      yHi={yHi}
      curveData={curve}
      showFitParams={showFitParams}
      curveWidth={curveWidth}
      gridSize={gridSize}
    />
  ));

  return (
    <Card className='overflow-auto'>
      <Card.Header className='d-flex justify-content-between align-items-center p-1'>
        <h5 className="mb-0">Dose-Response Curves</h5>
        <span className="text-muted">
          {curveData.length} curve{curveData.length !== 1 ? 's' : ''} found
          {protocol && protocol.dataProcessing.controls.length > 0 && (" (controls excluded)")}
        </span>
        <span className='d-flex justify-content-between align-items-center p-1'>
          <span className='mx-3'>
            <Form.Group>
              <Form.Label className="small fw-bold">Graphs per Row</Form.Label>
              <Form.Select
                size="sm"
                value={gridSize}
                onChange={(e) => {
                  setGridSize(parseInt(e.target.value));
                }}
              >
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
                <option value={4}>4</option>
              </Form.Select>
            </Form.Group>
          </span>
          <span>
            <Form.Group>
              <Form.Label className="small fw-bold">Show Fit Params?</Form.Label>
              <Form.Select
                size="sm"
                value={showFitParams}
                onChange={(e) => {
                  setShowFitParams(e.target.value)
                }}
              >
                <option value='true'>Yes</option>
                <option value='false'>No</option>
              </Form.Select>
            </Form.Group>
          </span>
        </span>
      </Card.Header>
      <Card.Body className='overflow-auto' ref={curvesRef}>
        {!plate || !hasResponseData(plate) ?
          <div>
            <h5>No plate data</h5>
            <p className='text-muted'>Please upload and parse plates to view response data</p>
          </div>
          :
          <Row md={gridSize} className="g-2">
            {treatmentCurves}
          </Row>}
      </Card.Body>
    </Card>
  );
};

export default TreatmentCurves;