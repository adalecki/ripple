import React, { useState } from 'react';
import { Container, Row, Col, Button, ButtonGroup, Form, Alert, Table } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { read, utils, WorkBook } from 'xlsx';

import { Plate, PlateSize } from '../../../classes/PlateClass';
import { Pattern, CombinationType, isCombinationType, getCombinationFold } from '../../../classes/PatternClass';
import { FormField, FormFieldType } from '../../../components/FormField';
import FileUploadCard from '../../../components/FileUploadCard';
import { usePreferences } from '../../../hooks/usePreferences';
import { PREFERENCES_CONFIG, Setting } from '../../../config/preferencesConfig';
import { generateId, plateMaxConcentration } from '../../../utils/designUtils';
import { getCoordsFromWellId } from '../../../utils/plateUtils';
import { echoInputValidation, fileHeaders } from '../../EchoTransfer/utils/validationUtils';
import { InputDataType } from '../../EchoTransfer/utils/echoUtils';

import '../../../css/DesignWizard.css';
import '../../../css/EchoForm.css';

export interface AssayForm {
  values: { [settingName: string]: number | '' };
  dmsoMode: '' | 'off' | 'auto' | 'fixed';
  intBarcodes: string;
  dstBarcodes: string;
}

export interface ImportedDesign {
  patterns: Pattern[];
  dstPlate: Plate;
  dstPlateSize: PlateSize;
  srcPlates: Plate[];
  srcPlateSize: PlateSize;
  assayForm: AssayForm;
}

const DMSO_MODE_OPTIONS = [
  { value: 'off', label: 'Off', description: 'No DMSO is added; each well keeps only the DMSO its transfers bring' },
  { value: 'auto', label: 'Match Highest', description: 'Every well is backfilled with DMSO up to the highest DMSO volume in any well of its destination plate' },
  { value: 'fixed', label: 'Fixed Volume', description: 'Every well is backfilled with DMSO up to a set volume, keeping DMSO consistent between assays. Overrides DMSO Tolerance setting.' }
] as const;

//Assay tab rows in export order; DMSO Normalization and Target DMSO Volume come from dmsoMode instead
const SETTING_NAMES = ['Well Volume (µL)', 'DMSO Tolerance', 'Allowed Error', 'Destination Replicates', 'Skip Unused Treatment Blocks', 'Source Plate Size', 'Destination Plate Size', 'Echo Droplet Size', 'Max Transfer Volume', 'Use Intermediate Plates', 'Backfill (µL)', 'Fill Intermediate Plates Column-wise', 'Evenly Deplete Source Wells'];

function getSetting(prefId: string): Setting {
  for (const category of PREFERENCES_CONFIG) {
    const setting = category.settings.find(s => s.prefId === prefId);
    if (setting) return setting;
  }
  throw new Error(`Unknown preference ${prefId}`);
}

export function parseBarcodeList(text: string): string[] {
  return text.split('\n').map(s => s.trim()).filter(Boolean);
}

//hidden fields stay in the form so toggling back restores them, but they never reach the template
export function buildAssayRows(assayForm: AssayForm): { 'Setting': string, 'Value': number }[] {
  const hiddenNames: string[] = [];
  if (assayForm.dmsoMode === 'off') hiddenNames.push('Skip Unused Treatment Blocks');
  if (assayForm.values['Use Intermediate Plates'] === 0) hiddenNames.push('Backfill (µL)', 'Fill Intermediate Plates Column-wise');
  const rows: { 'Setting': string, 'Value': number }[] = [];
  for (const name of SETTING_NAMES) {
    const value = assayForm.values[name];
    if (typeof value === 'number' && !hiddenNames.includes(name)) rows.push({ 'Setting': name, 'Value': value });
  }
  if (assayForm.dmsoMode !== '') rows.push({ 'Setting': 'DMSO Normalization', 'Value': assayForm.dmsoMode === 'off' ? 0 : 1 });
  const target = assayForm.values['Target DMSO Volume (nL)'];
  if (assayForm.dmsoMode === 'fixed' && typeof target === 'number') rows.push({ 'Setting': 'Target DMSO Volume (nL)', 'Value': target });
  return rows;
}

