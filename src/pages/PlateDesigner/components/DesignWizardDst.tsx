import React, { useState } from 'react';
import { Container, Row, Col, Button } from 'react-bootstrap';

import PatternManager from './PatternManager';
import { Plate, PlateSize } from '../../../classes/PlateClass';
import { Pattern } from '../../../classes/PatternClass';
import { calculateBlockBorders, formatWellBlock, splitIntoBlocks } from '../../../utils/plateUtils';
import { ColorConfig, generatePatternColors } from '../../../utils/wellColors';
import { currentItem, generateExcelTemplate, getPatternWells, isBlockOverlapping, mergeUnusedPatternLocations, sensibleWellSelection } from '../../../utils/designUtils';

import ApplyTooltip from './ApplyTooltip';
import PlateViewCanvas from '../../../components/PlateViewCanvas';

import '../../../css/DesignWizard.css'
import { FormField } from '../../../components/FormField';

interface DesignWizardDstProps {
  designDstPlates: Plate[];
  setDesignDstPlates: React.Dispatch<React.SetStateAction<Plate[]>>;
  curDesignDstPlateId: number | null;
  setCurDesignDstPlateId: React.Dispatch<React.SetStateAction<number | null>>;
  designSrcPlates: Plate[];
  designDstPlateSize: PlateSize;
  setDesignDstPlateSize: React.Dispatch<React.SetStateAction<PlateSize>>;
  patterns: Pattern[];
  setPatterns: React.Dispatch<React.SetStateAction<Pattern[]>>;
  curPatternId: number | null;
  selectedWellIds: string[];
  handleLabelClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  handleMouseDown?: (e: React.MouseEvent<Element, MouseEvent>) => void;
  patternState: {
    isEditing: boolean;
    isNewPattern: boolean;
    isPickingColor: boolean;
  }
  setPatternState: React.Dispatch<React.SetStateAction<{
    isEditing: boolean;
    isNewPattern: boolean;
    isPickingColor: boolean;
  }>>
}

