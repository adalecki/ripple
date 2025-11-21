import React, { useContext, useEffect, useRef, useState } from 'react';
import { Row, Col, Alert, Container, Button } from 'react-bootstrap';
import { read, WorkBook } from 'xlsx';
import { HslStringType } from '../../../classes/PatternClass';
import PlateView from '../../../components/PlateView';
import { ColorConfig } from '../../../utils/wellColors';
import '../../../css/PlateComponent.css';
import { echoInputValidation } from '../../EchoTransfer/utils/validationUtils';
import { usePreferences } from '../../../hooks/usePreferences';
import { MappedPlatesContext } from '../../../contexts/Context';
import { currentPlate } from '../../../utils/plateUtils';
import { constructPlatesFromTransfers, generateNewExcelTemplate, parseTransferLog, performTransfers } from '../../EchoTransfer/utils/parseUtils';
import EchoForm from '../../EchoTransfer/components/EchoForm';

const PlateMapper: React.FC = () => {
  const { mappedPlates, setMappedPlates, curMappedPlateId, setCurMappedPlateId } = useContext(MappedPlatesContext);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [transferFile, setTransferFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [compoundColorMap, setCompoundColorMap] = useState<Map<string, HslStringType>>(new Map());
  const [alertMaxHeight, setAlertMaxHeight] = useState<number>(200);
  const { preferences } = usePreferences();

  const alertContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function calculateAlertMaxHeight() {
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
    setErrors([]);

    if (!originalFile || !transferFile) {
      setErrors(['Please select both files']);
      return;
    }

    const formValues: { [key: string]: any } = {};
    for (let [key, value] of formData.entries()) {
      formValues[key] = value;
    }
    formValues['DMSO Tolerance'] = preferences.defaultDMSOTolerance;
    formValues['Allowed Error'] = preferences.defaultAllowedError;

    try {
      const xAb = await originalFile.arrayBuffer();
      const xWb = read(xAb, { type: 'array' }) as WorkBook;
      const { inputData, errors } = echoInputValidation(xWb, formValues, preferences);

      if (errors.length > 0) {
        setErrors(errors);
        return;
      }

      const { transfers, surveyedVolumes } = await parseTransferLog(transferFile);
      const { newPlates, compoundMap } = constructPlatesFromTransfers(inputData, transfers, preferences, surveyedVolumes);
      const { allPlates, colorMap, failures } = performTransfers(newPlates, transfers, compoundMap);

      if (failures.length > 0) {
        setErrors(prev => [...prev, ...failures]);
      }

      setCompoundColorMap(colorMap);
      setMappedPlates(allPlates);
      if (allPlates.length > 0) {
        setCurMappedPlateId(allPlates[0].id);
      }
    } catch (error) {
      setErrors([`Error processing files: ${error instanceof Error ? error.message : 'Unknown error'}`]);
    }
  };

  const handleClear = () => {
    setOriginalFile(null);
    setTransferFile(null);
    setErrors([]);
    setCompoundColorMap(new Map());
    setMappedPlates([]);
  };

  const plate = currentPlate(mappedPlates, curMappedPlateId);
  const colorConfig: ColorConfig = {
    scheme: 'compound',
    colorMap: compoundColorMap,
    maxConcentration: plate?.metadata.globalMaxConcentration
  };

  return (
    <Container fluid className='h-100 pb-2'>
      <Row className="h-100">
        <Col md={4} className='d-flex flex-column h-100 overflow-auto' style={{ scrollbarGutter: 'stable' }}>
          <h4>Plate Mapper</h4>
          <p>Upload the original Excel template and Echo transfer log to visualize actual transfers</p>
          <EchoForm
            onSubmit={handleSubmit}
            excelFile={originalFile}
            setExcelFile={setOriginalFile}
            transferFile={transferFile}
            setTransferFile={setTransferFile}
            submitText='Build Plate Maps'
            handleClear={handleClear}
          />
          <Button
            onClick={() => generateNewExcelTemplate(originalFile, mappedPlates)}
            className="mt-3"
            disabled={!originalFile || mappedPlates.length < 1}
            variant='success'
          >
            Download Updated Input File (Volumes)
          </Button>

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

        {mappedPlates.length > 0 && plate && originalFile && (
          <Col md={8} className='d-flex flex-column h-100 overflow-auto' style={{ scrollbarGutter: 'stable' }}>
            <PlateView
              plate={plate}
              view="plateMapper"
              colorConfig={colorConfig}
            />
          </Col>
        )}
      </Row>
    </Container>
  );
};

export default PlateMapper;