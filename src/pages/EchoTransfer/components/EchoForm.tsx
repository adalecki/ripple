import React, { useState, useRef, useEffect } from 'react';
import { Form, Button } from 'react-bootstrap';
import { usePreferences } from '../../../hooks/usePreferences';
import { PREFERENCES_CONFIG } from '../../../config/preferencesConfig';
import { FormField } from '../../../components/FormField';
import '../../../css/EchoForm.css';

interface EchoFormProps {
  onSubmit: (formData: FormData) => Promise<void>;
  file: File | null;
  setFile: (file: File | null) => void;
  handleClear: () => void;
}

const EchoForm: React.FC<EchoFormProps> = ({
  onSubmit,
  setFile,
  handleClear
}) => {
  const [validated, setValidated] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { preferences } = usePreferences();
  const [formValues, setFormValues] = useState<{ [key: string]: number | boolean | string }>({});

  const fields = PREFERENCES_CONFIG.find(p => p.id === 'calculator-defaults')?.settings || [];

  useEffect(() => {
    const newValues: { [key: string]: number | boolean | string } = {};
    fields.forEach(field => {
      newValues[field.name] = preferences[field.prefId] ?? field.defaultValue;
    });
    setFormValues(newValues);
  }, [preferences]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;

    if (form.checkValidity() === false) {
      e.stopPropagation();
    } else {
      const formData = new FormData(form);
      await onSubmit(formData);
    }
    setValidated(true);
  };

  const handleFileChange = (files: FileList | null) => {
    if (files && files.length === 1) {
      setFile(files[0]);
    } else {
      setFile(null);
    }
  };

  const handleFieldChange = (fieldName: string, value: number | boolean) => {
    setFormValues(prev => ({
      ...prev,
      [fieldName]: value
    }));
  };

  const handleClearForm = () => {
    // Reset file input by clearing its value
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    
    // Reset file state in parent component
    setFile(null);
    
    // Reset form validation state
    setValidated(false);
    
    // Call parent's clear handler
    handleClear();
  };

  return (
    <Form noValidate validated={validated} onSubmit={handleSubmit}>
      <FormField
        id="inputFile"
        name="inputFile"
        type="file"
        label="Input File"
        onChange={handleFileChange}
        required={true}
        accept=".xlsx,.xls"
        ref={fileInputRef}
      />

      {fields.map((field) => (
        <FormField
          key={field.name}
          id={field.prefId}
          name={field.name}
          type={field.type === 'number' ? 'number' : 'switch'}
          label={field.name}
          value={formValues[field.name]}
          onChange={(value) => handleFieldChange(field.name, value)}
          required={true}
          unit={field.unit}
          step={field.step}
        />
      ))}

      <br />
      <div className='form-buttons'>
        <Button type="submit">Submit form</Button>
        <Button variant="outline-danger" onClick={handleClearForm}>Clear Plates</Button>
      </div>
    </Form>
  );
};

export default EchoForm;