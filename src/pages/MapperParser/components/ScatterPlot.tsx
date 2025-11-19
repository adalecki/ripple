import React, { useEffect, useRef, useState } from 'react';
import { Card } from 'react-bootstrap';
import PlotFigure from './PlotFigure';
import * as Plot from "@observablehq/plot";
import { SinglePoint } from '../utils/resultsUtils';

interface ScatterPlotProps {
  sPData: SinglePoint[];
  yLo: number;
  yHi: number;
}

const ScatterPlot: React.FC<ScatterPlotProps> = ({ sPData, yLo, yHi }) => {
  const scatterNode = useRef(null)
  const [dimensions, setDimensions] = useState({ width: 100, height: 100 })

  useEffect(() => {
    if (scatterNode.current) {
      const observer = new ResizeObserver((entries) => {
        for (let entry of entries) {
          setDimensions({
            width: entry.contentRect.width,
            height: entry.contentRect.height,
          });
        }
      });

      observer.observe(scatterNode.current);

      return () => {
        observer.disconnect();
      };
    }
  }, []);

  function getColor(controlType: string): string {
    switch (controlType) {
      case 'MinCtrl': return '#dc2626';
      case 'MaxCtrl': return '#2563eb';
      default: return '#6b7280';
    }
  }

  function formatTooltip(point: SinglePoint): string {
    const lines: string[] = [];
    lines.push(`Well: ${point.wellId}`);
    lines.push(`Response: ${point.responseValue.toFixed(2)}`);

    if (point.controlType !== 'None') {
      lines.push(`Type: ${point.controlType}`);
    }

    lines.push('Contents:');

    if (point.contents.length === 0) {
      lines.push('  None');
    } else {
      point.contents.forEach(content => {
        lines.push(`  ${content.compoundId}: ${content.concentration.toFixed(3)} µM`);
      });
    }

    return lines.join('\n');
  }

  if (sPData.length === 0) {
    return (
      <Card className="mb-3">
        <Card.Header>
          <h6 className="mb-0">Well Data</h6>
        </Card.Header>
        <Card.Body className="text-center text-muted p-4">
          <p>No well data available.</p>
        </Card.Body>
      </Card>
    );
  }

  const plotData = sPData.map((point, index) => {
    const data: any = {
      ...point,
      xIndex: index
    };
    data.toolTip = formatTooltip(point)
    return data;
  });

  return (
    <Card className="flex-grow-1 page-card">
      <Card.Header className='bg-light'>
        <div className="d-flex align-items-center">
          <span><strong>Well Data</strong> ({sPData.length} wells)</span>
        </div>
      </Card.Header>
      <Card.Body ref={scatterNode} style={{ minHeight: 150 }}>
        <PlotFigure
          options={{
            width: dimensions.width,
            height: dimensions.height,
            marginLeft: 70,
            marginBottom: 60,
            marginRight: 20,
            style: {
              fontSize: "12px",
              maxWidth: "none",
            },
            y: {
              domain: [yLo, yHi],
              label: "Response",
              axis: "left"
            },
            x: {
              domain: [0, sPData.length - 1],
              label: "Well Index",
              axis: "bottom"
            },
            marks: [
              Plot.ruleY([yLo], { stroke: "#000", strokeWidth: 1 }),
              Plot.ruleX([0], { stroke: "#000", strokeWidth: 1 }),

              Plot.dot(plotData, {
                x: "xIndex",
                y: "responseValue",
                fill: (d: any) => getColor(d.controlType),
                r: 4,
                stroke: "#ffffff",
                strokeWidth: 1
              }),
              Plot.tip(plotData, Plot.pointer({
                x: "xIndex",
                y: "responseValue",
                title: (d) => d.toolTip
              }))
            ]
          }}
        />
      </Card.Body>
    </Card>
  );
};

export default ScatterPlot;