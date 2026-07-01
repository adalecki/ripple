import React from 'react';
import '../css/ApplyTooltip.css'

interface TooltipData {
  event: React.MouseEvent | null;
  msgArr: string[];
}

interface ApplyTooltipProps {
  data: TooltipData;
}

const ApplyTooltip: React.FC<ApplyTooltipProps> = ({ data }) => {
  const { event, msgArr } = data;
  if (!event || msgArr.length < 1) return
  return (
    <div className="apply-tooltip" style={{ top: event.pageY, left: event.pageX }}>
      <ul className="mb-0 ps-3">
        {msgArr.map((m, i) => <li key={i}>{m}</li>)}
      </ul>
    </div>
  );
};

export default ApplyTooltip;