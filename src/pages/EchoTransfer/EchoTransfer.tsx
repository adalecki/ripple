import React, { useState, useEffect } from 'react';
import { Col, Row, Tabs, Tab } from 'react-bootstrap';
import { PlatesContext, PatternsContext, MappedPlatesContext } from './contexts/Context.ts';
import { Plate, PlateSize } from './classes/PlateClass.ts';
import { Pattern } from './classes/PatternClass.ts';
import Sidebar from './components/Sidebar.tsx';
import EchoCalc from './components/EchoCalc.tsx';
import DesignWizard from './components/DesignWizard.tsx';
import EchoInstructions from './components/EchoInstructions.tsx';
import About from './components/About.tsx';
import { usePreferences } from '../../hooks/usePreferences';

import '../../css/Sidebar.css'
import PlateMapper from './components/PlateMapper.tsx';

const EchoTransfer: React.FC = () => {
  const { preferences } = usePreferences()
  const [tabKey, setTabKey] = useState<string>('instructions');
  const [plates, setPlates] = useState<Plate[]>([]);
  const [patternPlate, setPatternPlate] = useState<Plate>(new Plate({ plateSize: preferences.destinationPlateSize as PlateSize }));
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [curPlateId, setCurPlateId] = useState<number | null>(null);
  const [selectedPatternId, setSelectedPatternId] = useState<number | null>(null);
  const [mappedPlates, setMappedPlates] = useState<Plate[]>([]);
  const [curMappedPlateId, setCurMappedPlateId] = useState<number | null>(null);

  useEffect(() => {
    //not doing extra type checking as even if a user somehow got an invalid plate size,
    //it falls back to a 384 automatically
    const oldPlateSize = patternPlate.rows * patternPlate.columns
    if (oldPlateSize.toString() != preferences.destinationPlateSize.toString()) {
      const newPatternArr: Pattern[] = []
      for (const pattern of patterns) {
        const newPattern = pattern.clone()
        newPattern.locations = [];
        newPatternArr.push(newPattern)
      }
      setPatternPlate(new Plate({ plateSize: preferences.destinationPlateSize as PlateSize }));
      setPatterns(newPatternArr)
    }
  }, [preferences.destinationPlateSize]);

  const handleSelect = (k: string | null) => {
    if (k !== null) {
      setTabKey(k);
    }
  };

  if (plates.length == 0) {
    const newPlates: Plate[] = []
    for (let i = 0; i < 20; i++) {
      newPlates.push(new Plate({ id: i, barcode: i.toString(), plateSize: '384', plateRole: 'destination' }))
    }
  }

  const handleDeletePattern = (patternId: number) => {
    const newPlate = patternPlate.clone()
    const pattern = patterns.find(p => p.id == patternId)
    if (pattern) {
      for (const loc of pattern.locations) {
        newPlate.removePattern(loc, pattern.name)
      }
    }

    setPatterns(patterns.filter(p => p.id !== patternId));
    if (selectedPatternId === patternId) {
      setSelectedPatternId(null);
    }
    setPatternPlate(newPlate)
  };

  const renderSidebar = () => {
    if (tabKey === 'echo') {
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
    } else if (tabKey === 'design') {
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
          selectedItemId={selectedPatternId}
          setSelectedItemId={setSelectedPatternId}
          filterOptions={['Control', 'Treatment']}
          title="Patterns"
          onDeleteItem={handleDeletePattern}
        />
      );
    }
    else if (tabKey === 'mapper') {
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
    return (
      <Sidebar
        items={[]}
        selectedItemId={null}
        setSelectedItemId={setSelectedPatternId}
        filterOptions={[]}
        title=""
      />
    );
  };


  return (
    <PlatesContext.Provider value={{ plates, setPlates, curPlateId, setCurPlateId }}>
      <PatternsContext.Provider value={{ patterns, setPatterns, selectedPatternId, setSelectedPatternId }}>
        <MappedPlatesContext.Provider value={{ mappedPlates, setMappedPlates, curMappedPlateId, setCurMappedPlateId }}>
          <Row>
            <Col md="2">{renderSidebar()}</Col>
            <Col md="10" className="d-flex flex-column">
              <Tabs id="echo-tab-select" activeKey={tabKey} onSelect={handleSelect} className='mb-3'>
                <Tab eventKey="instructions" title="Instructions">
                  <EchoInstructions />
                </Tab>
                <Tab eventKey="design" title="Design">
                  <DesignWizard
                    patternPlate={patternPlate}
                    setPatternPlate={setPatternPlate}
                  />
                </Tab>
                <Tab eventKey="echo" title="Calculator">
                  <EchoCalc />
                </Tab>
                <Tab eventKey="mapper" title="Plate Mapper">
                  <PlateMapper />
                </Tab>
                <Tab eventKey="about" title="About">
                  <About />
                </Tab>
              </Tabs>
            </Col>
          </Row>
        </MappedPlatesContext.Provider>
      </PatternsContext.Provider>
    </PlatesContext.Provider>
  )
}

export default EchoTransfer;