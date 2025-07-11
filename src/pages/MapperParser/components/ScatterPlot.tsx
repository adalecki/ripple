import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface ScatterPlotProps {
  plotData: { x: number; y: number; wellId: string }[]; // x is original concentration/value, y is response
  treatmentKey: string;
}

const ScatterPlot: React.FC<ScatterPlotProps> = ({ plotData, treatmentKey }) => {
  const d3Container = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (plotData && plotData.length > 0 && d3Container.current) {
      const svg = d3.select(d3Container.current);
      svg.selectAll("*").remove(); // Clear previous SVG content

      const margin = { top: 40, right: 30, bottom: 50, left: 60 };
      const width = parseInt(svg.style('width')) - margin.left - margin.right;
      const height = parseInt(svg.style('height')) - margin.top - margin.bottom;

      const processedData = plotData.map((d, i) => ({
        index: i, // Use array index for X-axis
        response: d.y,
        wellId: d.wellId,
        originalX: d.x // Keep original x for tooltip if needed
      }));

      const xScale = d3.scaleLinear()
        .domain([0, processedData.length - 1])
        .range([0, width]);

      const yScale = d3.scaleLinear()
        .domain(d3.extent(processedData, d => d.response) as [number, number] || [0,100])
        .nice()
        .range([height, 0]);

      const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

      // X-axis
      g.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(xScale).ticks(Math.min(processedData.length -1, 10)).tickFormat(d3.format('d')))
        .append('text')
        .attr('y', margin.bottom - 10)
        .attr('x', width / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', 'currentColor')
        .style('font-size', '12px')
        .text('Well Index');

      // Y-axis
      g.append('g')
        .call(d3.axisLeft(yScale))
        .append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', -margin.left + 15)
        .attr('x', -height / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', 'currentColor')
        .style('font-size', '12px')
        .text('Response');
      
      // Title
      svg.append('text')
        .attr('x', (width + margin.left + margin.right) / 2)
        .attr('y', margin.top / 2 + 5)
        .attr('text-anchor', 'middle')
        .style('font-size', '16px')
        .style('font-weight', 'bold')
        .text(`Single-Point Assay: ${treatmentKey}`);

      // Tooltip
      const tooltip = d3.select('body').append('div')
        .attr('class', 'd3-tooltip')
        .style('position', 'absolute')
        .style('z-index', '10')
        .style('visibility', 'hidden')
        .style('padding', '10px')
        .style('background', 'rgba(0,0,0,0.7)')
        .style('color', '#fff')
        .style('border-radius', '5px')
        .style('font-size', '12px');

      // Data points
      g.selectAll('circle')
        .data(processedData)
        .enter()
        .append('circle')
        .attr('cx', d => xScale(d.index))
        .attr('cy', d => yScale(d.response))
        .attr('r', 5)
        .style('fill', 'steelblue')
        .on('mouseover', (_, d) => {
          tooltip.html(`Well: ${d.wellId}<br/>Index: ${d.index}<br/>Response: ${d.response.toFixed(2)}`)
            .style('visibility', 'visible');
        })
        .on('mousemove', (event) => {
          tooltip.style('top', (event.pageY - 10) + 'px')
                 .style('left', (event.pageX + 10) + 'px');
        })
        .on('mouseout', () => {
          tooltip.style('visibility', 'hidden');
        });

    }
    // Cleanup tooltip on component unmount
    return () => {
      d3.select('.d3-tooltip').remove();
    };
  }, [plotData, treatmentKey]); // Redraw chart if data or key changes

  if (!plotData || plotData.length === 0) {
    return <p>No data available for this treatment to display scatter plot.</p>;
  }

  return (
    <div style={{ width: '100%', height: '400px' }}>
      <svg ref={d3Container} width="100%" height="100%" />
    </div>
  );
};

export default ScatterPlot;
