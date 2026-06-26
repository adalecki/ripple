import React, { useState } from 'react';
import { Alert, Button, Form } from 'react-bootstrap';
import { Pattern } from '../../../classes/PatternClass';
import ConcentrationTable from './ConcentrationTable';
import { HslStringColorPicker } from 'react-colorful';

import '../../../css/PatternManager.css'
import { FormField } from '../../../components/FormField';

interface PatternManagerProps {
  patterns: Pattern[];
  setPatterns: React.Dispatch<React.SetStateAction<Pattern[]>>;
  curPatternId: number | null;
  patternState: {
    isEditing: boolean;
    isNewPattern: boolean;
    isPickingColor: boolean;
  }
  setPatternState: React.Dispatch<React.SetStateAction<{
    isEditing: boolean;
    isNewPattern: boolean;
    isPickingColor: boolean;
  }>>
}

const PatternManager: React.FC<PatternManagerProps> = ({ patterns, setPatterns, curPatternId, patternState, setPatternState }) => {
  const [editingPattern, setEditingPattern] = useState<Pattern | null>(null);
  const [prevPatternId, setPrevPatternId] = useState<number | null>(null)
  const [showAlert, setShowAlert] = useState<string[]>([])

  if (curPatternId !== prevPatternId) {
    setPrevPatternId(curPatternId)
    const selectedPattern = patterns ? patterns.find(p => p.id === curPatternId) : undefined;
    setEditingPattern(selectedPattern ? selectedPattern.clone() : null);
    setPatternState({ isEditing: (patternState.isNewPattern ? true : false), isNewPattern: false, isPickingColor: false })
  }

  const handleEditPattern = () => {
    setPatternState({ ...patternState, isEditing: true })
    if (editingPattern && editingPattern.concentrations.length == 0) {
      setEditingPattern(new Pattern({ ...editingPattern, concentrations: [null] }))
    }
  };

  const handleSavePattern = () => {
    if (editingPattern) {
      const concentrations = editingPattern.concentrations.filter(c => c != null)
      const savePattern = new Pattern({ ...editingPattern, concentrations: concentrations })
      setPatterns(patterns.map(p => p.id === savePattern.id ? savePattern : p));
      setPatternState({ ...patternState, isEditing: false, isPickingColor: false })
    }
  };

  const handleFieldChange = (fieldName: string, value: number | string | string[]) => {
    if (editingPattern) {

      if (fieldName === 'type' && value === 'Unused') {
        setEditingPattern(new Pattern({
          ...editingPattern,
          [fieldName]: value,
          concentrations: [],
          replicates: 1,
          direction: ['LR']
        }));
      } else if (fieldName === 'type' && editingPattern.type === 'Unused') {
        setEditingPattern(new Pattern({
          ...editingPattern,
          [fieldName]: value as "Treatment" | "Control" | "Combination" | "Solvent" | "Unused",
          concentrations: [null]
        }));
      } else {
        setEditingPattern(new Pattern({ ...editingPattern, [fieldName]: value }));
      }
    }
  };

  const handleConcentrationChange = (newConcentrations: (number | null)[]) => {
    if (editingPattern) {
      if (newConcentrations.length > 20) {
        setShowAlert(['Only 20'])
        return
      }
      setEditingPattern(new Pattern({ ...editingPattern, concentrations: newConcentrations }));
    }
  };

  const handleColorChange = (color: any) => {
    if (editingPattern) {
      setEditingPattern(new Pattern({
        ...editingPattern,
        color: color
      }));
    }
  };

  return (
    <div className="d-flex flex-column pattern-manager-root">
      {editingPattern ? (
        <div className="pattern-manager-body">
          <div className="d-flex justify-content-between align-items-center mb-3">
            {patternState.isEditing ? (
              <Button variant="success" size="sm" onClick={handleSavePattern}>
                Save
              </Button>
            ) : (
              <>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleEditPattern}
                  disabled={editingPattern.locations.length > 0}
                >
                  Edit
                </Button>
                {editingPattern.locations.length > 0 && (
                  <small className="text-muted fst-italic ms-2">Can't edit when present on plate</small>
                )}
              </>
            )}
          </div>
          <Form className="pattern-form">
            <FormField
              key='pattern-name'
              id='pattern-name'
              name='name'
              type='text'
              label='Name'
              value={editingPattern.name}
              onChange={(value) => handleFieldChange("name", value)}
              required={true}
              disabled={!patternState.isEditing}
            />
            <FormField
              key='pattern-type'
              id='pattern-type'
              name='type'
              type='select'
              label='Type'
              value={editingPattern.type}
              onChange={(value) => handleFieldChange("type", value)}
              required={true}
              disabled={!patternState.isEditing}
              options={[
                { label: "Control", value: "Control" },
                { label: "Treatment", value: "Treatment" },
                { label: "Unused", value: "Unused" }
              ]}
            />
            {editingPattern.type !== 'Unused' && (
              <div className="pattern-fields">
                <FormField
                  key='pattern-replicates'
                  id='pattern-replicates'
                  name='replicates'
                  type='number'
                  label='Replicates'
                  value={editingPattern.replicates}
                  onChange={(value) => handleFieldChange("replicates", value)}
                  required={true}
                  disabled={!patternState.isEditing}
                  step={1}
                />
                <FormField
                  key='pattern-direction'
                  id='pattern-direction'
                  name='direction'
                  type='select'
                  label='Direction'
                  value={editingPattern.direction[0]}
                  onChange={(value) => handleFieldChange("direction", [value])}
                  required={true}
                  disabled={!patternState.isEditing}
                  options={[
                    { label: "LR", value: "LR" },
                    { label: "RL", value: "RL" },
                    { label: "TB", value: "TB" },
                    { label: "BT", value: "BT" }
                  ]}
                />
                <div className='form-field'>
                  <div className='form-label'>Color</div>
                  <div
                    className="color-preview form-field-input"
                    style={{ backgroundColor: editingPattern.color }}
                    onClick={() => patternState.isEditing && setPatternState({ ...patternState, isPickingColor: !patternState.isPickingColor })}
                  />
                </div>
                {patternState.isPickingColor && (
                  <div className="mb-3">
                    <HslStringColorPicker
                      color={editingPattern.color}
                      onChange={handleColorChange}
                    />
                  </div>
                )}
                <Form.Label>Concentrations</Form.Label>
                <Alert variant='danger' show={showAlert.length > 0} onClose={() => setShowAlert([])} dismissible transition>
                  A maximum of 20 concentrations is allowed
                </Alert>
                <div className="concentration-table-container">
                  <ConcentrationTable
                    tableId="pattern-conc-table"
                    concentrations={editingPattern.concentrations}
                    onChange={handleConcentrationChange}
                    disabled={!patternState.isEditing}
                  />
                </div>
              </div>
            )}
          </Form>
        </div>
      ) : (
        <p className="text-muted">Select or add a pattern to edit</p>
      )}
    </div>
  );
};

export default PatternManager;