import React from 'react';
import { Card, Button, Dropdown, ButtonGroup } from 'react-bootstrap';
import { FolderOpen, Settings } from 'lucide-react';
import { ReformatScheme } from '../utils/reformatUtils';

interface ReformatSchemeCardProps {
  schemes: ReformatScheme[];
  onLoadScheme: (scheme: ReformatScheme) => void;
  onManageClick: () => void;
  hasUnsavedChanges: boolean;
}

const ReformatSchemesCard: React.FC<ReformatSchemeCardProps> = ({
  schemes,
  onLoadScheme,
  onManageClick,
  hasUnsavedChanges
}) => {
  const handleLoadScheme = (scheme: ReformatScheme) => {
    if (hasUnsavedChanges) {
      const confirmed = window.confirm(
        'Loading a scheme will replace your current plates and transfers. Continue?'
      );
      if (!confirmed) return;
    }
    onLoadScheme(scheme);
  };

  return (
    <Card className="mb-3">
      <Card.Body className="py-2">
        <div className="d-flex align-items-center justify-content-between gap-2">
          <Dropdown as={ButtonGroup} size="sm">
            <Dropdown.Toggle variant="outline-primary" disabled={schemes.length === 0}>
              <FolderOpen size={14} className="me-1" />
              Load Scheme
            </Dropdown.Toggle>
            <Dropdown.Menu style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {schemes.length === 0 ? (
                <Dropdown.Item disabled>No saved schemes</Dropdown.Item>
              ) : (
                schemes.map(scheme => (
                  <Dropdown.Item
                    key={scheme.id}
                    onClick={() => handleLoadScheme(scheme)}
                  >
                    <div>{scheme.name}</div>
                    <small className="text-muted">
                      {scheme.srcPlateCount} src ({scheme.srcPlateSize}) → {scheme.dstPlateCount} dst ({scheme.dstPlateSize})
                    </small>
                  </Dropdown.Item>
                ))
              )}
            </Dropdown.Menu>
          </Dropdown>

          <Button variant="outline-primary" size="sm" onClick={onManageClick}>
            <Settings size={14} className="me-1" />
            Save/Manage
          </Button>
        </div>
      </Card.Body>
    </Card>
  );
};

export default ReformatSchemesCard;