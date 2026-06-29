import React, { useState } from 'react';
import { Container, Row, Col, Button } from 'react-bootstrap';

import ContentsManager from './ContentsManager';
import PlateViewCanvas from '../../../components/PlateViewCanvas';
import ApplyTooltip from '../../../components/ApplyTooltip';
import { FormField } from '../../../components/FormField';
import { Plate, PlateSize } from '../../../classes/PlateClass';
import { Pattern } from '../../../classes/PatternClass';
import { ColorConfig, generateEntityColors } from '../../../utils/wellColors';
import { currentItem, generateExcelTemplate, plateMaxConcentration } from '../../../utils/designUtils';
import { formatWellBlock, mapWellsToConcentrations } from '../../../utils/plateUtils';

import '../../../css/DesignWizard.css'
import { Link } from 'react-router-dom';

export interface WellContentsForm {
  compoundId: string;
  concentration: number | '';
  volume: number | '';
  dmsoWells: boolean;
  patternNames: string[];
  compoundListText: string;
  concentrations: (number | null)[];
  direction: 'LR' | 'RL' | 'TB' | 'BT';
  currentIdx: number;
}

interface DesignWizardSrcProps {
  designSrcPlates: Plate[];
  setDesignSrcPlates: React.Dispatch<React.SetStateAction<Plate[]>>;
  curDesignSrcPlateId: number | null;
  designSrcPlateSize: PlateSize;
  setDesignSrcPlateSize: React.Dispatch<React.SetStateAction<PlateSize>>;
  setCurDesignSrcPlateId: React.Dispatch<React.SetStateAction<number | null>>;
  patterns: Pattern[];
  selectedWellIds: string[];
  handleLabelClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  handleMouseDown?: (e: React.MouseEvent<Element, MouseEvent>) => void;
  enterCallbackRef: React.RefObject<(() => void) | null>
  onDoubleClick: (e: React.MouseEvent<Element, MouseEvent>) => void;
}

