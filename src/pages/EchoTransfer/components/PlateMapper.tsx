import React, { useContext, useEffect, useRef, useState } from 'react';
import { Row, Col, Alert, Container } from 'react-bootstrap';
import { read, WorkBook } from 'xlsx';
import { HslStringType } from '../classes/PatternClass';
import PlateView from './PlateView';
import { ColorConfig } from '../utils/wellColors';
import '../../../css/PlateComponent.css';
import { echoInputValidation } from '../utils/validationUtils';
import { usePreferences } from '../../../hooks/usePreferences';
import { MappedPlatesContext } from '../contexts/Context';
import { currentPlate } from '../utils/plateUtils';
import { constructPlatesFromTransfers, parseTransferLog, performTransfers } from '../utils/parseUtils';
import EchoForm from './EchoForm';

const PlateMapper: React.FC = () => {
  const { mappedPlates, setMappedPlates, curMappedPlateId, setCurMappedPlateId } = useContext(MappedPlatesContext)
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [transferFile, setTransferFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [compoundColorMap, setCompoundColorMap] = useState<Map<string, HslStringType>>(new Map());
  const [alertMaxHeight, setAlertMaxHeight] = useState<number>(200);
  const { preferences } = usePreferences();
  
  const alertContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const calculateAlertMaxHeight = () => {
      if (!alertContainerRef.current) return;

      const alertContainer = alertContainerRef.current;
      const rect = alertContainer.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const availableHeight = viewportHeight - rect.top - 20;
      
      setAlertMaxHeight(Math.max(100, availableHeight));
    };

    if (errors.length > 0) {
      setTimeout(calculateAlertMaxHeight, 0);
    }

    window.addEventListener('resize', calculateAlertMaxHeight);
    return () => window.removeEventListener('resize', calculateAlertMaxHeight);
  }, [errors]);

  const handleSubmit = async (formData: FormData) => {
    setErrors([])
    //never should happen, should be prevented by form validation and disabled button, but as a fallback
    if (!originalFile || !transferFile) {
      setErrors(['Please select both files']);
      return
    }
    const formValues: { [key: string]: any } = {};
    for (let [key, value] of formData.entries()) {
      formValues[key] = value;
    }
    formValues['DMSO Tolerance'] = preferences.defaultDMSOTolerance
    formValues['Allowed Error'] = preferences.defaultAllowedError

    const xAb = await formValues.excelFile.arrayBuffer();
    const xWb = read(xAb, { type: 'array' }) as WorkBook;
    const { inputData, errors } = echoInputValidation(xWb, formValues, preferences)
    if (errors.length > 0) {
      setErrors(errors)
      return
    }
    const transfers = await parseTransferLog(transferFile);
    const { newPlates, compoundMap } = constructPlatesFromTransfers(inputData, transfers, preferences)
    const { allPlates, colorMap, failures } = performTransfers(newPlates, transfers, compoundMap)
    if (failures) setErrors(prev => [...prev, ...failures])
    setCompoundColorMap(colorMap)
    setMappedPlates(allPlates)
    allPlates.length > 0 ? setCurMappedPlateId(allPlates[0].id) : null
  }

  const handleClear = () => {
    setOriginalFile(null)
    setTransferFile(null)
    setErrors([])
    setCompoundColorMap(new Map())
    setMappedPlates([])
  }

  const plate = currentPlate(mappedPlates, curMappedPlateId)
  const colorConfig: ColorConfig = {
    scheme: 'compound',
    colorMap: compoundColorMap,
    maxConcentration: plate?.metadata.globalMaxConcentration
  }

  return (
    <Container fluid>
      <Row className="mb-3">
        <Col md={12}>
          <h4>Plate Mapper</h4>
          <p>Upload the original Excel template and Echo transfer log to visualize actual transfers</p>
        </Col>
      </Row>

      <Row className="mb-3">
        <Col md={3}>
          <EchoForm
            onSubmit={handleSubmit}
            excelFile={originalFile}
            setExcelFile={setOriginalFile}
            transferFile={transferFile}
            setTransferFile={setTransferFile}
            submitText='Build Plate Maps'
            handleClear={handleClear}
          />
          {errors.length > 0 && (
            <div ref={alertContainerRef}>
              <Alert 
                variant="danger"
                style={{
                  maxHeight: `${alertMaxHeight}px`,
                  overflowY: 'auto',
                  marginBottom: 0,
                  fontSize: '0.9rem'
                }}
              >
                {errors.map((error, idx) => (
                  <div key={idx}>{error}</div>
                ))}
              </Alert>
            </div>
          )}
        </Col>
        <Col md={8}>
          {mappedPlates.length > 0 && plate && (
            <PlateView
              plate={plate}
              view="plateMapper"
              colorConfig={colorConfig}
            />
          )}
        </Col>
      </Row>
    </Container >
  );
};

export default PlateMapper;