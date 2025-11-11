import React from 'react';
import { Card, Col } from 'react-bootstrap';
import PlotFigure from './PlotFigure';
import * as Plot from "@observablehq/plot";
import { curveFit } from '../utils/curveFit';
import { CurveData, FittedPoint, fourPL, formatEC50, AggregatedPoint, createLogTicks } from '../utils/resultsUtils';

interface CurveCardProps {
  treatmentKey: string;
  curveData: CurveData;
  yLo: number;
  yHi: number;
  showFitParams: string;
  curveWidth: number;
  gridSize: number;
}

const CurveCard: React.FC<CurveCardProps> = ({ treatmentKey, curveData, yLo, yHi, showFitParams, curveWidth, gridSize }) => {
  const aggregatedData = curveData.aggregatedPoints;
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
    const numPoints = x.length * 10;
    for (let i = 0; i < numPoints; i++) {
      const logConc = logMinConc + (i / (numPoints - 1)) * (logMaxConc - logMinConc);
      const concentration = Math.pow(10, logConc);
      const response = fourPL(concentration, fittedParams[3], fittedParams[0], fittedParams[1], fittedParams[2]);
      dataPoints.push({ concentration, mean: response });
    }
  } catch (error) {
    console.warn('Curve fitting failed for treatment:', curveData.treatmentId, error);
    fittingError = "Curve fitting failed";
    // Fallback to just showing the data points without fitted curve
    dataPoints = aggregatedData.map(d => ({ concentration: d.concentration, mean: d.mean }));
  }


  const xTicks = createLogTicks(Math.min(...x), Math.max(...x), gridSize);
  return (
    <Col key={treatmentKey}>
      <Card className='mapper-card'>
        <Card.Header className='bg-light'>
          <div className="d-flex justify-content-between align-items-center">
            <strong><span>{curveData.treatmentId}</span></strong>
            <div className="text-end">
              <div>EC50: {formatEC50(ec50)}</div>
            </div>
          </div>
        </Card.Header>
        <Card.Body>
          {fittingError && (
            <div className="alert alert-warning py-1 px-2 mb-2 small">
              {fittingError}
            </div>
          )}
          <PlotFigure
            options={{
              width: curveWidth,
              height: Math.min(curveWidth*0.75,400),
              marginLeft: 70,
              style: {
                fontSize: "12px",
                overflow: 'visible'
              },
              y: {
                domain: [yLo, yHi],
                label: "Response",
                axis: "left"
              },
              x: {
                type: "log",
                domain: [Math.min(...x) * 0.95, Math.max(...x) * 1.05],
                label: "Concentration (µM)",
                ticks: xTicks,
                tickFormat: (d: number) => {
                  if (d >= 1000) return `${(d / 1000).toFixed(0)}k`;
                  if (d >= 1) return d.toFixed(0);
                  if (d >= 0.1) return d.toFixed(1);
                  if (d >= 0.01) return d.toFixed(2);
                  return d.toExponential(1);
                },
                axis: "bottom"
              },
              marks: [
                Plot.ruleY([yLo], { stroke: "#000", strokeWidth: 1 }),
                Plot.ruleX([Math.min(...x) * 0.95], { stroke: "#000", strokeWidth: 1 }),

                Plot.dot(aggregatedData, {
                  x: "concentration",
                  y: "mean",
                  fill: "#2563eb",
                  r: Math.min(6, (8 - gridSize)),
                  stroke: "#ffffff",
                  strokeWidth: 2,
                  channels: {
                    concentration: "concentration",
                    mean: "mean",
                    stdDev: "stdDev",
                    count: "count",
                    wells: (d: AggregatedPoint) => d.wellIds.join(', ')
                  },
                  tip: {
                    format: {
                      concentration: false,
                      mean: false,
                      x: true,
                      y: true,
                      stdDev: (d: number) => d.toFixed(2),
                      count: false,
                      wells: true
                    }
                  }
                }),

                Plot.ruleX(aggregatedData, {
                  x: "concentration",
                  y1: (d: AggregatedPoint) => Math.max(yLo, d.mean - d.stdDev),
                  y2: (d: AggregatedPoint) => Math.min(yHi, d.mean + d.stdDev),
                  stroke: "#2563eb",
                  strokeWidth: 2,
                  opacity: 0.6
                }),

                ...(fittingError ? [] : [
                  Plot.line(dataPoints, {
                    x: "concentration",
                    y: "mean",
                    stroke: "#dc2626",
                    strokeWidth: 2.5,
                    opacity: 0.9
                  })
                ])
              ]
            }}
          />
          {!fittingError && fittedParams.length >= 4 && showFitParams === 'true' && (
            <div className='text-muted small'>
              <strong>Fit Parameters:</strong> Top: {fittedParams[3].toFixed(1)}, Bottom: {fittedParams[0].toFixed(1)}, Hill: {fittedParams[1].toFixed(2)}
            </div>
          )}
        </Card.Body>
      </Card>
    </Col>
  )
};

export default CurveCard;