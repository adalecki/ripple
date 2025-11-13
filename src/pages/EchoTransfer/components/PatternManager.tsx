import React, { useState, useEffect, useContext } from 'react';
import { Button, Form, Card } from 'react-bootstrap';
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
      setEditingPattern(new Pattern({ ...editingPattern, concentrations: [null] }))
    }
  };

  const handleSavePattern = () => {
    if (editingPattern) {
      const concentrations = editingPattern.concentrations.filter(c => c != null)
      const savePattern = new Pattern({ ...editingPattern, concentrations: concentrations })
      setPatterns(patterns.map(p => p.id === savePattern.id ? savePattern : p));
      setIsEditing(false);
      setIsPickingColor(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    if (editingPattern) {
      let value: any = e.target.value;
      if (e.target.name === 'replicates') { value = parseInt(e.target.value) }
      if (e.target.name === 'direction') { value = [e.target.value] }
      if (e.target.name === 'type' && value === 'Unused') {
        setEditingPattern(new Pattern({
          ...editingPattern,
          [e.target.name]: value,
          concentrations: [],
          replicates: 1,
          direction: ['LR']
        }));
      } else if (e.target.name === 'type' && editingPattern.type === 'Unused') {
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
    <div className="d-flex flex-column">
      <h4>Plate Designer</h4>
      <p>Add patterns and map them to your plate for a downloadable template</p>
      <Button variant="primary" onClick={handleAddPattern} className="mb-3">
        Add Pattern
      </Button>

      {editingPattern ? (
        <div>
          <div className="d-flex justify-content-between align-items-center mb-3">
            {isEditing ? (
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

          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Name</Form.Label>
              <Form.Control
                type="text"
                name="name"
                value={editingPattern.name}
                onChange={handleInputChange}
                disabled={!isEditing}
              />
            </Form.Group>

            <div className="d-flex gap-3 mb-3">
              <Form.Group className="flex-fill">
                <Form.Label>Type</Form.Label>
                <Form.Select
                  name="type"
                  value={editingPattern.type}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                >
                  <option value="Control">Control</option>
                  <option value="Treatment">Treatment</option>
                  <option value="Unused">Unused</option>
                </Form.Select>
              </Form.Group>

              {editingPattern.type !== 'Unused' && (
                <Form.Group className="flex-fill">
                  <Form.Label>Replicates</Form.Label>
                  <Form.Control
                    type="number"
                    name="replicates"
                    value={editingPattern.replicates}
                    onChange={handleInputChange}
                    disabled={!isEditing}
                  />
                </Form.Group>
              )}
            </div>

            {editingPattern.type !== 'Unused' && (
              <>
                <div className="d-flex gap-3 mb-3">
                  <Form.Group className="flex-fill">
                    <Form.Label>Direction</Form.Label>
                    <Form.Select
                      name="direction"
                      value={editingPattern.direction[0]}
                      onChange={handleInputChange}
                      disabled={!isEditing}
                    >
                      <option value="LR">Left to Right</option>
                      <option value="RL">Right to Left</option>
                      <option value="TB">Top to Bottom</option>
                      <option value="BT">Bottom to Top</option>
                    </Form.Select>
                  </Form.Group>

                  <Form.Group className="flex-fill">
                    <Form.Label>Color</Form.Label>
                    <div
                      className="color-preview"
                      style={{ backgroundColor: editingPattern.color }}
                      onClick={() => isEditing && setIsPickingColor(!isPickingColor)}
                    />
                  </Form.Group>
                </div>

                {isPickingColor && (
                  <div className="mb-3">
                    <HslStringColorPicker
                      color={editingPattern.color}
                      onChange={handleColorChange}
                    />
                  </div>
                )}

                <Form.Group>
                  <Form.Label>Concentrations</Form.Label>
                  <div className="concentration-table-container">
                    <ConcentrationTable
                      concentrations={editingPattern.concentrations}
                      onChange={handleConcentrationChange}
                      disabled={!isEditing}
                    />
                  </div>
                </Form.Group>
              </>
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