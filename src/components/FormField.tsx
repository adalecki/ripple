import React from 'react';
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
  unit?: string;
  step?: number;
  accept?: string;
  className?: string;
  error?: string;
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
    error
  }, ref) => {
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const newValue = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked :
        e.target.type === 'number' ||
          (e.target instanceof HTMLSelectElement && options?.[0]?.value !== undefined &&
            typeof options[0].value === 'number') ? parseFloat(e.target.value) :
          e.target.type === 'file' ? (e.target as HTMLInputElement).files :
            e.target.value;
      onChange(newValue);
    };

    const renderInput = () => {
      switch (type) {
        case 'number':
          return (
            <input
              type="number"
              id={id}
              name={name}
              value={value ?? ''}
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
              value={value ?? ''}
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
                  checked={Boolean(value)}
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
              value={value ?? ''}
              onChange={handleInputChange}
              required={required}
              disabled={disabled}
              placeholder={placeholder}
              className="form-control"
            />
          );
      }
    };

    //const baseClassName = `form-field${type === 'file' ? '-file' : ''} ${type === 'switch' ? 'form-field-switch' : ''} ${className}`;
    const baseClassName = `form-field ${type === 'switch' ? 'form-field-switch' : ''} ${type === 'file' ? 'form-field-file' : ''} ${className}`;

    // For switch type, we don't need the extra label since it's included in the switch component
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
