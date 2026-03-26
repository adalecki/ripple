import React from 'react';
import '../../../css/ApplyTooltip.css'

interface TooltipData {
    event: React.MouseEvent | null;
    msgArr: string[];
}

interface ApplyTooltipProps {
  data: TooltipData;
}

const ApplyTooltip: React.FC<ApplyTooltipProps> = ({ data }) => {
  const { event, msgArr } = data;
  if (!event) return
  return (
    <div className="apply-tooltip" style={{ top: event.pageY, left: event.pageX}}>
      <div className="well-id">
        <p>Warning - non-standard selection highlighted, resulting map may behave unpredictably.</p>
        <ul>
          {msgArr.map((m,i) => <li key={i}>{m}</li>)}
        </ul>
      </div>
    </div>
  );
};

export default ApplyTooltip;