import React, { useState } from 'react';
import { Container, Row, Col, Button } from 'react-bootstrap';

import ContentsManager from './ContentsManager';
import PlateViewCanvas from '../../../components/PlateViewCanvas';
import { FormField } from '../../../components/FormField';
import { Plate, PlateSize } from '../../../classes/PlateClass';
import { Pattern } from '../../../classes/PatternClass';
import { ColorConfig, generateEntityColors } from '../../../utils/wellColors';
import { currentItem, generateExcelTemplate, plateMaxConcentration } from '../../../utils/designUtils';
import { formatWellBlock, mapWellsToConcentrations } from '../../../utils/plateUtils';

import '../../../css/DesignWizard.css'

export interface WellContentsForm {
  compoundId: string;
  concentration: number | '';
  volume: number | '';
  dmsoWells: boolean;
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
  enterCallbackRef: React.RefObject<(() => void) | null>
}

const DesignWizardSrc: React.FC<DesignWizardSrcProps> = ({
  designSrcPlates,
  setDesignSrcPlates,
  curDesignSrcPlateId,
  patterns,
  selectedWellIds,
  handleLabelClick = (() => { }),
  handleMouseDown = (() => { }),
  enterCallbackRef
}) => {
  const [wellContentsForm, setWellContentsForm] = useState<WellContentsForm>({ compoundId: '', concentration: '', volume: '', dmsoWells: false, patternNames: [] })
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
      if (wellContentsForm.dmsoWells) {
        well.bulkFill(wellContentsForm.volume as number * 1000, 'DMSO')
      }
      else {
        well.addContent({
          compoundId: wellContentsForm.compoundId || undefined,
          concentration: wellContentsForm.concentration as number,
          patternName
        },
          wellContentsForm.volume as number * 1000, //uL to nL
          { name: 'DMSO', fraction: 1 }
        )
      }
    }
    newPlate.metadata.globalMaxConcentration = plateMaxConcentration(newPlate)
    setDesignSrcPlates(designSrcPlates.map(p => p.id === newPlate.id ? newPlate : p))
  };

  function applyAdvancedContentsToWells(
    compoundId: string,
    concentrations: number[],
    direction: 'LR' | 'RL' | 'TB' | 'BT',
    volume: number,
    patternNames: string[]
  ) {
    const newPlate = plate.clone();
    const patternName = patternNames.join(';');
    const wellBlock = formatWellBlock(selectedWellIds);

    const wellsByConcentration = mapWellsToConcentrations(newPlate, wellBlock, concentrations, direction);

    wellsByConcentration.forEach((wells, concIdx) => {
      const concentration = concentrations[concIdx];
      for (const wellId of wells) {
        const well = newPlate.getWell(wellId);
        if (!well) continue;
        well.clearContents();
        well.addContent(
          { compoundId: compoundId || undefined, concentration, patternName },
          volume * 1000,
          { name: 'DMSO', fraction: 1 }
        );
      }
    });

    newPlate.metadata.globalMaxConcentration = plateMaxConcentration(newPlate);
    setDesignSrcPlates(designSrcPlates.map(p => p.id === newPlate.id ? newPlate : p));
  }

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
    <Container fluid className='noselect design-wizard-container'>
      <Row className='design-wizard-row'>
        <Col md={3} className='design-wizard-col'>
          <div className='design-wizard-button-grid'>
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
            onApplyAdvanced={applyAdvancedContentsToWells}
            enterCallbackRef={enterCallbackRef}
          />
        </Col>
        <Col
          md={9}
          className='design-wizard-col'
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