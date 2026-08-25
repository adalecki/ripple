import React, { useState } from 'react';
import { Button, Col, Container, Row } from 'react-bootstrap';

import { Plate, PlateSize } from '../../../classes/PlateClass';
import { FormField } from '../../../components/FormField';
import PlateViewCanvas from '../../../components/PlateViewCanvas';
import ApplyTooltip from '../../../components/ApplyTooltip';
import { currentItem } from '../../../utils/designUtils';
import { ColorConfig, generateEntityColors } from '../../../utils/wellColors';
import { inventoryContents } from '../utils/cocktailUtils';
import InventoryManager from './InventoryManager';

import '../../../css/DesignWizard.css';

export interface InventoryForm {
  content: string;
  volume: number | '';
  plateType: string;
  contentListText: string;
  currentIdx: number;
}

interface InventoryWizardProps {
  srcPlates: Plate[];
  setSrcPlates: React.Dispatch<React.SetStateAction<Plate[]>>;
  curSrcPlateId: number | null;
  setCurSrcPlateId: React.Dispatch<React.SetStateAction<number | null>>;
  srcPlateSize: PlateSize;
  setSrcPlateSize: React.Dispatch<React.SetStateAction<PlateSize>>;
  selectedWellIds: string[];
  handleLabelClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  handleMouseDown: (e: React.MouseEvent<Element, MouseEvent>) => void;
  onDoubleClick: (e: React.MouseEvent<Element, MouseEvent>) => void;
  enterCallbackRef: React.RefObject<(() => void) | null>;
}

