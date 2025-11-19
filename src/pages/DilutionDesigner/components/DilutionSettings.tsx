import React from 'react';
import { Card } from 'react-bootstrap';
import { DilutionSettings, DilutionSettingsErrors } from '../types/dilutionTypes';
import { FormField } from '../../../components/FormField';
import InfoTooltip from '../../../components/InfoTooltip';

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
    <Card>
      <Card.Header className='d-flex justify-content-between align-items-center p-1'>
        <h5 className="mb-0">Transfer Settings</h5>
        <InfoTooltip text='To change transfer volume or droplet size, change your preferences (gear in the top right)' />
      </Card.Header>
      <Card.Body className='p-1'>
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
          className='mb-2'
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
          className='mb-2'
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
          className='mb-2'
        />

        <FormField
          id="useIntConcs"
          name="useIntConcs"
          type="switch"
          label="Use Intermediate Plates"
          value={settings.useIntConcs}
          onChange={(value) => onSettingChange('useIntConcs', value)}
          error={errors.useIntConcs}
          className='mb-2'
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
          disabled={!settings.useIntConcs}
          className='mb-2'
        />

        <FormField
          id="numIntConcs"
          name="numIntConcs"
          type="number"
          label="Int Concs to Check"
          value={settings.numIntConcs}
          onChange={(value) => onSettingChange('numIntConcs', value)}
          required={true}
          step={1}
          error={errors.numIntConcs}
          disabled={!settings.useIntConcs}
          className='mb-2'
        />
      </Card.Body>
    </Card>
  );
};

export default DilutionSettingsInput;