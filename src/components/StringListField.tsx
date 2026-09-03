import React, { useState } from 'react';
import { Button, Form, ListGroup } from 'react-bootstrap';
import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react';
import InfoTooltip from './InfoTooltip';

interface StringListFieldProps {
  id: string;
  label: string;
  value: string[];
  onChange: (value: string[]) => void;
  tooltip?: string;
}

const StringListField: React.FC<StringListFieldProps> = ({ id, label, value, onChange, tooltip }) => {
  const [draft, setDraft] = useState('');

  const trimmed = draft.trim();
  const canAdd = trimmed !== '' && !value.includes(trimmed);

  const handleAdd = () => {
    if (!canAdd) return;
    onChange([...value, trimmed]);
    setDraft('');
  };

  const handleRemove = (item: string) => {
    onChange(value.filter(v => v !== item));
  };

  const handleShift = (item: string, dir: 'up' | 'down') => {
    const itemIdx = value.findIndex(i => i == item)
    if (itemIdx < 0) return
    const newIdx = dir == 'up' ? itemIdx - 1 : itemIdx + 1;
    const arr = [...value]
    arr.splice(newIdx, 0, arr.splice(itemIdx, 1)[0])

    onChange([...arr])
  }


  return (
    <div className='mb-3'>
      <label htmlFor={id} className='form-label'>
        {label}
        {tooltip && <InfoTooltip text={tooltip} />}
      </label>
      <div className='mb-2 d-flex justify-content-between align-items-center gap-2'>
        <Form.Control
          id={id}
          type='text'
          value={draft}
          placeholder='New value'
          className='text-start'
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAdd();
            }
          }}
        />
        <Button variant='outline-success' onClick={handleAdd} disabled={!canAdd}>
          <Plus size={16} />
        </Button>
      </div>
      <ListGroup>
        {value.map((item,idx) => (
          <ListGroup.Item key={item} className='d-flex justify-content-between align-items-center py-1'>
            {item}
            <span>
            <Button variant='link' size='sm' className='text-danger p-0' onClick={() => handleRemove(item)} title={`Remove ${item}`} disabled={value.length < 2}>
              <X size={16} />
            </Button>
            <Button variant='link' size='sm' onClick={() => handleShift(item,'up')} disabled={idx == 0}>
              <ArrowUp />
            </Button>
            <Button variant='link' size='sm' onClick={() => handleShift(item,'down')} disabled={idx == value.length - 1}>
              <ArrowDown />
            </Button>
            </span>
          </ListGroup.Item>
        ))}
      </ListGroup>
    </div>
  );
};

export default StringListField;