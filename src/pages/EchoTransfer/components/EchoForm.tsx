import React, { useState, useRef, useEffect } from 'react';
import { Form, Button, Alert } from 'react-bootstrap';
import { usePreferences } from '../../../hooks/usePreferences';
import { PREFERENCES_CONFIG } from '../../../config/preferencesConfig';
import { FormField } from '../../../components/FormField';
import '../../../css/EchoForm.css';
import { read, utils, WorkBook } from 'xlsx';
import { fileHeaders } from '../utils/validationUtils';

interface EchoFormProps {
  onSubmit: (formData: FormData) => Promise<void>;
  excelFile: File | null;
  setExcelFile: (file: File | null) => void;
  transferFile?: File | null;
  setTransferFile?: (file: File | null) => void;
  submitText: string;
  handleClear: () => void;
}

const EchoForm: React.FC<EchoFormProps> = ({
  onSubmit,
  excelFile,
  setExcelFile,
  transferFile,
  setTransferFile,
  submitText,
  handleClear
}) => {
  const [validated, setValidated] = useState(false);
  const excelInputRef = useRef<HTMLInputElement>(null);
  const transferInputRef = useRef<HTMLInputElement>(null);
  const { preferences } = usePreferences();
  const [formValues, setFormValues] = useState<{ [key: string]: number | boolean | string }>({});
  const [showAlert, setShowAlert] = useState<string[]>([])

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

  const handleExcelFileChange = async (files: FileList | null) => {
    if (files && files.length === 1) {
      setExcelFile(files[0]);
      const ab = await files[0].arrayBuffer()
      let wb = read(ab, { type: 'array' }) as WorkBook;
      const fieldNames = fields.map(f => f.name)
      const changedFields: string[] = []
      if (wb.Sheets['Assay'] && fileHeaders(wb.Sheets['Assay'], ['Setting', 'Value'])) {
        const assayNumbers: { 'Setting': string, 'Value': number }[] = utils.sheet_to_json(wb.Sheets['Assay'])
        for (const line of assayNumbers) {
          if (fieldNames.includes(line.Setting) && !isNaN(line.Value) && formValues[line.Setting] != line.Value) {
            handleFieldChange(line.Setting, line.Value)
            changedFields.push(line.Setting)
          }
        }
      }
      if (changedFields.length > 0) {
        setShowAlert(changedFields)
      }
    } else {
      setExcelFile(null);
    }
  };

  const handleTransferFileChange = async (files: FileList | null) => {
    if (setTransferFile && files && files.length === 1) {
      setTransferFile(files[0])
    }
  }

  const handleFieldChange = (fieldName: string, value: number | boolean) => {
    setFormValues(prev => ({
      ...prev,
      [fieldName]: value
    }));
  };

  const handleClearForm = () => {
    if (excelInputRef.current) {
      excelInputRef.current.value = '';
    }
    if (transferInputRef.current) {
      transferInputRef.current.value = '';
    }
    setExcelFile(null);
    if (setTransferFile) setTransferFile(null)
    setValidated(false);
    setShowAlert([])
    handleClear();
  };

  const disabled: boolean = (!excelFile || (setTransferFile ? !transferFile : false))
  return (
    <>
      <Form noValidate validated={validated} onSubmit={handleSubmit}>
        <FormField
          id="excelFile"
          name="excelFile"
          type="file"
          label="Input File (Excel)"
          onChange={handleExcelFileChange}
          required={true}
          accept=".xlsx,.xls"
          ref={excelInputRef}
        />
        {setTransferFile ?
          <FormField
            id="transferFile"
            name="transferFile"
            type="file"
            label="Transfer Log (CSV)"
            onChange={handleTransferFileChange}
            required={true}
            accept=".csv"
            ref={transferInputRef}
          /> : ''}

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
          <Button type="submit" disabled={disabled}>{submitText}</Button>
          <Button variant="outline-danger" onClick={handleClearForm}>Clear Plates</Button>
        </div>
        <br />
        <Alert variant='warning' show={showAlert.length > 0} onClose={() => setShowAlert([])} dismissible transition>The following values were imported from the file: <ul>{showAlert.map(alert => <li>{alert}</li>)}</ul></Alert>

      </Form>

    </>
  );
};

export default EchoForm;