import { levenbergMarquardt } from 'ml-levenberg-marquardt';

export function curveFit(x: number[] = [],y: number[] = []) {
  //x = [50, 25.1, 12.6, 6.3, 3.16, 1.58, 0.794, 0.398, 0.199, 0.1]
  //y = [186.55, 187.13, 163.96, 103.18, 82.57, 21.84, 4.67, 3.04, -0.93, -1.32]

  
  // Normalize response values to scale from 0 - 100
  // Jules: The problem description says "The curveFit function normalizes y values, 
  // so I will always pass raw response values to it."
  // However, this normalization within curveFit might be intended.
  // I will keep it as provided. If the user wants to pass already normalized values,
  // this internal normalization might need adjustment or removal.
  let maxY = Math.max(...y)
  let minY = Math.min(...y)
  // Add a check for cases where maxY and minY are the same to avoid division by zero
  if (maxY === minY) {
    // If all y values are the same, return early or handle as a flat line
    // For now, returning parameters that would represent a flat line at that y value
    // This might need more sophisticated handling depending on expected behavior.
    // A: Bottom, B: HillSlope (0 for flat), C: EC50 (irrelevant for flat), D: Top
    // Setting A and D to the constant y value.
    const constantY = y.length > 0 ? y[0] : 0;
    return [constantY, 0, 0, constantY];
  }

  let normedY = []
  for (let val in y) {
    let norm = ((y[val]-minY)/(maxY-minY))*100
    normedY.push(norm)
  }

  // A - Bottom
  // B - Hillslope
  // C - EC50
  // D - Top

  function fourPL([A, B, C, D]: number[]) {
    return (t: number) => {
      return (A - D) / (1.0 + Math.pow(t / C, B)) + D;
    }
  }

  function line([slope,intercept]: number[]) {
    return (x_val: number) => slope * x_val + intercept
  }
  let initialSlopeY0 = y.length > 0 ? y[0] : 0;
  let initialSlopeYLast = y.length > 0 ? y[y.length-1] : 0;

  let initialSlope = y.length > 1 ? (initialSlopeYLast - initialSlopeY0)/y.length : 0;
  
  let lineResult;
  try {
    lineResult = levenbergMarquardt({x:x, y:y},line,{initialValues:[initialSlope,initialSlopeY0]})
  } catch (e) {
    console.error("Error during linear fitting for initial slope:", e);
    lineResult = { parameterValues: [0, initialSlopeY0] };
  }
  
  // Find the point closest to 50% response to use as initial EC50 guess
  let estA = Math.min(...y)
  let estB = (lineResult.parameterValues[0] > 0 ? 1 : -1)
  let estC = 5 // Default C if other estimates fail
  let estD = Math.max(...y)

  let midpoint = (estA + estD)/2
  
  if (y.length > 0) {
    let closest = y.reduce((prev,curr) => (Math.abs(curr-midpoint) < Math.abs(prev-midpoint) ? curr:prev))
    const indexOfClosest = y.indexOf(closest);
    if (indexOfClosest !== -1 && x.length > indexOfClosest) {
        estC = x[indexOfClosest];
    }
  }


  const initialValues = [estA, estB, estC, estD];
  

  const options = {
    damping: 1.5,
    initialValues: initialValues,
    gradientDifference: 10e-2,
    maxIterations: 100,
    errorTolerance: 10e-3
  };

  const data = {
    x: x,
    y: y
  };

  try {
    const fittedParams = levenbergMarquardt(data, fourPL, options).parameterValues;
    return fittedParams;
  } catch (error) {
    console.error("Error during 4PL curve fitting:", error);
    return initialValues;
  }
}
