import React, { useState, useContext } from 'react';
import { Col, Container, Row } from 'react-bootstrap';
import { read, WorkBook } from 'xlsx';

import { EchoPreCalculator } from '../classes/EchoPreCalculatorClass';
import { EchoCalculator, TransferStep } from '../classes/EchoCalculatorClass';
import { CheckpointTracker } from '../classes/CheckpointTrackerClass';
import { customSort, InputDataType } from '../utils/echoUtils';
import { echoInputValidation } from '../utils/validationUtils';
import { currentPlate } from '../utils/plateUtils';
import { ColorConfig, generateCompoundColors } from '../utils/wellColors';
import { PlatesContext } from '../../../contexts/Context';
import { HslStringType } from '../../../classes/PatternClass';
import { usePreferences } from '../../../hooks/usePreferences';

import CheckpointDisplayModal from './CheckpointDisplayModal';
import EchoForm from './EchoForm';
import TransferListDownload from './TransferListDownload';
import PlateView from '../../../components/PlateView';


const EchoCalc: React.FC = () => {
  const { plates, setPlates, curPlateId, setCurPlateId } = useContext(PlatesContext);
  const [file, setFile] = useState<File | null>(null)
  const [input, setInput] = useState<{ inputData: InputDataType; errors: string[]; } | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [echoPreCalc, setEchoPreCalc] = useState<EchoPreCalculator | null>(null);
  const [checkpointTracker, setCheckpointTracker] = useState(new CheckpointTracker());
  const [compoundColorMap, setCompoundColorMap] = useState<Map<string, HslStringType>>(new Map());
  const [transferMap, setTransferMap] = useState<Map<number, TransferStep[]>>(new Map())
  const { preferences } = usePreferences()

  const handleClose = () => setShowModal(false);

  const handleCancel = () => {
    setEchoPreCalc(null);
    setShowModal(false);
  };

  const handleClear = () => {
    setEchoPreCalc(null)
    setCheckpointTracker(new CheckpointTracker())
    setCompoundColorMap(new Map())
    setTransferMap(new Map())
    setPlates([])
    setFile(null)

  }

  const handleSubmit = async (formData: FormData) => {

    const formValues: { [key: string]: any } = {};
    for (let [key, value] of formData.entries()) {
      formValues[key] = value;
    }

    const ab = await formValues.excelFile.arrayBuffer()

    const fileCheckpointName = "File Validation";
    const mutableCheckpointTracker = checkpointTracker.clone();
    if (!mutableCheckpointTracker.getCheckpoints().has(fileCheckpointName)) {
      mutableCheckpointTracker.addCheckpoint(fileCheckpointName);
    }

    let wb = read(ab, { type: 'array' }) as WorkBook;
    let input = echoInputValidation(wb, formValues, preferences);


    if (input.errors.length === 0) {
      setInput(input);
      mutableCheckpointTracker.updateCheckpoint(fileCheckpointName, "Passed");
      const preCalc = new EchoPreCalculator(input.inputData, mutableCheckpointTracker, preferences);
      preCalc.calculateNeeds();
      setEchoPreCalc(preCalc);
      setShowModal(true);
    } else {
      mutableCheckpointTracker.updateCheckpoint(fileCheckpointName, "Failed", input.errors);
    }

    setCheckpointTracker(mutableCheckpointTracker);
    setShowModal(true);
  };

  const handleContinue = () => {
    if (echoPreCalc && input) {
      const mutableCheckpointTracker = checkpointTracker.clone();
      const calc = new EchoCalculator(echoPreCalc, mutableCheckpointTracker);
      setCheckpointTracker(mutableCheckpointTracker);
      const newPlates = [...calc.sourcePlates, ...calc.intermediatePlates, ...calc.destinationPlates];
      for (let i = 0; i < newPlates.length; i++) {
        let newPlate = newPlates[i]
        newPlate.id = i + 1
      }
      setCurPlateId(1)
      setPlates(newPlates)
      let compounds: string[] = []
      for (let cpd of input.inputData.Compounds) {
        compounds.push(cpd['Compound ID'])
      }
      compounds = Array.from(new Set(compounds))
      setCompoundColorMap(generateCompoundColors(compounds))
      const sortedTransferMap = customSort(structuredClone(calc.transferSteps), calc)
      setTransferMap(sortedTransferMap)
      console.log(calc, echoPreCalc)
    }

    setShowModal(false);
  };

  const plate = currentPlate(plates, curPlateId)
  const colorConfig: ColorConfig = {
    scheme: 'compound',
    colorMap: compoundColorMap,
    maxConcentration: plate?.metadata.globalMaxConcentration
  }

  return (
    <Container fluid className='h-100 pb-2'>
      <CheckpointDisplayModal
        showModal={showModal}
        checkpointTracker={checkpointTracker}
        echoPreCalc={echoPreCalc}
        handleClose={handleClose}
        handleCancel={handleCancel}
        handleContinue={handleContinue}
        setEchoPreCalc={setEchoPreCalc}
        setCheckpointTracker={setCheckpointTracker}
      />
      <Row className='h-100' style={{ minHeight: 0 }}>
        <Col md={4} className='d-flex flex-column h-100 overflow-auto' style={{ scrollbarGutter: 'stable' }}>
          <h4>Transfer Calculator</h4>
          <p>Upload formatted Excel template to calculate transfers</p>
          <EchoForm
            onSubmit={handleSubmit}
            excelFile={file}
            setExcelFile={setFile}
            submitText='Submit form'
            handleClear={handleClear}
          />
        </Col>
        <Col md={8} className='d-flex flex-column h-100 overflow-auto' style={{ scrollbarGutter: 'stable' }}>
          {(plate && compoundColorMap) ?
            <PlateView
              plate={plate}
              view="echoCalc"
              colorConfig={colorConfig}
            /> : "Please submit a template file to calculate transfer list"}
          <br />
          {transferMap.size > 0 && echoPreCalc && <TransferListDownload transferMap={transferMap} splitOutputCSVs={preferences.splitOutputCSVs as boolean} />}
        </Col>
      </Row>
    </Container>
  );
};

export default EchoCalc;