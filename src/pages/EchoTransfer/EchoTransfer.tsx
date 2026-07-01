import React, { useState } from 'react';
import { Col, Row, Tabs, Tab } from 'react-bootstrap';
import { PlatesContext } from '../../contexts/Context.ts';
import { Plate } from '../../classes/PlateClass.ts';
import Sidebar from '../../components/Sidebar.tsx';
import EchoCalc from './components/EchoCalc.tsx';
import About from './components/About.tsx';

const EchoTransfer: React.FC = () => {
  const [tabKey, setTabKey] = useState<string>('calculator');
  const [plates, setPlates] = useState<Plate[]>([]);
  const [curPlateId, setCurPlateId] = useState<number | null>(null);

  const handleSelect = (k: string | null) => {
    if (k !== null) {
      setTabKey(k);
    }
  };

  const renderSidebar = () => {
    if (tabKey === 'calculator') {
      return (
        <Sidebar
          items={plates.map(plate => ({
            id: plate.id,
            name: plate.barcode || `Plate ${plate.id}`,
            type: plate.plateRole,
            details: {
              items: Object.values(plate.wells).filter(well => well.getContents().length > 0).length,
            },
          }))}
          selectedItemId={curPlateId}
          setSelectedItemId={setCurPlateId}
          filterOptions={['source', 'intermediate1', 'intermediate2', 'destination']}
          title="Plates"
        />
      );
    }
    return (
      <Sidebar
        items={[]}
        selectedItemId={null}
        setSelectedItemId={() => { }}
        filterOptions={[]}
        title=""
      />
    );
  };


  return (
    <PlatesContext.Provider value={{ plates, setPlates, curPlateId, setCurPlateId }}>
      <Row>
        <Col md="2">{renderSidebar()}</Col>
        <Col md="10" style={{ minHeight: 0 }}>
          <div className="page-tabs">
            <Tabs
              id="echo-tab-select"
              activeKey={tabKey}
              onSelect={handleSelect}
              mountOnEnter
            >
              <Tab eventKey="calculator" title="Calculator">
                <EchoCalc showExamples={() => {setTabKey('about')}}/>
              </Tab>
              <Tab eventKey="about" title="About">
                <About />
              </Tab>
            </Tabs>
          </div>
        </Col>
      </Row>
    </PlatesContext.Provider>
  )
}

export default EchoTransfer;