//never shrinks below the starting size (the template's own Assay tab size, else the current design's), so a 384 template using only A1:H12 doesn't become a 96 well plate
function fitPlateSize(wellBlocks: string[], sizes: PlateSize[], curSize: PlateSize): PlateSize {
  const cornerCoords = wellBlocks.flatMap(block => block.split(/[;:]/)).map(wellId => getCoordsFromWellId(wellId));
  for (const size of sizes) {
    if (Number(size) < Number(curSize)) continue;
    const plate = new Plate({ plateSize: size });
    if (cornerCoords.every(coords => coords.row < plate.rows && coords.col < plate.columns)) return size;
  }
  return sizes[sizes.length - 1];
}

function buildDesignFromInputData(inputData: InputDataType, wb: WorkBook, curDstPlateSize: PlateSize, curSrcPlateSize: PlateSize): ImportedDesign {
  const assayForm: AssayForm = {
    values: {},
    dmsoMode: '',
    intBarcodes: inputData.Barcodes.map(row => row['Intermediate Plate Barcodes']).filter(Boolean).join('\n'),
    dstBarcodes: inputData.Barcodes.map(row => row['Destination Plate Barcodes']).filter(Boolean).join('\n')
  };
  if (wb.Sheets['Assay'] && fileHeaders(wb.Sheets['Assay'], ['Setting', 'Value'])) {
    const assayRows: { 'Setting': string, 'Value': number }[] = utils.sheet_to_json(wb.Sheets['Assay']);
    for (const row of assayRows) {
      if ([...SETTING_NAMES, 'Target DMSO Volume (nL)'].includes(row.Setting) && !isNaN(row.Value)) assayForm.values[row.Setting] = Number(row.Value);
    }
    //same reading as the calculator: normalization 0 is off; a target means fixed; normalization 1 without a target means match highest
    const normRow = assayRows.find(row => row.Setting === 'DMSO Normalization' && !isNaN(row.Value));
    const hasTarget = typeof assayForm.values['Target DMSO Volume (nL)'] === 'number';
    if (normRow || hasTarget) assayForm.dmsoMode = normRow && !normRow.Value ? 'off' : (hasTarget ? 'fixed' : 'auto');
  }

  const patterns: Pattern[] = [];
  for (const row of inputData.Patterns) {
    //the template generator re-adds this pattern whenever a source plate has DMSO wells
    if (row.Pattern === 'DMSO' && row.Type === 'Solvent') continue;
    const concentrations: number[] = [];
    for (let i = 1; i <= 20; i++) {
      const conc = row[`Conc${i}` as keyof typeof row];
      if (typeof conc === 'number') concentrations.push(conc);
    }
    patterns.push(new Pattern({
      id: generateId(patterns),
      name: row.Pattern,
      type: row.Type,
      replicates: row.Replicates || 1,
      direction: row.Direction ? String(row.Direction).split('-') as Pattern['direction'] : ['LR'],
      concentrations: concentrations.length > 0 ? concentrations : [null],
      locations: inputData.Layout.filter(layoutRow => layoutRow.Pattern === row.Pattern).map(layoutRow => layoutRow['Well Block']),
      fold: isCombinationType(row.Type) ? getCombinationFold(row.Type as CombinationType) : undefined
    }));
  }

  const assayDstSize = assayForm.values['Destination Plate Size'];
  const assaySrcSize = assayForm.values['Source Plate Size'];
  const dstPlateSize = fitPlateSize(inputData.Layout.map(row => row['Well Block']), ['96', '384', '1536'], typeof assayDstSize === 'number' ? String(assayDstSize) as PlateSize : curDstPlateSize);
  const dstPlate = new Plate({ barcode: 'DST001', plateSize: dstPlateSize });
  for (const pattern of patterns) {
    for (const block of pattern.locations) { dstPlate.applyPattern(block, pattern) }
  }

  const srcPlateSize = fitPlateSize(inputData.Compounds.map(row => row['Well ID']), ['384', '1536'], typeof assaySrcSize === 'number' ? String(assaySrcSize) as PlateSize : curSrcPlateSize);
  const srcPlates: Plate[] = [];
  for (const row of inputData.Compounds) {
    let plate = srcPlates.find(p => p.barcode === row['Source Barcode']);
    if (!plate) {
      plate = new Plate({ id: generateId(srcPlates), barcode: row['Source Barcode'], plateSize: srcPlateSize });
      srcPlates.push(plate);
    }
    for (const well of plate.getSomeWells(row['Well ID'])) {
      if (row['Compound ID'] === 'DMSO' && ['', 'DMSO'].includes(row.Pattern)) {
        //convert µL to nL
        well.bulkFill(row['Volume (µL)'] * 1000, 'DMSO');
      } else {
        well.addContent({
          compoundId: row['Compound ID'],
          concentration: row['Concentration (µM)'],
          volume: row['Volume (µL)'] * 1000,
          patternName: row.Pattern
        },
          { name: 'DMSO', fraction: 1 }
        );
      }
    }
  }
  for (const plate of srcPlates) { plate.metadata.globalMaxConcentration = plateMaxConcentration(plate) }
  if (srcPlates.length === 0) srcPlates.push(new Plate({ barcode: 'SRC001', plateSize: srcPlateSize }));

  return { patterns, dstPlate, dstPlateSize, srcPlates, srcPlateSize, assayForm };
}

