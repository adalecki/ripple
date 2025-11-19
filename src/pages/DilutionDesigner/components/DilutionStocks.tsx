import React from 'react';
import { Card } from 'react-bootstrap';
import { DilutionSettings } from '../types/dilutionTypes';
import EditableValueTable, { TableValue } from '../../../components/EditableValueTable';

interface DilutionStocksInputProps {
  settings: DilutionSettings;
  onSettingsChange: (settings: DilutionSettings) => void;
}

const DilutionStocksInput: React.FC<DilutionStocksInputProps> = ({
  settings,
  onSettingsChange,
}) => {
  const tableValues: TableValue[] = settings.stockConcentrations.map((conc, index) => ({
    id: index,
    value: conc,
    label: (index + 1).toString()
  }));

  const handleValuesChange = (newValues: TableValue[]) => {
    onSettingsChange({
      ...settings,
      stockConcentrations: newValues.map(v => v.value ?? 0)
    });
  };

  const handleAdd = () => {
    onSettingsChange({
      ...settings,
      stockConcentrations: [...settings.stockConcentrations, 10000]
    });
  };

  return (
    <Card>
      <Card.Header className='d-flex justify-content-between align-items-center p-1'>
        <h5 className="mb-0">Stock Concentrations</h5>
        <button
          className="btn btn-sm btn-outline-primary"
          onClick={handleAdd}
        >
          +
        </button>
      </Card.Header>
      <Card.Body className='p-1'>
        <EditableValueTable
          tableId='stocks'
          values={tableValues}
          onChange={handleValuesChange}
          showLabels={true}
          valueLabel="Concentration (µM)"
          canAdd={true}
          onAdd={handleAdd}
        />
      </Card.Body>
    </Card>
  );
};

export default DilutionStocksInput;