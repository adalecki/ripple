import * as Plot from "@observablehq/plot";
import React, { useRef, useEffect } from 'react';

interface PlotFigureProps {
  options: Plot.PlotOptions | null;
}

const PlotFigure: React.FC<PlotFigureProps> = ({ options }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (options == null || !containerRef.current) return;
    
    const plot = Plot.plot(options);
    containerRef.current.append(plot);
    
    return () => plot.remove();
  }, [options]);

  return <div ref={containerRef} />;
};

export default PlotFigure;