import React, { useState } from 'react';
import { Accordion, Form, Button } from 'react-bootstrap';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Pattern } from '../../../classes/PatternClass';
import { FormField } from '../../../components/FormField';
import { WellContentsForm } from './DesignWizardSrc';
import ConcentrationTable from './ConcentrationTable';

interface AdvancedForm {
  compoundListText: string;
  concentrations: (number | null)[];
  direction: 'LR' | 'RL' | 'TB' | 'BT';
  volume: number | '';
  currentIdx: number;
  patternNames: string[];
}

interface ContentsManagerProps {
  selectedWellIds: string[];
  patterns: Pattern[];
  wellContentsForm: WellContentsForm;
  setWellContentsForm: React.Dispatch<React.SetStateAction<WellContentsForm>>;
  onApplyAdvanced: (
    compoundId: string,
    concentrations: number[],
    direction: 'LR' | 'RL' | 'TB' | 'BT',
    volume: number,
    patternNames: string[]
  ) => void;
  enterCallbackRef: React.RefObject<(() => void) | null>
}

const ContentsManager: React.FC<ContentsManagerProps> = ({
  selectedWellIds,
  patterns,
  wellContentsForm,
  setWellContentsForm,
  onApplyAdvanced,
  enterCallbackRef
}) => {
  const [activeAccordion, setActiveAccordion] = useState<string | null>('basic');
  const [advancedForm, setAdvancedForm] = useState<AdvancedForm>({
    compoundListText: '',
    concentrations: [null],
    direction: 'LR',
    volume: '',
    currentIdx: 0,
    patternNames: [],
  });

  const compoundList = advancedForm.compoundListText
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean);
  const currentCompound = compoundList[advancedForm.currentIdx] ?? null;
  const validConcentrations = advancedForm.concentrations.filter(
    (c): c is number => typeof c === 'number' && !isNaN(c)
  );

  const canApplyAdvanced =
    selectedWellIds.length > 0 &&
    currentCompound !== null &&
    validConcentrations.length > 0 &&
    typeof advancedForm.volume === 'number' &&
    advancedForm.volume > 0 &&
    advancedForm.patternNames.length > 0;

  enterCallbackRef.current = canApplyAdvanced && activeAccordion === 'advanced'
  ? () => {
      onApplyAdvanced(
        currentCompound!,
        validConcentrations,
        advancedForm.direction,
        advancedForm.volume as number,
        advancedForm.patternNames,
      );
      setAdvancedForm(prev => ({
        ...prev,
        currentIdx: Math.min(prev.currentIdx + 1, compoundList.length - 1),
      }));
    }
  : null;

  const handleBasicFieldChange = (fieldName: string, value: number | string | string[] | boolean) => {
    switch (fieldName) {
      case 'name':
        setWellContentsForm({ ...wellContentsForm, compoundId: value as string });
        break;
      case 'concentration':
        setWellContentsForm({ ...wellContentsForm, concentration: value as number });
        break;
      case 'volume':
        setWellContentsForm({ ...wellContentsForm, volume: value as number });
        break;
      case 'dmso':
        setWellContentsForm({ ...wellContentsForm, dmsoWells: value as boolean });
        break;
      case 'pattern':
        setWellContentsForm({
          ...wellContentsForm,
          patternNames: wellContentsForm.patternNames.includes(value as string)
            ? wellContentsForm.patternNames.filter(p => p !== value)
            : [...wellContentsForm.patternNames, value as string],
        });
        break;
    }
  };

  const handleAdvancedFieldChange = (fieldName: string, value: number | string | string[] | boolean) => {
    switch (fieldName) {
      case 'direction':
        setAdvancedForm({ ...advancedForm, direction: (value as string[])[0] as AdvancedForm['direction'] });
        break;
      case 'volume':
        setAdvancedForm({ ...advancedForm, volume: value as number });
        break;
      case 'pattern':
        setAdvancedForm({
          ...advancedForm,
          patternNames: advancedForm.patternNames.includes(value as string)
            ? advancedForm.patternNames.filter(p => p !== value as string)
            : [...advancedForm.patternNames, value as string]
        });
        break;
    }
  };

  const handleConcentrationChange = (newConcentrations: (number | null)[]) => {
    setAdvancedForm({ ...advancedForm, concentrations: newConcentrations });
  };

  const selectionLabel =
    selectedWellIds.length === 0
      ? 'No wells selected'
      : `${selectedWellIds.length} well${selectedWellIds.length > 1 ? 's' : ''} selected`;

  const assignablePatterns = patterns.filter(p => p.type !== 'Unused');

  const expectedWells = validConcentrations.length

  function renderPatternCheckboxes(
    patternNames: string[],
    onChange: (fieldName: string, value: string) => void,
    disabled: boolean
  ) {
    return (
      <div className="mb-3">
        <label className="form-label">Linked Patterns</label>
        {assignablePatterns.length === 0 ? (
          <p className="text-muted small mb-0">No patterns defined on destination plate</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.25rem' }}>
            {assignablePatterns.map(pattern => (
              <div key={pattern.id} className="form-check mb-0">
                <input
                  type="checkbox"
                  id={`src-pattern-${activeAccordion}-${pattern.id}`}
                  className="form-check-input"
                  checked={patternNames.includes(pattern.name)}
                  onChange={(e) => {onChange('pattern', pattern.name);e.currentTarget.blur()}}
                  disabled={disabled}
                />
                <label
                  htmlFor={`src-pattern-${activeAccordion}-${pattern.id}`}
                  className="form-check-label d-flex align-items-center gap-2"
                >
                  <span
                    style={{
                      display: 'inline-block',
                      width: '0.75rem',
                      height: '0.75rem',
                      borderRadius: '50%',
                      backgroundColor: pattern.color,
                      flexShrink: 0
                    }}
                  />
                  {pattern.name}
                </label>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="d-flex flex-column">
      <div className="mb-2">
        <small className="text-muted">{selectionLabel}</small>
      </div>
      <Form>
        <Accordion
          activeKey={activeAccordion}
          onSelect={(k) => setActiveAccordion(k as string | null)}
          flush
        >
          <Accordion.Item eventKey="basic">
            <Accordion.Header>Basic</Accordion.Header>
            <Accordion.Body className="px-0">
              <FormField
                id="src-dmso-check"
                name="dmso"
                type="switch"
                label="DMSO-only Wells"
                value={wellContentsForm.dmsoWells}
                onChange={(value) => handleBasicFieldChange('dmso', value)}
                required
                tooltip="When checked, designates wells as solvent-only for downstream DMSO normalization"
              />
              <FormField
                id="src-compound-id"
                name="name"
                type="text"
                label="Compound ID"
                value={wellContentsForm.compoundId}
                onChange={(value) => handleBasicFieldChange('name', value)}
                disabled={selectedWellIds.length === 0 || wellContentsForm.dmsoWells}
                required
              />
              <FormField
                id="src-concentration"
                name="concentration"
                type="number"
                label="Concentration"
                value={wellContentsForm.concentration}
                onChange={(value) => handleBasicFieldChange('concentration', value)}
                disabled={selectedWellIds.length === 0 || wellContentsForm.dmsoWells}
                unit="µM"
                min={0}
                required
              />
              <FormField
                id="src-volume"
                name="volume"
                type="number"
                label="Volume"
                value={wellContentsForm.volume}
                onChange={(value) => handleBasicFieldChange('volume', value)}
                disabled={selectedWellIds.length === 0}
                unit="µL"
                min={0}
                required
              />
              {renderPatternCheckboxes(
                wellContentsForm.patternNames,
                handleBasicFieldChange,
                wellContentsForm.dmsoWells
              )}
            </Accordion.Body>
          </Accordion.Item>

          <Accordion.Item eventKey="advanced">
            <Accordion.Header>Advanced</Accordion.Header>
            <Accordion.Body className="px-0">
              <div className="mb-2">
                <label className="form-label">Compound List</label>
                <Form.Control
                  as="textarea"
                  rows={4}
                  placeholder="One compound ID per line"
                  value={advancedForm.compoundListText}
                  onChange={(e) => setAdvancedForm(prev => ({
                    ...prev,
                    compoundListText: e.target.value,
                    currentIdx: 0,
                  }))}
                  style={{ fontSize: '0.85rem', resize: 'vertical', fontFamily: 'monospace' }}
                />
              </div>

              <div className="d-flex align-items-center gap-1 mb-2">
                <Button
                  size="sm"
                  variant="outline-secondary"
                  onClick={() => setAdvancedForm(prev => ({ ...prev, currentIdx: Math.max(0, prev.currentIdx - 1) }))}
                  disabled={advancedForm.currentIdx === 0}
                >
                  <ChevronLeft size={14} />
                </Button>
                <span
                  className="flex-grow-1 text-center small border rounded py-1 px-2"
                  style={{ fontFamily: 'monospace', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  <span className="d-flex justify-content-between">
                    <span>{advancedForm.currentIdx + 1} / {compoundList.length}</span>
                    <span>{currentCompound}</span>
                  </span>
                </span>
                <Button
                  size="sm"
                  variant="outline-secondary"
                  onClick={() => setAdvancedForm(prev => ({ ...prev, currentIdx: Math.min(compoundList.length - 1, prev.currentIdx + 1) }))}
                  disabled={advancedForm.currentIdx >= compoundList.length - 1}
                >
                  <ChevronRight size={14} />
                </Button>
              </div>

              <FormField
                id="adv-direction"
                name="direction"
                type="select"
                label="Direction"
                value={advancedForm.direction}
                onChange={(value) => handleAdvancedFieldChange('direction', [value as string])}
                required
                options={[
                  { label: "LR", value: "LR" },
                  { label: "RL", value: "RL" },
                  { label: "TB", value: "TB" },
                  { label: "BT", value: "BT" }
                ]}
              />
              <FormField
                id="adv-volume"
                name="volume"
                type="number"
                label="Volume"
                value={advancedForm.volume}
                onChange={(value) => handleAdvancedFieldChange('volume', value)}
                unit="µL"
                min={0}
                required
              />
              {renderPatternCheckboxes(
                advancedForm.patternNames,
                handleAdvancedFieldChange,
                false
              )}

              <Form.Label>Concentrations</Form.Label>
              <div className="concentration-table-container">
                <ConcentrationTable
                  tableId="source-conc-table"
                  concentrations={advancedForm.concentrations}
                  onChange={handleConcentrationChange}
                  disabled={false}
                />
              </div>

              {expectedWells !== null && (
                <p className="small mb-2" style={{ color: selectedWellIds.length > 0 && selectedWellIds.length !== expectedWells ? 'var(--bs-warning)' : 'var(--bs-secondary)' }}>
                  Expects {expectedWells} well{expectedWells !== 1 ? 's' : ''} per compound
                  {selectedWellIds.length > 0 && selectedWellIds.length !== expectedWells && (
                    <> ({selectedWellIds.length} selected)</>
                  )}
                </p>
              )}

              <p className="text-muted small mb-0">
                Select wells on the plate, then press <kbd>Enter</kbd> to apply and advance to the next compound.
              </p>
            </Accordion.Body>
          </Accordion.Item>
        </Accordion>
      </Form>
    </div>
  );
};

export default ContentsManager;