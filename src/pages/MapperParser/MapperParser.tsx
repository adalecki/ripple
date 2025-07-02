import React, { useState } from 'react';
import { Col, Row, Tabs, Tab } from 'react-bootstrap';
import { MappedPlatesContext } from '../../contexts/Context.ts';
import { Plate } from '../../classes/PlateClass.ts';
import Sidebar from '../../components/Sidebar.tsx';

import '../../css/Sidebar.css'
import PlateMapper from './components/PlateMapper.tsx';

const MapperParser: React.FC = () => {
  const [tabKey, setTabKey] = useState<string>('mapper');
  const [mappedPlates, setMappedPlates] = useState<Plate[]>([]);
  const [curMappedPlateId, setCurMappedPlateId] = useState<number | null>(null);

  const handleSelect = (k: string | null) => {
    if (k !== null) {
      setTabKey(k);
    }
  };

  return (
    <MappedPlatesContext.Provider value={{ mappedPlates, setMappedPlates, curMappedPlateId, setCurMappedPlateId }}>
      <Row>
        <Col md="2">
          <Sidebar
            items={mappedPlates.map(plate => ({
              id: plate.id,
              name: plate.barcode || `Plate ${plate.id}`,
              type: plate.plateRole,
              details: {
                items: Object.values(plate.wells).filter(well => well.getContents().length > 0).length,
              },
            }))}
            selectedItemId={curMappedPlateId}
            setSelectedItemId={setCurMappedPlateId}
            filterOptions={['source', 'intermediate1', 'intermediate2', 'destination']}
            title="Plates"
          /></Col>
        <Col md="10" className="d-flex flex-column">
          <Tabs id="echo-tab-select" activeKey={tabKey} onSelect={handleSelect} className='mb-3'>
            <Tab eventKey="mapper" title="Plate Mapper">
              <PlateMapper />
            </Tab>
          </Tabs>
        </Col>
      </Row>
    </MappedPlatesContext.Provider>
  )
}

export default MapperParser;