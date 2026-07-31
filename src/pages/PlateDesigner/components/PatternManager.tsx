import React, { useState } from 'react';
import { Alert, Button, Form } from 'react-bootstrap';
import { Pattern, isCombinationType, getCombinationFold, CombinationType } from '../../../classes/PatternClass';
import ConcentrationTable from './ConcentrationTable';
import { HslStringColorPicker } from 'react-colorful';

import '../../../css/PatternManager.css'
import { FormField } from '../../../components/FormField';
import ApplyTooltip from '../../../components/ApplyTooltip';

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

const DIRECTION_OPTIONS = [
  { label: "LR", value: "LR" },
  { label: "RL", value: "RL" },
  { label: "TB", value: "TB" },
  { label: "BT", value: "BT" }
];

function defaultPerpendicular(dir: string): 'LR' | 'RL' | 'TB' | 'BT' {
  return (dir === 'LR' || dir === 'RL') ? 'TB' : 'LR';
}

function isPerpendicularDirections(a: string, b: string): boolean {
  const horizontal = ['LR', 'RL'];
  const vertical = ['TB', 'BT'];
  return (horizontal.includes(a) && vertical.includes(b)) || (vertical.includes(a) && horizontal.includes(b));
}

const PatternManager: React.FC<PatternManagerProps> = ({ patterns, setPatterns, curPatternId, patternState, setPatternState }) => {
  const [editingPattern, setEditingPattern] = useState<Pattern | null>(null);
  const [prevPatternId, setPrevPatternId] = useState<number | null>(null)
  const [applyPopup, setApplyPopup] = useState<{ event: React.MouseEvent | null, msgArr: string[] }>({ event: null, msgArr: [] })
  const [showAlert, setShowAlert] = useState<string[]>([])

  if (curPatternId !== prevPatternId) {
    setPrevPatternId(curPatternId)
    const selectedPattern = patterns ? patterns.find(p => p.id === curPatternId) : undefined;
    setEditingPattern(selectedPattern ? selectedPattern.clone() : null);
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
          type: 'Unused',
          concentrations: [],
          replicates: 1,
          direction: ['LR']
        }));
      } else if (fieldName === 'type' && value === 'Combination') {
        setEditingPattern(new Pattern({
          ...editingPattern,
          type: 'Combination-2',
          fold: 2,
          direction: [editingPattern.direction[0] || 'LR'],
          concentrations: editingPattern.type === 'Unused' ? [null] : editingPattern.concentrations
        }));
      } else if (fieldName === 'type' && editingPattern.type === 'Unused') {
        setEditingPattern(new Pattern({
          ...editingPattern,
          [fieldName]: value as "Treatment" | "Control" | "Solvent" | "Unused",
          concentrations: [null]
        }));
      } else if (fieldName === 'type' && isCombinationType(editingPattern.type)) {
        setEditingPattern(new Pattern({
          ...editingPattern,
          [fieldName]: value as "Treatment" | "Control" | "Solvent" | "Unused",
          direction: [editingPattern.direction[0]]
        }));
      } else {
        setEditingPattern(new Pattern({ ...editingPattern, [fieldName]: value }));
      }
    }
  };

  const handleFoldChange = (value: number) => {
    if (editingPattern) {
      const fold = Math.max(2, Math.round(value) || 2);
      const direction = fold === 2 ? editingPattern.direction : [editingPattern.direction[0]];
      setEditingPattern(new Pattern({
        ...editingPattern,
        type: `Combination-${fold}` as CombinationType,
        fold,
        direction
      }));
    }
  };

  const handleMatrixToggle = (checked: boolean) => {
    if (editingPattern) {
      setEditingPattern(new Pattern({
        ...editingPattern,
        direction: checked ? [editingPattern.direction[0], defaultPerpendicular(editingPattern.direction[0])] : [editingPattern.direction[0]]
      }));
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

  const handleMouseEnter = (e: React.MouseEvent) => {
    const msgArr: string[] = [];
    if (duplicateName) msgArr.push('Pattern names must be unique');
    if (editingPattern) {
      if (!editingPattern.replicates) msgArr.push('Must define replicates')
      if (!editingPattern.name) msgArr.push('Must enter a pattern name')
      if (matrixDirectionsInvalid) msgArr.push('Matrix directions must be perpendicular (one LR/RL, one TB/BT)')
    }

    setApplyPopup({ event: msgArr.length > 0 ? e : null, msgArr });
  };

  const handleMouseLeave = () => {
    setApplyPopup({ event: null, msgArr: [] });
  };

  const duplicateName = (editingPattern ? patterns.filter(p => p.name == editingPattern.name && p.id != editingPattern.id).length > 0 : false)
  const isMatrixPattern = editingPattern ? (isCombinationType(editingPattern.type) && editingPattern.direction.length === 2) : false;
  const matrixDirectionsInvalid = isMatrixPattern && editingPattern ? !isPerpendicularDirections(editingPattern.direction[0], editingPattern.direction[1]) : false;
  return (
    <div className="d-flex flex-column pattern-manager-root">
      {editingPattern ? (
        <div className="pattern-manager-body">
          <div className="d-flex justify-content-between align-items-center mb-3">
            {patternState.isEditing ? (
              <div
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
              >
                <Button
                  variant="success"
                  size="sm"
                  onClick={handleSavePattern}
                  disabled={duplicateName || !editingPattern.replicates || !editingPattern.name || matrixDirectionsInvalid}>
                  Save
                </Button>
              </div>
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
              value={isCombinationType(editingPattern.type) ? 'Combination' : editingPattern.type}
              onChange={(value) => handleFieldChange("type", value)}
              required={true}
              disabled={!patternState.isEditing}
              options={[
                { label: "Control", value: "Control" },
                { label: "Treatment", value: "Treatment" },
                { label: "Combination", value: "Combination" },
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
                  tooltip={isMatrixPattern ? "Number of numConcs x numConcs squares tiled across the applied selection" : undefined}
                />
                {isCombinationType(editingPattern.type) && (
                  <FormField
                    key='pattern-fold'
                    id='pattern-fold'
                    name='fold'
                    type='number'
                    label='Fold'
                    value={getCombinationFold(editingPattern.type as CombinationType)}
                    onChange={(value) => handleFoldChange(value)}
                    required={true}
                    disabled={!patternState.isEditing}
                    step={1}
                    min={2}
                    tooltip="Number of compounds combined per well"
                  />
                )}
                {isCombinationType(editingPattern.type) && getCombinationFold(editingPattern.type as CombinationType) === 2 && (
                  <FormField
                    key='pattern-matrix'
                    id='pattern-matrix'
                    name='matrix'
                    type='switch'
                    label='Matrix layout'
                    value={editingPattern.direction.length === 2}
                    onChange={(checked) => handleMatrixToggle(checked)}
                    disabled={!patternState.isEditing}
                    tooltip="Lay out as a perpendicular 2D matrix instead of a single shared dilution series"
                  />
                )}
                {isMatrixPattern ? (
                  <>
                    <FormField
                      key='pattern-direction-1'
                      id='pattern-direction-1'
                      name='direction1'
                      type='select'
                      label='Direction (Axis 1)'
                      value={editingPattern.direction[0]}
                      onChange={(value) => handleFieldChange("direction", [value, editingPattern.direction[1]])}
                      required={true}
                      disabled={!patternState.isEditing}
                      options={DIRECTION_OPTIONS}
                    />
                    <FormField
                      key='pattern-direction-2'
                      id='pattern-direction-2'
                      name='direction2'
                      type='select'
                      label='Direction (Axis 2)'
                      value={editingPattern.direction[1]}
                      onChange={(value) => handleFieldChange("direction", [editingPattern.direction[0], value])}
                      required={true}
                      disabled={!patternState.isEditing}
                      options={DIRECTION_OPTIONS}
                    />
                  </>
                ) : (
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
                    options={DIRECTION_OPTIONS}
                  />
                )}
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
      {applyPopup.msgArr.length > 0 ? <ApplyTooltip data={applyPopup} /> : ''}
    </div>
  );
};

export default PatternManager;