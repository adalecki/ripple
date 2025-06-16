import React, { useContext, useState } from 'react';
import { Row, Col, Alert } from 'react-bootstrap';
import { read, WorkBook } from 'xlsx';
import { Plate, PlateSize } from '../classes/PlateClass';
import { HslStringType } from '../classes/PatternClass';
import PlateView from './PlateView';
import { ColorConfig, generateCompoundColors } from '../utils/wellColors';
import '../../../css/PlateComponent.css';
import { CompoundInventory } from '../classes/EchoPreCalculatorClass';
import { echoInputValidation } from '../utils/validationUtils';
import { usePreferences } from '../../../hooks/usePreferences';
import { analyzeDilutionPatterns, executeAndRecordTransfer, prepareSrcPlates, buildSrcCompoundInventory } from '../utils/echoUtils';
import { TransferInfo, TransferStep } from '../classes/EchoCalculatorClass';
import { MappedPlatesContext } from '../contexts/Context';
import { currentPlate } from '../utils/plateUtils';
import EchoForm from './EchoForm';

const PlateMapper: React.FC = () => {
  const { mappedPlates, setMappedPlates, curMappedPlateId, setCurMappedPlateId } = useContext(MappedPlatesContext)
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [transferFile, setTransferFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [compoundColorMap, setCompoundColorMap] = useState<Map<string, HslStringType>>(new Map());
  const { preferences } = usePreferences()

  async function parseOriginalExcelFile(file: File) {
    const ab = await file.arrayBuffer();
    const wb = read(ab, { type: 'array' }) as WorkBook;
    const formValues = {
      'DMSO Tolerance': preferences.defaultDMSOTolerance,
      'Well Volume (µL)': preferences.defaultAssayVolume,
      'Backfill (µL)': preferences.defaultBackfill,
      'Allowed Error': preferences.defaultAllowedError
    }
    const { inputData, errors } = echoInputValidation(wb, formValues, preferences)
    return { inputData, errors }
  }

  async function parseTransferLog(file: File): Promise<TransferStep[]> {
    const text = await file.text();
    const lines = text.split('\n').filter(line => line.trim());

    if (lines.length < 2) {
      throw new Error('Transfer log file is empty or invalid');
    }

    // Parse header to find column indices
    const startIdx = lines.findIndex(l => l.split(',')[0].trim() == '[DETAILS]')
    const headers = lines[startIdx + 1].split(',').map(h => h.trim());
    const sourceBarcodeIdx = headers.findIndex(h => h === 'Source Plate Barcode');
    const sourceWellIdx = headers.findIndex(h => h === 'Source Well')
    const destBarcodeIdx = headers.findIndex(h => h === 'Destination Plate Barcode');
    const destWellIdx = headers.findIndex(h => h === 'Destination Well')
    const volumeIdx = headers.findIndex(h => h === 'Actual Volume');

    if ([sourceBarcodeIdx, sourceWellIdx, destBarcodeIdx, destWellIdx, volumeIdx].includes(-1)) {
      console.log([sourceBarcodeIdx, sourceWellIdx, destBarcodeIdx, destWellIdx, volumeIdx])
      throw new Error('Transfer log is missing required columns');

    }

    const transfers: TransferStep[] = [];

    // Parse data rows
    for (let i = startIdx + 2; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const cols = line.split(',').map(c => c.trim());

      if (isNaN(parseFloat(cols[volumeIdx]))) continue;

      transfers.push({
        sourceBarcode: cols[sourceBarcodeIdx],
        sourceWellId: cols[sourceWellIdx],
        destinationBarcode: cols[destBarcodeIdx],
        destinationWellId: cols[destWellIdx],
        volume: parseFloat(cols[volumeIdx])
      });
    }

    return transfers;
  };

  async function buildPlatesFromTransfers(): Promise<{ newPlates: { "source": Plate[], "intermediate": Plate[], "destination": Plate[] }, transfers: TransferStep[], compoundMap: CompoundInventory }> {
    const newPlates: { 'source': Plate[], 'intermediate': Plate[], 'destination': Plate[] } = {
      'source': [],
      'intermediate': [],
      'destination': []
    }
    if (!originalFile || !transferFile) {
      setErrors(['Please select both files']);
      return { newPlates, transfers: [], compoundMap: new Map() };
    }

    setErrors([]);
    const { inputData, errors } = await parseOriginalExcelFile(originalFile)
    if (errors.length > 0) setErrors(errors)

    const compoundMap = buildSrcCompoundInventory(inputData, preferences.sourcePlateSize as PlateSize);
    const dilutionPatterns = analyzeDilutionPatterns(inputData.Patterns)
    newPlates['source'] = prepareSrcPlates(compoundMap, preferences.sourcePlateSize as PlateSize, dilutionPatterns)
    const possibleBarcodes = {
      'source': new Set<string>(),
      'intermediate': new Set<string>(),
      'destination': new Set<string>()
    }
    inputData.Barcodes.map(row => row['Intermediate Plate Barcodes']).forEach(item => { if (item) { possibleBarcodes.intermediate.add(item) } })
    inputData.Barcodes.map(row => row['Destination Plate Barcodes']).forEach(item => { if (item) { possibleBarcodes.destination.add(item) } })

    // Parse transfer log
    const transfers = await parseTransferLog(transferFile);
    const transferBarcodes = new Set([...transfers.map(row => row.sourceBarcode), ...transfers.map(row => row.destinationBarcode)])

    const actualBarcodes = {
      'intermediate1': new Set<string>(),
      'intermediate2': new Set<string>(),
      'destination': new Set<string>()
    }

    for (const barcode of transferBarcodes) {
      if (newPlates['source'].some(p => p.barcode == barcode)) continue
      if (possibleBarcodes.destination.has(barcode) || (barcode.startsWith('DestPlate_') && !possibleBarcodes.intermediate.has(barcode))) {
        actualBarcodes.destination.add(barcode)
      }
      else if (possibleBarcodes.intermediate.has(barcode) || barcode.startsWith('IntPlate_')) {
        actualBarcodes.intermediate1.add(barcode) //by default assume int1
        for (const row of transfers.filter(r => r.destinationBarcode == barcode)) {
          if (!newPlates['source'].some(p => p.barcode == row.sourceBarcode)) {
            //if (!possibleBarcodes.source.has(row.sourceBarcode)) { //is actually int2, so delete from int1
            actualBarcodes.intermediate1.delete(barcode)
            actualBarcodes.intermediate2.add(barcode)
          }
        }
      }
      else {
        actualBarcodes.destination.add(barcode) //all others will be destination plates
      }
    }

    for (const bc of actualBarcodes.intermediate1) {
      const plate = new Plate({
        barcode: bc,
        plateSize: preferences.destinationPlateSize as PlateSize,
        plateRole: 'intermediate1'
      })
      for (const well of plate) {
        if (well) {
          well.addSolvent({ name: 'DMSO', volume: preferences.defaultBackfill as number });
        }
      }
      newPlates['intermediate'].push(plate)
    }
    for (const bc of actualBarcodes.intermediate2) {
      const plate = new Plate({
        barcode: bc,
        plateSize: preferences.destinationPlateSize as PlateSize,
        plateRole: 'intermediate2'
      })
      for (const well of plate) {
        if (well) {
          well.addSolvent({ name: 'DMSO', volume: preferences.defaultBackfill as number });
        }
      }
      newPlates['intermediate'].push(plate)
    }
    for (const bc of actualBarcodes.destination) {
      const plate = new Plate({
        barcode: bc,
        plateSize: preferences.destinationPlateSize as PlateSize,
        plateRole: 'destination'
      })
      for (const well of plate) {
        if (well) { well.addSolvent({ name: 'Assay Buffer', volume: preferences.defaultAssayVolume as number * 1000 }); }
      }
      newPlates['destination'].push(plate)
    }
    return { newPlates, transfers, compoundMap }
  };

  async function performTransfers() {
    const { newPlates, transfers, compoundMap } = await buildPlatesFromTransfers()

    const allPlates = [...newPlates['source'], ...newPlates['intermediate'], ...newPlates['destination']]

    for (const transfer of transfers) {
      const sourcePlate = allPlates.find(p => p.barcode == transfer.sourceBarcode)
      if (!sourcePlate) continue
      const sourceWell = sourcePlate.getWell(transfer.sourceWellId)
      if (!sourceWell) continue
      let transferInfo: TransferInfo
      if (sourceWell.isSolventOnlyWell('DMSO')) {
        transferInfo = {
          transferType: 'solvent',
          solventName: 'DMSO'
        }
      }
      else {
        transferInfo = {
          transferType: 'compound'
        }
      }
      executeAndRecordTransfer(transfer, transferInfo, newPlates['source'], newPlates['intermediate'], newPlates['destination'])
    }
    for (let i = 0; i < allPlates.length; i++) {
      allPlates[i].id = i + 1;
      let maxConcentration = 0;
      for (const well of allPlates[i]) {
        if (!well) continue;
        for (const content of well.getContents()) {
          if (content.compoundId) { maxConcentration = Math.max(maxConcentration, content.concentration) }
        }
      }
      allPlates[i].metadata.globalMaxConcentration = maxConcentration
    }
    setCompoundColorMap(generateCompoundColors(Array.from(compoundMap.keys())))
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
    <>
      <Row className="mb-3">
        <Col md={12}>
          <h4>Plate Mapper</h4>
          <p>Upload the original Excel template and Echo transfer log to visualize actual transfers</p>
        </Col>
      </Row>

      <Row className="mb-3">
        <Col md={3}>
          <EchoForm
            onSubmit={performTransfers}
            excelFile={originalFile}
            setExcelFile={setOriginalFile}
            transferFile={transferFile}
            setTransferFile={setTransferFile}
            submitText='Build Plate Maps'
            handleClear={handleClear}
          />
        </Col>
        <Col md={9}>
              {mappedPlates.length > 0 && plate && (
                <PlateView
                  plate={plate}
                  view="plateMapper"
                  colorConfig={colorConfig}
                />
              )}
        </Col>
      </Row>

      {errors.length > 0 && (
        <Row className="mb-3">
          <Col>
            <Alert variant="danger">
              {errors.map((error, idx) => (
                <div key={idx}>{error}</div>
              ))}
            </Alert>
          </Col>
        </Row>
      )}
    </>
  );
};

export default PlateMapper;