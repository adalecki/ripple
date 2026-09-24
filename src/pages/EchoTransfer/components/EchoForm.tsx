import React, { useState } from 'react';
import { Form, Button, Alert, ButtonGroup, Col, Row } from 'react-bootstrap';
import { read, utils } from 'xlsx';
import { ChevronRight } from 'lucide-react';

import { PreferencesState, PreferenceValue, usePreferences } from '../../../hooks/usePreferences';
import { PREFERENCES_CONFIG, Setting } from '../../../config/preferencesConfig';
import { FormField, FormFieldType } from '../../../components/FormField';
import FileUploadCard from '../../../components/FileUploadCard';
import { fileHeaders } from '../utils/validationUtils';

import '../../../css/EchoForm.css';

interface FormValues {
  [key: string]: number | boolean | string;
}

const DMSO_MODE_OPTIONS = [
  { value: 'off', label: 'Off', description: 'No DMSO is added; each well keeps only the DMSO its transfers bring' },
  { value: 'auto', label: 'Match Highest', description: 'Every well is backfilled with DMSO up to the largest transfer volume in this run' },
  { value: 'fixed', label: 'Fixed Volume', description: 'Every well is backfilled with DMSO up to a set volume, keeping DMSO consistent between assays. Overrides DMSO Tolerance setting.' }
];

const TRANSFER_LOG_PREF_IDS = ['defaultAssayVolume', 'defaultBackfill', 'useSurveyVols'];
const TRANSFER_SETTING_PREF_IDS = ['maxTransferVolume', 'dropletSize', 'sourcePlateSize', 'destinationPlateSize'];
const PLATES_SECTION_NAMES = ['Use Intermediate Plates', 'Backfill (µL)', 'Fill Intermediate Plates Column-wise', 'Evenly Deplete Source Wells'];

function getSetting(prefId: string): Setting {
  for (const category of PREFERENCES_CONFIG) {
    const setting = category.settings.find(s => s.prefId === prefId);
    if (setting) return setting;
  }
  throw new Error(`Unknown preference ${prefId}`);
}

function getFormSettings(isTransferLogMode: boolean): Setting[] {
  const calcSettings = PREFERENCES_CONFIG.find(p => p.id === 'calculator-defaults')?.settings || [];
  if (isTransferLogMode) return calcSettings.filter(s => TRANSFER_LOG_PREF_IDS.includes(s.prefId));
  const transferSettings = PREFERENCES_CONFIG.find(p => p.id === 'transfer-settings')?.settings || [];
  return [
    ...calcSettings.filter(s => s.prefId !== 'useSurveyVols'),
    ...transferSettings.filter(s => TRANSFER_SETTING_PREF_IDS.includes(s.prefId))
  ];
}

function buildFormValues(settings: Setting[], preferences: PreferencesState): FormValues {
  const values: FormValues = {};
  for (const setting of settings) {
    values[setting.name] = preferences[setting.prefId] as Exclude<PreferenceValue, string[]> ?? setting.defaultValue;
  }
  return values;
}

function getPlatesSummary(values: FormValues) {
  const parts = [
    `${values['Source Plate Size']} > ${values['Destination Plate Size']} wells`,
    `${values['Echo Droplet Size']} nL drops`,
    `${values['Max Transfer Volume']} nL max`,
    values['Use Intermediate Plates'] ? 'intermediates on' : 'intermediates off'
  ];
  if (values['Evenly Deplete Source Wells']) parts.push('even depletion');
  return parts.join(' · ');
}

interface EchoFormProps {
  onSubmit: (formData: FormData) => Promise<void>;
  excelFile: File | null;
  setExcelFile: (file: File | null) => void;
  transferFile?: File | null;
  setTransferFile?: (file: File | null) => void;
  submitText: string;
  handleClear: () => void;
}

