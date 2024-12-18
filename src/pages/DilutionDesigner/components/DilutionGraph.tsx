import React, { useEffect, useRef, useState } from 'react';
import { select, scaleLog, scaleLinear, line, axisBottom, axisLeft } from 'd3';
import { Card, Row } from 'react-bootstrap';
import { Point, DilutionRange } from '../types/dilutionTypes';

interface DilutionGraphProps {
  points: Point[];
  ranges: DilutionRange[];
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
  ranges,
  width: containerWidth = 600
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({
    width: containerWidth,
    height: Math.min(containerWidth * 0.6, 400)
  });

  const chartMargins = { top: 20, right: 30, bottom: 40, left: 60 };

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

    const minX = Math.min(...points.map(p => p.concentration).filter(p => p != 0)) * 0.1
    const maxX = Math.max(...points.map(p => p.concentration).filter(p => p != 0)) * 10

    const xScale = scaleLog()
      .domain([minX, maxX])
      .range([0, width]);

    const yScale = scaleLinear()
      .domain([0, points.length - 1])
      .range([height, 0]);

    const xTicks = generateLogTicks(minX, maxX);

    const xAxis = axisBottom(xScale)
      .tickValues(xTicks)
      .tickFormat(d => `${d as number} µM`);

    const yAxis = axisLeft(yScale)
      .ticks(points.length)
      .tickFormat(d => `Point ${d as number + 1}`);

    const g = svg.append('g')
      .attr('transform', `translate(${chartMargins.left},${chartMargins.top})`);

    // Add axes
    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(xAxis);

    g.append('g')
      .call(yAxis);

    const linePath = line<Point>()
      .x(d => xScale(d.concentration))
      .y(d => yScale(d.index));

    g.append('path')
      .datum(points.filter(p => (p.concentration != 0)))
      .attr('fill', 'none')
      .attr('stroke', '#2c3e50')
      .attr('stroke-width', 2)
      .attr('d', linePath);

    g.selectAll('circle')
      .data(points.filter(p => (p.concentration != 0)))
      .enter()
      .append('circle')
      .attr('cx', d => xScale(d.concentration))
      .attr('cy', d => yScale(d.index))
      .attr('r', 5)
      .attr('fill', '#2c3e50');

    ranges.forEach(range => {
      if (!isNaN(range.max) && !isNaN(range.min)) {
        g.append('rect')
        .attr('x', Math.max(xScale(range.min), 0))
        .attr('y', 0)
        .attr('width', Math.min(xScale(range.max), width) - Math.max(xScale(range.min), 0))
        .attr('height', height)
        .attr('fill', '#3498db')
        .attr('opacity', 0.2);
      }

    });

  }, [dimensions, points, ranges]);

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