import React, { useState } from 'react';
import { Button, Form } from 'react-bootstrap';
import { Pattern } from '../../../classes/PatternClass';
import { Plate } from '../../../classes/PlateClass';
import { FormField } from '../../../components/FormField';
import { WellContentsForm } from './DesignWizardSrc';



interface ContentsManagerProps {
  plate: Plate;
  selectedWellIds: string[];
  patterns: Pattern[];
  wellContentsForm: WellContentsForm,
  setWellContentsForm: React.Dispatch<React.SetStateAction<WellContentsForm>>
}

const ContentsManager: React.FC<ContentsManagerProps> = ({
  plate,
  selectedWellIds,
  patterns,
  wellContentsForm,
  setWellContentsForm
}) => {


  const handleFieldChange = (fieldName: string, value: number | string | string[]) => {

    switch (fieldName) {
      case 'name':
        setWellContentsForm({ ...wellContentsForm, compoundId: value as string })
        break
      case 'concentration':
        setWellContentsForm({ ...wellContentsForm, concentration: value as number })
        break
      case 'volume':
        setWellContentsForm({ ...wellContentsForm, volume: value as number })
        break
      case 'pattern':
        setWellContentsForm({ ...wellContentsForm, patternNames: (wellContentsForm.patternNames.includes(value as string) ? wellContentsForm.patternNames.filter(p => p !== value as string) : [...wellContentsForm.patternNames, value as string]) })
        break
    }
  };

  const selectionLabel =
    selectedWellIds.length === 0
      ? 'No wells selected'
      : `${selectedWellIds.length} well${selectedWellIds.length > 1 ? 's' : ''} selected`;

  const assignablePatterns = patterns.filter(p => p.type !== 'Unused');

  return (
    <div className="d-flex flex-column">
      <div className="mb-2">
        <small className="text-muted">{selectionLabel}</small>
      </div>
      <Form>
        <FormField
          id="src-compound-id"
          key="src-compound-id"
          name="name"
          type="text"
          label="Compound ID"
          value={wellContentsForm.compoundId}
          onChange={(value) => handleFieldChange('name', value)}
          disabled={!(selectedWellIds.length > 0)}
          required
        />

        <FormField
          id="src-concentration"
          key="src-concentration"
          name="concentration"
          type="number"
          label="Concentration"
          value={wellContentsForm.concentration}
          onChange={(value) => handleFieldChange('concentration', value)}
          disabled={!(selectedWellIds.length > 0)}
          unit="µM"
          min={0}
          required
        />

        <FormField
          id="src-volume"
          key="src-volume"
          name="volume"
          type="number"
          label="Volume"
          value={wellContentsForm.volume}
          onChange={(value) => handleFieldChange('volume', value)}
          disabled={!(selectedWellIds.length > 0)}
          unit="µL"
          min={0}
          required
        />

        <div className="mb-3">
          <label className="form-label">Linked Patterns</label>
          {assignablePatterns.length === 0 ? (
            <p className="text-muted small mb-0">No patterns defined on destination plate</p>
          ) : (
            <div className="d-flex flex-column gap-1">
              {assignablePatterns.map(pattern => (
                <div key={pattern.id} className="form-check mb-0">
                  <input
                    type="checkbox"
                    id={`src-pattern-${pattern.id}`}
                    className="form-check-input"
                    checked={wellContentsForm.patternNames.includes(pattern.name)}
                    onChange={() => handleFieldChange('pattern', pattern.name)}
                    disabled={!(selectedWellIds.length > 0)}
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
      </Form>
    </div>
  );
};

export default ContentsManager;