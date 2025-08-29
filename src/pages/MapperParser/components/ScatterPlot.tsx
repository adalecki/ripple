import React, { useCallback, useEffect, useState } from 'react';
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
  const [scatterNode, setScatterNode] = useState<HTMLDivElement | null>(null)
  const [dimensions, setDimensions] = useState({ width: 785, height: 785 })
  console.log(dimensions)

  const scatterRef = useCallback((node: HTMLDivElement) => {
    if (node !== null) {
      setScatterNode(node);
    }
  }, []);

  useEffect(() => {
    if (scatterNode) {
      const updateDimensions = () => {
        const rect = scatterNode.getBoundingClientRect();
        if (rect.height != 0 && rect.width != 0) { //when changing tabs dimensions become zero, forcing a rerender and producing an error
          setDimensions({
            width: rect.width,
            height: rect.height
          });
        }
      };
      updateDimensions();
      const resizeObserver = new ResizeObserver(updateDimensions);
      resizeObserver.observe(scatterNode);
      return () => {
        resizeObserver.disconnect();
      };
    }
  }, [scatterNode])

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

  // Add sequential index for x-axis to avoid gaps
  const plotData = sPData.map((point, index) => {
    const data: any = {
      ...point,
      xIndex: index
    };

    if (point.contents.length === 0) {
      data.compound1 = "No compounds";
    } else {
      // Add separate channels for each compound (up to 4 for tooltip space)
      point.contents.slice(0, 4).forEach((content, i) => {
        data[`compound${i + 1}`] = `${content.compoundId}: ${content.concentration.toFixed(3)} µM`;
      });

      if (point.contents.length > 4) {
        data.additionalCompounds = `... and ${point.contents.length - 4} more`;
      }
    }

    return data;
  });

  function getColor(controlType: string): string {
    switch (controlType) {
      case 'MinCtrl': return '#dc2626'; // red
      case 'MaxCtrl': return '#2563eb'; // blue
      default: return '#6b7280'; // grey
    }
  }

  return (
    <Card className="mb-3">
      <Card.Header>
        <h6 className="mb-0">Well Data ({sPData.length} wells)</h6>
      </Card.Header>
      <Card.Body ref={scatterRef}>
        <PlotFigure
          options={{
            width: dimensions.width,
            height: Math.min(dimensions.width, 600),
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
                strokeWidth: 1,
                channels: {
                  "Well": "wellId",
                  controlType: "controlType",
                  responseValue: "responseValue",
                  compound1: "compound1",
                  compound2: "compound2",
                  compound3: "compound3",
                  compound4: "compound4",
                  additionalCompounds: "additionalCompounds"
                },
                tip: {
                  format: {
                    x: false,
                    y: false,
                    xIndex: false,
                    wellId: (d: string) => `Well: ${d}`,
                    controlType: (d: string) => d === 'None' ? null : `Control: ${d}`,
                    compound1: (d: string) => d || null,
                    compound2: (d: string) => d || null,
                    compound3: (d: string) => d || null,
                    compound4: (d: string) => d || null,
                    additionalCompounds: (d: string) => d || null,
                    responseValue: (d: number) => `Response: ${d.toFixed(2)}`
                  }
                }
              })
            ]
          }}
        />
      </Card.Body>
    </Card>
  );
};

export default ScatterPlot;