import React, { useState } from 'react';
import { Modal, Button, ListGroup, Nav } from 'react-bootstrap';
import { Settings } from 'lucide-react';
import { PREFERENCES_CONFIG } from '../config/preferencesConfig';
import { usePreferences } from '../hooks/usePreferences';
import { FormField } from './FormField';
import type { PreferencesState } from '../hooks/usePreferences';

import '../css/PreferencesModal.css'


interface PreferencesModalProps {
  show: boolean;
  onHide: () => void;
}

export const PreferencesModal: React.FC<PreferencesModalProps> = ({ show, onHide }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>(PREFERENCES_CONFIG[0].id);
  const { preferences, updatePreferences, resetPreferences } = usePreferences();

  // Maintain temporary state while editing
  const [tempPreferences, setTempPreferences] = useState<PreferencesState>(() => ({ ...preferences }));

  // Reset temp preferences when modal opens
  React.useEffect(() => {
    if (show) {
      setTempPreferences({ ...preferences });
    }
  }, [show, preferences]);

  const handleSettingChange = (id: string, value: number) => {
    setTempPreferences(prev => ({
      ...prev,
      [id]: value
    }));
  };

  const handleSave = () => {
    updatePreferences(tempPreferences);
    onHide();
  };

  const handleCancel = () => {
    setTempPreferences({ ...preferences }); // Reset temp state
    onHide();
  };

  const handleReset = () => {
    if (window.confirm('Are you sure you want to reset all preferences to their default values?')) {
      resetPreferences();
      onHide();
    }
  };
  return (
    <Modal
      show={show}
      onHide={handleCancel}
      size="lg"
      aria-labelledby="preferences-modal"
      centered
      className="preferences-modal"
      dialogClassName="preferences-modal-dialog"
    >
      <Modal.Header closeButton>
        <Modal.Title id="preferences-modal">
          Preferences
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="d-flex">
          <div className="preferences-sidebar">
            <ListGroup>
              {PREFERENCES_CONFIG.map(category => (
                <ListGroup.Item
                  key={category.id}
                  active={category.id === selectedCategory}
                  onClick={() => setSelectedCategory(category.id)}
                  action
                >
                  {category.label}
                </ListGroup.Item>
              ))}
            </ListGroup>
          </div>
          <div className="preferences-content">
            {PREFERENCES_CONFIG.find(c => c.id === selectedCategory)?.settings.map(setting => (
              <FormField
                key={setting.prefId}
                id={setting.prefId}
                name={setting.name}
                type={setting.type}
                label={setting.name}
                value={tempPreferences[setting.prefId]}
                onChange={(value) => handleSettingChange(setting.prefId, value)}
                options={setting.options}
                unit={setting.unit}
                step={setting.step}
                className="preferences-field"
              />
            ))}
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={handleReset}>
          Reset to Defaults
        </Button>
        <Button variant="secondary" onClick={handleCancel}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSave}>
          Save Changes
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export const PreferencesButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <Nav.Link onClick={onClick} style={{ display: 'flex', alignItems: 'center' }}>
    <Settings size={18} />
  </Nav.Link>
);