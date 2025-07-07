import React, { useState, useEffect } from 'react';
import { Col, Row, Tabs, Tab } from 'react-bootstrap';
import { MappedPlatesContext, ProtocolsContext } from '../../contexts/Context.ts';
import { Plate } from '../../classes/PlateClass.ts';
import { Protocol } from '../../types/mapperTypes';
import Sidebar from '../../components/Sidebar.tsx';
import PlateMapper from './components/PlateMapper.tsx';
import ProtocolManager from './components/ProtocolManager.tsx';
import { loadProtocols, saveProtocols } from './utils/protocolUtils';

import '../../css/Sidebar.css'

const MapperParser: React.FC = () => {
  const [tabKey, setTabKey] = useState<string>('mapper');
  const [mappedPlates, setMappedPlates] = useState<Plate[]>([]);
  const [curMappedPlateId, setCurMappedPlateId] = useState<number | null>(null);
  const [protocols, setProtocols] = useState<Protocol[]>(() => loadProtocols());
  const [selectedProtocolId, setSelectedProtocolId] = useState<number | null>(null);

  // Save protocols whenever they change
  useEffect(() => {
    saveProtocols(protocols);
  }, [protocols]);

  const handleSelect = (k: string | null) => {
    if (k !== null) {
      setTabKey(k);
    }
  };

  const renderSidebar = () => {
    if (tabKey === 'mapper' || tabKey === 'parser' || tabKey === 'results') {
      return (
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
        />
      );
    }
    else if (tabKey === 'protocols') {
      return (
        <Sidebar
          items={protocols.map(protocol => ({
            id: protocol.id,
            name: protocol.name,
            type: protocol.parseStrategy.format,
          }))}
          selectedItemId={selectedProtocolId}
          setSelectedItemId={setSelectedProtocolId}
          filterOptions={['Table','Matrix']}
          title="Protocols"
        />
      )
    }
    return null;
  };

  return (
    <MappedPlatesContext.Provider value={{ mappedPlates, setMappedPlates, curMappedPlateId, setCurMappedPlateId }}>
      <ProtocolsContext.Provider value={{ protocols, setProtocols, selectedProtocolId, setSelectedProtocolId }}>
        <Row>
          <Col md="2">
            {renderSidebar()}
          </Col>
          <Col md="10" className="d-flex flex-column">
            <Tabs id="mapper-parser-tab-select" activeKey={tabKey} onSelect={handleSelect} className='mb-3'>
              <Tab eventKey="mapper" title="Plate Mapper">
                <PlateMapper />
              </Tab>
              <Tab eventKey="protocols" title="Protocol Manager">
                <ProtocolManager />
              </Tab>
              <Tab eventKey="parser" title="Data Parser">
                <div className="text-center py-5">
                  <p className="text-muted">Data Parser - Coming Soon</p>
                </div>
              </Tab>
              <Tab eventKey="results" title="Results">
                <div className="text-center py-5">
                  <p className="text-muted">Results Display - Coming Soon</p>
                </div>
              </Tab>
            </Tabs>
          </Col>
        </Row>
      </ProtocolsContext.Provider>
    </MappedPlatesContext.Provider>
  );
}

export default MapperParser;