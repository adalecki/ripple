import React from 'react';
import { Card, Button, Row, Col } from 'react-bootstrap';
import { Plate } from '../../../classes/PlateClass';
import { Protocol } from '../../../types/mapperTypes';
import { FormField } from '../../../components/FormField';

export interface PlateResultsOptions {
  normalized: boolean;
  showFitParams: boolean;
  showAllWells: boolean;
  responseRangeMin: number | '';
  responseRangeMax: number | '';
  graphsPerRow: number;
}

interface PlateResultsCardProps {
  plate: Plate;
  protocol: Protocol | null;
  maskedWells: string[];
  options: PlateResultsOptions;
  onOptionsChange: (updates: Partial<PlateResultsOptions>) => void;
  onExportCSV: () => void;
  showExportButton: boolean;
}

const PlateResultsCard: React.FC<PlateResultsCardProps> = ({
  plate,
  protocol,
  maskedWells,
  options,
  onOptionsChange,
  onExportCSV,
  showExportButton
}) => {
  return (
    <div>
      <h4 >Plate Results</h4>
      <Card className="mb-2">
        <Card.Body>
          <div className="p-2 bg-light rounded">
            <Row>
              <Col md={6}>
                <div className="mb-2">
                  <div><strong>Plate ID:</strong> {plate.id}</div>
                  <div><strong>Barcode:</strong> {plate.barcode || 'None'}</div>
                  <div><strong>Wells:</strong> {Object.keys(plate.getWells()).length}</div>
                </div>

                {protocol && protocol.dataProcessing.controls.length > 0 && (
                  <div>
                    <div className="small fw-bold mb-1">Control Wells:</div>
                    {protocol.dataProcessing.controls.map((control, index) => (
                      <div key={index} className="small text-muted">
                        {control.type}: {control.wells}
                      </div>
                    ))}
                    <div className="small text-muted mt-1">
                      <em>Controls are excluded from DRCs</em>
                    </div>
                    {maskedWells.length > 0 && (
                      <div className="small text-muted mt-1">
                        <strong>Masked Wells:</strong> {maskedWells.join(', ')}
                      </div>
                    )}
                  </div>
                )}
              </Col>

              <Col md={6}>
                <FormField
                  id="normalized"
                  name="normalized"
                  type="switch"
                  label="Normalized"
                  value={options.normalized}
                  onChange={(value) => onOptionsChange({ normalized: value })}
                />
                <FormField
                  id="showFitParams"
                  name="showFitParams"
                  type="switch"
                  label="Show Fit Params"
                  value={options.showFitParams}
                  onChange={(value) => onOptionsChange({ showFitParams: value })}
                />
                <FormField
                  id="showAllWells"
                  name="showAllWells"
                  type="switch"
                  label="Show All Wells"
                  value={options.showAllWells}
                  onChange={(value) => onOptionsChange({ showAllWells: value })}
                />
                <FormField
                  id="graphsPerRow"
                  name="graphsPerRow"
                  type="select"
                  label="Graphs per Row"
                  value={options.graphsPerRow}
                  onChange={(value) => onOptionsChange({ graphsPerRow: value })}
                  options={[
                    { value: 1, label: '1' },
                    { value: 2, label: '2' },
                    { value: 3, label: '3' },
                    { value: 4, label: '4' }
                  ]}
                />
                <FormField
                  id="responseRangeMin"
                  name="responseRangeMin"
                  type="number"
                  label="Min Response"
                  value={options.responseRangeMin}
                  onChange={(value) => onOptionsChange({ responseRangeMin: value })}
                  placeholder="Auto"
                  step={0.1}
                  debounce={500}
                />
                <FormField
                  id="responseRangeMax"
                  name="responseRangeMax"
                  type="number"
                  label="Max Response"
                  value={options.responseRangeMax}
                  onChange={(value) => onOptionsChange({ responseRangeMax: value })}
                  placeholder="Auto"
                  step={0.1}
                  debounce={500}
                />
              </Col>
            </Row>
          </div>

          {showExportButton && (
            <Button onClick={onExportCSV} variant="success" className="w-100">
              Export Results CSV
            </Button>
          )}
        </Card.Body>
      </Card>
    </div>
  );
};

export default PlateResultsCard;