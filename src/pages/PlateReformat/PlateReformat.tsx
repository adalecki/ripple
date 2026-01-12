import { Row, Col } from 'react-bootstrap';
import { useEffect, useState } from 'react';
import { Plate, PlateSize } from '../../classes/PlateClass';
import PlateList from './components/PlateList';
import { currentPlate, type TransferBlock } from '../../utils/plateUtils';
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

  useEffect(() => {
    document.addEventListener("mousedown", handlePageDblClick);
    return () => {
      document.removeEventListener("mousedown", handlePageDblClick);
    };
  }, []);

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
    const color = generateSingleColor(0.13276786491229609, newTsfrIdx) //arbitrary random seed because it looks decent
    transferBlock.color = color
    setTsfrIdx(newTsfrIdx)
    setTransferBlocks(prev => [...prev, transferBlock]);
    setSelectedDstWells([]);
    setSelectedSrcWells([]);
  }


  const hasUnsavedChanges = transferBlocks.length > 0;
  const canSave = srcPlates.length > 0 && dstPlates.length > 0 && transferBlocks.length > 0;

  const plateBarcodeCache: Map<number, string> = new Map();
  for (const plate of [...srcPlates, ...dstPlates]) {
    plateBarcodeCache.set(plate.id, plate.barcode);
  }

  return (
    <Row className='plate-reformat'>
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
          transferBlocks={transferBlocks}
        />
        <TransferList
          transferBlocks={transferBlocks}
          onDeleteTransfer={(index) => {
            setTransferBlocks(prev => prev.filter((_, i) => i !== index));
          }}
          plates={[...srcPlates, ...dstPlates]}
        />
      </Col>
      <Col md={9} className='p-0 noselect'>
        {srcDisplayPlate && dstDisplayPlate &&
          <DualCanvasPlateView
            plateBarcodeCache={plateBarcodeCache}
            sourcePlate={srcDisplayPlate}
            destPlate={dstDisplayPlate}
            selectedSrcWells={selectedSrcWells}
            setSelectedSrcWells={setSelectedSrcWells}
            selectedDstWells={selectedDstWells}
            setSelectedDstWells={setSelectedDstWells}
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
      />
    </Row>
  );
}

export default PlateReformat;