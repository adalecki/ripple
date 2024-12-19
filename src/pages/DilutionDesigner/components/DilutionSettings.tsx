import React from 'react';
import { Card, Form, Row } from 'react-bootstrap';
import { DilutionSettings } from '../types/dilutionTypes';

interface DilutionSettingsInputProps {
  settings: DilutionSettings;
  onSettingsChange: (settings: DilutionSettings) => void;
}

export const DilutionSettingsInput: React.FC<DilutionSettingsInputProps> = ({
  settings,
  onSettingsChange,
}) => {
  const handleSettingChange = (field: keyof DilutionSettings, value: string | boolean) => {
    // For boolean values (checkboxes), pass through directly
    if (typeof value === 'boolean') {
      onSettingsChange({
        ...settings,
        [field]: value
      });
      return;
    }

    // For numeric fields, only update if the value is valid
    const numericValue = value === '' ? 0 : parseFloat(value);
    if (!isNaN(numericValue)) {
      onSettingsChange({
        ...settings,
        [field]: numericValue
      });
    }
  };

  return (
    <>
      <Card className="mb-4">
        <Card.Header>
          <Row>
            <h5 className="mb-0">Transfer Settings</h5>
          </Row>
        </Card.Header>
        <Card.Body>
          <Form.Group className="mb-3">
            <Form.Label>Max Transfer Volume (nL)</Form.Label>
            <Form.Control
              type="number"
              value={settings.maxTransferVolume || ''}
              onChange={(e) => handleSettingChange('maxTransferVolume', e.target.value)}
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Droplet Size (nL)</Form.Label>
            <Form.Select
              value={settings.dropletSize || ''}
              onChange={(e) => handleSettingChange('dropletSize', e.target.value)}
            >
              <option value={2.5}>2.5</option>
              <option value={25}>25</option>
            </Form.Select>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>DMSO Limit</Form.Label>
            <Form.Control
              type="number"
              step="0.001"
              value={settings.dmsoLimit || ''}
              onChange={(e) => handleSettingChange('dmsoLimit', e.target.value)}
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Backfill Volume (µL)</Form.Label>
            <Form.Control
              type="number"
              value={settings.backfillVolume || ''}
              onChange={(e) => handleSettingChange('backfillVolume', e.target.value)}
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Assay Volume (µL)</Form.Label>
            <Form.Control
              type="number"
              value={settings.assayVolume || ''}
              onChange={(e) => handleSettingChange('assayVolume', e.target.value)}
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Allowable Error</Form.Label>
            <Form.Control
              type="number"
              value={settings.allowableError || ''}
              onChange={(e) => handleSettingChange('allowableError', e.target.value)}
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Check
              type="switch"
              id="use-int-concs"
              label="Use Intermediate Plates"
              checked={settings.useIntConcs}
              onChange={(e) => handleSettingChange('useIntConcs', e.target.checked)}
            />
          </Form.Group>
        </Card.Body>
      </Card>
    </>
  );
};

export default DilutionSettingsInput