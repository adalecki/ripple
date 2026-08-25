import React, { useState } from 'react';
import { Button, Col, Container, Row } from 'react-bootstrap';

import { Plate, PlateSize } from '../../../classes/PlateClass';
import { Pattern } from '../../../classes/PatternClass';
import { FormField } from '../../../components/FormField';
import PlateViewCanvas from '../../../components/PlateViewCanvas';
import ApplyTooltip from '../../../components/ApplyTooltip';
import { calculateBlockBorders, formatWellBlock } from '../../../utils/plateUtils';
import { currentItem, isBlockOverlapping, sensibleRecipeSelection } from '../../../utils/designUtils';
import { ColorConfig, generatePatternColors } from '../../../utils/wellColors';
import { recipeSlotCount } from '../utils/cocktailUtils';
import RecipeManager from './RecipeManager';

import '../../../css/DesignWizard.css';

interface RecipeWizardProps {
  recipes: Pattern[];
  setRecipes: React.Dispatch<React.SetStateAction<Pattern[]>>;
  curRecipeId: number | null;
  previewPlate: Plate;
  setPreviewPlate: React.Dispatch<React.SetStateAction<Plate>>;
  dstPlateSize: PlateSize;
  setDstPlateSize: React.Dispatch<React.SetStateAction<PlateSize>>;
  recipeState: {
    isEditing: boolean;
    isNewRecipe: boolean;
    isPickingColor: boolean;
  }
  setRecipeState: React.Dispatch<React.SetStateAction<{
    isEditing: boolean;
    isNewRecipe: boolean;
    isPickingColor: boolean;
  }>>
  dropletSize: number;
  selectedWellIds: string[];
  handleLabelClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  handleMouseDown: (e: React.MouseEvent<Element, MouseEvent>) => void;
  onDoubleClick: (e: React.MouseEvent<Element, MouseEvent>) => void;
}