const DesignWizardSrc: React.FC<DesignWizardSrcProps> = ({
  designSrcPlates,
  setDesignSrcPlates,
  curDesignSrcPlateId,
  designSrcPlateSize,
  setDesignSrcPlateSize,
  setCurDesignSrcPlateId,
  patterns,
  selectedWellIds,
  handleLabelClick = (() => { }),
  handleMouseDown = (() => { }),
  enterCallbackRef,
  onDoubleClick
}) => {
  const [wellContentsForm, setWellContentsForm] = useState<WellContentsForm>({
    compoundId: '',
    concentration: '',
    volume: '',
    dmsoWells: false,
    patternNames: [],
    compoundListText: '',
    concentrations: [null],
    direction: 'LR',
    currentIdx: 0
  })
  const [activeAccordion, setActiveAccordion] = useState<string | null>('basic');
  const [applyPopup, setApplyPopup] = useState<{ event: React.MouseEvent | null, msgArr: string[] }>({ event: null, msgArr: [] })

  const compoundList = wellContentsForm.compoundListText
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean);
  const currentCompound = compoundList[wellContentsForm.currentIdx] ?? null;
  const validConcentrations = wellContentsForm.concentrations.filter(
    (c): c is number => typeof c === 'number' && !isNaN(c)
  );

  const canApply = selectedWellIds.length > 0 &&
    typeof wellContentsForm.volume === 'number' &&
    wellContentsForm.volume > 0 &&
    ((wellContentsForm.dmsoWells) ||
      (activeAccordion === 'basic'
        ? (
          wellContentsForm.compoundId != '' &&
          typeof (wellContentsForm.concentration) == 'number' &&
          wellContentsForm.patternNames.length > 0)
        : (
          currentCompound !== null &&
          validConcentrations.length > 0 &&
          wellContentsForm.patternNames.length > 0))
    )

  const plate = currentItem(designSrcPlates, curDesignSrcPlateId) as Plate
  if (!plate) return (<div>Please select a source plate</div>)

  enterCallbackRef.current = canApply ? () => applyContentsToWells() : null;

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

  function getApplyDisabledReasons(): string[] {
    const reasons: string[] = [];
    if (selectedWellIds.length === 0) reasons.push('No wells selected');
    if (typeof wellContentsForm.volume !== 'number' || wellContentsForm.volume <= 0) reasons.push('No volume set');
    if (!wellContentsForm.dmsoWells) {
      if (wellContentsForm.patternNames.length === 0) reasons.push('No patterns linked');
      if (activeAccordion === 'basic') {
        if (wellContentsForm.compoundId === '') reasons.push('No compound ID');
        if (typeof wellContentsForm.concentration !== 'number') reasons.push('No concentration set');
      } else {
        if (currentCompound === null) reasons.push('No compounds in list');
        if (validConcentrations.length === 0) reasons.push('No valid concentrations');
      }
    }
    return reasons;
  }

  function applyContentsToWells() {
    const newPlate = plate.clone();
    const patternName = wellContentsForm.patternNames.join(';')
    if (wellContentsForm.dmsoWells) {
      for (const wellId of selectedWellIds) {
        const well = newPlate.getWell(wellId);
        if (!well) continue;
        well.clearContents();
        well.bulkFill(wellContentsForm.volume as number * 1000, 'DMSO');
      }
    } else if (activeAccordion === 'basic') {
      for (const wellId of selectedWellIds) {
        const well = newPlate.getWell(wellId);
        if (!well) continue;
        well.clearContents();
        well.addContent({
          compoundId: wellContentsForm.compoundId || undefined,
          concentration: wellContentsForm.concentration as number,
          patternName
        },
          wellContentsForm.volume as number * 1000, //uL to nL
          { name: 'DMSO', fraction: 1 }
        )
      }
    } else {
      const wellBlock = formatWellBlock(selectedWellIds);
      const wellsByConcentration = mapWellsToConcentrations(newPlate, wellBlock, validConcentrations, wellContentsForm.direction);
      wellsByConcentration.forEach((wells, concIdx) => {
        const concentration = validConcentrations[concIdx];
        for (const wellId of wells) {
          const well = newPlate.getWell(wellId);
          if (!well) continue;
          well.clearContents();
          well.addContent({
            compoundId: currentCompound || undefined,
            concentration,
            patternName
          },
            wellContentsForm.volume as number * 1000,
            { name: 'DMSO', fraction: 1 }
          );
        }
      });
      setWellContentsForm(prev => ({
        ...prev,
        currentIdx: Math.min(prev.currentIdx + 1, compoundList.length - 1),
      }));
    }
    newPlate.metadata.globalMaxConcentration = plateMaxConcentration(newPlate);
    setDesignSrcPlates(designSrcPlates.map(p => p.id === newPlate.id ? newPlate : p));
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

  const handlePlateSizeChange = (value: PlateSize) => {
    if (value === designSrcPlateSize) return
    const filledWells = Object.values(designSrcPlates[0].getWells()).filter(well => well.getTotalVolume() > 0)
    if (filledWells.length > 0 || designSrcPlates.length > 1) {
      if (!window.confirm("Changing plate size will delete all existing plates. Continue?")) {
        return
      }
    }
    const newPlate = new Plate({ barcode: 'SRC001', plateSize: value })
    setDesignSrcPlateSize(value)
    setDesignSrcPlates([newPlate])
    setCurDesignSrcPlateId(newPlate.id)
  }

  const handleMouseEnter = (e: React.MouseEvent) => {
    const reasons = getApplyDisabledReasons();
    setApplyPopup({ event: reasons.length > 0 ? e : null, msgArr: reasons });
  };

  const handleMouseLeave = () => {
    setApplyPopup({ event: null, msgArr: [] });
  };

  return (
    <Container fluid className='noselect design-wizard-container'>
      <Row className='design-wizard-row'>
        <Col md={3} className='design-wizard-col'>
          <div className='design-wizard-button-grid'>
            <div
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              <Button
                onClick={(e) => { applyContentsToWells(); e.currentTarget.blur() }}
                disabled={!canApply}
                size='sm'
              >
                Apply to Wells
              </Button>
            </div>
            <Button
              onClick={(e) => { clearContentsFromWells(); e.currentTarget.blur() }}
              disabled={selectedWellIds.length === 0}
              variant='danger'
              size='sm'
            >
              Clear from Wells
            </Button>
            <Button
              onClick={(e) => { clearContentsFromAllWells(); e.currentTarget.blur() }}
              variant='danger'
              size='sm'
            >
              Clear from All Wells
            </Button>
            <Button
              onClick={(e) => { generateExcelTemplate(patterns, designSrcPlates); e.currentTarget.blur() }}
              disabled={patterns.length < 1}
              variant='success'
              size='sm'
            >
              Generate Template
            </Button>
          </div>
          <small className="text-muted fst-italic mb-3"> Upload the generated template to the <Link to="/echotsfr">Echo Transfer calculator</Link> when finished</small>

          <ContentsManager
            selectedWellIds={selectedWellIds}
            patterns={patterns}
            wellContentsForm={wellContentsForm}
            setWellContentsForm={setWellContentsForm}
            activeAccordion={activeAccordion}
            setActiveAccordion={setActiveAccordion}
            compoundList={compoundList}
            currentCompound={currentCompound}
            validConcentrations={validConcentrations}
          />
        </Col>
        <Col
          md={9}
          className='design-wizard-col'
          style={{ scrollbarGutter: 'stable' }}
          onMouseDown={handleMouseDown}
          onDoubleClick={onDoubleClick}
        >
          <span className="d-flex justify-content-between">
            <FormField
              id="src-plate-barcode"
              name="barcode"
              type="text"
              label="Source Plate Barcode"
              value={plate.barcode}
              onChange={handleBarcodeChange}
              placeholder="e.g. SRC001"
              className="default-label-text w-auto form-field-compact"
            />
            <FormField
              id="src-plate-size"
              name="src-plate-size"
              type="select"
              label="Source Plate Size"
              value={designSrcPlateSize}
              onChange={handlePlateSizeChange}
              options={[
                { value: '384', label: '384' },
                { value: '1536', label: '1536' }]
              }
              className="default-label-text w-auto form-field-compact"
            />
          </span>
          <PlateViewCanvas
            plate={plate}
            view='design'
            colorConfig={colorConfig}
            selectedWells={selectedWellIds}
            handleLabelClick={handleLabelClick}
          />
          <small className="text-muted">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.25rem' }}>
              <span><kbd>LeftClick</kbd> to select wells, drag to select groups</span>
              <span><kbd>LeftClick</kbd> on labels or All Plate square to select groups of wells</span>
              <span><kbd>LeftClick</kbd> + <kbd>Ctrl</kbd> to add to current selection</span>
              <span><kbd>ArrowKey</kbd> to move current selection</span>
              <span><kbd>Shift</kbd> + <kbd>ArrowKey</kbd> expands well selection</span>
            </div>
          </small>
        </Col>
      </Row>
      {applyPopup.msgArr.length > 0 && <ApplyTooltip data={applyPopup} />}
    </Container>
  );
};

export default DesignWizardSrc;