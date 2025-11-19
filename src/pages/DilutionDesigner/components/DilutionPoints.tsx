import React from 'react';
import { Card } from 'react-bootstrap';
import { Point } from '../types/dilutionTypes';
import EditableValueTable, { TableValue } from '../../../components/EditableValueTable';

interface DilutionPointsInputProps {
  points: Point[];
  onPointsChange: (points: Point[]) => void;
}

const DilutionPointsInput: React.FC<DilutionPointsInputProps> = ({
  points,
  onPointsChange
}) => {
  const tableValues: TableValue[] = points.map((point) => ({
    id: point.index,
    value: point.concentration,
    label: (point.index + 1).toString()
  }));

  const handleValuesChange = (newValues: TableValue[]) => {
    onPointsChange(
      newValues.map((value, index) => ({
        concentration: value.value ?? 0,
        index
      }))
    );
  };

  const handleAdd = () => {
    const lastPoint = points[points.length - 1];
    onPointsChange([
      ...points,
      {
        concentration: (points.length > 0 ? Math.round((lastPoint.concentration / 3) * 100000) / 100000 : 30),
        index: points.length
      }
    ]);
  };

  const handleDelete = (id: number) => {
    onPointsChange(
      points
        .filter(p => p.index !== id)
        .map((p, i) => ({ ...p, index: i }))
    );
  };

  return (
    <Card >
      <Card.Header className='d-flex justify-content-between align-items-center p-1'>
        <h5 className="mb-0">Desired Points</h5>
        <button
          className="btn btn-sm btn-outline-primary"
          onClick={handleAdd}
        >
          +
        </button>
      </Card.Header>
      <Card.Body className='p-1'>
        <EditableValueTable
          tableId='points'
          values={tableValues}
          onChange={handleValuesChange}
          showLabels={true}
          valueLabel="Concentration (µM)"
          canAdd={true}
          onAdd={handleAdd}
          onDelete={handleDelete}
        />
      </Card.Body>
    </Card>
  );
};

export default DilutionPointsInput;