const RecipeWizard: React.FC<RecipeWizardProps> = ({
  recipes,
  setRecipes,
  curRecipeId,
  previewPlate,
  setPreviewPlate,
  dstPlateSize,
  setDstPlateSize,
  recipeState,
  setRecipeState,
  dropletSize,
  selectedWellIds,
  handleLabelClick,
  handleMouseDown,
  onDoubleClick
}) => {
  const [applyPopup, setApplyPopup] = useState<{ event: React.MouseEvent | null, msgArr: string[] }>({ event: null, msgArr: [] });

  const selectedRecipe = currentItem(recipes, curRecipeId) as Pattern | null;

  function getApplyDisabledReasons(): string[] {
    const reasons: string[] = [];
    if (recipeState.isEditing) reasons.push('Save the recipe before applying it to the plate');
    if (!selectedRecipe) {
      reasons.push('No recipe selected');
      return reasons;
    }
    if (recipeSlotCount(selectedRecipe) === 0) reasons.push('Recipe has no component volumes');
    reasons.push(...sensibleRecipeSelection(selectedWellIds, selectedRecipe, previewPlate));
    if (reasons.length === 0) {
      const otherLocations = recipes.filter(r => r.id !== selectedRecipe.id).flatMap(r => r.locations);
      if (isBlockOverlapping(previewPlate, formatWellBlock(selectedWellIds), otherLocations)) {
        reasons.push('Selection overlaps a region already assigned to another recipe');
      }
    }
    return reasons;
  }

  const applyDisabledReasons = getApplyDisabledReasons();
  const canApply = applyDisabledReasons.length === 0;

  function applyRecipeToWells() {
    if (!selectedRecipe || !canApply) return;
    const newRecipe = selectedRecipe.clone();
    const newPlate = previewPlate.clone();
    const block = formatWellBlock(selectedWellIds);
    newPlate.applyPattern(block, newRecipe);
    newRecipe.locations.push(block);
    setPreviewPlate(newPlate);
    setRecipes(recipes.map(r => (r.id === newRecipe.id ? newRecipe : r)));
  }

  function clearRecipeFromWells(clearAll?: boolean) {
    const wellSelection = clearAll ? previewPlate.getWellIds() : selectedWellIds;
    if (wellSelection.length === 0) return;
    const newPlate = previewPlate.clone();
    const newRecipes = recipes.map(recipe => {
      const newRecipe = recipe.clone();
      newRecipe.locations = recipe.locations.filter(location => {
        if (clearAll || isBlockOverlapping(previewPlate, formatWellBlock(wellSelection), [location])) {
          newPlate.removePattern(location, recipe.name);
          return false;
        }
        return true;
      });
      return newRecipe;
    });
    setPreviewPlate(newPlate);
    setRecipes(newRecipes);
  }

  const handleMouseEnter = (e: React.MouseEvent) => {
    setApplyPopup({ event: applyDisabledReasons.length > 0 ? e : null, msgArr: applyDisabledReasons });
  };

  const handleMouseLeave = () => {
    setApplyPopup({ event: null, msgArr: [] });
  };

  const handlePlateSizeChange = (value: PlateSize) => {
    if (value === dstPlateSize) return;
    const placed = recipes.some(r => r.locations.length > 0);
    if (placed && !window.confirm('Changing destination plate size will clear recipe placements. Continue?')) return;
    setDstPlateSize(value);
    setPreviewPlate(new Plate({ barcode: 'PREVIEW', plateSize: value }));
    setRecipes(recipes.map(recipe => {
      const cleared = recipe.clone();
      cleared.locations = [];
      return cleared;
    }));
  };

  const colorConfig: ColorConfig = {
    scheme: 'pattern',
    colorMap: generatePatternColors(recipes)
  };

  return (
    <Container fluid className="noselect design-wizard-container">
      <Row className="design-wizard-row">
        <Col md={3} className="design-wizard-col design-wizard-col-left">
          <div className="design-wizard-button-grid">
            <div onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
              <Button onClick={applyRecipeToWells} disabled={!canApply} size="sm">
                Apply to Wells
              </Button>
            </div>
            <Button onClick={() => clearRecipeFromWells()} disabled={selectedWellIds.length === 0} variant="danger" size="sm">
              Clear from Wells
            </Button>
            <Button onClick={() => clearRecipeFromWells(true)} variant="danger" size="sm">
              Clear from All Wells
            </Button>
          </div>
          <RecipeManager
            recipes={recipes}
            setRecipes={setRecipes}
            curRecipeId={curRecipeId}
            recipeState={recipeState}
            setRecipeState={setRecipeState}
            dropletSize={dropletSize}
          />
        </Col>
        <Col
          md={9}
          className="design-wizard-col"
          style={{ scrollbarGutter: 'stable' }}
          onMouseDown={handleMouseDown}
          onDoubleClick={onDoubleClick}
        >
          <span className="d-flex justify-content-end">
            <FormField
              id="cocktail-dst-plate-size"
              name="cocktail-dst-plate-size"
              type="select"
              label="Destination Plate Size"
              value={dstPlateSize}
              onChange={handlePlateSizeChange}
              options={[
                { value: '96', label: '96' },
                { value: '384', label: '384' },
                { value: '1536', label: '1536' }
              ]}
              className="default-label-text w-auto form-field-compact"
            />
          </span>
          <PlateViewCanvas
            plate={previewPlate}
            view="design"
            colorConfig={colorConfig}
            selectedWells={selectedWellIds}
            handleLabelClick={handleLabelClick}
            blockBorderMap={calculateBlockBorders(previewPlate)}
          />
          <small className="text-muted">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.25rem' }}>
              <span><kbd>LeftClick</kbd> to select wells, drag to select groups</span>
              <span><kbd>LeftClick</kbd> on labels to select rows or columns</span>
              <span><kbd>Ctrl</kbd> + <kbd>LeftClick</kbd> to add to the selection</span>
              <span><kbd>ArrowKey</kbd> to move the selection</span>
              <span><kbd>Shift</kbd> + <kbd>ArrowKey</kbd> expands the selection</span>
            </div>
          </small>
        </Col>
      </Row>
      {applyPopup.msgArr.length > 0 ? <ApplyTooltip data={applyPopup} /> : ''}
    </Container>
  );
};

export default RecipeWizard;
