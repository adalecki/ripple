import React from 'react';
import { Accordion } from 'react-bootstrap';
import PlotFigure from './PlotFigure';
import * as Plot from "@observablehq/plot";
import { curveFit } from '../utils/curveFit';
import { CurveData, aggregateData, FittedPoint, fourPL, formatEC50, AggregatedPoint } from '../utils/resultsUtils';

interface CurveCardProps {
  eventKey: string;
  curveData: CurveData;
  yLo: number;
  yHi: number;
}

const CurveCard: React.FC<CurveCardProps> = ({ eventKey, curveData, yLo, yHi }) => {

  const aggregatedData = aggregateData(curveData.points);
  aggregatedData.sort((a, b) => b.concentration - a.concentration);
  const x = aggregatedData.map(d => d.concentration);
  const y = aggregatedData.map(d => d.mean);

  let fittedParams: number[] = [];
  let dataPoints: FittedPoint[] = [];
  let ec50 = 0;
  let fittingError: string | null = null;

  try {
    fittedParams = curveFit(x, y);
    ec50 = fittedParams[2];

    // Generate fitted curve points - create more points for smooth curve
    const minConc = Math.min(...x);
    const maxConc = Math.max(...x);
    const logMinConc = Math.log10(minConc);
    const logMaxConc = Math.log10(maxConc);

    // Generate points across the concentration range
    dataPoints = [];
    const numPoints = x.length * 2;
    for (let i = 0; i < numPoints; i++) {
      const logConc = logMinConc + (i / (numPoints - 1)) * (logMaxConc - logMinConc);
      const concentration = Math.pow(10, logConc);
      const response = fourPL(concentration, fittedParams[3], fittedParams[0], fittedParams[1], fittedParams[2]);
      dataPoints.push({ concentration, mean: response });
    }
  } catch (error) {
    console.warn('Curve fitting failed for compound:', curveData.compoundId, error);
    fittingError = "Curve fitting failed";
    // Fallback to just showing the data points without fitted curve
    dataPoints = aggregatedData.map(d => ({ concentration: d.concentration, mean: d.mean }));
  }

  return (
    <Accordion.Item eventKey={eventKey}>
      <Accordion.Header className="custom-accordion-button">
        <div className="d-flex justify-content-between align-items-center w-100 me-3">
          <span>{curveData.compoundId}</span>
          <div className="text-end">
            <div>EC50: {formatEC50(ec50)}</div>
            <small className="text-muted">{curveData.points.length} wells, {aggregatedData.length} concentrations</small>
          </div>
        </div>
      </Accordion.Header>
      <Accordion.Body>
        {fittingError && (
          <div className="alert alert-warning py-1 px-2 mb-2 small">
            {fittingError}
          </div>
        )}
        <PlotFigure
          options={{
            width: 600,
            height: 400,
            y: {
              domain: [yLo, yHi],
              label: "Response"
            },
            x: {
              type: "log",
              label: "Concentration",
              ticks: 10,
              tickFormat: ','
            },
            marks: [
              Plot.dot(aggregatedData, {
                x: "concentration",
                y: "mean",
                fill: "#2563eb",
                r: 4
              }),
              Plot.ruleX(aggregatedData, {
                x: "concentration",
                y1: (d: AggregatedPoint) => d.mean - d.stdDev,
                y2: (d: AggregatedPoint) => d.mean + d.stdDev,
                stroke: "#2563eb",
                strokeWidth: 1
              }),
              Plot.lineY(dataPoints, {
                x: "concentration",
                y: "mean",
                stroke: "#dc2626",
                strokeWidth: 2,
                curve: 'natural'
              })
            ]
          }}
        />

        {/* Data summary table */}
        <div className="mt-3">
          <small className="text-muted">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Concentration</th>
                  <th>Mean Response</th>
                  <th>Std Dev</th>
                  <th>N</th>
                </tr>
              </thead>
              <tbody>
                {aggregatedData.map((point, idx) => (
                  <tr key={idx}>
                    <td>{point.concentration.toExponential(2)}</td>
                    <td>{point.mean.toFixed(2)}</td>
                    <td>{point.stdDev.toFixed(2)}</td>
                    <td>{point.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </small>
        </div>
      </Accordion.Body>
    </Accordion.Item>
  );
};

export default CurveCard;