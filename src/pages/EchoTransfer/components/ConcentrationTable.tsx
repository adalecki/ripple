import React from 'react';
import EditableValueTable, { TableValue } from '../../../components/EditableValueTable';

interface ConcentrationTableProps {
  concentrations: (number | null)[];
  onChange: (concentrations: (number | null)[]) => void;
  disabled: boolean;
}

const ConcentrationTable: React.FC<ConcentrationTableProps> = ({
  concentrations,
  onChange,
  disabled
}) => {
  const tableValues: TableValue[] = concentrations.map((conc, index) => ({
    id: index,
    value: conc,
    label: (index + 1).toString()
  }));

  const handleValuesChange = (newValues: TableValue[]) => {
    onChange(newValues.map(v => v.value));
  };

  const handleAdd = () => {
    onChange([
      ...concentrations,
      null
    ]
    )
  }

  return (
    <EditableValueTable
      tableId='patternConcs'
      values={tableValues}
      onChange={handleValuesChange}
      disabled={disabled}
      showLabels={true}
      valueLabel="Concentration"
      canAdd={true}
      onAdd={handleAdd}
    />
  );
};

export default ConcentrationTable;