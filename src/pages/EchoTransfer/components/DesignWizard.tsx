import React, { useState, useRef, useEffect, useContext, useCallback, useMemo } from 'react';
import { Container, Row, Col, Button } from 'react-bootstrap';

import PlateView from '../../../components/PlateView';
import PatternManager from './PatternManager';
import { Plate } from '../../../classes/PlateClass';
import { Pattern } from '../../../classes/PatternClass';
import { PatternsContext } from '../../../contexts/Context';
import { calculateBlockBorders, formatWellBlock, getCoordsFromWellId, numberToLetters, splitIntoBlocks } from '../../../utils/plateUtils';
import { ColorConfig, generatePatternColors } from '../../../utils/wellColors';
import { checkWellsInSelection, generateExcelTemplate, getPatternWells, isBlockOverlapping, mergeUnusedPatternLocations, sensibleWellSelection } from '../../../utils/designUtils';

import '../../../css/PlateComponent.css'
import '../../../css/DesignWizard.css'
import ApplyTooltip from './ApplyTooltip';

interface DesignWizardProps {
  patternPlate: Plate;
  setPatternPlate: React.Dispatch<React.SetStateAction<Plate>>;
}

const DesignWizard: React.FC<DesignWizardProps> = ({ patternPlate, setPatternPlate }) => {
  const { patterns, setPatterns, selectedPatternId } = useContext(PatternsContext);
  const [selectedPattern, setSelectedPattern] = useState<Pattern | undefined>(undefined)
  const [colorConfig, setColorConfig] = useState<ColorConfig>({ scheme: 'pattern', colorMap: generatePatternColors(patterns) })
  const [isEditing, setIsEditing] = useState(false);
  const [selectedWells, setSelectedWells] = useState<string[]>([]);
  const [applyPopup, setApplyPopup] = useState<{ event: React.MouseEvent | null, msgArr: string[] }>({ event: null, msgArr: [] })

  const selectionRef = useRef<HTMLDivElement | null>(null);
  const dragState = useRef({ dragging: false, startX: 0, startY: 0, endX: 0, endY: 0 });

  useEffect(() => {
    document.addEventListener('mousedown', handlePageDblClick, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handlePageDblClick);
    };
  }, []);

  const handlePageDblClick = useCallback((e: any) => {
    if (e.detail > 1) {
      setSelectedWells(prev => (prev.length ? [] : prev));
    }
  }, [])

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

  const handleMouseEnter = (e: React.MouseEvent) => {
    const msgArr = sensibleWellSelection(selectedWells, patterns.find(p => p.id == selectedPatternId)!, patternPlate)
    setApplyPopup({ event: e, msgArr: msgArr })
  };

  const handleMouseLeave = () => {
    setApplyPopup({ event: null, msgArr: [] });
  };

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const start = { x: e.clientX + window.scrollX, y: e.clientY + window.scrollY };

    dragState.current.dragging = true;
    dragState.current.startX = start.x;
    dragState.current.startY = start.y
    dragState.current.endX = start.x
    dragState.current.endY = start.y
    const el = selectionRef.current;
    if (el) {
      el.style.display = 'block';
      el.style.left = `${start.x}px`;
      el.style.top = `${start.y}px`;
      el.style.width = '0px';
      el.style.height = '0px';
      el.className = 'selection-rectangle';
    }
  }, []);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragState.current.dragging) return
    dragState.current.endX = e.clientX + window.scrollX
    dragState.current.endY = e.clientY + window.scrollY
    const left = Math.min(dragState.current.startX, dragState.current.endX)
    const top = Math.min(dragState.current.startY, dragState.current.endY)
    const width = Math.abs(dragState.current.startX - dragState.current.endX)
    const height = Math.abs(dragState.current.startY - dragState.current.endY)
    const el = selectionRef.current;
    if (el) {
      el.style.left = `${left}px`;
      el.style.top = `${top}px`;
      el.style.width = `${width}px`;
      el.style.height = `${height}px`;
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!dragState.current.dragging) return
    dragState.current.dragging = false
    const el = selectionRef.current;
    if (el) el.style.display = 'none';

    const startWell = document.elementFromPoint(dragState.current.startX, dragState.current.startY)
    if (startWell && startWell.closest("[data-view]")) {
      const parentPlate = startWell.closest("[data-view]")
      if (!parentPlate) return
      const wells = parentPlate.querySelectorAll('[data-wellid]')
      let wellArr = checkWellsInSelection({ x: dragState.current.startX, y: dragState.current.startY }, { x: dragState.current.endX, y: dragState.current.endY }, wells);
      selectorHelper(e, wellArr, selectedWells, setSelectedWells)
    }
  };


  const selectorHelper = useCallback((e: React.MouseEvent, wellArr: string[], selectedWells: string[], setSelectedWells: React.Dispatch<React.SetStateAction<string[]>>) => {
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
  }, [])

  const handleLabelClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const newSelection = new Set<string>();
    const target = e.target as HTMLDivElement;
    const targetLabel = target.innerText;
    const parentPlate = target.closest("[data-view]")
    if (!parentPlate) return
    const wells = parentPlate.querySelectorAll('[data-wellid]')
    wells.forEach(wellElement => {
      if (!wellElement) return
      const wellId = wellElement.getAttribute('data-wellid')
      if (!wellId) return
      if (target.className.includes('all-wells-container')) {
        newSelection.add(wellId)
      }
      else {
        const wellCoords = getCoordsFromWellId(wellId)
        const shouldSelect = isNaN(parseInt(targetLabel))
          ? numberToLetters(wellCoords.row) === targetLabel
          : (wellCoords.col + 1).toString() === targetLabel;

        if (shouldSelect) {
          newSelection.add(wellId);
        }
      }
    })

        if (target.className.includes('all-wells-container') && Array.from(newSelection).length == selectedWells.length) {
          newSelection.clear()
        }
        selectorHelper(e, Array.from(newSelection), selectedWells, setSelectedWells)


  }

  const applyPatternToWells = () => {
    if (selectedPatternId && selectedWells.length > 0) {
      const pattern = patterns.find(p => p.id == selectedPatternId)
      if (pattern) {
        const newPattern = pattern.clone()
        const newPlate = patternPlate.clone();
        if (pattern.type === 'Unused') {
          for (const wellId of selectedWells) {
            const well = newPlate.getWell(wellId);
            if (well && well.getContents().length > 0) {
              alert(`Cannot mark wells as unused - they contain other patterns. Please clear them first.`);
              return;
            }
          }
          const mergedBlock = mergeUnusedPatternLocations(newPattern, newPlate, selectedWells);
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

  const clearPatternFromWells = (clearAll?: boolean) => {
    if (clearAll || selectedWells.length > 0) {
      const wellSelection = clearAll ? patternPlate.getWellIds() : [...selectedWells]
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
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        className='h-100'
      >
      <Row className='h-100' style={{ minHeight: 0 }}>
        <Col md={4} className='d-flex flex-column h-100 overflow-y-auto' style={{ scrollbarGutter: 'stable' }}>
            <PatternManager isEditing={isEditing} setIsEditing={setIsEditing}/>
          </Col>
          <Col md={8} className='d-flex flex-column h-100 overflow-y-auto' style={{ scrollbarGutter: 'stable' }}>
            <PlateView
              plate={patternPlate}
              view='design'
              colorConfig={colorConfig}
              selectedWells={selectedWells}
              handleLabelClick={handleLabelClick}
              handleMouseDown={handleMouseDown}
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
                      selectedWells.length === 0 ||
                      (selectedPattern.type !== 'Unused' && !Number.isInteger(selectedWells.length / (selectedPattern.replicates * selectedPattern.concentrations.length))) ||
                      isEditing
                    }
                    className="mt-3 h-75"
                  >
                    Apply Pattern to Selected Wells
                  </Button>
                </Col>
                <Col >
                  <Button
                    onClick={() => clearPatternFromWells() }
                    disabled={selectedWells.length === 0}
                    className="mt-3 h-75"
                    variant='danger'
                  >
                    Clear Patterns from Selected Wells
                  </Button>
                </Col>
                <Col >
                  <Button
                    onClick={() => clearPatternFromWells(true) }
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
        {applyPopup.msgArr.length > 0 ? <ApplyTooltip data={applyPopup}/> : ''}
        <div ref={selectionRef} style={{ position: 'absolute', pointerEvents: 'none', display: 'none' }} />
      </div>
    </Container>
  );
};

export default DesignWizard;