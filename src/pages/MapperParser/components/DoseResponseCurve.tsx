import React, { useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import { curveFit } from '../utils/curveFit';

interface DoseResponseCurveProps {
  plotData: { x: number; y: number; wellId: string }[]; // x is concentration, y is response
  treatmentKey: string;
}

const DoseResponseCurve: React.FC<DoseResponseCurveProps> = ({ plotData, treatmentKey }) => {
  const d3Container = useRef<SVGSVGElement | null>(null);

  // Sort data by concentration for proper curve plotting
  const sortedPlotData = useMemo(() =>
    [...plotData].sort((a, b) => a.x - b.x),
    [plotData]
  );

  const concentrations = useMemo(() => sortedPlotData.map(p => p.x), [sortedPlotData]);
  const responses = useMemo(() => sortedPlotData.map(p => p.y), [sortedPlotData]);

  const fitResults = useMemo(() => {
    try {
      const params = curveFit(concentrations, responses);
      if (!params || params.length !== 4) return { fittedParams: null, ec50: "Fit Failed" };
      
      const ec50Num = parseFloat(params[2].toFixed(3));
      return { fittedParams: params, ec50: ec50Num };
    } catch (error) {
      console.error(`Error fitting curve for ${treatmentKey}:`, error);
      return { fittedParams: null, ec50: "Fit Error" };
    }
  }, [concentrations, responses, treatmentKey]);

  const { fittedParams, ec50 } = fitResults;

  useEffect(() => {
    if (sortedPlotData && sortedPlotData.length > 0 && d3Container.current) {
      const svg = d3.select(d3Container.current);
      svg.selectAll("*").remove(); // Clear previous SVG content

      const margin = { top: 40, right: 30, bottom: 50, left: 60 };
      const width = parseInt(svg.style('width')) - margin.left - margin.right;
      const height = parseInt(svg.style('height')) - margin.top - margin.bottom;

      // Filter out non-positive concentrations for log scale
      const positiveConcData = sortedPlotData.filter(d => d.x > 0);
      
      const xScale = d3.scaleLog()
        // Use extent of positive concentrations, or a default range if none
        .domain(d3.extent(positiveConcData, d => d.x) as [number, number] || [0.001, 1000])
        .range([0, width])
        .clamp(true); // Prevent values outside the range

      const yScale = d3.scaleLinear()
        .domain(d3.extent(sortedPlotData, d => d.y) as [number, number] || [0,100])
        .nice()
        .range([height, 0]);

      const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

      // X-axis (Logarithmic)
      g.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(xScale).ticks(5, d3.format(".1e"))) // Format for scientific notation
        .append('text')
        .attr('y', margin.bottom - 10)
        .attr('x', width / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', 'currentColor')
        .style('font-size', '12px')
        .text('Concentration (log scale)');

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
        .text(`Dose-Response: ${treatmentKey} (EC50: ${typeof ec50 === 'number' ? ec50.toExponential(2) : ec50})`);

      // Tooltip
      const tooltip = d3.select('body').append('div')
        .attr('class', 'd3-tooltip-dr') // Use a different class to avoid conflicts if both charts on page
        .style('position', 'absolute')
        .style('z-index', '10')
        .style('visibility', 'hidden')
        .style('padding', '10px')
        .style('background', 'rgba(0,0,0,0.7)')
        .style('color', '#fff')
        .style('border-radius', '5px')
        .style('font-size', '12px');

      // Raw data points (only plot those with positive concentrations for log scale)
      g.selectAll('circle.raw-data')
        .data(positiveConcData)
        .enter()
        .append('circle')
        .attr('class', 'raw-data')
        .attr('cx', d => xScale(d.x))
        .attr('cy', d => yScale(d.y))
        .attr('r', 5)
        .style('fill', 'coral')
        .on('mouseover', (_, d) => {
          tooltip.html(`Well: ${d.wellId}<br/>Conc: ${d.x.toExponential(2)}<br/>Response: ${d.y.toFixed(2)}`)
            .style('visibility', 'visible');
        })
        .on('mousemove', (event) => {
          tooltip.style('top', (event.pageY - 10) + 'px')
                 .style('left', (event.pageX + 10) + 'px');
        })
        .on('mouseout', () => {
          tooltip.style('visibility', 'hidden');
        });
      
      // Fitted curve
      if (fittedParams && fittedParams.length === 4) {
        const [A, B, C, D_top] = fittedParams;
        const fourPL = (t: number) => (A - D_top) / (1.0 + Math.pow(t / C, B)) + D_top;

        const lineGenerator = d3.line<{x: number, y: number}>()
          .x(d => xScale(d.x))
          .y(d => yScale(d.y));
        
        const curvePoints: {x: number, y: number}[] = [];
        const domainX = xScale.domain();
        if (domainX[0] > 0 && domainX[1] > 0) { // Ensure valid log domain
            for (let i = 0; i <= 100; i++) {
                const t = domainX[0] * Math.pow(domainX[1] / domainX[0], i / 100);
                if (t > 0) { // Check t to avoid issues if domain was [0, something]
                    curvePoints.push({ x: t, y: fourPL(t) });
                }
            }
        }


        if (curvePoints.length > 0) {
            g.append('path')
            .datum(curvePoints)
            .attr('fill', 'none')
            .attr('stroke', 'steelblue')
            .attr('stroke-width', 2)
            .attr('d', lineGenerator);
        }
      }
    }
    // Cleanup tooltip on component unmount
    return () => {
      d3.select('.d3-tooltip-dr').remove();
    };
  }, [sortedPlotData, treatmentKey, fittedParams, ec50]); // Redraw chart if data changes

  if (!plotData || plotData.length === 0) {
    return <p>No data available for this treatment to display dose-response curve.</p>;
  }

  return (
    <div style={{ width: '100%', position: 'relative' }}> {/* Added position relative for potential absolute positioned elements inside */}
      <div style={{ width: '100%', height: '500px' }}>
        <svg ref={d3Container} width="100%" height="100%" />
      </div>
      {fittedParams && (
        <div className="mt-2 text-center" style={{ fontSize: '12px' }}>
          <p className="mb-0"><strong>Calculated Parameters:</strong></p>
          <p className="mb-0">Bottom (A): {fittedParams[0].toFixed(3)}</p>
          <p className="mb-0">HillSlope (B): {fittedParams[1].toFixed(3)}</p>
          <p className="mb-0">EC50 (C): {fittedParams[2].toExponential(3)}</p>
          <p className="mb-0">Top (D): {fittedParams[3].toFixed(3)}</p>
        </div>
      )}
       {fitResults.ec50 === "Fit Failed" && <p className="text-danger text-center mt-2">Curve fitting failed.</p>}
       {fitResults.ec50 === "Fit Error" && <p className="text-danger text-center mt-2">An error occurred during curve fitting.</p>}
    </div>
  );
};

export default DoseResponseCurve;
