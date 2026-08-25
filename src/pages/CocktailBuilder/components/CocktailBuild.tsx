import React from 'react';
import { Button, Container, Row, Col } from 'react-bootstrap';

import { Plate, PlateSize } from '../../../classes/PlateClass';
import { Pattern } from '../../../classes/PatternClass';
import FileUploadCard from '../../../components/FileUploadCard';
import PlateViewCanvas from '../../../components/PlateViewCanvas';
import TransferListDownload from '../../../components/TransferListDownload';
import { ColorConfig, generateEntityColors } from '../../../utils/wellColors';
import { TransferStepExport } from '../../../utils/plateUtils';
import { Cocktail } from '../types/cocktailTypes';
import {
  InputDataType,
  buildInputData,
  exportCocktailWorkbook,
  inventoryContents,
  recipeSlotCount
} from '../utils/cocktailUtils';
import FileResultsCard from './FileResultsCard';

interface CocktailBuildProps {
  plate: Plate | null;
  recipes: Pattern[];
  srcPlates: Plate[];
  cocktails: Cocktail[];
  srcPlateSize: PlateSize;
  dstPlateSize: PlateSize;
  dropletSize: number;
  errors: string[];
  transferSteps: TransferStepExport[];
  onBuild: (inputData: InputDataType, srcPlateSize: PlateSize, dstPlateSize: PlateSize, dropletSize: number) => void;
  onImportFile: (files: File[], srcPlateSize: PlateSize, dstPlateSize: PlateSize, dropletSize: number) => void;
  onClear: () => void;
  showInstructions: () => void;
}

const CocktailBuild: React.FC<CocktailBuildProps> = ({
  plate,
  recipes,
  srcPlates,
  cocktails,
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
  const inputData = buildInputData(recipes, srcPlates, cocktails);

  function getBuildDisabledReasons(): string[] {
    const reasons: string[] = [];
    if (!recipes.some(r => r.locations.length > 0)) reasons.push('No recipe has been applied to the plate');
    if (!recipes.some(r => recipeSlotCount(r) > 0)) reasons.push('No recipe has component volumes');
    if (inventoryContents(srcPlates).length === 0) reasons.push('No inventory has been declared');
    if (cocktails.length === 0) reasons.push('No cocktails have been added');
    return reasons;
  }

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
            Author recipes, inventory and cocktails on the other tabs, or import an existing
            workbook below. See the{' '}
            <button type="button" className="link-button" onClick={showInstructions}>instructions</button>
            {' '}for the file format.
          </small>

          <FileUploadCard
            onFilesSelected={files => onImportFile(files, srcPlateSize, dstPlateSize, dropletSize)}
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
            onBuild={() => inputData && onBuild(inputData, srcPlateSize, dstPlateSize, dropletSize)}
            onClear={onClear}
          />
        </Col>
        <Col md={8} className="d-flex flex-column h-100 overflow-auto" style={{ scrollbarGutter: 'stable' }}>
          {plate
            ? <PlateViewCanvas plate={plate} view="cocktail" colorConfig={colorConfig} />
            : 'Build the design to view the resulting plates'}
          {transferMap.size > 0 && (
            <div className="d-flex gap-2 w-100 button-row mt-2">
              <div className="flex-fill">
                <TransferListDownload transferMap={transferMap} splitOutputCSVs={false} />
              </div>
              <div className="flex-fill">
                <Button variant="success" className="w-100" onClick={() => exportCocktailWorkbook(inputData)}>
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

export default CocktailBuild;
