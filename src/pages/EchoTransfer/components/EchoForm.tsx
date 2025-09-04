import React, { useState, useEffect } from 'react';
import { Form, Button, Alert, Col, Row } from 'react-bootstrap';
import { usePreferences } from '../../../hooks/usePreferences';
import { PREFERENCES_CONFIG } from '../../../config/preferencesConfig';
import { FormField } from '../../../components/FormField';
import FileUploadCard from '../../../components/FileUploadCard';
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
  const { preferences } = usePreferences();
  const [formValues, setFormValues] = useState<{ [key: string]: number | boolean | string }>({});
  const [showAlert, setShowAlert] = useState<string[]>([])
  const [clearKey, setClearKey] = useState(0)

  let fields = PREFERENCES_CONFIG.find(p => p.id === 'calculator-defaults')?.settings || [];
  if (setTransferFile) {
    const retainedSettingsNames = ['Well Volume (µL)', 'Backfill (µL)', 'Use Source Survey Volumes']
    fields = fields.filter(s => retainedSettingsNames.includes(s.name))
  }
  else {
    fields = fields.filter(s => s.name != 'Use Source Survey Volumes')
  }

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

  const handleExcelFileSelected = async (files: File[]) => {
    if (files.length === 1) {
      const file = files[0];
      setExcelFile(file);

      const ab = await file.arrayBuffer()
      const wb = read(ab, { type: 'array' }) as WorkBook;
      const fieldNames = fields.map(f => f.name)
      const changedFields: string[] = []

      if (wb && wb.Sheets['Assay'] && fileHeaders(wb.Sheets['Assay'], ['Setting', 'Value'])) {
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
    } else if (files.length === 0) {
      setExcelFile(null);
    }
  };

  const handleTransferFileSelected = (files: File[]) => {
    if (setTransferFile) {
      if (files.length === 1) {
        setTransferFile(files[0]);
      } else if (files.length === 0) {
        setTransferFile(null);
      }
    }
  };

  const handleFieldChange = (fieldName: string, value: number | boolean) => {
    setFormValues(prev => ({
      ...prev,
      [fieldName]: value
    }));
  };

  const handleClearForm = () => {
    setExcelFile(null);
    if (setTransferFile) setTransferFile(null)
    setValidated(false);
    setShowAlert([])
    setClearKey(prev => prev + 1)
    handleClear();
  };

  const disabled: boolean = (!excelFile || (setTransferFile ? !transferFile : false))
  return (
    <>
      <Form noValidate validated={validated} onSubmit={handleSubmit}>
        <Row >
          <Col md={(setTransferFile ? '6' : '12')}>
            <FileUploadCard
              key={`excel-${clearKey}`}
              onFilesSelected={handleExcelFileSelected}
              acceptedTypes=".xlsx, .xls"
              title="Ripple Input"
              description="Original Ripple file"
              multiple={false}
              name='excelFile'
            >
              {excelFile && (
                <div className="mt-2">
                  <small className="text-success">
                    Selected: {excelFile.name}
                  </small>
                </div>
              )}
            </FileUploadCard>
          </Col>
          {setTransferFile && (
            <Col md='6'>
              <FileUploadCard
                key={`transfer-${clearKey}`}
                onFilesSelected={handleTransferFileSelected}
                acceptedTypes=".csv"
                title="Transfer Log"
                description="Echo output log"
                multiple={false}
                name='transferFile'
              >
                {transferFile && (
                  <div className="mt-2">
                    <small className="text-success">
                      Selected: {transferFile.name}
                    </small>
                  </div>
                )}
              </FileUploadCard>
            </Col>
          )}
        </Row>




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
        <Alert variant='warning' show={showAlert.length > 0} onClose={() => setShowAlert([])} dismissible transition>
          The following values were imported from the file:
          <ul>
            {showAlert.map((alert, idx) => <li key={idx}>{alert}</li>)}
          </ul>
        </Alert>
      </Form>
    </>
  );
};

export default EchoForm;