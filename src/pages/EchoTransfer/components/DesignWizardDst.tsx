import React, { useState, useEffect, useMemo } from 'react';
import { Container, Row, Col, Button } from 'react-bootstrap';

import PatternManager from './PatternManager';
import { Plate } from '../../../classes/PlateClass';
import { Pattern } from '../../../classes/PatternClass';
import { calculateBlockBorders, formatWellBlock, splitIntoBlocks } from '../../../utils/plateUtils';
import { ColorConfig, generatePatternColors } from '../../../utils/wellColors';
import { currentPattern, generateExcelTemplate, getPatternWells, isBlockOverlapping, mergeUnusedPatternLocations, sensibleWellSelection } from '../../../utils/designUtils';

import '../../../css/PlateComponent.css'
import '../../../css/DesignWizard.css'
import ApplyTooltip from './ApplyTooltip';
import PlateViewCanvas from '../../../components/PlateViewCanvas';

interface DesignWizardProps {
  designDstPlates: Plate[];
  setDesignDstPlates: React.Dispatch<React.SetStateAction<Plate[]>>;
  curDesignDstPlateId: number | null;
  setCurDesignDstPlateId: React.Dispatch<React.SetStateAction<number | null>>;
  patterns: Pattern[];
  setPatterns: React.Dispatch<React.SetStateAction<Pattern[]>>;
  curPatternId: number | null;
  setCurPatternId: React.Dispatch<React.SetStateAction<number | null>>;
  selectedWellIds: string[];
  setSelectedWellIds: React.Dispatch<React.SetStateAction<string[]>>;
  handleLabelClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  patternPlate: Plate;
  setPatternPlate: React.Dispatch<React.SetStateAction<Plate>>;
}

const DesignWizard: React.FC<DesignWizardProps> = ({
  designDstPlates,
  setDesignDstPlates,
  curDesignDstPlateId,
  setCurDesignDstPlateId,
  patterns,
  setPatterns,
  curPatternId,
  setCurPatternId,
  selectedWellIds,
  setSelectedWellIds,
  handleLabelClick = (() => { }),
  patternPlate,
  setPatternPlate }) => {
  const [colorConfig, setColorConfig] = useState<ColorConfig>({ scheme: 'pattern', colorMap: generatePatternColors(patterns) })
  const [isEditing, setIsEditing] = useState(false);
  const [applyPopup, setApplyPopup] = useState<{ event: React.MouseEvent | null, msgArr: string[] }>({ event: null, msgArr: [] })

  const selectedPattern = currentPattern(patterns,curPatternId)

  useEffect(() => {
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
    setColorConfig({
      scheme: 'pattern',
      colorMap: generatePatternColors(patterns),
      maxConcentration: maxConcentration || 0
    })
  }, [patterns])

  const handleMouseEnter = (e: React.MouseEvent) => {
    const msgArr = sensibleWellSelection(selectedWellIds, patterns.find(p => p.id == curPatternId)!, patternPlate)
    setApplyPopup({ event: e, msgArr: msgArr })
  };

  const handleMouseLeave = () => {
    setApplyPopup({ event: null, msgArr: [] });
  };

  const applyPatternToWells = () => {
    if (curPatternId && selectedWellIds.length > 0) {
      const pattern = patterns.find(p => p.id == curPatternId)
      if (pattern) {
        const newPattern = pattern.clone()
        const newPlate = patternPlate.clone();
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
          setPatternPlate(newPlate);
          setPatterns(patterns.map(p => p.id === newPattern.id ? newPattern : p));
          return;
        }
        const patternSize = newPattern.replicates * newPattern.concentrations.length;
        //shouldn't be possible, but as a fallback
        if (selectedWellIds.length % patternSize !== 0) {
          alert(`The number of selected wells must be a multiple of ${patternSize} (replicates * concentrations).`);
          return;
        }
        const blocks = splitIntoBlocks(selectedWellIds, newPattern, patternPlate);
        for (const block of blocks) {
          if (isBlockOverlapping(patternPlate, block, newPattern.locations)) {
            alert(`The selected wells overlap with existing patterns. Please choose different wells.`);
            return;
          }
          newPlate.applyPattern(block, newPattern);
          newPattern.locations.push(block);
        }
        setPatternPlate(newPlate);
        setPatterns(patterns.map(p => p.id === newPattern.id ? newPattern : p));
      }
    }
  };

  const clearPatternFromWells = (clearAll?: boolean) => {
    if (clearAll || selectedWellIds.length > 0) {
      const wellSelection = clearAll ? patternPlate.getWellIds() : [...selectedWellIds]
      const newPlate = patternPlate.clone();
      const wellsToCheck = patternPlate.getSomeWells(wellSelection.join(';'))
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
      setPatternPlate(newPlate)
    }
  }


  const blockBorderMap = useMemo(() => {
    return calculateBlockBorders(patternPlate);
  }, [patterns, patternPlate.rows, patternPlate.columns]);

  return (
    <Container fluid className='noselect h-100 pb-2'>
      <div
        className='h-100'
      >
        <Row className='h-100' style={{ minHeight: 0 }}>
          <Col md={4} className='d-flex flex-column h-100 overflow-y-auto' style={{ scrollbarGutter: 'stable' }}>
            <PatternManager isEditing={isEditing} setIsEditing={setIsEditing} patterns={patterns} setPatterns={setPatterns} curPatternId={curPatternId} setCurPatternId={setCurPatternId} />
          </Col>
          <Col md={8} className='d-flex flex-column h-100 overflow-y-auto' style={{ scrollbarGutter: 'stable' }}>
            <PlateViewCanvas
              plate={patternPlate}
              view='design'
              colorConfig={colorConfig}
              selectedWells={selectedWellIds}
              handleLabelClick={handleLabelClick}
              blockBorderMap={blockBorderMap}
            />
            <Container>
              <Row>
                <Col>
                  <Button
                    onClick={applyPatternToWells}
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                    disabled={
                      !selectedPattern ||
                      selectedWellIds.length === 0 ||
                      (selectedPattern.type !== 'Unused' && !Number.isInteger(selectedWellIds.length / (selectedPattern.replicates * selectedPattern.concentrations.length))) ||
                      isEditing
                    }
                    className="mt-3 h-75"
                  >
                    Apply Pattern to Selected Wells
                  </Button>
                </Col>
                <Col >
                  <Button
                    onClick={() => clearPatternFromWells()}
                    disabled={selectedWellIds.length === 0}
                    className="mt-3 h-75"
                    variant='danger'
                  >
                    Clear Patterns from Selected Wells
                  </Button>
                </Col>
                <Col >
                  <Button
                    onClick={() => clearPatternFromWells(true)}
                    className="mt-3 h-75"
                    variant='danger'
                  >
                    Clear Patterns from All Wells
                  </Button>
                </Col>
                <Col >
                  <Button
                    onClick={() => generateExcelTemplate(patterns)}
                    className="mt-3 h-75"
                    disabled={patterns.length < 1}
                    variant='success'
                  >
                    Generate Excel Template
                  </Button>
                </Col>
              </Row>
            </Container>
          </Col>
        </Row>
        {applyPopup.msgArr.length > 0 ? <ApplyTooltip data={applyPopup} /> : ''}
      </div>
    </Container>
  );
};

export default DesignWizard;