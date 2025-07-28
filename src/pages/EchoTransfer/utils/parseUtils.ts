import { WorkBook, read, utils, writeFile } from "xlsx";
import { PreferencesState } from "../../../hooks/usePreferences";
import { TransferInfo, TransferStep } from "../classes/EchoCalculatorClass";
import { CompoundInventory } from "../classes/EchoPreCalculatorClass";
import { HslStringType } from "../../../classes/PatternClass";
import { Plate, PlateSize } from "../../../classes/PlateClass";
import { buildSrcCompoundInventory, analyzeDilutionPatterns, prepareSrcPlates, InputDataType, executeAndRecordTransfer } from "./echoUtils";
import { generateCompoundColors } from "./wellColors";
import { formatWellBlock } from "./plateUtils";

export function constructPlatesFromTransfers(inputData: InputDataType, transfers: TransferStep[], preferences: PreferencesState, surveyedVolumes: Map<string, Map<string, number>>): { newPlates: { "source": Plate[], "intermediate": Plate[], "destination": Plate[] }, compoundMap: CompoundInventory } {
  const newPlates: { 'source': Plate[], 'intermediate': Plate[], 'destination': Plate[] } = {
    'source': [],
    'intermediate': [],
    'destination': []
  }

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
        well.addSolvent({ name: 'DMSO', volume: inputData.CommonData.intermediateBackfillVolume as number });
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
        well.addSolvent({ name: 'DMSO', volume: inputData.CommonData.intermediateBackfillVolume as number });
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
      if (well) { well.addSolvent({ name: 'Assay Buffer', volume: inputData.CommonData.finalAssayVolume as number * 1000 }); }
    }
    newPlates['destination'].push(plate)
  }
  if (inputData.CommonData.updateFromSurveyVolumes) {
    for (const plate of newPlates['source']) {
      const plateSurvey = surveyedVolumes.get(plate.barcode)
      if (!plateSurvey) continue
      for (const [wellId, volume] of plateSurvey) {
        const well = plate.getWell(wellId)
        if (!well || isNaN(volume)) continue
        well.updateVolume(volume * 1000)
      }
    }
  }
  return { newPlates, compoundMap }
};

export function performTransfers(newPlates: { "source": Plate[], "intermediate": Plate[], "destination": Plate[] }, transfers: TransferStep[], compoundMap: CompoundInventory): { allPlates: Plate[], colorMap: Map<string, HslStringType>, failures: string[] } {

  const allPlates = [...newPlates['source'], ...newPlates['intermediate'], ...newPlates['destination']]
  const failures: string[] = []

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
    const success = executeAndRecordTransfer(transfer, transferInfo, newPlates['source'], newPlates['intermediate'], newPlates['destination'])
    if (!success) failures.push(`${transfer.sourceBarcode} ${transfer.sourceWellId} to ${transfer.destinationBarcode} ${transfer.destinationWellId} - well (${sourceWell.getTotalVolume()}) less than tsfr (${transfer.volume})`)
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
  const colorMap = generateCompoundColors(Array.from(compoundMap.keys()))
  return { allPlates, colorMap, failures }
}

export async function parseTransferLog(file: File): Promise<{ transfers: TransferStep[], surveyedVolumes: Map<string, Map<string, number>> }> {
  const surveyedVolumes: Map<string, Map<string, number>> = new Map() //barcode, then wellId
  const text = await file.text();
  const lines = text.split('\n').filter(line => line.trim());

  if (lines.length < 2) {
    throw new Error('Transfer log file is empty or invalid');
  }

  const startIdx = lines.findIndex(l => l.split(',')[0].trim() == '[DETAILS]')
  const headers = lines[startIdx + 1].split(',').map(h => h.trim());
  const sourceBarcodeIdx = headers.findIndex(h => h === 'Source Plate Barcode');
  const sourceWellIdx = headers.findIndex(h => h === 'Source Well')
  const destBarcodeIdx = headers.findIndex(h => h === 'Destination Plate Barcode');
  const destWellIdx = headers.findIndex(h => h === 'Destination Well')
  const volumeIdx = headers.findIndex(h => h === 'Actual Volume');
  const surveyedIdx = headers.findIndex(h => h === 'Survey Fluid Volume')

  if ([sourceBarcodeIdx, sourceWellIdx, destBarcodeIdx, destWellIdx, volumeIdx].includes(-1)) {
    console.log([sourceBarcodeIdx, sourceWellIdx, destBarcodeIdx, destWellIdx, volumeIdx])
    throw new Error('Transfer log is missing required columns');
  }

  const transfers: TransferStep[] = [];

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
    let barcodeMap = surveyedVolumes.get(cols[sourceBarcodeIdx])
    if (!barcodeMap) {
      surveyedVolumes.set(cols[sourceBarcodeIdx], new Map())
      barcodeMap = surveyedVolumes.get(cols[sourceBarcodeIdx])
    }
    if (!barcodeMap) continue //shouldn't happen
    if (!barcodeMap.has(cols[sourceWellIdx])) { barcodeMap.set(cols[sourceWellIdx], parseFloat(cols[surveyedIdx])) }
  }

  return { transfers, surveyedVolumes };
};

export async function generateNewExcelTemplate(originalFile: File | null, mappedPlates: Plate[]) {
  if (!originalFile) return
  const newObj: InputDataType['Compounds'] = []
  const xAb = await originalFile.arrayBuffer();
  const xWb = read(xAb, { type: 'array' }) as WorkBook;
  const sheetNames = xWb.SheetNames
  if (!sheetNames.includes('Compounds')) return
  const xWs = utils.sheet_to_json(xWb.Sheets['Compounds']) as InputDataType['Compounds']
  for (const line of xWs) {
    const plate = mappedPlates.find(p => p.barcode == line["Source Barcode"])
    if (!plate) continue
    const newWells: Map<number, string[]> = new Map() //tracking volumes within a well block
    const wells = plate.getSomeWells(line["Well ID"])
    for (const well of wells) {
      const finalVol = well.getTotalVolume()
      if (newWells.has(finalVol)) {
        newWells.set(finalVol, [...newWells.get(finalVol)!, well.id])
      }
      else {
        newWells.set(finalVol, [well.id])
      }
    }
    for (const [volume, wellIds] of newWells) {
      const wellBlock = formatWellBlock(wellIds)
      newObj.push({ 'Source Barcode': line["Source Barcode"], 'Well ID': wellBlock, 'Concentration (µM)': line["Concentration (µM)"], 'Compound ID': line["Compound ID"], 'Volume (µL)': volume/1000, 'Pattern': line.Pattern })
    }

  }
  const newCompoundWs = utils.json_to_sheet(newObj);

  const compoundsHeaders = [
    'Source Barcode', 'Well ID', 'Concentration (µM)', 'Compound ID', 'Volume (µL)', 'Pattern'
  ];
  utils.sheet_add_aoa(newCompoundWs, [compoundsHeaders], { origin: "A1" });

  //utils.book_append_sheet(xWb, newCompoundWs, "NewCompounds");
  xWb.Sheets['Compounds'] = newCompoundWs

  const fileName = `Echo_UpdatedTemplate_${new Date().toISOString().split('T')[0]}.xlsx`;
  writeFile(xWb, fileName);
}