const EchoForm: React.FC<EchoFormProps> = ({
  onSubmit,
  excelFile,
  setExcelFile,
  transferFile,
  setTransferFile,
  submitText,
  handleClear
}) => {
  const { preferences } = usePreferences();
  const isTransferLogMode = Boolean(setTransferFile);
  const settings = getFormSettings(isTransferLogMode);

  const [validated, setValidated] = useState(false);
  const [formValues, setFormValues] = useState<FormValues>(() => buildFormValues(settings, preferences));
  const [isFixedTarget, setIsFixedTarget] = useState(typeof preferences.targetDMSOVol === 'number');
  const [isPlatesOpen, setIsPlatesOpen] = useState(true);
  const [prevPreferences, setPrevPreferences] = useState(preferences);
  const [showAlert, setShowAlert] = useState<string[]>([]);
  const [clearKey, setClearKey] = useState(0);

  if (preferences !== prevPreferences) {
    setPrevPreferences(preferences);
    setFormValues(buildFormValues(settings, preferences));
    setIsFixedTarget(typeof preferences.targetDMSOVol === 'number');
  }

  const dmsoMode = !formValues['DMSO Normalization'] ? 'off' : (isFixedTarget ? 'fixed' : 'auto');
  const isIntermediateOn = Boolean(formValues['Use Intermediate Plates']);

  const wellVolume = formValues['Well Volume (µL)'];
  const targetVolume = formValues['Target DMSO Volume (nL)'];
  const tolerance = formValues['DMSO Tolerance'];
  const maxTransfer = formValues['Max Transfer Volume'];
  //convert µL to nL
  const finalDMSOFraction = (typeof wellVolume === 'number' && wellVolume > 0 && typeof targetVolume === 'number') ? targetVolume / (wellVolume * 1000) : null;
  const isOverTolerance = finalDMSOFraction !== null && typeof tolerance === 'number' && finalDMSOFraction > tolerance;
  const isOverMaxTransfer = finalDMSOFraction !== null && targetVolume > maxTransfer;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;

    if (form.checkValidity() === false) {
      e.stopPropagation();
    } else {
      await onSubmit(new FormData(form));
    }
    setValidated(true);
  };

  const handleFieldChange = (fieldName: string, value: number | boolean | string) => {
    setFormValues(prev => ({ ...prev, [fieldName]: value }));
  };

  const handleExcelFileSelected = async (files: File[]) => {
    if (files.length === 1) {
      const file = files[0];
      setExcelFile(file);

      const wb = read(await file.arrayBuffer(), { type: 'array' });
      //assay-tab import only reaches calculator-defaults fields, never transfer settings
      const importableNames = settings.filter(s => !TRANSFER_SETTING_PREF_IDS.includes(s.prefId) && !['dmsoNormalization', 'targetDMSOVol'].includes(s.prefId)).map(s => s.name);
      const changedFields: string[] = [];

      if (wb && wb.Sheets['Assay'] && fileHeaders(wb.Sheets['Assay'], ['Setting', 'Value'])) {
        const assayNumbers: { 'Setting': string, 'Value': number }[] = utils.sheet_to_json(wb.Sheets['Assay']);
        for (const line of assayNumbers) {
          const setting = settings.find(s => s.name === line.Setting);
          if (!setting || !importableNames.includes(line.Setting) || isNaN(line.Value)) continue;
          const value = setting.type === 'switch' ? Boolean(line.Value) : line.Value;
          if (formValues[line.Setting] !== value) {
            handleFieldChange(line.Setting, value);
            changedFields.push(line.Setting);
          }
        }
        //normalization 0 is off; a target means fixed; normalization 1 without a target means match highest
        const normRow = assayNumbers.find(line => line.Setting === 'DMSO Normalization' && !isNaN(line.Value));
        const targetRow = assayNumbers.find(line => line.Setting === 'Target DMSO Volume (nL)' && !isNaN(line.Value));
        if (normRow || targetRow) {
          const fileMode = normRow && !normRow.Value ? 'off' : (targetRow ? 'fixed' : 'auto');
          if (targetRow && formValues['Target DMSO Volume (nL)'] !== targetRow.Value) {
            handleFieldChange('Target DMSO Volume (nL)', targetRow.Value);
            changedFields.push('Target DMSO Volume (nL)');
          }
          if (fileMode !== dmsoMode) {
            handleDmsoModeChange(fileMode);
            changedFields.push('DMSO Normalization');
          }
        }
      }
      if (changedFields.length > 0) {
        setShowAlert(changedFields);
        if (changedFields.some(name => PLATES_SECTION_NAMES.includes(name))) setIsPlatesOpen(true);
      }
    } else if (files.length === 0) {
      setExcelFile(null);
    }
  };

  const handleTransferFileSelected = (files: File[]) => {
    if (setTransferFile) {
      if (files.length === 1) {
        setTransferFile(files[0]);
      } else if (files.length === 0) {
        setTransferFile(null);
      }
    }
  };

  const handleDmsoModeChange = (mode: string) => {
    setIsFixedTarget(mode === 'fixed');
    handleFieldChange('DMSO Normalization', mode !== 'off');
  };

  const handleResetForm = () => {
    console.log(formValues, buildFormValues(settings, preferences))
    setFormValues(buildFormValues(settings, preferences));
    setIsFixedTarget(typeof preferences.targetDMSOVol === 'number');
    setShowAlert([]);
  };

  const handleClearForm = () => {
    setExcelFile(null);
    if (setTransferFile) setTransferFile(null);
    setValidated(false);
    setShowAlert([]);
    setClearKey(prev => prev + 1);
    handleClear();
  };

  const renderField = (prefId: string, isDisabled = false, unit?: string) => {
    const setting = getSetting(prefId);
    return (
      <FormField
        key={prefId}
        id={prefId}
        name={setting.name}
        type={setting.type as FormFieldType}
        label={setting.name}
        value={formValues[setting.name]}
        onChange={(value) => handleFieldChange(setting.name, value)}
        required={!setting.optional}
        disabled={isDisabled}
        unit={unit ?? setting.unit}
        step={setting.step}
        max={setting.max}
        min={setting.min}
        options={setting.options}
        tooltip={setting.tooltip}
      />
    );
  };

  //spells out the percentage a fraction field equals, so a decimal isn't mistaken for a percent
  const getPercentUnit = (name: string) => {
    const value = formValues[name];
    return typeof value === 'number' ? `${(value * 100).toFixed(2)}%` : undefined;
  };

  return (
    <Form noValidate validated={validated} onSubmit={handleSubmit}>
      <Row>
        <Col md={isTransferLogMode ? '6' : '12'}>
          <FileUploadCard
            key={`excel-${clearKey}`}
            onFilesSelected={handleExcelFileSelected}
            acceptedTypes=".xlsx, .xls"
            title="Ripple Input"
            description="Original Ripple file"
            multiple={false}
            name="excelFile"
          >
            {excelFile && (
              <div className="mt-2">
                <small className="text-success">
                  Selected: {excelFile.name}
                </small>
              </div>
            )}
          </FileUploadCard>
        </Col>
        {isTransferLogMode && (
          <Col md="6">
            <FileUploadCard
              key={`transfer-${clearKey}`}
              onFilesSelected={handleTransferFileSelected}
              acceptedTypes=".csv"
              title="Transfer Log"
              description="Echo output log"
              multiple={false}
              name="transferFile"
            >
              {transferFile && (
                <div className="mt-2">
                  <small className="text-success">
                    Selected: {transferFile.name}
                  </small>
                </div>
              )}
            </FileUploadCard>
          </Col>
        )}
      </Row>

      <Alert variant="warning" show={showAlert.length > 0} onClose={() => setShowAlert([])} dismissible transition>
        The following values were imported from the file:
        <ul className="mb-0">
          {showAlert.map((alert, idx) => <li key={idx}>{alert}</li>)}
        </ul>
      </Alert>

      {isTransferLogMode ? (
        <div className="echo-form-group">
          {settings.map(s => renderField(s.prefId))}
        </div>
      ) : (
        <>
          <div className="echo-form-group">
            <div className="echo-form-group-label">ASSAY</div>
            {renderField('defaultAssayVolume')}
            {renderField('defaultDMSOTolerance', dmsoMode === 'fixed', getPercentUnit('DMSO Tolerance'))}
            {renderField('defaultAllowedError', false, getPercentUnit('Allowed Error'))}
            {renderField('defaultDestinationReplicates')}
          </div>

          <div className="echo-form-group">
            <div className="echo-form-group-label">DMSO NORMALIZATION</div>
            <ButtonGroup className="echo-form-dmso-modes">
              {DMSO_MODE_OPTIONS.map(option => (
                <Button
                  key={option.value}
                  type="button"
                  size="sm"
                  variant={dmsoMode === option.value ? 'primary' : 'outline-primary'}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    handleDmsoModeChange(option.value);
                  }}
                >
                  {option.label}
                </Button>
              ))}
            </ButtonGroup>
            <small className="echo-form-hint">{DMSO_MODE_OPTIONS.find(o => o.value === dmsoMode)?.description}</small>
            {dmsoMode !== 'off' && <input type="hidden" name="DMSO Normalization" value="on" />}
            {dmsoMode === 'fixed' && (
              <>
                <FormField
                  id="targetDMSOVol"
                  name="Target DMSO Volume (nL)"
                  type="number"
                  label="Target DMSO Volume (nL)"
                  value={targetVolume}
                  onChange={(value) => handleFieldChange('Target DMSO Volume (nL)', value)}
                  required
                  step={formValues['Echo Droplet Size'] as number}
                  min={0}
                  tooltip={getSetting('targetDMSOVol').tooltip}
                />
                {finalDMSOFraction !== null && (
                  <small className={`echo-form-hint ${isOverTolerance ? 'text-warning' : ''}`}>
                    = {(finalDMSOFraction * 100).toFixed(2)}% final DMSO in a {wellVolume} µL well{isOverTolerance ? ' (above DMSO Tolerance)' : ''}
                  </small>
                )}
                {finalDMSOFraction !== null && isOverMaxTransfer && (
                  <small className='echo-form-hint text-danger'>
                    Target volume is above listed {maxTransfer} maximum transfer volume!
                  </small>
                )}
              </>
            )}
            {dmsoMode !== 'off' && renderField('skipUnusedBlocks')}
          </div>
          <div className="echo-form-group">
            <button
              type="button"
              className="echo-form-group-label echo-form-section-toggle"
              onClick={(e) => {
                e.currentTarget.blur();
                setIsPlatesOpen(!isPlatesOpen);
              }}
            >
              <ChevronRight size={14} className={`echo-form-chevron ${isPlatesOpen ? 'open' : ''}`} />
              PLATES & ECHO
            </button>
            {!isPlatesOpen && <small className="echo-form-hint">{getPlatesSummary(formValues)}</small>}
            <div className={isPlatesOpen ? '' : 'd-none'}>
              {renderField('sourcePlateSize')}
              {renderField('destinationPlateSize')}
              {renderField('dropletSize')}
              {renderField('maxTransferVolume')}
              {renderField('useIntermediatePlates')}
              {isIntermediateOn && renderField('defaultBackfill')}
              {isIntermediateOn && renderField('fillIntColumnwise')}
              {renderField('evenDepletion')}
            </div>
          </div>
        </>
      )}

      <div className="form-buttons">
        <Button type="submit" disabled={!excelFile || (isTransferLogMode && !transferFile)}>{submitText}</Button>
        <div className="d-flex gap-2">
          <Button variant="link" size="sm" onClick={handleResetForm}>Reset to Defaults</Button>
          <Button variant="outline-danger" onClick={handleClearForm}>Clear Plates</Button>
        </div>
      </div>
    </Form>
  );
};

export default EchoForm;