const InventoryWizard: React.FC<InventoryWizardProps> = ({
  srcPlates,
  setSrcPlates,
  curSrcPlateId,
  setCurSrcPlateId,
  srcPlateSize,
  setSrcPlateSize,
  selectedWellIds,
  handleLabelClick,
  handleMouseDown,
  onDoubleClick,
  enterCallbackRef
}) => {
  const [form, setForm] = useState<InventoryForm>({ content: '', volume: '', plateType: '384PP_DMSO2', contentListText: '', currentIdx: 0 });
  const [activeAccordion, setActiveAccordion] = useState<string | null>('basic');
  const [applyPopup, setApplyPopup] = useState<{ event: React.MouseEvent | null, msgArr: string[] }>({ event: null, msgArr: [] });

  const plate = currentItem(srcPlates, curSrcPlateId) as Plate | null;

  const contentList = form.contentListText.split('\n').map(s => s.trim()).filter(Boolean);
  const currentContent = contentList[form.currentIdx] ?? null;

  function getApplyDisabledReasons(): string[] {
    const reasons: string[] = [];
    if (!plate) reasons.push('No source plate selected');
    if (selectedWellIds.length === 0) reasons.push('No wells selected');
    if (typeof form.volume !== 'number' || form.volume <= 0) reasons.push('No volume set');
    if (activeAccordion === 'advanced') {
      if (!currentContent) reasons.push('No contents in list');
    } else if (!form.content) {
      reasons.push('No content name');
    }
    return reasons;
  }

  const applyDisabledReasons = getApplyDisabledReasons();
  const canApply = applyDisabledReasons.length === 0;

  const applyContentsToWells = () => {
    if (!plate || !canApply) return;
    const content = activeAccordion === 'advanced' ? currentContent! : form.content;
    const newPlate = plate.clone();
    //const solventName = newPlate.plateType?.includes('AQ') ? 'AQ' : 'DMSO';
    for (const wellId of selectedWellIds) {
      const well = newPlate.getWell(wellId);
      if (!well) continue;
      well.clearContents();
      well.addContent({ 
        compoundId: content, 
        concentration: null, 
        volume: form.volume as number * 1000,
        patternName: content 
      },
        { name: form.plateType, fraction: 1 }
      );
    }
    setSrcPlates(srcPlates.map(p => (p.id === newPlate.id ? newPlate : p)));
    if (activeAccordion === 'advanced') {
      setForm(prev => ({ ...prev, currentIdx: Math.min(prev.currentIdx + 1, contentList.length - 1) }));
    }
  };

  enterCallbackRef.current = canApply ? applyContentsToWells : null;

  function clearContentsFromWells() {
    if (!plate) return;
    const newPlate = plate.clone();
    for (const wellId of selectedWellIds) {
      newPlate.getWell(wellId)?.clearContents();
    }
    setSrcPlates(srcPlates.map(p => (p.id === newPlate.id ? newPlate : p)));
  }

  function clearContentsFromAllWells() {
    if (!plate) return;
    const newPlate = plate.clone();
    for (const wellId of newPlate.getWellIds()) {
      newPlate.getWell(wellId)?.clearContents();
    }
    setSrcPlates(srcPlates.map(p => (p.id === newPlate.id ? newPlate : p)));
  }

  const handleBarcodeChange = (value: string) => {
    if (!plate) return;
    const newPlate = plate.clone();
    newPlate.barcode = value;
    setSrcPlates(srcPlates.map(p => (p.id === newPlate.id ? newPlate : p)));
  };

  const handleMouseEnter = (e: React.MouseEvent) => {
    setApplyPopup({ event: applyDisabledReasons.length > 0 ? e : null, msgArr: applyDisabledReasons });
  };

  const handleMouseLeave = () => {
    setApplyPopup({ event: null, msgArr: [] });
  };

  const handlePlateSizeChange = (value: PlateSize) => {
    if (value === srcPlateSize) return;
    const filled = srcPlates.some(p => Object.values(p.getWells()).some(w => w.getContents().length > 0));
    if (filled && !window.confirm('Changing source plate size will reset the inventory plates. Continue?')) return;
    setSrcPlateSize(value);
    const newPlate = new Plate({ barcode: 'SRC001', plateSize: value, plateRole: 'source', plateType: '384PP_DMSO2' });
    setSrcPlates([newPlate]);
    setCurSrcPlateId(newPlate.id);
  };

  if (!plate) return <div className="p-3">Please select a source plate</div>;

  const colorConfig: ColorConfig = {
    scheme: 'compound',
    colorMap: generateEntityColors(inventoryContents(srcPlates), 0.5)
  };

  return (
    <Container fluid className="noselect design-wizard-container">
      <Row className="design-wizard-row">
        <Col md={3} className="design-wizard-col design-wizard-col-left">
          <div className="design-wizard-button-grid">
            <div onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
              <Button onClick={applyContentsToWells} disabled={!canApply} size="sm">
                Apply to Wells
              </Button>
            </div>
            <Button onClick={clearContentsFromWells} disabled={selectedWellIds.length === 0} variant="danger" size="sm">
              Clear from Wells
            </Button>
            <Button onClick={clearContentsFromAllWells} variant="danger" size="sm">
              Clear from All Wells
            </Button>
          </div>
          <InventoryManager
            form={form}
            setForm={setForm}
            selectedWellIds={selectedWellIds}
            contentList={contentList}
            currentContent={currentContent}
            activeAccordion={activeAccordion}
            setActiveAccordion={setActiveAccordion}
          />
        </Col>
        <Col
          md={9}
          className="design-wizard-col"
          style={{ scrollbarGutter: 'stable' }}
          onMouseDown={handleMouseDown}
          onDoubleClick={onDoubleClick}
        >
          <span className="d-flex justify-content-between gap-2">
            <FormField
              id="inventory-barcode"
              name="inventory-barcode"
              type="text"
              label="Barcode"
              value={plate.barcode}
              onChange={handleBarcodeChange}
              className="default-label-text w-auto form-field-compact"
            />
            <FormField
              id="cocktail-src-plate-size"
              name="cocktail-src-plate-size"
              type="select"
              label="Source Plate Size"
              value={srcPlateSize}
              onChange={handlePlateSizeChange}
              options={[
                { value: '96', label: '96' },
                { value: '384', label: '384' },
                { value: '1536', label: '1536' }
              ]}
              className="default-label-text w-auto form-field-compact"
            />
          </span>
          <PlateViewCanvas
            plate={plate}
            view="design"
            colorConfig={colorConfig}
            selectedWells={selectedWellIds}
            handleLabelClick={handleLabelClick}
          />
          <small className="text-muted">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.25rem' }}>
              <span><kbd>LeftClick</kbd> to select wells, drag to select groups</span>
              <span><kbd>LeftClick</kbd> on labels to select rows or columns</span>
              <span><kbd>Ctrl</kbd> + <kbd>LeftClick</kbd> to add to the selection</span>
              <span><kbd>ArrowKey</kbd> to move the selection</span>
              <span><kbd>Enter</kbd> to apply and advance</span>
            </div>
          </small>
        </Col>
      </Row>
      {applyPopup.msgArr.length > 0 ? <ApplyTooltip data={applyPopup} /> : ''}
    </Container>
  );
};

export default InventoryWizard;
