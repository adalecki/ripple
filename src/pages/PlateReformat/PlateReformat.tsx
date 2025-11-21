import { Row, Col, Container } from 'react-bootstrap';
import { useState } from 'react';
import { Plate } from '../../classes/PlateClass'
import DualPlateView from './components/DualPlateView';
import PlateList from './components/PlateList';
import { currentPlate, type TransferBlock } from '../../utils/plateUtils';
import TransferBox from './components/TransferBox';
import TransferList from './components/TransferList';


function Home() {
  const [srcPlates, setSrcPlates] = useState<Plate[]>([])
  const [dstPlates, setDstPlates] = useState<Plate[]>([])
  const [curSrcPlateId, setCurSrcPlateId] = useState<number | null>(null);
  const [curDstPlateId, setCurDstPlateId] = useState<number | null>(null);
  const [selectedSrcWells, setSelectedSrcWells] = useState<string[]>([]);
  const [selectedDstWells, setSelectedDstWells] = useState<string[]>([]);
  const [transferBlocks, setTransferBlocks] = useState<TransferBlock[]>([])
  const srcDisplayPlate = currentPlate(srcPlates, curSrcPlateId)
  const dstDisplayPlate = currentPlate(dstPlates, curDstPlateId)


  return (
    <Container fluid>
      <Row>
        <Col md={3}>
          <PlateList
            srcPlates={srcPlates}
            setSrcPlates={setSrcPlates}
            dstPlates={dstPlates}
            setDstPlates={setDstPlates}
            curSrcPlateId={curSrcPlateId}
            setCurSrcPlateId={setCurSrcPlateId}
            curDstPlateId={curDstPlateId}
            setCurDstPlateId={setCurDstPlateId}
          />
          <TransferBox
            sourcePlate={srcDisplayPlate}
            destPlate={dstDisplayPlate}
            selectedSrcWells={selectedSrcWells}
            selectedDstWells={selectedDstWells}
            onAddTransfer={(transferBlock) => {
              setTransferBlocks(prev => [...prev, transferBlock]);
            }}
            onClearSelection={() => {
              setSelectedSrcWells([]);
              setSelectedDstWells([]);
            }}
          />
          <TransferList
            transferBlocks={transferBlocks}
            onDeleteTransfer={(index) => {
              setTransferBlocks(prev => prev.filter((_, i) => i !== index));
            }}
          />
        </Col>
        <Col md={9}>
          {srcDisplayPlate && dstDisplayPlate &&
            <DualPlateView
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
      </Row>
    </Container>
  );
}

export default Home;