import React from 'react';
import { Button, Container, Row, Col } from 'react-bootstrap';

import { Plate, PlateSize } from '../../../classes/PlateClass';
import { Pattern } from '../../../classes/PatternClass';
import FileUploadCard from '../../../components/FileUploadCard';
import PlateViewCanvas from '../../../components/PlateViewCanvas';
import TransferListDownload from '../../../components/TransferListDownload';
import { ColorConfig, generateEntityColors } from '../../../utils/wellColors';
import { TransferStepExport } from '../../../utils/plateUtils';
import { Combination } from '../types/combinatorTypes';
import {
  InputDataType,
  TransferStep,
  buildInputData,
  exportCombinatorWorkbook,
  inventoryContents,
  recipeSlotCount
} from '../utils/combinatorUtils';
import { ValidationPreferences } from '../utils/validationUtils';
import FileResultsCard from './FileResultsCard';

interface CombinatorBuildProps {
  plate: Plate | null;
  recipes: Pattern[];
  srcPlates: Plate[];
  combinations: Combination[];
  srcPlateSize: PlateSize;
  dstPlateSize: PlateSize;
  dropletSize: number;
  errors: string[];
  transferSteps: TransferStep[];
  onBuild: (inputData: InputDataType, validationPreferences: ValidationPreferences) => void;
  onImportFile: (files: File[], validationPreferences: ValidationPreferences) => void;
  onClear: () => void;
  showInstructions: () => void;
}

const CombinatorBuild: React.FC<CombinatorBuildProps> = ({
  plate,
  recipes,
  srcPlates,
  combinations,
  srcPlateSize,
  dstPlateSize,
  dropletSize,
  errors,
  transferSteps,
  onBuild,
  onImportFile,
  onClear,
  showInstructions
}) => {
  const inputData = buildInputData(recipes, srcPlates, combinations);

  const validationPreferences: ValidationPreferences = {
    dropletSize,
    sourcePlateSize: srcPlateSize,
    destinationPlateSize: dstPlateSize
  };

  function getBuildDisabledReasons(): string[] {
    const reasons: string[] = [];
    if (!recipes.some(r => r.locations.length > 0)) reasons.push('No recipe has been applied to the plate');
    if (!recipes.some(r => recipeSlotCount(r) > 0)) reasons.push('No recipe has component volumes');
    if (inventoryContents(srcPlates).length === 0) reasons.push('No inventory has been declared');
    if (combinations.length === 0) reasons.push('No combinations have been added');
    return reasons;
  }

  const handleExportWorkbook = () => {
    exportCombinatorWorkbook(inputData);
  };

  const colorMap = inputData
    ? generateEntityColors([...new Set(inputData.SourceLayout.map(row => row.Content))], 0.5)
    : new Map();

  const colorConfig: ColorConfig = { scheme: 'compound', colorMap };

  const transferMap = new Map<number, TransferStepExport[]>();
  if (transferSteps.length > 0) transferMap.set(3, transferSteps);

  return (
    <Container fluid className="h-100 pb-2">
      <Row className="h-100" style={{ minHeight: 0 }}>
        <Col md={4} className="d-flex flex-column h-100 overflow-auto" style={{ scrollbarGutter: 'stable' }}>
          <h4>Build</h4>
          Generate plates and a transfer list from the current design
          <small className="text-muted fst-italic mb-3">
            Author recipes, inventory and combinations on the other tabs, or import an existing
            workbook below. See the{' '}
            <button type="button" className="link-button" onClick={showInstructions}>instructions</button>
            {' '}for the file format.
          </small>

          <FileUploadCard
            onFilesSelected={files => onImportFile(files, validationPreferences)}
            multiple={false}
            acceptedTypes=".xlsx"
            title="Import Workbook"
            description="Replaces the current design"
          />

          <FileResultsCard
            inputData={inputData}
            errors={errors}
            transferSteps={transferSteps}
            buildDisabledReasons={getBuildDisabledReasons()}
            onBuild={() => inputData && onBuild(inputData, validationPreferences)}
            onExportWorkbook={handleExportWorkbook}
            onClear={onClear}
          />
        </Col>
        <Col md={8} className="d-flex flex-column h-100 overflow-auto" style={{ scrollbarGutter: 'stable' }}>
          {plate
            ? <PlateViewCanvas plate={plate} view="combinator" colorConfig={colorConfig} />
            : 'Build the design to view the resulting plates'}
          {transferMap.size > 0 && (
            <div className="d-flex gap-2 w-100 button-row mt-2">
              <div className="flex-fill">
                <TransferListDownload transferMap={transferMap} splitOutputCSVs={false} />
              </div>
              <div className="flex-fill">
                <Button variant="success" className="w-100" onClick={handleExportWorkbook}>
                  Export Workbook
                </Button>
              </div>
            </div>
          )}
        </Col>
      </Row>
    </Container>
  );
};

export default CombinatorBuild;
