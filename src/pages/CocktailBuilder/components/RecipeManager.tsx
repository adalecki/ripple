import React, { useState } from 'react';
import { Alert, Button, Form } from 'react-bootstrap';
import { HslStringColorPicker } from 'react-colorful';

import { HslStringType, Pattern } from '../../../classes/PatternClass';
import { FormField } from '../../../components/FormField';
import ApplyTooltip from '../../../components/ApplyTooltip';
import { currentItem } from '../../../utils/designUtils';
import { isDropletMultiple } from '../utils/validationUtils';
import VolumeTable from './VolumeTable';
import { MAX_RECIPE_SLOTS } from '../utils/cocktailUtils';

interface RecipeManagerProps {
  recipes: Pattern[];
  setRecipes: React.Dispatch<React.SetStateAction<Pattern[]>>;
  curRecipeId: number | null;
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
}

const RecipeManager: React.FC<RecipeManagerProps> = ({
  recipes,
  setRecipes,
  curRecipeId,
  recipeState,
  setRecipeState,
  dropletSize
}) => {
  const [editingRecipe, setEditingRecipe] = useState<Pattern | null>(null);
  const [prevRecipeId, setPrevRecipeId] = useState<number | null>(null);
  const [applyPopup, setApplyPopup] = useState<{ event: React.MouseEvent | null, msgArr: string[] }>({ event: null, msgArr: [] });

  if (curRecipeId !== prevRecipeId) {
    setPrevRecipeId(curRecipeId);
    const selectedRecipe = currentItem(recipes, curRecipeId) as Pattern | null;
    setEditingRecipe(selectedRecipe ? selectedRecipe.clone() : null);
  }

  const duplicateName = editingRecipe ? recipes.some(r => r.name === editingRecipe.name && r.id !== editingRecipe.id) : false;
  const atSlotCap = editingRecipe ? editingRecipe.volumes.length >= MAX_RECIPE_SLOTS : false;
  const offDroplet = editingRecipe
    ? editingRecipe.volumes.some(v => typeof v === 'number' && !isDropletMultiple(v, dropletSize))
    : false;

  function getSaveDisabledReasons(): string[] {
    const reasons: string[] = [];
    if (!editingRecipe) return reasons;
    if (duplicateName) reasons.push('Another recipe already uses this name');
    if (!editingRecipe.name) reasons.push('Must enter a recipe name');
    if (!editingRecipe.replicates) reasons.push('Must define replicates');
    return reasons;
  }

  const saveDisabledReasons = getSaveDisabledReasons();

  const handleEditRecipe = () => {
    setRecipeState({ ...recipeState, isEditing: true });
    if (editingRecipe && editingRecipe.volumes.length == 0) {
      setEditingRecipe(new Pattern({ ...editingRecipe, volumes: [null] }))
    }
  };

  const handleSaveRecipe = () => {
    if (!editingRecipe) return;
    const volumes = editingRecipe.volumes.filter(v => v != null)
    const saveRecipe = new Pattern({ ...editingRecipe, volumes: volumes })
    setRecipes(recipes.map(r => r.id === saveRecipe.id ? saveRecipe : r));
    setRecipeState({ ...recipeState, isEditing: false, isPickingColor: false });
  };

  const handleFieldChange = (fieldName: string, value: string | number) => {
    if (!editingRecipe) return;
    setEditingRecipe(new Pattern({ ...editingRecipe, [fieldName]: value }));
  };

  const handleVolumesChange = (volumes: (number | null)[]) => {
    if (!editingRecipe) return;
    setEditingRecipe(new Pattern({ ...editingRecipe, volumes }));
  };

  const handleColorChange = (color: string) => {
    if (!editingRecipe) return;
    setEditingRecipe(new Pattern({ ...editingRecipe, color: color as HslStringType }));
  };

  const handleMouseEnter = (e: React.MouseEvent) => {
    setApplyPopup({ event: saveDisabledReasons.length > 0 ? e : null, msgArr: saveDisabledReasons });
  };

  const handleMouseLeave = () => {
    setApplyPopup({ event: null, msgArr: [] });
  };

  return (
    <div className="d-flex flex-column">
      {editingRecipe ? (
        <>
          <div className="d-flex justify-content-between align-items-center mb-2">
            {recipeState.isEditing ? (
              <div onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
                <Button
                  size="sm"
                  onClick={(e) => { handleSaveRecipe(); e.currentTarget.blur() }}
                  disabled={saveDisabledReasons.length > 0}
                >
                  Save
                </Button>
              </div>
            ) : (
              <>
                <Button
                  size="sm"
                  variant="outline-primary"
                  onClick={(e) => { handleEditRecipe(); e.currentTarget.blur() }}
                  disabled={editingRecipe.locations.length > 0}
                >
                  Edit
                </Button>
                {editingRecipe.locations.length > 0 && (
                  <small className="text-muted fst-italic ms-2">Can't edit when present on plate</small>
                )}
              </>
            )}
          </div>

          <Form>
            <FormField
              id="recipe-name"
              name="recipe-name"
              type="text"
              label="Name"
              value={editingRecipe.name}
              onChange={value => handleFieldChange('name', value)}
              required
              disabled={!recipeState.isEditing}
              error={duplicateName ? 'Another recipe already uses this name' : undefined}
            />
            <FormField
              id="recipe-replicates"
              name="recipe-replicates"
              type="number"
              label="Replicates"
              value={editingRecipe.replicates}
              onChange={value => handleFieldChange('replicates', value)}
              step={1}
              min={1}
              required
              disabled={!recipeState.isEditing}
              tooltip="How many destination wells each cocktail occupies"
            />

            <div className="form-field">
              <div className="form-label">Color</div>
              <div
                className="color-preview form-field-input"
                style={{ backgroundColor: editingRecipe.color }}
                onClick={() => recipeState.isEditing && setRecipeState({ ...recipeState, isPickingColor: !recipeState.isPickingColor })}
              />
            </div>
            {recipeState.isPickingColor && (
              <div className="mb-3">
                <HslStringColorPicker color={editingRecipe.color} onChange={handleColorChange} />
              </div>
            )}

            <Form.Label>Component Volumes</Form.Label>
            <Alert variant="danger" show={atSlotCap} transition={false} className="py-1 px-2 small">
              A maximum of {MAX_RECIPE_SLOTS} components is allowed
            </Alert>
            <div className="concentration-table-container">
              <VolumeTable
                tableId="recipe-volume-table"
                volumes={editingRecipe.volumes}
                onChange={handleVolumesChange}
                disabled={!recipeState.isEditing}
                canAdd={!atSlotCap}
              />
            </div>
            {offDroplet && (
              <small style={{ color: 'var(--bs-warning)' }}>
                One or more volumes is not a multiple of the {dropletSize} nL droplet size
              </small>
            )}
          </Form>
        </>
      ) : (
        <p className="text-muted">Select or add a recipe to edit</p>
      )}
      {applyPopup.msgArr.length > 0 ? <ApplyTooltip data={applyPopup} /> : ''}
    </div>
  );
};

export default RecipeManager;