const DesignWizardDst: React.FC<DesignWizardDstProps> = ({
  designDstPlates,
  setDesignDstPlates,
  //these are for a future with multiple dest design patterns, requiring a major rewrite of core calculator logic; don't worry about it anytime soon
  //@ts-ignore
  curDesignDstPlateId,
  //@ts-ignore
  setCurDesignDstPlateId,
  designSrcPlates,
  designDstPlateSize,
  setDesignDstPlateSize,
  patterns,
  setPatterns,
  curPatternId,
  selectedWellIds,
  handleLabelClick = (() => { }),
  handleMouseDown = (() => { }),
  patternState,
  setPatternState
}) => {
  const [applyPopup, setApplyPopup] = useState<{ event: React.MouseEvent | null, msgArr: string[] }>({ event: null, msgArr: [] })

  const selectedPattern = currentItem(patterns, curPatternId)
  const colorConfig = buildColorConfig(patterns);

  function buildColorConfig(patterns: Pattern[]): ColorConfig {
    let maxConcentration: number | null = null;
    for (const pattern of patterns) {
      for (const concentration of pattern.concentrations) {
        if (typeof concentration === 'number') {
          if (maxConcentration === null || concentration > maxConcentration) {
            maxConcentration = concentration;
          }
        }
      }
    }
    return {
      scheme: 'pattern',
      colorMap: generatePatternColors(patterns),
      maxConcentration: maxConcentration || 0,
    };
  }

  const handleMouseEnter = (e: React.MouseEvent) => {
    const msgArr: string[] = [];
    if (patternState.isEditing) msgArr.push('Save the pattern before applying to plate');
    const curPattern = patterns.find(p => p.id == curPatternId);
    if (selectedWellIds.length > 0 && curPattern && curPattern.concentrations.filter(c => c != null).length > 0) {
      msgArr.push(...sensibleWellSelection(selectedWellIds, curPattern, designDstPlates[0]));
    }
    setApplyPopup({ event: msgArr.length > 0 ? e : null, msgArr });
  };

  const handleMouseLeave = () => {
    setApplyPopup({ event: null, msgArr: [] });
  };

  const handlePlateSizeChange = (value: PlateSize) => {
    if (value === designDstPlateSize) return
    const filledWells = Object.values(designDstPlates[0].getWells()).filter(well => well.getTotalVolume() > 0)
    if (filledWells.length > 0 || designDstPlates.length > 1) {
      if (!window.confirm("Changing plate size will reset the destination plate. Continue?")) {
        return
      }
    }
    const newPlate = new Plate({ barcode: 'DST001', plateSize: value })
    setDesignDstPlateSize(value)
    setDesignDstPlates([newPlate])
    setCurDesignDstPlateId(newPlate.id)
  }

  function applyPatternToWells() {
    if (curPatternId && selectedWellIds.length > 0) {
      const pattern = patterns.find(p => p.id == curPatternId)
      if (pattern) {
        const newPattern = pattern.clone()
        const newPlate = designDstPlates[0].clone();
        if (pattern.type === 'Unused') {
          for (const wellId of selectedWellIds) {
            const well = newPlate.getWell(wellId);
            if (well && well.getContents().length > 0) {
              alert(`Cannot mark wells as unused - they contain other patterns. Please clear them first.`);
              return;
            }
          }
          const mergedBlock = mergeUnusedPatternLocations(newPattern, newPlate, selectedWellIds);
          for (const location of newPattern.locations) {
            newPlate.removePattern(location, newPattern.name);
          }
          newPattern.locations = [];
          newPlate.applyPattern(mergedBlock, newPattern);
          newPattern.locations = [mergedBlock];
          setDesignDstPlates([newPlate]);
          setPatterns(patterns.map(p => p.id === newPattern.id ? newPattern : p));
          return;
        }
        const patternSize = newPattern.replicates * newPattern.concentrations.length;
        //shouldn't be possible, but as a fallback
        if (selectedWellIds.length % patternSize !== 0) {
          alert(`The number of selected wells must be a multiple of ${patternSize} (replicates * concentrations).`);
          return;
        }
        const blocks = splitIntoBlocks(selectedWellIds, newPattern, designDstPlates[0]);
        for (const block of blocks) {
          if (isBlockOverlapping(designDstPlates[0], block, newPattern.locations)) {
            alert(`The selected wells overlap with existing patterns. Please choose different wells.`);
            return;
          }
          newPlate.applyPattern(block, newPattern);
          newPattern.locations.push(block);
        }
        setDesignDstPlates([newPlate]);
        setPatterns(patterns.map(p => p.id === newPattern.id ? newPattern : p));
      }
    }
  };

  function clearPatternFromWells(clearAll?: boolean) {
    if (clearAll || selectedWellIds.length > 0) {
      const wellSelection = clearAll ? designDstPlates[0].getWellIds() : [...selectedWellIds]
      const newPlate = designDstPlates[0].clone();
      const wellsToCheck = designDstPlates[0].getSomeWells(wellSelection.join(';'))
      const patternNamesToCheck = [...new Set(wellsToCheck.flatMap(w => w.getPatterns()))]

      const unusedPatterns = patterns.filter(p => p.type === 'Unused')
      const unusedPatternNames = unusedPatterns.map(p => p.name);

      const hasUnusedWells = wellsToCheck.some(w => w.getIsUnused());

      const newPatternArr: Pattern[] = []

      for (const unusedPattern of unusedPatterns) {
        if (hasUnusedWells) {
          const newPattern = unusedPattern.clone();
          const allUnusedWells = getPatternWells(newPattern, newPlate);
          const remainingUnusedWells = allUnusedWells.filter(wellId => !wellSelection.includes(wellId));

          for (const location of newPattern.locations) {
            newPlate.removePattern(location, newPattern.name);
          }
          newPattern.locations = [];

          if (remainingUnusedWells.length > 0) {
            const mergedBlock = formatWellBlock(remainingUnusedWells);
            newPlate.applyPattern(mergedBlock, newPattern);
            newPattern.locations = [mergedBlock];
          }

          newPatternArr.push(newPattern);
        }
      }

      for (const patternName of patternNamesToCheck) {
        if (!unusedPatternNames.includes(patternName)) {
          const pattern = patterns.find(p => p.name == patternName)
          if (pattern) {
            const newPattern = pattern.clone()
            for (const loc of pattern.locations) {
              if (isBlockOverlapping(newPlate, wellSelection.join(';'), [loc])) {
                newPlate.removePattern(loc, patternName)
                newPattern.locations = newPattern.locations.filter(l => !(l == loc))
              }
            }
            newPatternArr.push(newPattern)
          }
        }
      }

      setPatterns(patterns.map(p => newPatternArr.some(nP => nP.id == p.id) ? newPatternArr.find(nP => nP.id == p.id) as Pattern : p));
      setDesignDstPlates([newPlate])
    }
  }

  const blockBorderMap = calculateBlockBorders(designDstPlates[0]);

  return (
    <Container fluid className='noselect design-wizard-container'>
      <Row className='design-wizard-row'>
        <Col md={3} className='design-wizard-col'>
          <div className='design-wizard-button-grid'>
            <div
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              <Button
                onClick={applyPatternToWells}
                disabled={
                  !selectedPattern ||
                  selectedWellIds.length === 0 ||
                  (selectedPattern.type !== 'Unused' && !Number.isInteger(selectedWellIds.length / (selectedPattern.replicates * selectedPattern.concentrations.length))) ||
                  patternState.isEditing
                }
                size='sm'
              >
                Apply to Wells
              </Button>
            </div>
            <Button
              onClick={() => clearPatternFromWells()}
              disabled={selectedWellIds.length === 0}
              variant='danger'
              size='sm'
            >
              Clear from Wells
            </Button>
            <Button
              onClick={() => clearPatternFromWells(true)}
              variant='danger'
              size='sm'
            >
              Clear from All Wells
            </Button>
            <Button
              onClick={() => generateExcelTemplate(patterns, designSrcPlates)}
              disabled={patterns.length < 1}
              variant='success'
              size='sm'
            >
              Generate Template
            </Button>
          </div>
          <PatternManager
            patternState={patternState}
            setPatternState={setPatternState}
            patterns={patterns}
            setPatterns={setPatterns}
            curPatternId={curPatternId}
          />
        </Col>
        <Col md={9} className='design-wizard-col' onMouseDown={handleMouseDown}>
          <span className="d-flex justify-content-end">
            <FormField
              id="dst-plate-size"
              name="dst-plate-size"
              type="select"
              label="Destination Plate Size"
              value={designDstPlateSize}
              onChange={handlePlateSizeChange}
              options={[
                { value: '96', label: '96' },
                { value: '384', label: '384' },
                { value: '1536', label: '1536' }]
              }
              className="default-label-text w-auto form-field-compact"
            />
          </span>
          <PlateViewCanvas
            plate={designDstPlates[0]}
            view='design'
            colorConfig={colorConfig}
            selectedWells={selectedWellIds}
            handleLabelClick={handleLabelClick}
            blockBorderMap={blockBorderMap}
          />
          <small className="text-muted">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.25rem' }}>
              <span><kbd>LeftClick</kbd> to select wells, drag to select groups</span>
              <span><kbd>LeftClick</kbd> on labels or All Plate square to select groups of wells</span>
              <span><kbd>LeftClick</kbd> + <kbd>Shift</kbd> to add to current selection</span>
              <span><kbd>ArrowKey</kbd> to move current selection</span>
              <span><kbd>Shift</kbd> + <kbd>ArrowKey</kbd> expands well selection</span>
            </div>
          </small>
        </Col>
      </Row>
      {applyPopup.msgArr.length > 0 ? <ApplyTooltip data={applyPopup} /> : ''}
    </Container>
  );
};

export default DesignWizardDst;