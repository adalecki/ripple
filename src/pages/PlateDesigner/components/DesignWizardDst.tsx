import React, { useState } from 'react';
import { Container, Row, Col, Button } from 'react-bootstrap';

import PatternManager from './PatternManager';
import { Plate } from '../../../classes/PlateClass';
import { Pattern } from '../../../classes/PatternClass';
import { calculateBlockBorders, formatWellBlock, splitIntoBlocks } from '../../../utils/plateUtils';
import { ColorConfig, generatePatternColors } from '../../../utils/wellColors';
import { currentItem, generateExcelTemplate, getPatternWells, isBlockOverlapping, mergeUnusedPatternLocations, sensibleWellSelection } from '../../../utils/designUtils';

import ApplyTooltip from './ApplyTooltip';
import PlateViewCanvas from '../../../components/PlateViewCanvas';

interface DesignWizardDstProps {
  designDstPlates: Plate[];
  setDesignDstPlates: React.Dispatch<React.SetStateAction<Plate[]>>;
  curDesignDstPlateId: number | null;
  setCurDesignDstPlateId: React.Dispatch<React.SetStateAction<number | null>>;
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
    const msgArr = sensibleWellSelection(selectedWellIds, patterns.find(p => p.id == curPatternId)!, designDstPlates[0])
    if (patternState.isEditing) {
      msgArr.splice(0, 0, 'isEditing')
    }
    setApplyPopup({ event: e, msgArr: msgArr })
  };

  const handleMouseLeave = () => {
    setApplyPopup({ event: null, msgArr: [] });
  };

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

  //className="d-flex justify-content-between align-items-center mb-3"
  const blockBorderMap = calculateBlockBorders(designDstPlates[0]);

  return (
    <Container fluid className='noselect h-100 pb-2 pt-2'>
      <div className='h-100'>
        <Row className='h-100' style={{ minHeight: 0 }}>
          <Col md={4} className='d-flex flex-column h-100 overflow-y-auto' style={{ scrollbarGutter: 'stable' }}>
            <div className='mb-3' style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: '2em', rowGap: '0.5em' }}>
              <div
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}>
                <Button
                  onClick={applyPatternToWells}
                  disabled={
                    !selectedPattern ||
                    selectedWellIds.length === 0 ||
                    (selectedPattern.type !== 'Unused' && !Number.isInteger(selectedWellIds.length / (selectedPattern.replicates * selectedPattern.concentrations.length))) ||
                    patternState.isEditing
                  }
                  size='sm'
                  style={{width: '100%'}}
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
                onClick={() => generateExcelTemplate(patterns)}
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
          <Col md={8} className='d-flex flex-column h-100 overflow-y-auto' style={{ scrollbarGutter: 'stable' }} onMouseDown={handleMouseDown}>
            <PlateViewCanvas
              plate={designDstPlates[0]}
              view='design'
              colorConfig={colorConfig}
              selectedWells={selectedWellIds}
              handleLabelClick={handleLabelClick}
              blockBorderMap={blockBorderMap}
            />

          </Col>
        </Row>
        {applyPopup.msgArr.length > 0 ? <ApplyTooltip data={applyPopup} /> : ''}
      </div>
    </Container>
  );
};

export default DesignWizardDst;