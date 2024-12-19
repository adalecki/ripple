import React, { useEffect, useRef, useState } from 'react';
import { select, scaleLog, scaleLinear, line, axisBottom, axisLeft } from 'd3';
import { Card, Row } from 'react-bootstrap';
import { Point } from '../types/dilutionTypes';
import { TransferMap } from '../utils/dilutionUtils';

interface DilutionGraphProps {
  points: Point[];
  analysisResults: Map<number, TransferMap[]>;
  allowableError: number;
  width?: number;
}

const generateLogTicks = (min: number, max: number): number[] => {
  const logs = [Math.floor(Math.log10(min)), Math.ceil(Math.log10(max))]; 
  const ticks: number[] = [];

  for (let i = logs[0]; i <= logs[1]; i++) {
    // Convert to number using exponential notation for precision
    const mainTick = Number(`1e${i}`);
    ticks.push(mainTick);

    if (logs[1] - logs[0] <= 3) {
      [2, 3, 5, 7].forEach(mult => {
        const tick = Number(`${mult}e${i}`);
        if (tick >= min && tick <= max) {
          ticks.push(tick);
        }
      });
    } else if (logs[1] - logs[0] <= 5) {
      [2, 5].forEach(mult => {
        const tick = Number(`${mult}e${i}`);
        if (tick >= min && tick <= max) {
          ticks.push(tick);
        }
      });
    }
  }

  return ticks.sort((a, b) => a - b).filter(t => t >= min && t <= max);
};

const DilutionGraph: React.FC<DilutionGraphProps> = ({
  points,
  analysisResults,
  allowableError,
  width: containerWidth = 600
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({
    width: containerWidth,
    height: Math.min(containerWidth * 0.6, 400)
  });

  const chartMargins = { top: 20, right: 100, bottom: 40, left: 60 };

  useEffect(() => {
    const updateDimensions = () => {
      if (svgRef.current) {
        const newWidth = svgRef.current.parentElement?.clientWidth || containerWidth;
        setDimensions({
          width: newWidth,
          height: Math.min(newWidth * 0.6, 400)
        });
      }
    };

    window.addEventListener('resize', updateDimensions);
    updateDimensions();

    return () => window.removeEventListener('resize', updateDimensions);
  }, [containerWidth]);

  useEffect(() => {
    if (!svgRef.current || dimensions.width === 0 || points.length === 0) return;

    const svg = select(svgRef.current);
    svg.selectAll('*').remove();

    const width = dimensions.width - chartMargins.left - chartMargins.right;
    const height = dimensions.height - chartMargins.top - chartMargins.bottom;

    // Find min/max concentrations for domain
    const allConcentrations = points.flatMap(p => {
      const transfers = analysisResults.get(p.concentration) || [];
      return [
        p.concentration,
        ...transfers.flatMap(t => t.possibleConcs)
      ];
    }).filter(c => c !== 0);

    const minConc = Math.min(...allConcentrations) * 0.1;
    const maxConc = Math.max(...allConcentrations) * 10;

    const xScale = scaleLog()
      .domain([minConc, maxConc])
      .range([0, width]);

    const yScale = scaleLinear()
      .domain([0, points.length - 1])
      .range([height, 0]);

    const xTicks = generateLogTicks(minConc, maxConc);

    const xAxis = axisBottom(xScale)
      .tickValues(xTicks)
      .tickFormat(d => `${d as number} µM`);

    const yAxis = axisLeft(yScale)
      .ticks(points.length)
      .tickFormat(d => `Point ${(d as number) + 1}`);

    const g = svg.append('g')
      .attr('transform', `translate(${chartMargins.left},${chartMargins.top})`);

    // Add axes
    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(xAxis);

    g.append('g')
      .call(yAxis);

    // Layer 1: Allowable range rectangles
    const rangesGroup = g.append('g').attr('class', 'ranges');
    points.forEach((point, _) => {
      if (point.concentration !== 0) {
        rangesGroup.append('rect')
          .attr('x', xScale(point.concentration * (1 - allowableError)))
          .attr('y', 0)
          .attr('width', xScale(point.concentration * (1 + allowableError)) - xScale(point.concentration * (1 - allowableError)))
          .attr('height', height)
          .attr('fill', '#3498db')
          .attr('opacity', 0.15);
      }
    });

    const colors = {
      stock: '#ff7700',
      int1: '#2b00ff',
      int2: '#29bd1e'
    };

    // Layer 2: Discrete transfer lines
    points.forEach((point, _) => {
      const transfers = analysisResults.get(point.concentration) || [];
      transfers.forEach(transfer => {
        transfer.possibleConcs.forEach(conc => {
          g.append('line')
            .attr('x1', xScale(conc))
            .attr('x2', xScale(conc))
            .attr('y1', 0)
            .attr('y2', height)
            .attr('stroke', colors[transfer.sourceType as keyof typeof colors])
            .attr('stroke-width', 1)
            .attr('opacity', 1);
        });
      });
    });

    // Layer 3: Target line
    const linePath = line<Point>()
      .x(d => xScale(d.concentration))
      .y(d => yScale(d.index));

    g.append('path')
      .datum(points.filter(p => (p.concentration != 0)))
      .attr('fill', 'none')
      .attr('stroke', '#2c3e50')
      .attr('stroke-width', 2)
      .attr('d', linePath);

    // Layer 4: Target points (on top)
    points.filter(p => p.concentration !== 0).forEach((point, _) => {
      const transfers = analysisResults.get(point.concentration) || [];
      const hasValidTransfer = transfers.length > 0 && 
        transfers.some(t => t.possibleConcs.length > 0);

      g.append('circle')
        .attr('cx', xScale(point.concentration))
        .attr('cy', yScale(point.index))
        .attr('r', 5)
        .attr('fill', hasValidTransfer ? '#2c3e50' : '#c0392b')

    });

    // Add legend
    const legend = g.append('g')
      .attr('class', 'legend')
      .attr('transform', `translate(${width - 100}, 20)`);

    const legendData = [
      { color: '#ff7700', type: 'line', label: 'Direct Transfer' },
      { color: '#2b00ff', type: 'line', label: 'Via Int. Plate 1' },
      { color: '#29bd1e', type: 'line', label: 'Via Int. Plate 2' },
      { color: '#2c3e50', type: 'dot', label: 'Viable Conc' },
      { color: '#c0392b', type: 'dot', label: 'No Scheme Found' },
    ];

    legendData.forEach((item, i) => {
      const legendRow = legend.append('g')
        .attr('transform', `translate(0, ${i * 20})`);
      
      if (item.type == 'line') {
        legendRow.append('line')
        .attr('x1', 0)
        .attr('x2', 20)
        .attr('y1', 0)
        .attr('y2', 0)
        .attr('stroke', item.color)
        .attr('stroke-width', 2);
      }
      else if (item.type == 'dot') {
        legendRow.append('circle')
        .attr('cx', 10)
        .attr('cy', 0)
        .attr('r', 5)
        .attr('fill',item.color)
      }

      legendRow.append('text')
        .attr('x', 25)
        .attr('y', 4)
        .text(item.label)
        .attr('font-size', '12px');
    });

  }, [dimensions, points, analysisResults]);

  return (
    <Card>
      <Card.Header>
        <Row>
          <h5 className="mb-0">Dilution Curve</h5>
        </Row>
      </Card.Header>
      <Card.Body>
        <svg
          ref={svgRef}
          width={dimensions.width}
          height={dimensions.height}
          className="w-100"
        />
      </Card.Body>
    </Card>
  );
};

export default DilutionGraph;
