import React from 'react';
import { Accordion } from 'react-bootstrap';
import PlotFigure from './PlotFigure';
import * as Plot from "@observablehq/plot";
import { curveFit } from '../utils/curveFit';
import { CurveData, FittedPoint, fourPL, formatEC50, AggregatedPoint } from '../utils/resultsUtils';

interface CurveCardProps {
  eventKey: string;
  curveData: CurveData;
  yLo: number;
  yHi: number;
}

const CurveCard: React.FC<CurveCardProps> = ({ eventKey, curveData, yLo, yHi }) => {
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
    const numPoints = x.length * 10; // More points for smoother curve
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

  function createLogTicks(min: number, max: number) {
    const logMin = Math.log10(min);
    const logMax = Math.log10(max);
    const range = logMax - logMin;
    const numTicks = 10;

    const ticks: number[] = [];
    for (let i = 0; i < numTicks; i++) {
      const logValue = logMin + (i / (numTicks - 1)) * range;
      ticks.push(Math.pow(10, logValue));
    }
    return ticks;
  };

  const xTicks = createLogTicks(Math.min(...x), Math.max(...x));

  return (
    <Accordion.Item eventKey={eventKey}>
      <Accordion.Header>
        <div className="d-flex justify-content-between align-items-center w-100 me-3">
          <span>{curveData.treatmentId}</span>
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
            marginLeft: 70,
            marginBottom: 60,
            style: {
              fontSize: "12px"
            },
            y: {
              domain: [yLo, yHi],
              label: "Response",
              axis: "left"
            },
            x: {
              type: "log",
              domain: [Math.min(...x) * 0.9, Math.max(...x) * 1.1],
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
              // X and Y axis lines only
              Plot.ruleY([yLo], { stroke: "#000", strokeWidth: 1 }),
              Plot.ruleX([Math.min(...x) * 0.9], { stroke: "#000", strokeWidth: 1 }),

              // Data points with tooltips
              Plot.dot(aggregatedData, {
                x: "concentration",
                y: "mean",
                fill: "#2563eb",
                r: 6,
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

              // Error bars
              Plot.ruleX(aggregatedData, {
                x: "concentration",
                y1: (d: AggregatedPoint) => Math.max(yLo, d.mean - d.stdDev),
                y2: (d: AggregatedPoint) => Math.min(yHi, d.mean + d.stdDev),
                stroke: "#2563eb",
                strokeWidth: 2,
                opacity: 0.6
              }),

              // Fitted curve
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
        {!fittingError && fittedParams.length >= 4 && (
          <div className='text-muted small'>
            <strong>Fit Parameters:</strong> Top: {fittedParams[3].toFixed(1)}, Bottom: {fittedParams[0].toFixed(1)}, Hill: {fittedParams[1].toFixed(2)}
          </div>
        )}
      </Accordion.Body>
    </Accordion.Item>
  );
};

export default CurveCard;