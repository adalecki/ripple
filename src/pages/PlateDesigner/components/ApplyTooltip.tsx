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
  if (!event || msgArr.length < 1) return
  return (
    <div className="apply-tooltip" style={{ top: event.pageY, left: event.pageX}}>
      {msgArr[0].startsWith('Non-contiguous rectangles in block') ? 
      <div className="well-id">
        <p>Warning - non-standard selection highlighted, resulting map may behave unpredictably.</p>
        <ul>
          {msgArr.filter(m => m.startsWith('Non-contiguous rectangles in block')).map((m,i) => <li key={i}>{m}</li>)}
        </ul>
      </div>
      :
      <div className="well-id">
        <p>Make sure to save the pattern before applying to plate!</p>
      </div>
    }


    </div>
  );
};

export default ApplyTooltip;