interface Point {
  x: number;
  y: number;
}

interface EllipticalArcParams {
  centerX: number;
  centerY: number;
  radiusX: number;
  radiusY: number;
  startAngle: number;
  endAngle: number;
  rotation?: number;
}

function polarToElliptical(
  centerX: number,
  centerY: number,
  radiusX: number,
  radiusY: number,
  angleInDegrees: number
): Point {
  const angleInRadians: number = (angleInDegrees - 90) * Math.PI / 180.0;
  return {
    x: centerX + (radiusX * Math.cos(angleInRadians)),
    y: centerY + (radiusY * Math.sin(angleInRadians))
  };
}

function describeEllipticalArc({
  centerX,
  centerY,
  radiusX,
  radiusY,
  startAngle,
  endAngle
}: EllipticalArcParams): string {
  const start: Point = polarToElliptical(centerX, centerY, radiusX, radiusY, endAngle);
  const end: Point = polarToElliptical(centerX, centerY, radiusX, radiusY, startAngle);

  const largeArcFlag: string = Math.abs(endAngle - startAngle) <= 180 ? "0" : "1";

  const d: string = [
    "M", start.x, start.y,
    "A", radiusX, radiusY, 0, largeArcFlag, 0, end.x, end.y
  ].join(" ");

  return d;
}
//#0445ad
const Logo = () => {
  return (
    <svg
      width="74"
      height="63"
      viewBox="0 0 270 230"
    >
      <defs>
        <radialGradient id="highlightGradient" cx="50%" cy="40%" r="50%" fx="50%" fy="40%">
          <stop offset="0%" stopColor="white" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#91A6C8" stopOpacity="0.1" />
        </radialGradient>

        <radialGradient id="shadowGradient" cx="50%" cy="60%" r="50%" fx="50%" fy="60%">
          <stop offset="0%" stopColor="#404040" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#0445ad" stopOpacity="0.4" />
        </radialGradient>

      </defs>
      <g
        fill="url(#highlightGradient)"
        stroke="url(#shadowGradient)"
      >
        <path d={describeEllipticalArc({
          centerX: 135,
          centerY: 160,
          radiusX: 130,
          radiusY: 65,
          startAngle: 3,
          endAngle: 357
        })}
          opacity={.4}
          strokeWidth={2} />
        <path d={describeEllipticalArc({
          centerX: 135,
          centerY: 150,
          radiusX: 100,
          radiusY: 50,
          startAngle: 4,
          endAngle: 356
        })}
          opacity={0.6}
          strokeWidth={3} />
        <path d={describeEllipticalArc({
          centerX: 135,
          centerY: 140,
          radiusX: 70,
          radiusY: 35,
          startAngle: 7,
          endAngle: 353
        })}
          opacity={0.8}
          strokeWidth={4} />
        <path d={describeEllipticalArc({
          centerX: 135,
          centerY: 130,
          radiusX: 40,
          radiusY: 20,
          startAngle: 17,
          endAngle: 343
        })}
          opacity={1}
          strokeWidth={5} />

      </g>
      <g
        fill="none"
        stroke="#91A6C8"
        strokeWidth="4"
      >
        <path d={describeEllipticalArc({
          centerX: 95,
          centerY: 85,
          radiusX: 35,
          radiusY: 45,
          startAngle: 90,
          endAngle: 180
        })} />
        <path d={describeEllipticalArc({
          centerX: 175,
          centerY: 85,
          radiusX: 35,
          radiusY: 45,
          startAngle: 180,
          endAngle: 270
        })} />
        <path d={describeEllipticalArc({
          centerX: 135,
          centerY: 77,
          radiusX: 10,
          radiusY: 10,
          startAngle: 201,
          endAngle: 360
        })} />
        <path d={describeEllipticalArc({
          centerX: 135,
          centerY: 77,
          radiusX: 10,
          radiusY: 10,
          startAngle: 0,
          endAngle: 159
        })} />
        <circle cx="135" cy="20" r="15" />
      </g>
    </svg>
  )
}

export default Logo