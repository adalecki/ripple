import React, { useEffect, useState } from 'react';
import { useDebounce } from 'use-debounce';
import '../css/FormField.css'

export type FormFieldType = 'text' | 'number' | 'select' | 'switch' | 'file';

export interface FormFieldOption {
  value: string | number;
  label: string;
}

export interface FormFieldProps {
  id: string;
  name: string;
  type: FormFieldType;
  label: string;
  value?: any;
  onChange: (value: any) => void;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  options?: FormFieldOption[];
  unit?: string | React.ReactNode;
  step?: number;
  accept?: string;
  className?: string;
  error?: string;
  debounce?: number; 
}

export const FormField = React.forwardRef<HTMLInputElement, FormFieldProps>(
  ({
    id,
    name,
    type,
    label,
    value,
    onChange,
    required = false,
    disabled = false,
    placeholder = '',
    options = [],
    unit,
    step,
    accept,
    className = '',
    error,
    debounce
  }, ref) => {
    const [internalValue, setInternalValue] = useState(value);
    const [debouncedValue] = useDebounce(internalValue, debounce || 0);

    // Update internal value when external value changes
    useEffect(() => {
      setInternalValue(value);
    }, [value]);

    // Call onChange when debounced value changes (only if debouncing is enabled)
    useEffect(() => {
      if (debounce && debouncedValue !== value) {
        onChange(debouncedValue);
      }
    }, [debouncedValue, debounce, onChange, value]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const newValue = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked :
        e.target.type === 'number' ||
          (e.target instanceof HTMLSelectElement && options?.[0]?.value !== undefined &&
            typeof options[0].value === 'number') ? (!isNaN(parseFloat(e.target.value)) ? parseFloat(e.target.value) : '') :
          e.target.type === 'file' ? (e.target as HTMLInputElement).files :
            e.target.value;
      
      if (debounce) {
        setInternalValue(newValue);
      } else {
        onChange(newValue);
      }
    };

    const renderInput = () => {
      const displayValue = debounce ? internalValue : value;

      switch (type) {
        case 'number':
          return (
            <input
              type="number"
              id={id}
              name={name}
              value={displayValue ?? ''}
              onChange={handleInputChange}
              required={required}
              disabled={disabled}
              placeholder={placeholder}
              step={step}
              className="form-control"
            />
          );

        case 'select':
          return (
            <select
              id={id}
              name={name}
              value={displayValue ?? ''}
              onChange={handleInputChange}
              required={required}
              disabled={disabled}
              className="form-select"
            >
              {options.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          );

        case 'switch':
          return (
            <div className="switch-container">
              <div className="form-check form-switch">
                <input
                  type="checkbox"
                  id={id}
                  name={name}
                  checked={Boolean(displayValue)}
                  onChange={handleInputChange}
                  disabled={disabled}
                  className="form-check-input"
                />
                <label className="form-check-label" htmlFor={id}>
                  {label}
                </label>
              </div>
            </div>
          );

        case 'file':
          return (
            <input
              ref={ref}
              type="file"
              id={id}
              name={name}
              onChange={handleInputChange}
              required={required}
              disabled={disabled}
              accept={accept}
              className="form-control"
            />
          );

        default:
          return (
            <input
              type="text"
              id={id}
              name={name}
              value={displayValue ?? ''}
              onChange={handleInputChange}
              required={required}
              disabled={disabled}
              placeholder={placeholder}
              className="form-control"
            />
          );
      }
    };

    const baseClassName = `form-field ${type === 'switch' ? 'form-field-switch' : ''} ${type === 'file' ? 'form-field-file' : ''} ${className}`.trim();

    return type === 'switch' ? (
      <div className={baseClassName}>
        {renderInput()}
        {error && <div className="form-field-error">{error}</div>}
      </div>
    ) : (
      <div className={baseClassName}>
        <label htmlFor={id} className="form-label">{label}</label>
        <div className="form-field-input">
          {renderInput()}
        </div>
        {unit && <span className="unit-label">{unit}</span>}
        {error && <div className="form-field-error">{error}</div>}
      </div>
    );
  }
);