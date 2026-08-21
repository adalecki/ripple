import React from 'react';
import { Accordion, Form } from 'react-bootstrap';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { FormField } from '../../../components/FormField';
import InfoTooltip from '../../../components/InfoTooltip';
import { InventoryForm } from './InventoryWizard';
import { PLATE_TYPE_OPTIONS } from '../utils/combinatorUtils';

interface InventoryManagerProps {
  form: InventoryForm;
  setForm: React.Dispatch<React.SetStateAction<InventoryForm>>;
  selectedWellIds: string[];
  contentList: string[];
  currentContent: string | null;
  activeAccordion: string | null;
  setActiveAccordion: React.Dispatch<React.SetStateAction<string | null>>;
}

const InventoryManager: React.FC<InventoryManagerProps> = ({
  form,
  setForm,
  selectedWellIds,
  contentList,
  currentContent,
  activeAccordion,
  setActiveAccordion
}) => {
  const handleFieldChange = (fieldName: keyof InventoryForm, value: string | number) => {
    setForm({ ...form, [fieldName]: value });
  };

  return (
    <div>
      <small className="text-muted">
        {selectedWellIds.length} well{selectedWellIds.length === 1 ? '' : 's'} selected
      </small>

      <FormField
        id="inventory-volume"
        name="inventory-volume"
        type="number"
        label="Well Volume"
        value={form.volume}
        onChange={value => handleFieldChange('volume', value)}
        unit="µL"
        min={0}
        required
      />
      <FormField
        id="plate-type"
        name="plate-type"
        type="select"
        label="Plate Type"
        value={form.plateType}
        options={PLATE_TYPE_OPTIONS}
        onChange={value => handleFieldChange('plateType', value)}
        required
        tooltip='The fluid class but listed as "Plate Type" in Echo software; can be set well-by-well.'
      />

      <Accordion activeKey={activeAccordion} onSelect={k => setActiveAccordion(k as string | null)}>
        <Accordion.Item eventKey="basic">
          <Accordion.Header onClick={e => (e.currentTarget as HTMLElement).blur()}>Basic</Accordion.Header>
          <Accordion.Body>
            <FormField
              id="inventory-content"
              name="inventory-content"
              type="text"
              label="Content"
              value={form.content}
              onChange={value => handleFieldChange('content', value)}
              required
            />
          </Accordion.Body>
        </Accordion.Item>

        <Accordion.Item eventKey="advanced">
          <Accordion.Header onClick={e => (e.currentTarget as HTMLElement).blur()}>
            Advanced
            <InfoTooltip text={<>Select wells on the plate, then press <kbd>Enter</kbd> to apply and advance to the next content. Can use arrow keys to navigate to different wells.</>} />
          </Accordion.Header>
          <Accordion.Body>
            <Form.Label>Content List</Form.Label>
            <Form.Control
              as="textarea"
              rows={4}
              value={form.contentListText}
              placeholder="One content name per line"
              style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}
              onChange={e => setForm({ ...form, contentListText: e.target.value, currentIdx: 0 })}
            />
            <div className="d-flex align-items-center justify-content-between mt-2">
              <button
                type="button"
                className="item-list-btn"
                onClick={e => {
                  (e.currentTarget as HTMLElement).blur();
                  setForm({ ...form, currentIdx: Math.max(0, form.currentIdx - 1) });
                }}
                disabled={contentList.length === 0}
              >
                <ChevronLeft size={16} />
              </button>
              <small className="text-muted text-center">
                {currentContent
                  ? <>Next stamp: <strong>{currentContent}</strong> ({form.currentIdx + 1} of {contentList.length})</>
                  : 'No contents in list'}
              </small>
              <button
                type="button"
                className="item-list-btn"
                onClick={e => {
                  (e.currentTarget as HTMLElement).blur();
                  setForm({ ...form, currentIdx: Math.min(contentList.length - 1, form.currentIdx + 1) });
                }}
                disabled={contentList.length === 0}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </Accordion.Body>
        </Accordion.Item>
      </Accordion>
    </div>
  );
};

export default InventoryManager;
