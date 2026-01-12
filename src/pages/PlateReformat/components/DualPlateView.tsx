import React, { useCallback, useRef, useEffect } from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import PlateView from '../../../components/PlateView';
import { Plate } from '../../../classes/PlateClass';
import { formatWellBlock, getCoordsFromWellId, numberToLetters, type TransferBlock } from '../../../utils/plateUtils';
import { checkWellsInSelection } from '../../../utils/designUtils';
import { getPlateColorAndBorders } from '../utils/reformatUtils';
import '../../../css/PlateComponent.css';

interface DualPlateViewProps {
  sourcePlate: Plate
  destPlate: Plate
  selectedSrcWells: string[];
  setSelectedSrcWells: React.Dispatch<React.SetStateAction<string[]>>
  selectedDstWells: string[];
  setSelectedDstWells: React.Dispatch<React.SetStateAction<string[]>>
  sourceLabel?: string;
  destLabel?: string;
  transferBlocks?: TransferBlock[];
}

const DualPlateView: React.FC<DualPlateViewProps> = ({
  sourcePlate,
  destPlate,
  selectedSrcWells,
  setSelectedSrcWells,
  selectedDstWells,
  setSelectedDstWells,
  sourceLabel = "Source Plate",
  destLabel = "Destination Plate",
  transferBlocks = []
}) => {

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
      setSelectedSrcWells(prev => (prev.length ? [] : prev));
      setSelectedDstWells(prev => (prev.length ? [] : prev));
    }
  }, [])

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
      let selectorQuery = parentPlate.getAttribute('data-view')
      if (!selectorQuery) return
      selectorQuery = selectorQuery.split("-")[1]
      const wells = parentPlate.querySelectorAll('[data-wellid]')
      let wellArr = checkWellsInSelection({ x: dragState.current.startX, y: dragState.current.startY }, { x: dragState.current.endX, y: dragState.current.endY }, wells);
      switch (selectorQuery) {
        case "source": {
          selectorHelper(e, wellArr, selectedSrcWells, setSelectedSrcWells)
          break
        }
        case "destination": {
          selectorHelper(e, wellArr, selectedDstWells, setSelectedDstWells)
          break
        }
      }
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
    let selectorQuery = parentPlate.getAttribute('data-view')
    if (!selectorQuery) return
    selectorQuery = selectorQuery.split("-")[1]
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
    switch (selectorQuery) {
      case "source": {
        if (target.className.includes('all-wells-container') && Array.from(newSelection).length == selectedSrcWells.length) {
          newSelection.clear()
        }
        selectorHelper(e, Array.from(newSelection), selectedSrcWells, setSelectedSrcWells)
        break
      }
      case "destination": {
        if (target.className.includes('all-wells-container') && Array.from(newSelection).length == selectedDstWells.length) {
          newSelection.clear()
        }
        selectorHelper(e, Array.from(newSelection), selectedDstWells, setSelectedDstWells)
        break
      }
    }

  }
  const {colorConfig: sourceColorConfig, borderMap: sourceBorderMap} = getPlateColorAndBorders(sourcePlate,transferBlocks,'source')
  const {colorConfig: destColorConfig, borderMap: destBorderMap} = getPlateColorAndBorders(destPlate,transferBlocks,'destination')
  
  return (
    <Container fluid>
      <Row>
        <Col md={6}>
          <div className="plate-container">
            <h5 className="text-center mb-3">
              {sourceLabel}
              {sourcePlate && ` (${sourcePlate.barcode || 'No Barcode'})`}
            </h5>

            <PlateView
              plate={sourcePlate}
              view="reformatter-source"
              colorConfig={sourceColorConfig}
              selectedWells={selectedSrcWells}
              handleLabelClick={handleLabelClick}
              handleMouseDown={handleMouseDown}
              handleMouseMove={handleMouseMove}
              handleMouseUp={handleMouseUp}
              blockBorderMap={sourceBorderMap}
            />
            {selectedSrcWells.length > 0 && (
              <div className="text-center text-muted small mb-2">
                Selected: {formatWellBlock(selectedSrcWells)}
              </div>
            )}
          </div>
        </Col>

        <Col md={6}>
          <div className="plate-container">
            <h5 className="text-center mb-3">
              {destLabel}
              {destPlate && ` (${destPlate.barcode || 'No Barcode'})`}
            </h5>

            <PlateView
              plate={destPlate}
              view="reformatter-destination"
              colorConfig={destColorConfig}
              selectedWells={selectedDstWells}
              handleLabelClick={handleLabelClick}
              handleMouseDown={handleMouseDown}
              handleMouseMove={handleMouseMove}
              handleMouseUp={handleMouseUp}
              blockBorderMap={destBorderMap}
            />
            {selectedDstWells.length > 0 && (
              <div className="text-center text-muted small mb-2">
                Selected: {formatWellBlock(selectedDstWells)}
              </div>
            )}
          </div>
          <div ref={selectionRef} style={{ position: 'absolute', pointerEvents: 'none', display: 'none' }} />
        </Col>
      </Row>
    </Container>
  );
};

export default DualPlateView;