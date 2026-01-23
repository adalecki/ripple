import { Row, Col } from 'react-bootstrap';
import { useEffect, useRef, useState } from 'react';
import { Plate, PlateSize } from '../../classes/PlateClass';
import PlateList from './components/PlateList';
import { currentPlate, getWellIdFromCoords, type TransferBlock } from '../../utils/plateUtils';
import TransferBox from './components/TransferBox';
import TransferList from './components/TransferList';
import DualCanvasPlateView from './components/DualCanvasPlateView';
import ReformatSchemesCard from './components/ReformatSchemesCard';
import ReformatSchemesModal from './components/ReformatSchemesModal';
import {
  ReformatScheme,
  loadSchemes,
  saveSchemes,
  createSchemeFromCurrentState,
  applyScheme,
  deleteScheme
} from './utils/reformatUtils';
import '../../css/PlateReformat.css'
import { generateSingleColor } from '../../utils/wellColors';
import { labelDrag, selectorHelper } from '../../utils/designUtils';
import { defaults } from './utils/defaultSchemes';

function PlateReformat() {
  const [srcPlates, setSrcPlates] = useState<Plate[]>([]);
  const [dstPlates, setDstPlates] = useState<Plate[]>([]);
  const [curSrcPlateId, setCurSrcPlateId] = useState<number | null>(null);
  const [curDstPlateId, setCurDstPlateId] = useState<number | null>(null);
  const [srcPlateSize, setSrcPlateSize] = useState<PlateSize>('384')
  const [dstPlateSize, setDstPlateSize] = useState<PlateSize>('384')
  const [selectedSrcWells, setSelectedSrcWells] = useState<string[]>([]);
  const [selectedDstWells, setSelectedDstWells] = useState<string[]>([]);
  const [transferBlocks, setTransferBlocks] = useState<TransferBlock[]>([]);
  const [schemes, setSchemes] = useState<ReformatScheme[]>(() => loadSchemes());
  const [showManageModal, setShowManageModal] = useState(false);
  const [tsfrIdx, setTsfrIdx] = useState<number>(0)

  const srcDisplayPlate = currentPlate(srcPlates, curSrcPlateId);
  const dstDisplayPlate = currentPlate(dstPlates, curDstPlateId);

  const selectionRef = useRef<HTMLDivElement | null>(null);
  const dragState = useRef({ mouseDown: false, dragging: false, startX: 0, startY: 0, endX: 0, endY: 0 });

  useEffect(() => {
    document.addEventListener("mousedown", handlePageDblClick);
    return () => {
      document.removeEventListener("mousedown", handlePageDblClick);
    };
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    //e.preventDefault();
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
    const selectorQuery = parent.getAttribute("data-view")?.split("-")[1];
    if (!selectorQuery) return;
    const plate = selectorQuery === "source" ? srcDisplayPlate : dstDisplayPlate;
    if (!plate) return;
    const selected = selectorQuery === "source" ? selectedSrcWells : selectedDstWells;
    const setSelected = selectorQuery === "source" ? setSelectedSrcWells : setSelectedDstWells;
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
      selectorHelper(e, labelWells, selected, setSelected)
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
      selectorHelper(e, newSelected, selected, setSelected);
    }
  };

  const handlePageDblClick = (e: MouseEvent) => {
    if (e.detail > 1) {
      e.preventDefault();
      setSelectedSrcWells(prev => (prev.length ? [] : prev));
      setSelectedDstWells(prev => (prev.length ? [] : prev));
    }
  };

  const handleLoadScheme = (scheme: ReformatScheme) => {
    const result = applyScheme(scheme);
    setSrcPlates(result.srcPlates);
    setDstPlates(result.dstPlates);
    setTransferBlocks(result.transferBlocks);
    setTsfrIdx(result.transferBlocks.length)
    setCurSrcPlateId(result.srcPlates[0]?.id ?? null);
    setCurDstPlateId(result.dstPlates[0]?.id ?? null);
    setSelectedSrcWells([]);
    setSelectedDstWells([]);
  };

  const handleSaveScheme = (name: string, description: string) => {
    const newScheme = createSchemeFromCurrentState(
      name,
      description,
      srcPlates,
      srcPlateSize,
      dstPlates,
      dstPlateSize,
      transferBlocks
    );
    const updated = [...schemes, newScheme];
    setSchemes(updated);
    saveSchemes(updated);
  };

  const handleDeleteScheme = (schemeId: number) => {
    const updated = deleteScheme(schemes, schemeId);
    setSchemes(updated);
    saveSchemes(updated);
  };

  const handleAddTransfer = (transferBlock: TransferBlock) => {
    const newTsfrIdx = tsfrIdx + 1
    if (!transferBlock.color) { transferBlock.color = generateSingleColor(0.75638, newTsfrIdx) }
    setTsfrIdx(newTsfrIdx)
    setTransferBlocks(prev => [...prev, transferBlock]);
    setSelectedDstWells([]);
    setSelectedSrcWells([]);
  }

  const handleLoadDefaults = () => {
    const existingIds = new Set(schemes.map(s => s.id));
    const newDefaults = defaults.filter(d => !existingIds.has(d.id));
    setSchemes([...schemes, ...newDefaults]);
  };

  const hasUnsavedChanges = transferBlocks.length > 0;
  const canSave = srcPlates.length > 0 && dstPlates.length > 0 && transferBlocks.length > 0;

  const plateBarcodeCache: Map<number, string> = new Map();
  for (const plate of [...srcPlates, ...dstPlates]) {
    plateBarcodeCache.set(plate.id, plate.barcode);
  }

  return (
    <Row className='plate-reformat'
      onMouseMove={handleMouseSelectionMove}
      onMouseUp={handleMouseUp}>
      <Col md={3} className='plate-reformat-sidebar'>
        <ReformatSchemesCard
          schemes={schemes}
          onLoadScheme={handleLoadScheme}
          onManageClick={() => setShowManageModal(true)}
          hasUnsavedChanges={hasUnsavedChanges}
        />
        <TransferBox
          sourcePlate={srcDisplayPlate}
          destPlate={dstDisplayPlate}
          selectedSrcWells={selectedSrcWells}
          selectedDstWells={selectedDstWells}
          onAddTransfer={handleAddTransfer}
        />
        <PlateList
          srcPlates={srcPlates}
          setSrcPlates={setSrcPlates}
          dstPlates={dstPlates}
          setDstPlates={setDstPlates}
          curSrcPlateId={curSrcPlateId}
          setCurSrcPlateId={setCurSrcPlateId}
          curDstPlateId={curDstPlateId}
          setCurDstPlateId={setCurDstPlateId}
          srcPlateSize={srcPlateSize}
          setSrcPlateSize={setSrcPlateSize}
          dstPlateSize={dstPlateSize}
          setDstPlateSize={setDstPlateSize}
          setSelectedSrcWells={setSelectedSrcWells}
          setSelectedDstWells={setSelectedDstWells}
          transferBlocks={transferBlocks}
        />
        <TransferList
          transferBlocks={transferBlocks}
          setTransferBlocks={setTransferBlocks}
          onDeleteTransfer={(index) => {
            setTransferBlocks(prev => prev.filter((_, i) => i !== index));
          }}
          plates={[...srcPlates, ...dstPlates]}
        />
      </Col>
      <Col md={9} className='noselect' onMouseDown={handleMouseDown}>
        {srcDisplayPlate && dstDisplayPlate &&
          <DualCanvasPlateView
            plateBarcodeCache={plateBarcodeCache}
            sourcePlate={srcDisplayPlate}
            destPlate={dstDisplayPlate}
            selectedSrcWells={selectedSrcWells}
            setSelectedSrcWells={setSelectedSrcWells}
            selectedDstWells={selectedDstWells}
            setSelectedDstWells={setSelectedDstWells}

            selectionRef={selectionRef}
            transferBlocks={transferBlocks}
          />
        }
      </Col>

      <ReformatSchemesModal
        show={showManageModal}
        onHide={() => setShowManageModal(false)}
        schemes={schemes}
        onSaveScheme={handleSaveScheme}
        onDeleteScheme={handleDeleteScheme}
        onLoadScheme={handleLoadScheme}
        canSave={canSave}
        onLoadDefaults={handleLoadDefaults}
      />
    </Row>
  );
}

export default PlateReformat;