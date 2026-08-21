import React, { useEffect, useRef, useState } from 'react';
import { Row, Col, Tabs, Tab } from 'react-bootstrap';
import { read } from 'xlsx';

import { Plate, PlateSize } from '../../classes/PlateClass';
import { Pattern } from '../../classes/PatternClass';
import Sidebar from '../../components/Sidebar';
import { usePreferences } from '../../hooks/usePreferences';
import { currentPlate, getCoordsFromWellId, getWellIdFromCoords, numberToLetters, TransferStepExport } from '../../utils/plateUtils';
import { labelDrag, moveWellSelection, selectorHelper } from '../../utils/designUtils';

import { Combination } from './types/combinatorTypes';
import {
  InputDataType,
  buildDesignFromInputData,
  processInputData,
  recipeSlotCount
} from './utils/combinatorUtils';
import { echoInputValidation, validateInputData } from './utils/validationUtils';
import CombinatorBuild from './components/CombinatorBuild';
import CombinationsTab from './components/CombinationsTab';
import InventoryWizard from './components/InventoryWizard';
import RecipeWizard from './components/RecipeWizard';
import Instructions from './components/Instructions';

function Combinator() {
  const { preferences } = usePreferences();
  const [tabKey, setTabKey] = useState<string>('recipes');

  const [dstPlateSize, setDstPlateSize] = useState(preferences.destinationPlateSize as PlateSize);
  const [srcPlateSize, setSrcPlateSize] = useState(preferences.sourcePlateSize as PlateSize);

  const [recipes, setRecipes] = useState<Pattern[]>([]);
  const [curRecipeId, setCurRecipeId] = useState<number | null>(null);
  const [prevRecipeId, setPrevRecipeId] = useState<number | null>(null);
  const [recipeState, setRecipeState] = useState({ isEditing: false, isNewRecipe: false, isPickingColor: false });
  const [previewPlate, setPreviewPlate] = useState<Plate>(() => new Plate({ barcode: 'PREVIEW', plateSize: dstPlateSize }));

  const [srcPlates, setSrcPlates] = useState<Plate[]>(() => [new Plate({ barcode: 'SRC001', plateSize: srcPlateSize, plateRole: 'source' })]);
  const [curSrcPlateId, setCurSrcPlateId] = useState<number | null>(srcPlates[0] ? srcPlates[0].id : null);

  const [combinations, setCombinations] = useState<Combination[]>([]);

  const [builtPlates, setBuiltPlates] = useState<Plate[]>([]);
  const [curBuiltPlateId, setCurBuiltPlateId] = useState<number | null>(null);
  const [transferSteps, setTransferSteps] = useState<TransferStepExport[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  const [selectedWellIds, setSelectedWellIds] = useState<string[]>([]);

  if (curRecipeId !== prevRecipeId) {
    setPrevRecipeId(curRecipeId);
    setRecipeState({ isEditing: recipeState.isNewRecipe, isNewRecipe: false, isPickingColor: false });
  }

  const selectionRef = useRef<HTMLDivElement | null>(null);
  const dragState = useRef({ mouseDown: false, dragging: false, startX: 0, startY: 0, endX: 0, endY: 0 });
  const enterCallbackRef = useRef<(() => void) | null>(null);
  const activePlateRef = useRef<Plate | null>(null);

  function activePlate(): Plate | null {
    switch (tabKey) {
      case 'recipes': return previewPlate;
      case 'inventory': return currentPlate(srcPlates, curSrcPlateId);
      default: return null;
    }
  }

  //assigned during render so the once-registered keydown listener never reads a stale plate
  activePlateRef.current = activePlate();

  const handleKeyDown = (e: KeyboardEvent) => {
    const tag = (document.activeElement as HTMLElement)?.tagName;
    if (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(tag)) return;
    const plate = activePlateRef.current;
    if (!plate) return;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
      setSelectedWellIds(prev => moveWellSelection(plate, prev, e.key as 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight', e));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      enterCallbackRef.current?.();
    }
  };

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => { document.removeEventListener('keydown', handleKeyDown); };
  }, []);

  const handleSelect = (k: string | null) => {
    if (k !== null) {
      setTabKey(k);
    }
  };

  const handlePageDblClick = (e: React.MouseEvent<Element, MouseEvent>) => {
    if (e.detail > 1) {
      e.preventDefault();
      setSelectedWellIds(prev => (prev.length ? [] : prev));
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const start = { x: e.clientX + window.scrollX, y: e.clientY + window.scrollY };

    dragState.current.mouseDown = true;
    dragState.current.startX = start.x;
    dragState.current.startY = start.y;
    dragState.current.endX = start.x;
    dragState.current.endY = start.y;

    const el = selectionRef.current;
    if (el) {
      el.style.left = `${start.x}px`;
      el.style.top = `${start.y}px`;
      el.style.width = "0px";
      el.style.height = "0px";
      el.className = "selection-rectangle";
    }
  };

  const handleMouseSelectionMove = (e: React.MouseEvent) => {

    if (!dragState.current.mouseDown) return;
    dragState.current.dragging = true;
    dragState.current.endX = e.clientX + window.scrollX;
    dragState.current.endY = e.clientY + window.scrollY;

    const left = Math.min(dragState.current.startX, dragState.current.endX);
    const top = Math.min(dragState.current.startY, dragState.current.endY);
    const width = Math.abs(dragState.current.startX - dragState.current.endX);
    const height = Math.abs(dragState.current.startY - dragState.current.endY);

    const el = selectionRef.current;
    if (el) {
      el.style.display = "block"
      el.style.left = `${left}px`;
      el.style.top = `${top}px`;
      el.style.width = `${width}px`;
      el.style.height = `${height}px`;
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!dragState.current.mouseDown) return;
    dragState.current.mouseDown = false;
    dragState.current.dragging = false;
    const el = selectionRef.current;
    if (el) el.style.display = "none";

    const parent = (e.target as HTMLElement).closest("[data-view]");
    if (!parent) return;
    const plate = activePlate();
    if (!plate) return;

    const region = {
      x1: Math.min(dragState.current.startX, dragState.current.endX),
      y1: Math.min(dragState.current.startY, dragState.current.endY),
      x2: Math.max(dragState.current.startX, dragState.current.endX),
      y2: Math.max(dragState.current.startY, dragState.current.endY)
    };
    const startEl = document.elementFromPoint(region.x1, region.y1);
    const endEl = document.elementFromPoint(region.x2, region.y2);
    const labelWells = labelDrag(startEl, endEl, plate);
    if (labelWells.length > 0) {
      selectorHelper(e, labelWells, selectedWellIds, setSelectedWellIds)
    }
    else {
      const canvas = parent.getElementsByTagName('canvas')[0]
      const rect = canvas.getBoundingClientRect();
      const cx = region.x1 - rect.left;
      const cy = region.y1 - rect.top;
      const cw = region.x2 - rect.left;
      const ch = region.y2 - rect.top;

      const width = rect.width;
      const height = rect.height;
      const cellW = width / plate.columns;
      const cellH = height / plate.rows;

      const newSelected: string[] = [];

      for (let r = 0; r < plate.rows; r++) {
        for (let c = 0; c < plate.columns; c++) {
          const wx1 = c * cellW;
          const wy1 = r * cellH;
          const wx2 = wx1 + cellW;
          const wy2 = wy1 + cellH;

          const intersects = wx2 >= cx && wx1 <= cw && wy2 >= cy && wy1 <= ch;
          if (intersects) {
            newSelected.push(getWellIdFromCoords(r, c));
          }
        }
      }
      selectorHelper(e, newSelected, selectedWellIds, setSelectedWellIds);
    }
  };

  const handleLabelClick = (e: React.MouseEvent<HTMLDivElement>) => {

    const target = e.target as HTMLDivElement;
    const targetLabel = target.innerText;

    if (!target.closest('[data-view]')) return;
    const plate = activePlate();
    if (!plate) return;

    const newSelected: string[] = [];

    if (target.className.includes("all-wells-container")) {
      for (let r = 0; r < plate.rows; r++) {
        for (let c = 0; c < plate.columns; c++) {
          newSelected.push(getWellIdFromCoords(r, c));
        }
      }

      if (newSelected.length === selectedWellIds.length) newSelected.length = 0;
      setSelectedWellIds(newSelected);
      return;
    }

    for (let r = 0; r < plate.rows; r++) {
      for (let c = 0; c < plate.columns; c++) {
        const wellId = getWellIdFromCoords(r, c);
        const coords = getCoordsFromWellId(wellId);

        const shouldSelect = isNaN(parseInt(targetLabel))
          ? numberToLetters(coords.row) === targetLabel
          : (coords.col + 1).toString() === targetLabel;

        if (shouldSelect) newSelected.push(wellId);
      }
    }
    selectorHelper(e, newSelected, selectedWellIds, setSelectedWellIds)
  };

  const handleAddRecipe = () => {
    let iter = recipes.length + 1;
    while (recipes.find(r => r.name === `Recipe ${iter}`)) iter += 1;
    const newRecipe = new Pattern({
      name: `Recipe ${iter}`,
      type: 'Recipe',
      replicates: 1,
      direction: ['LR'],
      concentrations: [],
      volumes: [null],
      locations: []
    });
    setRecipes([...recipes, newRecipe]);
    setCurRecipeId(newRecipe.id);
    setRecipeState({ isEditing: true, isNewRecipe: true, isPickingColor: false });
  };

  const handleDeleteRecipe = (recipeId: number) => {
    const recipe = recipes.find(r => r.id === recipeId);
    if (recipe) {
      const newPlate = previewPlate.clone();
      for (const location of recipe.locations) newPlate.removePattern(location, recipe.name);
      setPreviewPlate(newPlate);
      setCombinations(combinations.filter(c => c.patternName !== recipe.name));
    }
    setRecipes(recipes.filter(r => r.id !== recipeId));
    if (curRecipeId === recipeId) setCurRecipeId(null);
  };

  const handleAddPlate = () => {
    let iter = srcPlates.length + 1;
    while (srcPlates.find(p => p.barcode === `SRC${iter.toString().padStart(3, '0')}`)) iter += 1;
    const newPlate = new Plate({
      barcode: `SRC${iter.toString().padStart(3, '0')}`,
      plateSize: srcPlateSize,
      plateRole: 'source',
    });
    setSrcPlates([...srcPlates, newPlate]);
    setCurSrcPlateId(newPlate.id);
  };

  const handleDeletePlate = (plateId: number) => {
    const remaining = srcPlates.filter(p => p.id !== plateId);
    if (remaining.length === 0) {
      const newPlate = new Plate({ barcode: 'SRC001', plateSize: srcPlateSize, plateRole: 'source' });
      setSrcPlates([newPlate]);
      setCurSrcPlateId(newPlate.id);
      return;
    }
    setSrcPlates(remaining);
    if (curSrcPlateId === plateId) setCurSrcPlateId(null);
  };

  const handleBuild = (inputData: InputDataType, srcPlateSize: PlateSize, dstPlateSize: PlateSize, dropletSize: number) => {
    const validationErrors = validateInputData(inputData, srcPlateSize, dstPlateSize, dropletSize);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      setBuiltPlates([]);
      setTransferSteps([]);
      return;
    }
    const result = processInputData(inputData, dstPlateSize);
    const plates = [...result.srcPlates, ...result.dstPlates];
    setBuiltPlates(plates);
    setCurBuiltPlateId(plates.length > 0 ? plates[0].id : null);
    setTransferSteps(result.transferSteps);
    setErrors(result.warnings);
  };

  const handleImportFile = async (files: File[], srcPlateSize: PlateSize, dstPlateSize: PlateSize, dropletSize: number) => {
    const arrayBuffer = await files[0].arrayBuffer();
    const workbook = read(arrayBuffer, { type: 'array' });
    const { inputData, errors: importErrors } = echoInputValidation(workbook, srcPlateSize, dstPlateSize, dropletSize);
    setErrors(importErrors);
    if (importErrors.length > 0) return;

    const design = buildDesignFromInputData(inputData, dstPlateSize, srcPlateSize);
    console.log(design)
    setRecipes(design.recipes);
    setPreviewPlate(design.previewPlate);
    setSrcPlates(design.srcPlates);
    setCombinations(design.combinations);
    setCurRecipeId(design.recipes[0]?.id ?? null);
    setCurSrcPlateId(design.srcPlates[0]?.id ?? null);
    setRecipeState({ isEditing: false, isNewRecipe: false, isPickingColor: false });
    setBuiltPlates([]);
    setTransferSteps([]);
    setSelectedWellIds([]);
  };

  const handleClear = () => {
    setBuiltPlates([]);
    setRecipes([]);
    setSrcPlates([new Plate({ barcode: 'SRC001', plateSize: srcPlateSize, plateRole: 'source'})]);
    setCombinations([]);
    setPreviewPlate(new Plate({ barcode: 'PREVIEW', plateSize: dstPlateSize }))
    setCurBuiltPlateId(null);
    setTransferSteps([]);
    setErrors([]);
    setSelectedWellIds([]);
  };

  const renderSidebar = () => {
    switch (tabKey) {
      case 'recipes':
        return (
          <Sidebar
            items={recipes.map(recipe => ({
              id: recipe.id,
              name: recipe.name,
              type: 'Recipe',
              details: {
                rep: recipe.replicates,
                comp: recipeSlotCount(recipe),
                combos: combinations.filter(c => c.patternName === recipe.name).length
              }
            }))}
            selectedItemId={curRecipeId}
            setSelectedItemId={setCurRecipeId}
            title="Recipes"
            onAddItem={handleAddRecipe}
            onDeleteItem={handleDeleteRecipe}
          />
        );
      case 'inventory':
        return (
          <Sidebar
            items={srcPlates.map(plate => ({
              id: plate.id,
              name: plate.barcode || `Plate ${plate.id}`,
              type: plate.plateRole,
              details: { items: Object.values(plate.wells).filter(w => w.getContents().length > 0).length }
            }))}
            selectedItemId={curSrcPlateId}
            setSelectedItemId={setCurSrcPlateId}
            title="Plates"
            onAddItem={handleAddPlate}
            onDeleteItem={handleDeletePlate}
          />
        );
      case 'build':
        return (
          <Sidebar
            items={builtPlates.map(plate => ({
              id: plate.id,
              name: plate.barcode || `Plate ${plate.id}`,
              type: plate.plateRole,
              details: { items: Object.values(plate.wells).filter(w => w.getContents().length > 0).length }
            }))}
            selectedItemId={curBuiltPlateId}
            setSelectedItemId={setCurBuiltPlateId}
            filterOptions={['source', 'destination']}
            title="Plates"
          />
        );
      default:
        return <Sidebar items={[]} selectedItemId={null} setSelectedItemId={() => { }} filterOptions={[]} title="" />;
    }
  };

  if (recipes.length === 0) handleAddRecipe()

  return (
    <div>
      <Row>
        <Col md="2">{renderSidebar()}</Col>
        <Col
          md="10"
          style={{ minHeight: 0 }}
          onMouseMove={handleMouseSelectionMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <div className="page-tabs">
            <Tabs id="combinator-tab-select" activeKey={tabKey} onSelect={handleSelect} mountOnEnter>
              <Tab eventKey="instructions" title="Instructions">
                <Instructions />
              </Tab>
              <Tab eventKey="recipes" title="Recipes">
                <RecipeWizard
                  recipes={recipes}
                  setRecipes={setRecipes}
                  curRecipeId={curRecipeId}
                  previewPlate={previewPlate}
                  setPreviewPlate={setPreviewPlate}
                  dstPlateSize={dstPlateSize}
                  setDstPlateSize={setDstPlateSize}
                  recipeState={recipeState}
                  setRecipeState={setRecipeState}
                  dropletSize={preferences.dropletSize as number}
                  selectedWellIds={selectedWellIds}
                  handleLabelClick={handleLabelClick}
                  handleMouseDown={handleMouseDown}
                  onDoubleClick={handlePageDblClick}
                />
              </Tab>
              <Tab eventKey="inventory" title="Inventory">
                <InventoryWizard
                  srcPlates={srcPlates}
                  setSrcPlates={setSrcPlates}
                  curSrcPlateId={curSrcPlateId}
                  setCurSrcPlateId={setCurSrcPlateId}
                  srcPlateSize={srcPlateSize}
                  setSrcPlateSize={setSrcPlateSize}
                  selectedWellIds={selectedWellIds}
                  handleLabelClick={handleLabelClick}
                  handleMouseDown={handleMouseDown}
                  onDoubleClick={handlePageDblClick}
                  enterCallbackRef={enterCallbackRef}
                />
              </Tab>
              <Tab eventKey="combinations" title="Combinations">
                <CombinationsTab
                  combinations={combinations}
                  setCombinations={setCombinations}
                  recipes={recipes}
                  srcPlates={srcPlates}
                />
              </Tab>
              <Tab eventKey="build" title="Build">
                <CombinatorBuild
                  plate={currentPlate(builtPlates, curBuiltPlateId)}
                  recipes={recipes}
                  srcPlates={srcPlates}
                  combinations={combinations}
                  srcPlateSize={srcPlateSize}
                  dstPlateSize={dstPlateSize}
                  dropletSize={preferences.dropletSize as number}
                  errors={errors}
                  transferSteps={transferSteps}
                  onBuild={handleBuild}
                  onImportFile={handleImportFile}
                  onClear={handleClear}
                  showInstructions={() => setTabKey('instructions')}
                />
              </Tab>
            </Tabs>
          </div>
        </Col>
      </Row>
      <div ref={selectionRef} style={{ position: 'absolute', pointerEvents: 'none', display: 'none' }} />
    </div>
  );
}

export default Combinator;
