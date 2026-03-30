import React, { useEffect, useRef, useState } from 'react';
import { Col, Row, Tabs, Tab } from 'react-bootstrap';
import { Plate, PlateSize } from '../../classes/PlateClass.ts';
import { Pattern } from '../../classes/PatternClass.ts';
import { usePreferences } from '../../hooks/usePreferences';
import DesignWizardDst from './components/DesignWizardDst.tsx';
import { labelDrag, selectorHelper } from '../../utils/designUtils.ts';
import { currentPlate, getCoordsFromWellId, getWellIdFromCoords, numberToLetters } from '../../utils/plateUtils.ts';
import DesignWizardSrc from './components/DesignWizardSrc.tsx';
import Sidebar from '../../components/Sidebar.tsx';

const PlateDesigner: React.FC = () => {
  const { preferences } = usePreferences()
  const [tabKey, setTabKey] = useState<string>('designDst');
  const [designSrcPlates, setDesignSrcPlates] = useState<Plate[]>([new Plate({ barcode: 'SRC001', plateSize: preferences.sourcePlateSize as PlateSize })]);
  const [designDstPlates, setDesignDstPlates] = useState<Plate[]>([new Plate({ barcode: 'DST001', plateSize: preferences.destinationPlateSize as PlateSize })]);
  const [curDesignSrcPlateId, setCurDesignSrcPlateId] = useState<number | null>(designSrcPlates[0] ? designSrcPlates[0].id || null : null)
  const [curDesignDstPlateId, setCurDesignDstPlateId] = useState<number | null>(designDstPlates[0] ? designDstPlates[0].id || null : null)
  const [curPatternId, setCurPatternId] = useState<number | null>(null)
  const [selectedWellIds, setSelectedWellIds] = useState<string[]>([])
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [patternState, setPatternState] = useState({ isEditing: false, isNewPattern: false, isPickingColor: false })
  //implement plate size selection directly instead of relying on preferences
  //@ts-ignore
  const [designSrcPlateSize, setDesignSrcPlateSize] = useState(preferences.sourcePlateSize as PlateSize)

  const selectionRef = useRef<HTMLDivElement | null>(null);
  const dragState = useRef({ mouseDown: false, dragging: false, startX: 0, startY: 0, endX: 0, endY: 0 });

  useEffect(() => {
    document.addEventListener("mousedown", handlePageDblClick);
    return () => {
      document.removeEventListener("mousedown", handlePageDblClick);
    };
  }, []);

  const renderSidebar = () => {
    if (tabKey === 'designDst') {
      return (

        <Sidebar
          items={patterns.map(pattern => ({
            id: pattern.id,
            name: pattern.name,
            type: pattern.type,
            details: {
              rep: pattern.replicates,
              con: pattern.concentrations.length,
            },
          }))}
          selectedItemId={curPatternId}
          setSelectedItemId={setCurPatternId}
          title="Patterns"
          onAddItem={handleAddPattern}
          onDeleteItem={handleDeletePattern}
        />
      );
    } else if (tabKey === 'designSrc') {
      return (
        <Sidebar
          items={designSrcPlates.map(plate => ({
            id: plate.id,
            name: plate.barcode || `Plate ${plate.id}`,
            type: plate.plateRole,
            details: {
              items: Object.values(plate.wells).filter(well => well.getContents().length > 0).length,
            },
          }))}
          selectedItemId={curDesignSrcPlateId}
          setSelectedItemId={setCurDesignSrcPlateId}
          title="Plates"
          onAddItem={handleAddPlate}
          onDeleteItem={handleDeletePlate}
        />
      );
    }
    return (
      <div />
    );
  };

  const handleAddPattern = () => {
    let iter = patterns.length + 1;
    while (patterns.find(p => p.name == `Pattern ${iter}`)) {
      iter += 1
    }
    const name = `Pattern ${iter}`
    const newPattern = new Pattern({
      name: name,
      type: 'Treatment',
      replicates: 1,
      direction: ['LR'],
      concentrations: [null],
      locations: []
    });
    setPatterns([...patterns, newPattern]);
    setCurPatternId(newPattern.id);
    setPatternState({ isEditing: true, isNewPattern: true, isPickingColor: false })
  };

  const handleDeletePattern = (patternId: number) => {
    const pattern = patterns.find(p => p.id === patternId);
    if (pattern) {
      const newPlate = designDstPlates[0].clone();
      for (const loc of pattern.locations) {
        newPlate.removePattern(loc, pattern.name);
      }
      setDesignDstPlates([newPlate]);
    }
    setPatterns(patterns.filter(p => p.id !== patternId));
    if (curPatternId === patternId) {
      setCurPatternId(null);
    }
  }

  const handleAddPlate = () => {
    let iter = designSrcPlates.length + 1;
    while (designSrcPlates.find(p => p.barcode == `SRC${iter.toString().padStart(3,'0')}`) != undefined) {
      iter += 1
    }
    const barcode = `SRC${iter.toString().padStart(3,'0')}`;
    const newPlate = new Plate({barcode: barcode, plateSize: preferences.destinationPlateSize as PlateSize})
    setDesignSrcPlates([...designSrcPlates,newPlate])
    setCurDesignSrcPlateId(newPlate.id)
  }

  const handleDeletePlate = (plateId: number) => {
    const remainingSrcPlates = designSrcPlates.filter(p => p.id !== plateId)
    if (remainingSrcPlates.length < 1) {
      const newPlate = new Plate({barcode: 'SRC001', plateSize: designSrcPlateSize})
      setDesignSrcPlates([newPlate])
      setCurDesignSrcPlateId(newPlate.id)
    }
    else {
      setDesignSrcPlates([...remainingSrcPlates])
    }
    if (curDesignSrcPlateId === plateId) {
      setCurDesignSrcPlateId(null)
    }
  }

  const handlePageDblClick = (e: MouseEvent) => {
    if (e.detail > 1) {
      e.preventDefault();
      setSelectedWellIds(prev => (prev.length ? [] : prev));
    }
  };

  const handleSelect = (k: string | null) => {
    if (k !== null) {
      setTabKey(k);
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
    let plate: Plate | null = null
    switch (tabKey) {
      case "designDst":
        plate = currentPlate(designDstPlates, curDesignDstPlateId)
        break;
      case "designSrc":
        plate = currentPlate(designSrcPlates, curDesignSrcPlateId)
        break;
      default:
        plate = null;
    }
    if (!plate) return;

    const region = {
      x1: Math.min(dragState.current.startX, dragState.current.endX),
      y1: Math.min(dragState.current.startY, dragState.current.endY),
      x2: Math.max(dragState.current.startX, dragState.current.endX),
      y2: Math.max(dragState.current.startY, dragState.current.endY)
    };
    const startEl = document.elementFromPoint(region.x1, region.y1)
    const endEl = document.elementFromPoint(region.x2, region.y2)
    const labelWells = labelDrag(startEl, endEl, plate)
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

    const parentPlate = target.closest("[data-view]");
    if (!parentPlate) return;

    let plate: Plate | null = null
    switch (tabKey) {
      case "designDst":
        plate = currentPlate(designDstPlates, curDesignDstPlateId)
        break;
      case "designSrc":
        plate = currentPlate(designSrcPlates, curDesignSrcPlateId)
        break;
      default:
        plate = null;
    }

    if (!plate) return

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

  if (patterns.length === 0) handleAddPattern()

  return (
    <div>
      <Row>
        <Col md="2">{renderSidebar()}</Col>
        <Col md="10" style={{ minHeight: 0 }}
          onMouseMove={handleMouseSelectionMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp} //kill the selection rectangle as we can't detect mouseup on, say, the nav bar
        >
          <div className="page-tabs">
            <Tabs
              id="design-tab-select"
              activeKey={tabKey}
              onSelect={handleSelect}
              mountOnEnter
            >
              <Tab eventKey="designDst" title="Design - Destination">
                <DesignWizardDst
                  designDstPlates={designDstPlates}
                  setDesignDstPlates={setDesignDstPlates}
                  curDesignDstPlateId={curDesignDstPlateId}
                  setCurDesignDstPlateId={setCurDesignDstPlateId}
                  patterns={patterns}
                  setPatterns={setPatterns}
                  curPatternId={curPatternId}
                  selectedWellIds={selectedWellIds}
                  handleLabelClick={handleLabelClick}
                  handleMouseDown={handleMouseDown}
                  patternState={patternState}
                  setPatternState={setPatternState}
                />
              </Tab>
              <Tab eventKey="designSrc" title="Design - Source">
                <DesignWizardSrc
                  designSrcPlates={designSrcPlates}
                  setDesignSrcPlates={setDesignSrcPlates}
                  curDesignSrcPlateId={curDesignSrcPlateId}
                  patterns={patterns}
                  selectedWellIds={selectedWellIds}
                  handleLabelClick={handleLabelClick}
                  handleMouseDown={handleMouseDown}
                />
              </Tab>
            </Tabs>
          </div>
        </Col>
      </Row>
      <div ref={selectionRef} style={{ position: "absolute", pointerEvents: "none", display: "none" }} />
    </div>
  )
}

export default PlateDesigner;