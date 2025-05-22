import React, { useState, useRef, useEffect, useContext, useCallback, useMemo } from 'react';
import { Container, Row, Col, Button } from 'react-bootstrap';

import PlateView from './PlateView';
import PatternManager from './PatternManager';
import { Plate } from '../classes/PlateClass';
import { Pattern } from '../classes/PatternClass';
import { PatternsContext } from '../contexts/Context';
import { calculateBlockBorders, formatWellBlock, getCoordsFromWellId, mapWellsToConcentrations, numberToLetters } from '../utils/plateUtils';
import { ColorConfig, generatePatternColors } from '../utils/wellColors';
import { generateExcelTemplate } from '../utils/designUtils';

import '../../../css/PlateComponent.css'
import '../../../css/DesignWizard.css'

interface DesignWizardProps {
  patternPlate: Plate;
  setPatternPlate: React.Dispatch<React.SetStateAction<Plate>>;
}

const DesignWizard: React.FC<DesignWizardProps> = ({ patternPlate, setPatternPlate }) => {
  const { patterns, setPatterns, selectedPatternId } = useContext(PatternsContext);
  const [selectedPattern, setSelectedPattern] = useState<Pattern | undefined>(undefined)
  const [colorConfig, setColorConfig] = useState<ColorConfig>({ scheme: 'pattern', colorMap: generatePatternColors(patterns) })
  const [dragging, setDragging] = useState(false);
  const [startPoint, setStartPoint] = useState<Point>({ x: 0, y: 0 });
  const [endPoint, setEndPoint] = useState<Point>({ x: 0, y: 0 });
  const [selectedWells, setSelectedWells] = useState<string[]>([]);
  const wellsRef = useRef<(HTMLDivElement)[]>([]);

  useEffect(() => {
    document.addEventListener('mousedown', (e) => handlePageDblClick(e));
    return () => {
      document.removeEventListener('mousedown', (e) => handlePageDblClick(e));
    };
  }, []);

  //necessary for switching plate sizes and then resetting ref
  useEffect(() => {
    const newPlateSize = patternPlate.columns * patternPlate.rows;
    if (wellsRef.current.length != newPlateSize) {
      wellsRef.current = [];
    }
  },[patternPlate.columns,patternPlate.rows])

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

  useEffect(() => {
    setSelectedPattern(patterns.find(p => p.id == selectedPatternId))
  }, [selectedPatternId, patterns])

  const handlePageDblClick = (e: any) => {
    if (e.detail > 1) {
      setSelectedWells([])
    }
  }

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setDragging(true);
    const start = { x: e.clientX + window.scrollX, y: e.clientY + window.scrollY };
    setStartPoint(start);
    setEndPoint(start) // Initially, endPoint is the same as startPoint
  }, []);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (dragging) {
      setEndPoint({ x: e.clientX + window.scrollX, y: e.clientY + window.scrollY });
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (dragging) {
      setDragging(false);
      let wellArr = checkWellsInSelection();
      let newSelection = [...selectedWells]
      if (!e.shiftKey) {
        setSelectedWells(wellArr)
      }
      else {
        for (let wellId of wellArr) {
          let idx = newSelection.indexOf(wellId)
          if (idx > -1) {
            newSelection.splice(idx, 1)
          }
          else {
            newSelection.push(wellId)
          }
        }
        setSelectedWells(newSelection)
      }
    }
  };

  const handleLabelClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    const targetLabel = target.innerText;
    const isRow = isNaN(parseInt(targetLabel));

    if (!e.shiftKey) {
      setSelectedWells(_ => {
        const newSelection = new Set<string>();
        wellsRef.current.forEach(wellElement => {
          if (wellElement) {
            const wellId = wellElement.getAttribute('data-wellid');
            if (!wellId) return
            const wellCoords = getCoordsFromWellId(wellId);
            const shouldSelect = isRow
              ? numberToLetters(wellCoords.row) === targetLabel
              : (wellCoords.col + 1).toString() === targetLabel;

            if (shouldSelect) {
              newSelection.add(wellId);
            }
          }
        });
        return Array.from(newSelection);
      });
    }
    else {
      setSelectedWells(prevSelected => {
        const newSelection = new Set(prevSelected);
        wellsRef.current.forEach(wellElement => {
          if (wellElement) {
            const wellId = wellElement.getAttribute('data-wellid');
            if (!wellId) return
            const wellCoords = getCoordsFromWellId(wellId);
            const shouldSelect = isRow
              ? numberToLetters(wellCoords.row) === targetLabel
              : (wellCoords.col + 1).toString() === targetLabel;
            if (shouldSelect) {
              if (newSelection.has(wellId)) {
                newSelection.delete(wellId);
              } else {
                newSelection.add(wellId);
              }
            }
          }
        });
        return Array.from(newSelection);
      });
    }
  }, [wellsRef]);

  interface Point {
    x: number;
    y: number;
  }

  interface Rectangle {
    left: number;
    top: number;
    right: number;
    bottom: number;
  }

  const rectanglesOverlap = (rect1: Rectangle, rect2: Rectangle): boolean => {
    return !(rect1.right < rect2.left ||
      rect1.left > rect2.right ||
      rect1.bottom < rect2.top ||
      rect1.top > rect2.bottom);
  };

  const checkWellsInSelection = (): string[] => {
    const wellArr: string[] = [];
    const selectionRect: Rectangle = {
      left: Math.min(startPoint.x, endPoint.x),
      top: Math.min(startPoint.y, endPoint.y),
      right: Math.max(startPoint.x, endPoint.x),
      bottom: Math.max(startPoint.y, endPoint.y)
    };
    wellsRef.current.forEach(wellElement => {
      if (wellElement) {
        const rect = wellElement.getBoundingClientRect();
        const wellRect: Rectangle = {
          left: rect.left + window.scrollX,
          top: rect.top + window.scrollY,
          right: rect.right + window.scrollX,
          bottom: rect.bottom + window.scrollY
        };

        if (rectanglesOverlap(wellRect, selectionRect)) {
          const wellId = wellElement.getAttribute('data-wellid');
          if (wellId) {
            wellArr.push(wellId);
          }
        }
      }
    });

    return wellArr;
  };

  const applyPatternToWells = () => {
    if (selectedPatternId && selectedWells.length > 0) {
      const pattern = patterns.find(p => p.id == selectedPatternId)
      if (pattern) {
        const newPattern = pattern.clone()
        const newPlate = patternPlate.clone();
        
        // Handle Unused pattern differently
        if (pattern.type === 'Unused') {
          // For unused patterns, just apply to all selected wells as one block
          const block = formatWellBlock(selectedWells);
          
          // Check for overlaps
          if (isBlockOverlapping(patternPlate, block, newPattern.locations)) {
            alert(`The selected wells overlap with existing patterns. Please choose different wells.`);
            return;
          }
          
          newPlate.applyPattern(block, newPattern);
          newPattern.locations.push(block);
          
          setPatternPlate(newPlate);
          setPatterns(patterns.map(p => p.id === newPattern.id ? newPattern : p));
          return;
        }
        
        // Original logic for non-Unused patterns
        const patternSize = newPattern.replicates * newPattern.concentrations.length;
  
        //shouldn't be possible, but as a fallback
        if (selectedWells.length % patternSize !== 0) {
          alert(`The number of selected wells must be a multiple of ${patternSize} (replicates * concentrations).`);
          return;
        }
  
        const blocks = splitIntoBlocks(selectedWells, newPattern, patternPlate);
  
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
  
  const splitIntoBlocks = (wells: string[], pattern: Pattern, plate: Plate): string[] => {
    if (pattern.type === 'Unused') {
      return [formatWellBlock(wells)];
    }
    const concentrations = pattern.concentrations.filter(c => c != null)
    const concentrationCount = pattern.concentrations.length;
    const wellsPerConcentration = wells.length / concentrationCount;

    if (wellsPerConcentration % 1 !== 0) {
      throw new Error("The number of wells must be divisible by the number of concentrations.");
    }

    const patternReplicates = wellsPerConcentration / pattern.replicates;

    if (patternReplicates % 1 !== 0) {
      throw new Error("The number of wells per concentration must be divisible by the original number of replicates.");
    }

    // Map wells to concentrations based on the pattern
    const wellConcentrationArr = mapWellsToConcentrations(
      plate,
      formatWellBlock(wells),
      concentrations,
      wellsPerConcentration,
      pattern.direction[0]
    );

    // Split into blocks
    const blocks: string[] = [];

    for (let i = 0; i < patternReplicates; i++) {
      const block: string[] = [];
      for (const concIdx in concentrations) {
        const startIndex = i * pattern.replicates;
        const endIndex = startIndex + pattern.replicates;
        block.push(...wellConcentrationArr[concIdx].slice(startIndex, endIndex))
      }
      blocks.push(formatWellBlock(block));
    }
    return blocks;
  };

  const isBlockOverlapping = (plate: Plate, newBlock: string, existingLocations: string[]): boolean => {
    const newWells = plate.getSomeWells(newBlock)
    for (const location of existingLocations) {
      const existingWells = plate.getSomeWells(location)
      for (const well of existingWells) {
        if (newWells.includes(well)) {
          return true
        }
      }
    }
    return false;
  };

  const clearPatternFromWells = () => {
    if (selectedWells.length > 0) {
      const newPlate = patternPlate.clone();
      const wellsToCheck = patternPlate.getSomeWells(selectedWells.join(';'))
      const patternNamesToCheck = [...new Set(wellsToCheck.flatMap(w => w.getPatterns()))]
      if (wellsToCheck.some(w => w.getIsUnused() == true)) {
        const unusedPatterns = patterns.filter(p => p.type === 'Unused')
        patternNamesToCheck.push(...unusedPatterns.map(p => p.name))
      }
      const newPatternArr: Pattern[] = []
      for (const patternName of patternNamesToCheck) {
        const pattern = patterns.find(p => p.name == patternName)
        console.log(pattern,patterns)
        if (pattern) {
          const newPattern = pattern.clone()
          console.log(newPattern)
          for (const loc of pattern.locations) {
            if (isBlockOverlapping(newPlate, selectedWells.join(';'), [loc])) {
              newPlate.removePattern(loc, patternName)
              newPattern.locations = newPattern.locations.filter(l => !(l == loc))
            }
          }
          newPatternArr.push(newPattern)
          //setPatterns(patterns.map(p => p.id === newPattern.id ? newPattern : p));
        }
      }
      console.log(patterns)
      const newPatterns = patterns.map(p => newPatternArr.find(n => n.id == p.id) ? newPatternArr.find(n => n.id == p.id)! : p)
      setPatterns(newPatterns)
      setPatternPlate(newPlate)
    }
  }

  const selectionStyle = {
    left: Math.min(startPoint.x, endPoint.x),
    top: Math.min(startPoint.y, endPoint.y),
    width: Math.abs(startPoint.x - endPoint.x),
    height: Math.abs(startPoint.y - endPoint.y),
  };

  
  const blockBorderMap = useMemo(() => {
    return calculateBlockBorders(patternPlate);
  }, [patterns, patternPlate.rows, patternPlate.columns]);

  return (
    <Container fluid className='noselect'>
      <div
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        <Row>
          <Col md="3">
            <PatternManager />
          </Col>
          <Col md="7">
            <PlateView
              plate={patternPlate}
              view='design'
              colorConfig={colorConfig}
              selectedWells={selectedWells}
              handleLabelClick={handleLabelClick}
              handleMouseDown={handleMouseDown}
              blockBorderMap={blockBorderMap}
              selectionStyle={dragging ? selectionStyle : undefined}
              ref={wellsRef}
            />
            <div className='pattern-buttons'>
              <Button
                onClick={applyPatternToWells}
                disabled={
                  !selectedPattern || 
                  selectedWells.length === 0 || 
                  (selectedPattern.type !== 'Unused' && !Number.isInteger(selectedWells.length / (selectedPattern.replicates * selectedPattern.concentrations.length)))
                }
                className="mt-3"
              >
                Apply Pattern to Selected Wells
              </Button>
              <Button
                onClick={clearPatternFromWells}
                disabled={selectedWells.length === 0}
                className="mt-3"
                variant='danger'
              >
                Clear Patterns from Selected Wells
              </Button>
              <Button
                onClick={() => generateExcelTemplate(patterns)}
                className="mt-3"
                disabled={patterns.length < 1}
                variant='success'
              >
                Generate Excel Template
              </Button>
            </div>
          </Col>

        </Row>
      </div>
    </Container>
  );
};

export default DesignWizard;