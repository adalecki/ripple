import React, { useState, useEffect, useContext } from 'react';
import { Button } from 'react-bootstrap';
import { Pattern } from '../../../classes/PatternClass';
import { PatternsContext } from '../../../contexts/Context';
import ConcentrationTable from './ConcentrationTable';
import { HslStringColorPicker } from 'react-colorful';

import '../../../css/PatternManager.css'

const PatternManager: React.FC = () => {
  const { patterns, setPatterns, selectedPatternId, setSelectedPatternId } = useContext(PatternsContext);
  const [isEditing, setIsEditing] = useState(false);
  const [isPickingColor, setIsPickingColor] = useState(false);
  const [editingPattern, setEditingPattern] = useState<Pattern | null>(null);
  const [isNewPattern, setIsNewPattern] = useState<boolean>(false)

  useEffect(() => {
    const selectedPattern = patterns.find(p => p.id === selectedPatternId);
    setEditingPattern(selectedPattern ? selectedPattern.clone() : null);
    setIsPickingColor(false);
    if (!isNewPattern) {
      setIsEditing(false)
    }
    setIsNewPattern(false)
  }, [selectedPatternId, patterns]);

  const handleAddPattern = () => {
    let iter = patterns.length + 1;
    while (patterns.find(p => p.name == `Pattern ${iter}`)) {
      iter += 1
    }
    const name = `Pattern ${iter}`
    const newPattern = new Pattern({
      name: name,
      type: 'Treatment',
      replicates: 1,
      direction: ['LR'],
      concentrations: [null],
      locations: []
    });
    setIsPickingColor(false)
    setPatterns([...patterns, newPattern]);
    setSelectedPatternId(newPattern.id);
    setIsNewPattern(true)
    setIsEditing(true);
  };

  const handleEditPattern = () => {
    setIsEditing(true);
    if (editingPattern && editingPattern.concentrations.length == 0) {
      setEditingPattern(new Pattern({...editingPattern, concentrations: [null]}))
    }
  };

  const handleSavePattern = () => {
    if (editingPattern) {
      const concentrations = editingPattern.concentrations.filter(c => c != null)
      const savePattern = new Pattern({...editingPattern, concentrations: concentrations})
      setPatterns(patterns.map(p => p.id === savePattern.id ? savePattern : p));
      setIsEditing(false);
      setIsPickingColor(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (editingPattern) {
      let value: any = e.target.value;
      if (e.target.name === 'replicates') { value = parseInt(e.target.value) }
      if (e.target.name === 'direction') { value = [e.target.value] }
      // NEW: Handle type change to/from Unused
      if (e.target.name === 'type' && value === 'Unused') {
        setEditingPattern(new Pattern({ 
          ...editingPattern, 
          [e.target.name]: value,
          concentrations: [], // Clear concentrations for Unused
          replicates: 1,
          direction: ['LR']
        }));
      } else if (e.target.name === 'type' && editingPattern.type === 'Unused') {
        // Switching from Unused to another type
        setEditingPattern(new Pattern({ 
          ...editingPattern, 
          [e.target.name]: value,
          concentrations: [null]
        }));
      } else {
        setEditingPattern(new Pattern({ ...editingPattern, [e.target.name]: value }));
      }
    }
  };

  const handleConcentrationChange = (newConcentrations: (number | null)[]) => {
    if (editingPattern) {
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
    <div className="pattern-manager">
      <div className="pattern-form-container">
      <Button onClick={handleAddPattern} className="add-pattern-btn">Add Pattern</Button>
        {isEditing ? (
          <div>
            <Button onClick={handleSavePattern}>Save</Button>
          </div>
        ) : (
          <div>
            {selectedPatternId && <Button onClick={handleEditPattern} disabled={(editingPattern != null && editingPattern.locations.length > 0)}>Edit</Button>}
            {(editingPattern != null && editingPattern.locations.length > 0) ? (<span className='edit-alert'>Can't edit when present on plate</span>) : (<div></div>)}
          </div>
        )}
        {editingPattern && (
          <div className="pattern-form">
            <div className="pattern-form"></div>
            <div className="form-group">
              <label>Name</label>
              <input
                type="text"
                name="name"
                value={editingPattern.name}
                onChange={handleInputChange}
                disabled={!isEditing}
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Type</label>
                <select
                  name="type"
                  value={editingPattern.type}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                >
                  <option value="Control">Control</option>
                  <option value="Treatment">Treatment</option>
                  <option value="Unused">Unused</option>
                </select>
              </div>
              {editingPattern.type !== 'Unused' && (
                <div className="form-group">
                  <label>Replicates</label>
                  <input
                    type="number"
                    name="replicates"
                    value={editingPattern.replicates}
                    onChange={handleInputChange}
                    disabled={!isEditing}
                  />
                </div>
              )}
            </div>
            {editingPattern.type !== 'Unused' && (
              <div className='form-row'>
                <div className="form-group">
                  <label>Direction</label>
                  <select
                    name="direction"
                    value={editingPattern.direction[0]}
                    onChange={handleInputChange}
                    disabled={!isEditing}
                  >
                    <option value="LR">Left to Right</option>
                    <option value="RL">Right to Left</option>
                    <option value="TB">Top to Bottom</option>
                    <option value="BT">Bottom to Top</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Color</label>
                  <div className="color-picker-container">
                    <div
                      className="color-preview"
                      style={{ backgroundColor: editingPattern.color }}
                      onClick={() => isEditing && setIsPickingColor(!isPickingColor)}
                    />
                  </div>
                  {isPickingColor && (
                    <HslStringColorPicker
                      color={editingPattern.color}
                      onChange={handleColorChange}
                    />
                  )}
                </div>
              </div>
            )}
            {editingPattern.type !== 'Unused' && (
              <div>
                <label>Concentrations</label>
                <div className="concentration-table-container">
                  <ConcentrationTable
                    concentrations={editingPattern.concentrations}
                    onChange={handleConcentrationChange}
                    disabled={!isEditing}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PatternManager;