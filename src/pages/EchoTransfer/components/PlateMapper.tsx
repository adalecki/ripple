import React, { useContext, useState } from 'react';
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
  const { preferences } = usePreferences()

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
            <Alert variant="danger">
              {errors.map((error, idx) => (
                <div key={idx}>{error}</div>
              ))}
            </Alert>
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