import React from 'react';
import EditableValueTable, { TableValue } from '../../../components/EditableValueTable';

interface VolumeTableProps {
  tableId: string;
  volumes: (number | null)[];
  onChange: (volumes: (number | null)[]) => void;
  disabled: boolean;
  canAdd: boolean;
}

const VolumeTable: React.FC<VolumeTableProps> = ({
  tableId,
  volumes,
  onChange,
  disabled,
  canAdd
}) => {
  const tableValues: TableValue[] = volumes.map((volume, index) => ({
    id: index,
    value: volume,
    label: `Comp${index + 1}`
  }));

  const handleValuesChange = (newValues: TableValue[]) => {
    onChange(newValues.map(v => v.value));
  };

  const handleAdd = () => {
    onChange([
      ...volumes,
      null
    ]
    )
  }

  return (
    <EditableValueTable
      tableId={tableId}
      values={tableValues}
      onChange={handleValuesChange}
      disabled={disabled}
      showLabels={true}
      valueLabel="Volume (nL)"
      canAdd={canAdd}
      onAdd={handleAdd}
    />
  );
};

export default VolumeTable;