interface DesignWizardAsyProps {
  assayForm: AssayForm;
  setAssayForm: React.Dispatch<React.SetStateAction<AssayForm>>;
  patterns: Pattern[];
  designSrcPlates: Plate[];
  designDstPlateSize: PlateSize;
  designSrcPlateSize: PlateSize;
  onImportDesign: (design: ImportedDesign) => void;
  onGenerateTemplate: () => void;
}

const DesignWizardAsy: React.FC<DesignWizardAsyProps> = ({
  assayForm,
  setAssayForm,
  patterns,
  designSrcPlates,
  designDstPlateSize,
  designSrcPlateSize,
  onImportDesign,
  onGenerateTemplate
}) => {
  const { preferences } = usePreferences();
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importedFileName, setImportedFileName] = useState('');

  const intBarcodes = parseBarcodeList(assayForm.intBarcodes);
  const dstBarcodes = parseBarcodeList(assayForm.dstBarcodes);
  const assayRows = buildAssayRows(assayForm);
  const barcodeWarnings = getBarcodeWarnings();

  const wellVolume = typeof assayForm.values['Well Volume (µL)'] === 'number' ? assayForm.values['Well Volume (µL)'] : preferences.defaultAssayVolume as number;
  const targetVolume = assayForm.values['Target DMSO Volume (nL)'];
  const dropletSize = typeof assayForm.values['Echo Droplet Size'] === 'number' ? assayForm.values['Echo Droplet Size'] : preferences.dropletSize as number;
  const srcSizeValue = assayForm.values['Source Plate Size'];
  const dstSizeValue = assayForm.values['Destination Plate Size'];
  //convert µL to nL
  const finalDMSOFraction = (wellVolume > 0 && typeof targetVolume === 'number') ? targetVolume / (wellVolume * 1000 + targetVolume) : null;

  function getBarcodeWarnings(): string[] {
    const warnings: string[] = [];
    const srcBarcodes = designSrcPlates.map(p => p.barcode);
    for (const [idx, barcode] of intBarcodes.entries()) {
      if (intBarcodes.indexOf(barcode) !== idx) warnings.push(`${barcode} is listed more than once as an Intermediate barcode`);
      if (srcBarcodes.includes(barcode)) warnings.push(`${barcode} is already a source plate barcode`);
      if (dstBarcodes.includes(barcode)) warnings.push(`${barcode} is listed as both an Intermediate and a Destination barcode`);
    }
    for (const [idx, barcode] of dstBarcodes.entries()) {
      if (dstBarcodes.indexOf(barcode) !== idx) warnings.push(`${barcode} is listed more than once as a Destination barcode`);
      if (srcBarcodes.includes(barcode)) warnings.push(`${barcode} is already a source plate barcode`);
    }
    return warnings;
  }

  const handleFieldChange = (fieldName: keyof AssayForm, value: string) => {
    setAssayForm(prev => ({ ...prev, [fieldName]: value }));
  };

  const handleValueChange = (settingName: string, value: number | '') => {
    setAssayForm(prev => ({ ...prev, values: { ...prev.values, [settingName]: value } }));
  };

  const handleResetSettings = () => {
    setAssayForm(prev => ({ ...prev, values: {}, dmsoMode: '' }));
  };

  const handleImportFileSelected = async (files: File[]) => {
    //an empty list means the file dialog was cancelled
    if (files.length !== 1) return;
    const wb = read(await files[0].arrayBuffer(), { type: 'array' });
    //validate against the largest plates so the template's own wells decide the plate sizes; the form check only needs numbers since assay values are read separately
    const { inputData, errors } = echoInputValidation(wb, { 'DMSO Tolerance': 0, 'Well Volume (µL)': 0, 'Allowed Error': 0 }, { ...preferences, sourcePlateSize: '1536', destinationPlateSize: '1536' });
    setImportErrors(errors);
    setImportedFileName('');
    if (errors.length > 0) return;
    const hasDesign = patterns.some(p => p.locations.length > 0) || designSrcPlates.some(plate => Array.from(plate).some(well => well.getTotalVolume() > 0));
    if (hasDesign && !window.confirm('Importing will replace the current patterns, layout, source plates, and assay settings. Continue?')) return;
    onImportDesign(buildDesignFromInputData(inputData, wb, designDstPlateSize, designSrcPlateSize));
    setImportedFileName(files[0].name);
  };

  //spells out the percentage a fraction field equals, so a decimal isn't mistaken for a percent
  const getPercentUnit = (name: string) => {
    const value = assayForm.values[name];
    return typeof value === 'number' ? `${(value * 100).toFixed(2)}%` : undefined;
  };

  //a blank field or blank first option means the setting is left out of the template
  const renderField = (prefId: string, unit?: string) => {
    const setting = getSetting(prefId);
    if (setting.type === 'switch' || setting.type === 'select') {
      const options = setting.type === 'switch' ? [{ value: 1, label: 'On' }, { value: 0, label: 'Off' }] : setting.options ?? [];
      return (
        <FormField
          key={prefId}
          id={prefId}
          name={setting.name}
          type="select"
          label={setting.name}
          value={assayForm.values[setting.name] ?? ''}
          onChange={(value) => handleValueChange(setting.name, value === '' ? '' : Number(value))}
          options={[{ value: '', label: '' }, ...options]}
          unit={unit ?? setting.unit}
          tooltip={setting.tooltip}
        />
      );
    }
    return (
      <FormField
        key={prefId}
        id={prefId}
        name={setting.name}
        type={setting.type as FormFieldType}
        label={setting.name}
        value={assayForm.values[setting.name] ?? ''}
        onChange={(value) => handleValueChange(setting.name, value)}
        unit={unit ?? setting.unit}
        step={setting.step}
        min={setting.min}
        tooltip={setting.tooltip}
      />
    );
  };

  return (
    <Container fluid className="design-wizard-container">
      <Row className="design-wizard-row">
        <Col md={4} className="design-wizard-col">
          <FileUploadCard
            onFilesSelected={handleImportFileSelected}
            multiple={false}
            acceptedTypes=".xlsx"
            title="Import Template"
            description="Load an existing Ripple template into the designer, replacing the current design"
          >
            {importedFileName && (
              <div className="mt-2">
                <small className="text-success">Imported: {importedFileName}</small>
              </div>
            )}
          </FileUploadCard>
          {importErrors.length > 0 && (
            <Alert variant="danger">
              <ul className="mb-0">
                {importErrors.map((error, idx) => <li key={idx}>{error}</li>)}
              </ul>
            </Alert>
          )}
          <div className="echo-form-group">
            <div className="echo-form-group-label">BARCODES</div>
            <small className="echo-form-hint">One per line, used in order; plates without a barcode are named automatically</small>
            <div className="mb-2">
              <label htmlFor="int-barcodes" className="form-label">Intermediate Plate Barcodes</label>
              <Form.Control
                id="int-barcodes"
                as="textarea"
                rows={6}
                value={assayForm.intBarcodes}
                onChange={(e) => handleFieldChange('intBarcodes', e.target.value)}
                style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}
              />
              <small className="text-muted">{intBarcodes.length} barcode{intBarcodes.length === 1 ? '' : 's'}</small>
            </div>
            <div className="mb-2">
              <label htmlFor="dst-barcodes" className="form-label">Destination Plate Barcodes</label>
              <Form.Control
                id="dst-barcodes"
                as="textarea"
                rows={6}
                value={assayForm.dstBarcodes}
                onChange={(e) => handleFieldChange('dstBarcodes', e.target.value)}
                style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}
              />
              <small className="text-muted">{dstBarcodes.length} barcode{dstBarcodes.length === 1 ? '' : 's'}</small>
            </div>
            {barcodeWarnings.length > 0 && (
              <Alert variant="warning">
                <ul className="mb-0">
                  {barcodeWarnings.map((warning, idx) => <li key={idx}>{warning}</li>)}
                </ul>
              </Alert>
            )}
          </div>

        </Col>

        <Col md={4} className="design-wizard-col">
          <small className="text-muted fst-italic">Only the settings you fill in are written to the Assay tab; blank settings leave the calculator's own values in place</small>
          <div className="echo-form-group">
            <div className="echo-form-group-label">ASSAY</div>
            {renderField('defaultAssayVolume')}
            {renderField('defaultDMSOTolerance', getPercentUnit('DMSO Tolerance'))}
            {renderField('defaultAllowedError', getPercentUnit('Allowed Error'))}
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
                  variant={assayForm.dmsoMode === option.value ? 'primary' : 'outline-primary'}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    handleFieldChange('dmsoMode', assayForm.dmsoMode === option.value ? '' : option.value);
                  }}
                >
                  {option.label}
                </Button>
              ))}
            </ButtonGroup>
            <small className="echo-form-hint">{DMSO_MODE_OPTIONS.find(o => o.value === assayForm.dmsoMode)?.description ?? 'Not set; click a mode to include it, and click it again to clear'}</small>
            {assayForm.dmsoMode === 'fixed' && (
              <>
                <FormField
                  id="targetDMSOVol"
                  name="Target DMSO Volume (nL)"
                  type="number"
                  label="Target DMSO Volume (nL)"
                  value={targetVolume ?? ''}
                  onChange={(value) => handleValueChange('Target DMSO Volume (nL)', value)}
                  required
                  step={dropletSize}
                  min={dropletSize}
                  tooltip={getSetting('targetDMSOVol').tooltip}
                />
                {finalDMSOFraction !== null && (
                  <small className="echo-form-hint">
                    = {(finalDMSOFraction * 100).toFixed(2)}% final DMSO in a {wellVolume} µL well
                  </small>
                )}
              </>
            )}
            {assayForm.dmsoMode !== 'off' && renderField('skipUnusedBlocks')}
          </div>

          <div className="echo-form-group">
            <div className="echo-form-group-label">PLATES & ECHO</div>
            {renderField('sourcePlateSize')}
            {typeof srcSizeValue === 'number' && srcSizeValue !== Number(designSrcPlateSize) && <small className="echo-form-hint text-warning">Source design uses {designSrcPlateSize} well plates</small>}
            {renderField('destinationPlateSize')}
            {typeof dstSizeValue === 'number' && dstSizeValue !== Number(designDstPlateSize) && <small className="echo-form-hint text-warning">Destination design uses a {designDstPlateSize} well plate</small>}
            {renderField('dropletSize')}
            {renderField('maxTransferVolume')}
            {renderField('useIntermediatePlates')}
            {assayForm.values['Use Intermediate Plates'] !== 0 && renderField('defaultBackfill')}
            {assayForm.values['Use Intermediate Plates'] !== 0 && renderField('fillIntColumnwise')}
            {renderField('evenDepletion')}
          </div>
          <div className="form-buttons">
            <Button variant="link" size="sm" onClick={handleResetSettings}>Clear Settings</Button>
          </div>
        </Col>

        <Col md={4} className="design-wizard-col">

          <Button
            className="my-2"
            onClick={(e) => { onGenerateTemplate(); e.currentTarget.blur(); }}
            disabled={patterns.length < 1}
            variant="success"
          >
            Generate Template
          </Button>
          <small className="text-muted fst-italic mb-3"> Upload the generated template to the <Link to="/echotsfr">Echo Transfer calculator</Link> when finished</small>
          <div className="echo-form-group">
            <div className="echo-form-group-label">ASSAY TAB PREVIEW</div>
            {assayRows.length > 0 ? (
              <Table size="sm" borderless className="mb-0">
                <tbody>
                  {assayRows.map(row => (
                    <tr key={row.Setting}>
                      <td>{row.Setting}</td>
                      <td>{row.Value}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <small className="echo-form-hint">No settings set; the calculator will use its own values</small>
            )}
          </div>
        </Col>
      </Row>
    </Container>
  );
};

export default DesignWizardAsy;