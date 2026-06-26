import React, { useState, useContext } from 'react';
import { Alert, Col, Container, Row } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { read, WorkBook } from 'xlsx';

import { EchoPreCalculator } from '../classes/EchoPreCalculatorClass';
import { EchoCalculator } from '../classes/EchoCalculatorClass';
import { CheckpointTracker } from '../classes/CheckpointTrackerClass';
import { customSort, InputDataType } from '../utils/echoUtils';
import { echoInputValidation } from '../utils/validationUtils';
import { currentPlate, TransferStepExport } from '../../../utils/plateUtils';
import { ColorConfig, generateEntityColors } from '../../../utils/wellColors';
import { PlatesContext } from '../../../contexts/Context';
import { HslStringType } from '../../../classes/PatternClass';
import { usePreferences } from '../../../hooks/usePreferences';

import CheckpointDisplayModal from './CheckpointDisplayModal';
import EchoForm from './EchoForm';
import TransferListDownload from '../../../components/TransferListDownload';
import PlateView from '../../../components/PlateView';
import DestMapDownload from './DestMapDownload';

import '../../../css/EchoCalc.css'

interface EchoCalcProps {
  showExamples: () => void;
}

const EchoCalc: React.FC<EchoCalcProps> = ({ showExamples }) => {
  const { plates, setPlates, curPlateId, setCurPlateId } = useContext(PlatesContext);
  const [file, setFile] = useState<File | null>(null)
  const [input, setInput] = useState<{ inputData: InputDataType; errors: string[]; } | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [echoPreCalc, setEchoPreCalc] = useState<EchoPreCalculator | null>(null);
  const [checkpointTracker, setCheckpointTracker] = useState(new CheckpointTracker());
  const [compoundColorMap, setCompoundColorMap] = useState<Map<string, HslStringType>>(new Map());
  const [transferMap, setTransferMap] = useState<Map<number, TransferStepExport[]>>(new Map())
  const [showAlert, setShowAlert] = useState<string[]>([])
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
    setShowAlert([])

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
    setShowAlert([])
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
      setCompoundColorMap(generateEntityColors(compounds))
      const sortedTransferMap = customSort(structuredClone(calc.transferSteps), calc)
      setTransferMap(sortedTransferMap)
      if (calc.errors.length > 0) setShowAlert([...calc.errors])
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

  const destinationPlates = plates.filter(p => p.plateRole === 'destination')

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
          Upload formatted Excel template to calculate transfers
          <small className="text-muted fst-italic mb-3">
            <Link to="/platedesigner">Design</Link> a template from scratch, or{" "}
            <button
              type="button"
              className="link-button"
              onClick={showExamples}
            >
              download
            </button>{" "}
            an example.
          </small>
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
          <div className="d-flex gap-2 w-100 button-row">
            {transferMap.size > 0 && echoPreCalc && (
              <div className="flex-fill">
                <TransferListDownload
                  transferMap={transferMap}
                  splitOutputCSVs={preferences.splitOutputCSVs as boolean}
                />
              </div>
            )}

            {destinationPlates && destinationPlates.length > 0 && (
              <div className="flex-fill">
                <DestMapDownload destinationPlates={destinationPlates} />
              </div>
            )}
          </div>
          <Alert variant='danger' show={showAlert.length > 0} onClose={() => setShowAlert([])} dismissible transition>
            The following errors occurred:
            <ul>
              {showAlert.map((alert, idx) => <li key={idx}>{alert}</li>)}
            </ul>
          </Alert>
        </Col>
      </Row>
    </Container>
  );
};

export default EchoCalc;