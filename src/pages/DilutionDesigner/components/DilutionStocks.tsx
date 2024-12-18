import React from 'react';
import { Card, Row, Col } from 'react-bootstrap';
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
      <Card.Header>
        <Row>
          <Col md="10"><h5 className="mb-0">Stock Concentrations</h5></Col>
          <Col md="2">
            <button
              className="btn btn-sm btn-outline-primary mt-2"
              onClick={handleAdd}
            >
              +
            </button>
          </Col>
        </Row>
      </Card.Header>
      <Card.Body>
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