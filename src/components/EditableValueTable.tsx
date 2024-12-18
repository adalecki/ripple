import React, { useState, useEffect, KeyboardEvent, ClipboardEvent } from 'react';
import { Table } from 'react-bootstrap';
import '../css/EditableValueTable.css';

export interface TableValue {
  id: number;
  value: number | null;
  label?: string;
}

interface EditableValueTableProps {
  tableId: string;
  values: TableValue[];
  onChange: (values: TableValue[]) => void;
  disabled?: boolean;
  showLabels?: boolean;
  showDelete?: boolean;
  canAdd?: boolean;
  defaultValue?: number;
  valueLabel?: string;
  onAdd?: () => void;
  onDelete?: (id: number) => void;
  formatValue?: (value: number) => string;
  parseValue?: (value: string) => number;
}

const EditableValueTable: React.FC<EditableValueTableProps> = ({
  tableId,
  values,
  onChange,
  disabled = false,
  showLabels = false,
  showDelete = true,
  canAdd = false,
  valueLabel = '',
  onAdd,
  onDelete,
  formatValue = (v: number) => v.toString(),
  parseValue = (v: string) => parseFloat(v),
}) => {
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  const [editingValues, setEditingValues] = useState<{ [key: number]: string }>({});

  useEffect(() => {
    if (focusIndex !== null) {
      const inputToFocus = document.getElementById(`${tableId}-value-${focusIndex}`);
      if (inputToFocus) {
        (inputToFocus as HTMLInputElement).focus();
      }
      setFocusIndex(null);
    }
  }, [focusIndex]);

  const handleChange = (id: number, inputValue: string) => {
    setEditingValues(prev => ({ ...prev, [id]: inputValue }));

    // Only update the actual value if it's a valid number
    if (inputValue === '') {
      const newValues = values.map(v =>
        v.id === id ? { ...v, value: null } : v
      );
      onChange(newValues);
    } else {
      const numberValue = parseValue(inputValue);
      if (!isNaN(numberValue)) {
        const newValues = values.map(v =>
          v.id === id ? { ...v, value: numberValue } : v
        );
        onChange(newValues);
      }
    }
  };

  const handleBlur = (id: number) => {
    // Clean up the editing value when the input loses focus
    setEditingValues(prev => {
      const newValues = { ...prev };
      delete newValues[id];
      return newValues;
    });
  };

  const getDisplayValue = (item: TableValue): string => {
    if (item.id in editingValues) {
      return editingValues[item.id];
    }
    return item.value !== null ? formatValue(item.value) : '';
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, currentId: number) => {
    const currentIndex = values.findIndex(v => v.id === currentId);

    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      if (currentIndex < values.length - 1) {
        setFocusIndex(values[currentIndex + 1].id);
      } else if (canAdd && onAdd) {
        onAdd();
        setFocusIndex(values.length);
      }
    } else if (e.key === 'ArrowUp' && currentIndex > 0) {
      e.preventDefault();
      setFocusIndex(values[currentIndex - 1].id);
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>, currentId: number) => {
    e.preventDefault();
    const pasteData = e.clipboardData
      .getData('text')
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line !== '')
      .map(value => parseValue(value))
      .filter(value => !isNaN(value));

    if (pasteData.length === 0) return;

    const currentIndex = values.findIndex(v => v.id === currentId);
    const newValues = [...values];

    pasteData.forEach((value, index) => {
      const targetIndex = currentIndex + index;
      if (targetIndex < newValues.length) {
        newValues[targetIndex] = { ...newValues[targetIndex], value };
      } else if (canAdd) {
        newValues.push({ id: Date.now() + index, value, label: `${newValues.length + 1}` });
      }
    });

    onChange(newValues);
  };

  const handleDelete = (id: number) => {
    if (onDelete) {
      onDelete(id);
    } else {
      onChange(values.filter(v => v.id !== id));
    }
  };

  return (
    <div className="editable-value-table">
      <Table size="sm">
        <thead>
          <tr>
            {showLabels && <th>#</th>}
            <th>{valueLabel}</th>
            {showDelete && <th></th>}
          </tr>
        </thead>
        <tbody>
          {values.map((item) => (
            <tr key={item.id}>
              {showLabels && (
                <td>
                  <div className="label">{item.label || item.id}</div>
                </td>
              )}
              <td className="value-cell">
                <input
                  id={`${tableId}-value-${item.id}`}
                  type="text"
                  inputMode="decimal"
                  value={getDisplayValue(item)}
                  onChange={(e) => handleChange(item.id, e.target.value)}
                  onBlur={() => handleBlur(item.id)}
                  onKeyDown={(e) => handleKeyDown(e, item.id)}
                  onPaste={(e) => handlePaste(e, item.id)}
                  disabled={disabled}
                  className="value-input"
                  onFocus={(e) => e.target.select()}
                />
              </td>
              {showDelete && (
                <td>
                  <button 
                    onClick={() => handleDelete(item.id)}
                    className={`delete-btn ${disabled ? 'disabled' : ''}`}
                    disabled={disabled}
                  >
                    ×
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
};

export default EditableValueTable;