import React from 'react';
import { Accordion, Form, Button } from 'react-bootstrap';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Pattern } from '../../../classes/PatternClass';
import { FormField } from '../../../components/FormField';
import { WellContentsForm } from './DesignWizardSrc';
import ConcentrationTable from './ConcentrationTable';
import InfoTooltip from '../../../components/InfoTooltip';

interface ContentsManagerProps {
  selectedWellIds: string[];
  patterns: Pattern[];
  wellContentsForm: WellContentsForm;
  setWellContentsForm: React.Dispatch<React.SetStateAction<WellContentsForm>>;
  activeAccordion: string | null;
  setActiveAccordion: React.Dispatch<React.SetStateAction<string | null>>
  compoundList: string[];
  currentCompound: string | null;
  validConcentrations: number[];
}

const ContentsManager: React.FC<ContentsManagerProps> = ({
  selectedWellIds,
  patterns,
  wellContentsForm,
  setWellContentsForm,
  activeAccordion,
  setActiveAccordion,
  compoundList,
  currentCompound,
  validConcentrations
}) => {

  const handleFieldChange = (fieldName: string, value: number | string | string[] | boolean) => {
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
      case 'direction':
        setWellContentsForm({ ...wellContentsForm, direction: (value as string[])[0] as WellContentsForm['direction'] });
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

  const handleConcentrationChange = (newConcentrations: (number | null)[]) => {
    if (newConcentrations.length === 0) newConcentrations.push(null)
    setWellContentsForm({ ...wellContentsForm, concentrations: newConcentrations });
  };

  const selectionLabel =
    selectedWellIds.length === 0
      ? 'No wells selected'
      : `${selectedWellIds.length} well${selectedWellIds.length > 1 ? 's' : ''} selected`;

  const assignablePatterns = patterns.filter(p => p.type !== 'Unused');

  const expectedWells = validConcentrations.length

  return (
    <div className="d-flex flex-column">
      <div className="mb-2">
        <small className="text-muted">{selectionLabel}</small>
      </div>
      <Form>
        <FormField
          id="src-volume"
          name="volume"
          type="number"
          label="Well Volume"
          value={wellContentsForm.volume}
          onChange={(value) => handleFieldChange('volume', value)}
          unit="µL"
          min={0}
          required
        />
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
                    id={`src-pattern-${pattern.id}`}
                    className="form-check-input"
                    checked={wellContentsForm.patternNames.includes(pattern.name)}
                    onChange={(e) => { handleFieldChange('pattern', pattern.name); e.currentTarget.blur() }}
                    disabled={wellContentsForm.dmsoWells}
                  />
                  <label
                    htmlFor={`src-pattern-${pattern.id}`}
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
        <FormField
          id="src-dmso-check"
          name="dmso"
          type="switch"
          label="DMSO-only Wells"
          value={wellContentsForm.dmsoWells}
          onChange={(value) => handleFieldChange('dmso', value)}
          required
          tooltip="When checked, designates wells as solvent-only for downstream DMSO normalization"
        />
        <Accordion
          activeKey={activeAccordion}
          onSelect={(k) => setActiveAccordion(k as string | null)}
        >
          <Accordion.Item eventKey="basic">
            <Accordion.Header onClick={() => {(document.activeElement as HTMLElement).blur()}}>Basic</Accordion.Header>
            <Accordion.Body className="px-2">
              <FormField
                id="src-compound-id"
                name="name"
                type="text"
                label="Compound ID"
                value={wellContentsForm.compoundId}
                onChange={(value) => handleFieldChange('name', value)}
                disabled={wellContentsForm.dmsoWells}
                required
              />
              <FormField
                id="src-concentration"
                name="concentration"
                type="number"
                label="Concentration"
                value={wellContentsForm.concentration}
                onChange={(value) => handleFieldChange('concentration', value)}
                disabled={wellContentsForm.dmsoWells}
                unit="µM"
                min={0}
                required
              />

            </Accordion.Body>
          </Accordion.Item>

          <Accordion.Item eventKey="advanced">
            <Accordion.Header onClick={() => {(document.activeElement as HTMLElement).blur()}}>Advanced <InfoTooltip text={<>Select wells on the plate, then press <kbd>Enter</kbd> to apply and advance to the next compound.</>} /></Accordion.Header>
            <Accordion.Body className="px-2">
              <div className="mb-2">
                <label className="form-label">Compound List</label>
                <Form.Control
                  as="textarea"
                  rows={4}
                  placeholder="One compound ID per line"
                  value={wellContentsForm.compoundListText}
                  onChange={(e) => setWellContentsForm(prev => ({
                    ...prev,
                    compoundListText: e.target.value,
                    currentIdx: 0,
                  }))}
                  style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}
                  disabled={wellContentsForm.dmsoWells}
                />
              </div>

              <div className="d-flex align-items-center gap-1 mb-2">
                <Button
                  size="sm"
                  variant="outline-secondary"
                  onClick={() => setWellContentsForm(prev => ({ ...prev, currentIdx: Math.max(0, prev.currentIdx - 1) }))}
                  disabled={wellContentsForm.currentIdx === 0}
                >
                  <ChevronLeft size={14} />
                </Button>
                <span
                  className="flex-grow-1 text-center small border rounded py-1 px-2"
                  style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  <span className="d-flex justify-content-between" style={{fontSize: '0.8rem'}}>
                    <span>Next stamp:</span>
                    <span>{currentCompound}</span>
                    <span>({wellContentsForm.currentIdx + 1} of {compoundList.length})</span>
                    
                  </span>
                </span>
                <Button
                  size="sm"
                  variant="outline-secondary"
                  onClick={() => setWellContentsForm(prev => ({ ...prev, currentIdx: Math.min(compoundList.length - 1, prev.currentIdx + 1) }))}
                  disabled={wellContentsForm.currentIdx >= compoundList.length - 1}
                >
                  <ChevronRight size={14} />
                </Button>
              </div>

              <FormField
                id="adv-direction"
                name="direction"
                type="select"
                label="Direction"
                value={wellContentsForm.direction}
                onChange={(value) => handleFieldChange('direction', [value as string])}
                required
                options={[
                  { label: "LR", value: "LR" },
                  { label: "RL", value: "RL" },
                  { label: "TB", value: "TB" },
                  { label: "BT", value: "BT" }
                ]}
                disabled={wellContentsForm.dmsoWells}
              />

              <Form.Label>Concentrations</Form.Label>
              <div className="concentration-table-container">
                <ConcentrationTable
                  tableId="source-conc-table"
                  concentrations={wellContentsForm.concentrations}
                  onChange={handleConcentrationChange}
                  disabled={wellContentsForm.dmsoWells}
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
            </Accordion.Body>
          </Accordion.Item>
        </Accordion>
      </Form>
    </div>
  );
};

export default ContentsManager;