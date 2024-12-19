import React from 'react';
import { Card, Row } from 'react-bootstrap';
import { DilutionSettings, DilutionSettingsErrors } from '../types/dilutionTypes';
import { FormField } from '../../../components/FormField';

interface DilutionSettingsInputProps {
  settings: DilutionSettings;
  onSettingChange: (field: keyof DilutionSettings, value: any) => void;
  errors: DilutionSettingsErrors;
}

export const DilutionSettingsInput: React.FC<DilutionSettingsInputProps> = ({
  settings,
  onSettingChange,
  errors
}) => {
  return (
    <Card className="mb-4">
      <Card.Header>
        <Row>
          <h5 className="mb-0">Transfer Settings</h5>
        </Row>
      </Card.Header>
      <Card.Body>
        <FormField
          id="maxTransferVolume"
          name="maxTransferVolume"
          type="number"
          label="Max Transfer Volume"
          value={settings.maxTransferVolume}
          onChange={(value) => onSettingChange('maxTransferVolume', value)}
          required={true}
          unit="nL"
          error={errors.maxTransferVolume}
        />

        <FormField
          id="dropletSize"
          name="dropletSize"
          type="select"
          label="Droplet Size"
          value={settings.dropletSize}
          onChange={(value) => onSettingChange('dropletSize', value)}
          required={true}
          unit="nL"
          options={[
            { value: 2.5, label: '2.5' },
            { value: 25, label: '25' }
          ]}
          error={errors.dropletSize}
        />

        <FormField
          id="dmsoLimit"
          name="dmsoLimit"
          type="number"
          label="DMSO Limit"
          value={settings.dmsoLimit}
          onChange={(value) => onSettingChange('dmsoLimit', value)}
          required={true}
          step={0.001}
          error={errors.dmsoLimit}
        />

        <FormField
          id="backfillVolume"
          name="backfillVolume"
          type="number"
          label="Backfill Volume"
          value={settings.backfillVolume}
          onChange={(value) => onSettingChange('backfillVolume', value)}
          required={true}
          unit="µL"
          error={errors.backfillVolume}
        />

        <FormField
          id="assayVolume"
          name="assayVolume"
          type="number"
          label="Assay Volume"
          value={settings.assayVolume}
          onChange={(value) => onSettingChange('assayVolume', value)}
          required={true}
          unit="µL"
          error={errors.assayVolume}
        />

        <FormField
          id="allowableError"
          name="allowableError"
          type="number"
          label="Allowable Error"
          value={settings.allowableError}
          onChange={(value) => onSettingChange('allowableError', value)}
          required={true}
          step={0.05}
          error={errors.allowableError}
        />

        <FormField
          id="useIntConcs"
          name="useIntConcs"
          type="switch"
          label="Use Intermediate Plates"
          value={settings.useIntConcs}
          onChange={(value) => onSettingChange('useIntConcs', value)}
          error={errors.useIntConcs}
        />
      </Card.Body>
    </Card>
  );
};

export default DilutionSettingsInput;