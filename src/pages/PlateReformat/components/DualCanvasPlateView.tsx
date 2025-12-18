import React, { useRef, useEffect } from "react";
import { Row, Col } from "react-bootstrap";
import PlateViewCanvas from "../../../components/PlateViewCanvas";
import { Plate } from "../../../classes/PlateClass";
import { formatWellBlock, getCoordsFromWellId, getWellIdFromCoords, numberToLetters, type TransferBlock } from "../../../utils/plateUtils";
import { getPlateColorAndBorders } from "../../../utils/designUtils";
//import "../../../css/PlateComponent.css";

interface DualPlateViewProps {
  sourcePlate: Plate;
  destPlate: Plate;
  selectedSrcWells: string[];
  setSelectedSrcWells: React.Dispatch<React.SetStateAction<string[]>>;
  selectedDstWells: string[];
  setSelectedDstWells: React.Dispatch<React.SetStateAction<string[]>>;
  sourceLabel?: string;
  destLabel?: string;
  transferBlocks?: TransferBlock[];
}


const DualCanvasPlateView: React.FC<DualPlateViewProps> = ({
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
    document.addEventListener("mousedown", handlePageDblClick, { passive: true });
    return () => {
      document.removeEventListener("mousedown", handlePageDblClick);
    };
  }, []);

  const handlePageDblClick = (e: any) => {
    if (e.detail > 1) {
      setSelectedSrcWells(prev => (prev.length ? [] : prev));
      setSelectedDstWells(prev => (prev.length ? [] : prev));
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const start = { x: e.clientX + window.scrollX, y: e.clientY + window.scrollY };

    dragState.current.dragging = true;
    dragState.current.startX = start.x;
    dragState.current.startY = start.y;
    dragState.current.endX = start.x;
    dragState.current.endY = start.y;

    const el = selectionRef.current;
    if (el) {
      el.style.display = "block";
      el.style.left = `${start.x}px`;
      el.style.top = `${start.y}px`;
      el.style.width = "0px";
      el.style.height = "0px";
      el.className = "selection-rectangle";
    }
  };

  const handleMouseSelectionMove = (e: React.MouseEvent) => {
    if (!dragState.current.dragging) return;

    dragState.current.endX = e.clientX + window.scrollX;
    dragState.current.endY = e.clientY + window.scrollY;

    const left = Math.min(dragState.current.startX, dragState.current.endX);
    const top = Math.min(dragState.current.startY, dragState.current.endY);
    const width = Math.abs(dragState.current.startX - dragState.current.endX);
    const height = Math.abs(dragState.current.startY - dragState.current.endY);

    const el = selectionRef.current;
    if (el) {
      el.style.left = `${left}px`;
      el.style.top = `${top}px`;
      el.style.width = `${width}px`;
      el.style.height = `${height}px`;
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!dragState.current.dragging) return;
    dragState.current.dragging = false;
    const parent = (e.target as HTMLElement).closest("[data-view]");
    if (!parent) return;

    const selectorQuery = parent.getAttribute("data-view")?.split("-")[1];
    if (!selectorQuery) return;

    const plate = selectorQuery === "source" ? sourcePlate : destPlate;
    const selected = selectorQuery === "source" ? selectedSrcWells : selectedDstWells;
    const setSelected = selectorQuery === "source" ? setSelectedSrcWells : setSelectedDstWells;

    const el = selectionRef.current;
    if (el) el.style.display = "none";

    const region = {
      x1: Math.min(dragState.current.startX, dragState.current.endX),
      y1: Math.min(dragState.current.startY, dragState.current.endY),
      x2: Math.max(dragState.current.startX, dragState.current.endX),
      y2: Math.max(dragState.current.startY, dragState.current.endY)
    };

    const rect = e.currentTarget.getBoundingClientRect();
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
    selectorHelper(e, newSelected, selected, setSelected);
  };

  const selectorHelper = (e: React.MouseEvent, newSelected: string[], selectedWells: string[], setSelectedWells: React.Dispatch<React.SetStateAction<string[]>>) => {
    let newSelection = [...selectedWells]
    if (!e.shiftKey) {
      setSelectedWells(newSelected)
    }
    else {
      for (let wellId of newSelected) {
        let idx = newSelection.indexOf(wellId)
        if (idx > -1) {
          newSelection.splice(idx, 1)
        }
        else {
          newSelection.push(wellId)
        }
      }
      newSelection.sort((a,b) => {
        const aCoords = getCoordsFromWellId(a)
        const bCoords = getCoordsFromWellId(b)
        const rowComp = aCoords.row - bCoords.row
        if (rowComp === 0) {
          return aCoords.col - bCoords.col
        }
        return rowComp
      })
      setSelectedWells(newSelection)
    }
  }

  const handleLabelClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    const targetLabel = target.innerText;

    const parentPlate = target.closest("[data-view]");
    if (!parentPlate) return;

    const selectorQuery = parentPlate.getAttribute("data-view")?.split("-")[1];
    if (!selectorQuery) return;

    const plate = selectorQuery === "source" ? sourcePlate : destPlate;
    const selected = selectorQuery === "source" ? selectedSrcWells : selectedDstWells;
    const setSelected = selectorQuery === "source" ? setSelectedSrcWells : setSelectedDstWells;

    const newSelected: string[] = [];

    if (target.className.includes("all-wells-container")) {
      for (let r = 0; r < plate.rows; r++) {
        for (let c = 0; c < plate.columns; c++) {
          newSelected.push(getWellIdFromCoords(r, c));
        }
      }

      if (newSelected.length === selected.length) newSelected.length = 0;
      setSelected(newSelected);
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

    selectorHelper(e, newSelected, selected, setSelected)
  };

  const { colorConfig: sourceColorConfig, borderMap: sourceBorderMap } = getPlateColorAndBorders(sourcePlate, transferBlocks, "source");
  const { colorConfig: destColorConfig, borderMap: destBorderMap } = getPlateColorAndBorders(destPlate, transferBlocks, "destination");

  return (
    <div>
      <Row>
        <Col md={6}>
          <h5 className="text-center mb-3">
            {sourceLabel} {sourcePlate && ` (${sourcePlate.barcode || "No Barcode"})`}
          </h5>

          <PlateViewCanvas
            plate={sourcePlate}
            view="reformatter-source"
            colorConfig={sourceColorConfig}
            selectedWells={selectedSrcWells}
            handleLabelClick={handleLabelClick}
            handleMouseDown={handleMouseDown}
            handleMouseSelectionMove={handleMouseSelectionMove}
            handleMouseUp={handleMouseUp}
            blockBorderMap={sourceBorderMap}
          />


          {selectedSrcWells.length > 0 && (
            <div className="text-center text-muted small mb-2">
              Selected: {formatWellBlock(selectedSrcWells)}
            </div>
          )}
        </Col>
        <Col md={6}>

          <h5 className="text-center mb-3">
            {destLabel} {destPlate && ` (${destPlate.barcode || "No Barcode"})`}
          </h5>

          <PlateViewCanvas
            plate={destPlate}
            view="reformatter-destination"
            colorConfig={destColorConfig}
            selectedWells={selectedDstWells}
            handleLabelClick={handleLabelClick}
            handleMouseDown={handleMouseDown}
            handleMouseSelectionMove={handleMouseSelectionMove}
            handleMouseUp={handleMouseUp}
            blockBorderMap={destBorderMap}
          />

          {selectedDstWells.length > 0 && (
            <div className="text-center text-muted small mb-2">
              Selected: {formatWellBlock(selectedDstWells)}
            </div>
          )}
        </Col>
      </Row>
      <div ref={selectionRef} style={{ position: "absolute", pointerEvents: "none", display: "none" }} />
    </div>

  );
};

export default DualCanvasPlateView;
