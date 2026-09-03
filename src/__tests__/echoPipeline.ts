import { readFileSync } from 'fs';
import { read, utils, WorkBook } from 'xlsx';
import { PREFERENCES_CONFIG, Setting } from '../config/preferencesConfig';
import { getDefaultPreferences, PreferencesState, PreferenceValue } from '../hooks/usePreferences';
import { CheckpointTracker } from '../pages/EchoTransfer/classes/CheckpointTrackerClass';
import { EchoPreCalculator } from '../pages/EchoTransfer/classes/EchoPreCalculatorClass';
import { EchoCalculator } from '../pages/EchoTransfer/classes/EchoCalculatorClass';
import { echoInputValidation, fileHeaders } from '../pages/EchoTransfer/utils/validationUtils';
import { customSort } from '../pages/EchoTransfer/utils/echoUtils';
import { generateTransferListCSV, rowColExport, TransferStepExport } from '../utils/plateUtils';

export interface PipelineResult {
  csv: string;
  errors: string[];
  checkpointTracker: CheckpointTracker;
}

const calculatorFields = (PREFERENCES_CONFIG.find(p => p.id === 'calculator-defaults')?.settings || [])
  .filter(s => s.name !== 'Use Source Survey Volumes');

const transferFieldNames = ['Max Transfer Volume', 'Echo Droplet Size', 'Source Plate Size', 'Destination Plate Size'];
const transferFields = (PREFERENCES_CONFIG.find(p => p.id === 'transfer-settings')?.settings || [])
  .filter(s => transferFieldNames.includes(s.name));

//Assay rows only reach calculator-defaults fields; EchoForm never maps them against transfer settings
function applyAssaySettings(wb: WorkBook, values: { [key: string]: number | boolean | string }) {
  const sheet = wb.Sheets['Assay'];
  if (!sheet || !fileHeaders(sheet, ['Setting', 'Value'])) return;
  const assayNumbers: { Setting: string, Value: number }[] = utils.sheet_to_json(sheet);
  const fieldNames = calculatorFields.map(f => f.name);
  for (const line of assayNumbers) {
    if (fieldNames.includes(line.Setting) && !isNaN(line.Value)) {
      values[line.Setting] = line.Value;
    }
  }
}

//unchecked switches are absent from FormData entirely, which downstream validation relies on
function serializeAsFormData(values: { [key: string]: number | boolean | string }, fields: Setting[]) {
  const formValues: { [key: string]: any } = {};
  for (const field of fields) {
    const value = values[field.name];
    if (field.type === 'switch') {
      if (value) formValues[field.name] = 'on';
    }
    else {
      formValues[field.name] = String(value);
    }
  }
  return formValues;
}

export function buildFormValues(wb: WorkBook, preferences: PreferencesState) {
  const values: { [key: string]: number | boolean | string } = {};
  for (const field of [...calculatorFields, ...transferFields]) {
    values[field.name] = preferences[field.prefId] as Exclude<PreferenceValue, string[]> ?? field.defaultValue;
  }
  applyAssaySettings(wb, values);

  const visibleFields = [
    ...calculatorFields.filter(field =>
      (field.name !== 'Backfill (µL)' && field.name !== 'Fill Intermediate Plates Column-wise') ||
      values['Use Intermediate Plates']
    ),
    ...transferFields
  ];
  return serializeAsFormData(values, visibleFields);
}

export function runEchoPipeline(filePath: string, preferences: PreferencesState = getDefaultPreferences()): PipelineResult {
  const wb = read(new Uint8Array(readFileSync(filePath)), { type: 'array' }) as WorkBook;
  const formValues = buildFormValues(wb, preferences);

  const maxTransferVolume = parseFloat(formValues['Max Transfer Volume']);
  const dropletSize = parseFloat(formValues['Echo Droplet Size']);
  const effectivePreferences = {
    ...preferences,
    maxTransferVolume: isNaN(maxTransferVolume) ? preferences.maxTransferVolume : maxTransferVolume,
    dropletSize: isNaN(dropletSize) ? preferences.dropletSize : dropletSize,
    sourcePlateSize: formValues['Source Plate Size'] ?? preferences.sourcePlateSize,
    destinationPlateSize: formValues['Destination Plate Size'] ?? preferences.destinationPlateSize,
  };

  const checkpointTracker = new CheckpointTracker();
  const fileCheckpointName = 'File Validation';
  checkpointTracker.addCheckpoint(fileCheckpointName);

  const input = echoInputValidation(wb, formValues, effectivePreferences);
  if (input.errors.length > 0) {
    checkpointTracker.updateCheckpoint(fileCheckpointName, 'Failed', input.errors);
    return { csv: '', errors: input.errors, checkpointTracker };
  }
  checkpointTracker.updateCheckpoint(fileCheckpointName, 'Passed');

  const preCalc = new EchoPreCalculator(input.inputData, checkpointTracker, effectivePreferences);
  preCalc.calculateNeeds();

  //mirrors canContinue in CheckpointDisplayModal; warnings still proceed
  const failed = Array.from(checkpointTracker.checkpoints.values()).filter(check => check.status === 'Failed');
  if (failed.length > 0) {
    return { csv: '', errors: failed.flatMap(check => check.message), checkpointTracker };
  }

  const calc = new EchoCalculator(preCalc, checkpointTracker);
  const transferMap = customSort(structuredClone(calc.transferSteps), calc);

  let allSteps: TransferStepExport[] = [];
  for (const steps of transferMap.values()) {
    allSteps = allSteps.concat(steps);
  }
  const hasPlateType = allSteps.some(s => s.sourcePlateType != undefined)
  const rows = allSteps.map(step => rowColExport(step, hasPlateType));

  return { csv: generateTransferListCSV(rows), errors: calc.errors, checkpointTracker };
}