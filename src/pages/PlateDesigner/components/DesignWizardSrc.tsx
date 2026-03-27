import React, { useState } from 'react';
import { Container, Row, Col, Button } from 'react-bootstrap';

import ContentsManager from './ContentsManager';
import PlateViewCanvas from '../../../components/PlateViewCanvas';
import { FormField } from '../../../components/FormField';
import { Plate, PlateSize } from '../../../classes/PlateClass';
import { Pattern } from '../../../classes/PatternClass';
import { ColorConfig, generateEntityColors } from '../../../utils/wellColors';
import { currentItem, generateExcelTemplate, plateMaxConcentration } from '../../../utils/designUtils';

export interface WellContentsForm {
  compoundId: string;
  concentration: number | '';
  volume: number | '';
  patternNames: string[];
}

interface DesignWizardSrcProps {
  designSrcPlates: Plate[];
  setDesignSrcPlates: React.Dispatch<React.SetStateAction<Plate[]>>;
  curDesignSrcPlateId: number | null;
  patterns: Pattern[];
  selectedWellIds: string[];
  handleLabelClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  handleMouseDown?: (e: React.MouseEvent<Element, MouseEvent>) => void;
}

const DesignWizardSrc: React.FC<DesignWizardSrcProps> = ({
  designSrcPlates,
  setDesignSrcPlates,
  curDesignSrcPlateId,
  patterns,
  selectedWellIds,
  handleLabelClick = (() => { }),
  handleMouseDown = (() => { }),
}) => {
  const [wellContentsForm, setWellContentsForm] = useState<WellContentsForm>({ compoundId: '', concentration: '', volume: '', patternNames: [] })
  const plate = currentItem(designSrcPlates, curDesignSrcPlateId) as Plate
  if (!plate) return (<div>Please select a source plate</div>)

  const compoundIdsSet = new Set<string>()
  for (const plate of designSrcPlates) {
    const compoundIds = Array.from(plate).flatMap(w => w.getContents().map(c => c.compoundId).filter((id): id is string => Boolean(id)))//filters out empty strings
    compoundIds.forEach((id) => compoundIdsSet.add(id))
  }


  const colorConfig: ColorConfig = {
    scheme: 'compound',
    colorMap: generateEntityColors([...compoundIdsSet], 0.5),
    maxConcentration: plate.metadata.globalMaxConcentration
  };

  const canApply = selectedWellIds.length > 0 &&
    wellContentsForm.compoundId != '' &&
    typeof (wellContentsForm.concentration) == 'number' &&
    typeof (wellContentsForm.volume) == 'number' &&
    wellContentsForm.patternNames.length > 0

  function applyContentsToWells() {
    const newPlate = plate!.clone();
    const patternName = wellContentsForm.patternNames.join(';')
    for (const wellId of selectedWellIds) {
      const well = newPlate.getWell(wellId);
      if (!well) continue;
      well.clearContents();
      well.bulkFill(wellContentsForm.volume as number, 'DMSO');
      well.contents.push({
        compoundId: wellContentsForm.compoundId || undefined,
        concentration: wellContentsForm.concentration as number,
        patternName
      });
    }
    newPlate.metadata.globalMaxConcentration = plateMaxConcentration(newPlate)
    setDesignSrcPlates(designSrcPlates.map(p => p.id === newPlate.id ? newPlate : p))
  };

  function clearContentsFromWells() {
    const newPlate = plate!.clone();
    for (const wellId of selectedWellIds) {
      const well = newPlate.getWell(wellId);
      if (well) well.clearContents();
    }
    newPlate.metadata.globalMaxConcentration = plateMaxConcentration(newPlate)
    setDesignSrcPlates(designSrcPlates.map(p => p.id === newPlate.id ? newPlate : p))
  };

  function clearContentsFromAllWells() {
    if (!plate) return
    const newPlate = new Plate({ id: plate.id, barcode: plate.barcode, plateSize: (plate.rows * plate.columns).toString() as PlateSize })
    setDesignSrcPlates(designSrcPlates.map(p => p.id === newPlate.id ? newPlate : p))
  }

  const handleBarcodeChange = (value: string) => {
    const newPlate = plate.clone();
    newPlate.barcode = value;
    setDesignSrcPlates(designSrcPlates.map(p => p.id === newPlate.id ? newPlate : p))
  };

  return (
    <Container fluid className='noselect h-100 pb-2 pt-2'>
      <Row className='h-100' style={{ minHeight: 0 }}>
        <Col md={4} className='d-flex flex-column h-100 overflow-y-auto' style={{ scrollbarGutter: 'stable' }}>
          <div className='mb-3' style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: '2em', rowGap: '0.5em' }}>
            <Button
              onClick={applyContentsToWells}
              disabled={!canApply}
              size='sm'
            >
              Apply to Wells
            </Button>
            <Button
              onClick={clearContentsFromWells}
              disabled={selectedWellIds.length === 0}
              variant='danger'
              size='sm'
            >
              Clear from Wells
            </Button>
            <Button
              onClick={clearContentsFromAllWells}
              variant='danger'
              size='sm'
            >
              Clear from All Wells
            </Button>
            <Button
              onClick={() => generateExcelTemplate(patterns, designSrcPlates)}
              disabled={patterns.length < 1}
              variant='success'
              size='sm'
            >
              Generate Template
            </Button>
          </div>
          <FormField
            id="src-plate-barcode"
            name="barcode"
            type="text"
            label="Source Plate Barcode"
            value={plate.barcode}
            onChange={handleBarcodeChange}
            placeholder="e.g. SRC001"
            className='default-label-text'
          />
          <ContentsManager
            selectedWellIds={selectedWellIds}
            patterns={patterns}
            wellContentsForm={wellContentsForm}
            setWellContentsForm={setWellContentsForm}
          />
        </Col>
        <Col
          md={8}
          className='d-flex flex-column h-100 overflow-y-auto'
          style={{ scrollbarGutter: 'stable' }}
          onMouseDown={handleMouseDown}
        >

          <PlateViewCanvas
            plate={plate}
            view='design'
            colorConfig={colorConfig}
            selectedWells={selectedWellIds}
            handleLabelClick={handleLabelClick}
          />
        </Col>
      </Row>
    </Container>
  );
};

export default DesignWizardSrc;