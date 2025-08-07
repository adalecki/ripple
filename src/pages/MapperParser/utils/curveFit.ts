import { levenbergMarquardt } from 'ml-levenberg-marquardt';

export interface CurveFitResult {
  A: number; // Bottom
  B: number; // Hillslope  
  C: number; // EC50
  D: number; // Top
}

export interface CurveFitOptions {
  damping?: number;
  gradientDifference?: number;
  maxIterations?: number;
  errorTolerance?: number;
}

export function curveFit(x: number[] = [], y: number[] = [], options: CurveFitOptions = {}): number[] {
  if (x.length !== y.length) {
    throw new Error('x and y arrays must have the same length');
  }
  
  if (x.length < 3) {
    throw new Error('Need at least 3 data points for curve fitting');
  }
  // Normalize response values to scale from 0 - 100
  const maxY = Math.max(...y);
  const minY = Math.min(...y);
  const normedY: number[] = [];
  
  for (let i = 0; i < y.length; i++) {
    const norm = ((y[i] - minY) / (maxY - minY)) * 100;
    normedY.push(norm);
  }

  // A - Bottom, B - Hillslope, C - EC50, D - Top
  function fourPL([A, B, C, D]: number[]) {
    return (t: number): number => {
      return (A - D) / (1.0 + Math.pow(t / C, B)) + D;
    };
  }

  function line([slope, intercept]: number[]) {
    return (x: number): number => slope * x + intercept;
  }

  const initialSlope = (y[y.length - 1] - y[0]) / y.length;
  const lineResult = levenbergMarquardt(
    { x: x, y: y }, 
    line, 
    { initialValues: [initialSlope, y[0]] }
  );
  
  // Find the point closest to 50% response to use as initial EC50 guess
  const estA = Math.min(...y);
  const estB = (lineResult.parameterValues[0] > 0 ? 1 : -1);
  let estC = 5;
  const estD = Math.max(...y);

  const midpoint = (estA + estD) / 2;
  const closest = y.reduce((prev, curr) => 
    (Math.abs(curr - midpoint) < Math.abs(prev - midpoint) ? curr : prev)
  );
  estC = x[y.indexOf(closest)];

  const initialValues = [estA, estB, estC, estD];

  // Options for the LM algorithm
  const lmOptions = {
    damping: options.damping ?? 1.5,
    initialValues: initialValues,
    gradientDifference: options.gradientDifference ?? 10e-2,
    maxIterations: options.maxIterations ?? 100,
    errorTolerance: options.errorTolerance ?? 10e-3
  };

  const data = {
    x: x,
    y: y
  };
  
  const fittedParams = levenbergMarquardt(data, fourPL, lmOptions).parameterValues;
  return fittedParams;
}