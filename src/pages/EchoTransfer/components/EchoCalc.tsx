import React, { useState, useContext } from 'react';
import { Col, Row } from 'react-bootstrap';
import { read, WorkBook } from 'xlsx';

import { EchoPreCalculator } from '../classes/EchoPreCalculatorClass';
import { EchoCalculator, TransferStep } from '../classes/EchoCalculatorClass';
import { CheckpointTracker } from '../classes/CheckpointTrackerClass';
import { customSort, InputDataType } from '../utils/echoUtils';
import { echoInputValidation } from '../utils/validationUtils';
import { currentPlate } from '../utils/plateUtils';
import { ColorConfig, generateCompoundColors } from '../utils/wellColors';
import { PlatesContext } from '../contexts/Context';
import { HslStringType } from '../classes/PatternClass';
import { usePreferences } from '../../../hooks/usePreferences';

import CheckpointDisplayModal from './CheckpointDisplayModal';
import EchoForm from './EchoForm';
import TransferListDownload from './TransferListDownload';
import PlateView from './PlateView';


const EchoCalc: React.FC = () => {
  const { plates, setPlates, curPlateId, setCurPlateId } = useContext(PlatesContext);
  const [file, setFile] = useState<File | null>(null)
  const [input, setInput] = useState<{ inputData: InputDataType; errors: string[]; } | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [echoPreCalc, setEchoPreCalc] = useState<EchoPreCalculator | null>(null);
  const [checkpointTracker, setCheckpointTracker] = useState(new CheckpointTracker());
  const [compoundColorMap, setCompoundColorMap] = useState<Map<string, HslStringType>>(new Map());
  const [transferMap, setTransferMap] = useState<Map<number,TransferStep[]>>(new Map())
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
    formValues['Use Intermediate Plates'] = formData.get('Use Intermediate Plates') === 'on';
    formValues['DMSO Normalization'] = formData.get('DMSO Normalization') === 'on';

    const ab = await formValues.inputFile.arrayBuffer()

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
      const prevPlates = [...plates]
      for (let newPlate of newPlates) {
        const id = prevPlates.length > 0 ? Math.max(...prevPlates.map(p => p.id)) + 1 : 1
        newPlate.id = id
        if (!prevPlates.find((plate) => plate.barcode == newPlate.barcode)) {
          prevPlates.push(newPlate)
        }
        if (prevPlates.length === 1) { setCurPlateId(newPlate.id) }
      }
      setPlates(prevPlates)
      let compounds: string[] = []
      for (let cpd of input.inputData.Compounds) {
        compounds.push(cpd['Compound ID'])
      }
      compounds = Array.from(new Set(compounds))
      setCompoundColorMap(generateCompoundColors(compounds))
      const sortedTransferMap = customSort(structuredClone(calc.transferSteps), calc)
      let sortedTransferList2: TransferStep[] = []
      for (const [_, steps] of sortedTransferMap) {
        sortedTransferList2 = sortedTransferList2.concat(steps)
      }
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
    <div>
      <CheckpointDisplayModal
        showModal={showModal}
        checkpointTracker={checkpointTracker}
        echoPreCalc={echoPreCalc}
        handleClose={handleClose}
        handleCancel={handleCancel}
        handleContinue={handleContinue}
        setEchoPreCalc={setEchoPreCalc}
        setCheckpointTracker={setCheckpointTracker}
        initialInputData={input ? input.inputData : null}
        preferences={preferences}
      />
      <Row>
        <Col md="3">
          <EchoForm
            onSubmit={handleSubmit}
            file={file}
            setFile={setFile}
            handleClear={handleClear}
          />
        </Col>
        <Col md="7">
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
    </div>
  );
};

export default EchoCalc;