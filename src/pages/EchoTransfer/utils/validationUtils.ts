import { utils, WorkBook, WorkSheet } from 'xlsx'
import { Plate, PlateSize } from '../classes/PlateClass';
import { InputDataType } from './echoUtils';
import { PreferencesState } from '../../../hooks/usePreferences';
import { getCoordsFromWellId } from './plateUtils';

function arraysMatch(arr1: any[], arr2: any[]) {
  if (arr1.length !== arr2.length) return false
  for (let i = 0; i < arr1.length; i++) {
    if (arr1[i] !== arr2[i]) return false
  }
  return true
}

function fileHeaders(ws: WorkSheet, validHeaders: string[]) {
  let headers = []
  for (let key in ws) {
    let regEx = new RegExp("^\(\\w\)\(1\){1}$")
    if (regEx.test(key) == true) {
      headers.push(ws[key].v)
    }
  }
  return (arraysMatch(headers, validHeaders))
}

// intended to make sure just the basic file structure is correct, i.e. worksheet headers and all values filled in
export function echoInputValidation(wb: WorkBook, formValues: { [key: string]: any }, preferences: PreferencesState) {
  const srcTestPlate = new Plate({ plateSize: preferences.sourcePlateSize as PlateSize})
  const dstTestPlate = new Plate({ plateSize: preferences.destinationPlateSize as PlateSize})
  let validHeaders: { [key: string]: string[] } = {}
  validHeaders['Patterns'] = ['Pattern', 'Type', 'Direction', 'Replicates', 'Conc1', 'Conc2', 'Conc3', 'Conc4', 'Conc5', 'Conc6', 'Conc7', 'Conc8', 'Conc9', 'Conc10', 'Conc11', 'Conc12', 'Conc13', 'Conc14', 'Conc15', 'Conc16', 'Conc17', 'Conc18', 'Conc19', 'Conc20']
  validHeaders['Layout'] = ['Pattern', 'Well Block']
  validHeaders['Compounds'] = ['Source Barcode', 'Well ID', 'Concentration (µM)', 'Compound ID', 'Volume (µL)', 'Pattern']
  validHeaders['Barcodes'] = ['Intermediate Plate Barcodes', 'Destination Plate Barcodes']
  let errors: string[] = []
  let inputData = <InputDataType>{}
  if (fileHeaders(wb.Sheets['Layout'], validHeaders['Layout'])) {
    inputData['Layout'] = utils.sheet_to_json(wb.Sheets['Layout'])
  }
  else {
    errors.push('Error in Layout headers')
  }
  if (fileHeaders(wb.Sheets['Patterns'], validHeaders['Patterns'])) {
    inputData['Patterns'] = utils.sheet_to_json(wb.Sheets['Patterns'])
  }
  else {
    errors.push('Error in Patterns headers')
  }
  if (fileHeaders(wb.Sheets['Compounds'], validHeaders['Compounds'])) {
    inputData['Compounds'] = utils.sheet_to_json(wb.Sheets['Compounds'])
  }
  else {
    errors.push('Error in Compounds headers')
  }
  if (fileHeaders(wb.Sheets['Barcodes'], validHeaders['Barcodes'])) {
    inputData['Barcodes'] = utils.sheet_to_json(wb.Sheets['Barcodes'])
  }
  else {
    errors.push('Error in Barcodes headers')
  }

  if (errors.length == 0) {
    const availablePatternNames = patternsTabValidation(inputData, errors)
    if (errors.length == 0) {
      layoutTabValidation(inputData, dstTestPlate, availablePatternNames, errors)
      const srcBarcodes = compoundsTabValidation(inputData, srcTestPlate, availablePatternNames, errors)
      barcodesTabValidation(inputData, srcBarcodes, errors)
      if (!isNaN(formValues['DMSO Tolerance']) && !isNaN(formValues['Well Volume (µL)']) && !isNaN(formValues['Backfill (µL)']) && !isNaN(formValues['Allowed Error'])) {
        const CommonData: InputDataType['CommonData'] = {
          maxDMSOFraction: parseFloat(formValues['DMSO Tolerance']),
          finalAssayVolume: parseFloat(formValues['Well Volume (µL)']),
          intermediateBackfillVolume: parseFloat(formValues['Backfill (µL)']),
          allowableError: parseFloat(formValues['Allowed Error']),
          destReplicates: parseInt(formValues['Destination Replicates']),
          createIntConcs: Boolean(formValues['Use Intermediate Plates']),
          dmsoNormalization: Boolean(formValues['DMSO Normalization'])
        }
        inputData.CommonData = CommonData
    
      }
      else { errors.push('Error in input form') }
    }
  }
  return { inputData, errors }
}

function patternsTabValidation(inputData: InputDataType, errors: string[]): Map<string, { replicates: number, concentrations: number[] }> {
  const availablePatternNames: Map<string, { replicates: number, concentrations: number[] }> = new Map
  for (let idx in inputData['Patterns']) {
    const row = inputData['Patterns'][idx] as { [key: string]: any }
    const patternName = inputData['Patterns'][idx]['Pattern']
      if (!availablePatternNames.has(patternName)) {
        availablePatternNames.set(patternName, { replicates: 0, concentrations: [] })
      }
      else {
        errors.push(`${patternName} on line ${parseInt(idx) + 2} is already present earlier`)
      }
    if (!['Control','Treatment','Solvent','Combination'].includes(row.Type)) {
      errors.push(`${row.Type} on line ${parseInt(idx) + 2} of Patterns tab is not valid (must be Control, Treatment, Solvent, or Combination)`)
    }
    const pattern = availablePatternNames.get(patternName)!
    if (row.Type != 'Solvent') {
      if (row.Type == 'Combination') {
        const directions = row.Direction.split("-")
        if (directions.length < 2) {
          errors.push(`${row.Direction} on line ${parseInt(idx) + 2} of Patterns tab is not valid (only ${directions.length} included, need at least two)`)
        }
        for (const dir of directions) {
          if (!['LR','RL','TB','BT'].includes(dir)) {
            errors.push(`${row.Direction} on line ${parseInt(idx) + 2} of Patterns tab is not valid (${dir} must be LR, RL, TB, or BT)`)
          }
        }
      }
      else {
        if (!['LR', 'RL', 'TB', 'BT'].includes(row.Direction)) {
          errors.push(`${row.Direction} on line ${parseInt(idx) + 2} of Patterns tab is not valid (must be LR, RL, TB, or BT)`)
        }
      }
      if (!(parseInt(row.Replicates.toString()) == row.Replicates)) {
        errors.push(`${row.Replicates} on line ${parseInt(idx) + 2} of Patterns tab is not a valid integer`)
      }
      
      else { pattern.replicates = row.Replicates }
      for (let i = 1; i <= 20; i++) {
        const concKey = `Conc${i}`;
        if (row[concKey] !== undefined) {
          if (isNaN(parseFloat(row[concKey]))) {
            errors.push(`${concKey} on line ${parseInt(idx) + 2} of Patterns tab is not a valid number`)
          }
          else {
            pattern.concentrations.push(row[concKey])
          }
        }
      }
    }
  }
  return availablePatternNames
}

function layoutTabValidation(inputData: InputDataType, testPlate: Plate, availablePatternNames: Map<string, { replicates: number, concentrations: number[] }>, errors: string[]) {
  for (let idx in inputData['Layout']) {
    try {
      const pattern = availablePatternNames.get(inputData['Layout'][idx]['Pattern'])
      if (!pattern) {
        errors.push(`${inputData['Layout'][idx]['Pattern']} on line ${parseInt(idx) + 2} of Layout tab not present on Patterns tab`)
      }
      else {
        const blockRanges = inputData['Layout'][idx]['Well Block'].split(';');
        const cornerWellIds = blockRanges.flatMap(block => block.split(':'))
        let safeCornerWells = true;
        for (const cornerWellId of cornerWellIds) {
          const cornerWellCoords = getCoordsFromWellId(cornerWellId)
          if (cornerWellCoords.row >= testPlate.rows || cornerWellCoords.col >= testPlate.columns) {
            safeCornerWells = false
          }
        }
        if (safeCornerWells) {
          const wells = testPlate.getSomeWells(inputData['Layout'][idx]['Well Block'])
          if (!(wells.length == (pattern!.concentrations!.length * pattern!.replicates!))) {
            errors.push(`Well block size in line ${parseInt(idx) + 2} of Layout tab does not match with number of concentrations and replicates on Patterns tab`)
          }
        }
        else {
          errors.push(`Well block in line ${parseInt(idx) + 2} of Layout tab does not fit on destination plate of size ${testPlate.rows * testPlate.columns}`)
        }
      }
    } catch (err) {
      errors.push(`Area ${inputData['Layout'][idx]['Well Block']} on line ${parseInt(idx) + 2} of Layout tab is not valid`)
    }
  }
}

function compoundsTabValidation(inputData: InputDataType, testPlate: Plate, availablePatternNames: Map<string, { replicates: number, concentrations: number[] }>, errors: string[]): string[] {
  const srcBarcodes: string[] = []
  const usedWellIdsMap: Map<string, string[]> = new Map();
  for (let idx in inputData['Compounds']) {
    const cpd = inputData['Compounds'][idx]
    if (!(cpd['Compound ID'].length > 0)) {
      errors.push(`Line ${parseInt(idx) + 2} of Compounds tab lacks a compound ID`)
      break
    }
    if (!(cpd['Source Barcode'].length > 0)) {
      errors.push(`${cpd['Compound ID']} on line ${parseInt(idx) + 2} of Compounds tab lacks a source plate barcode`)
    }
    else {
      if (!srcBarcodes.includes(cpd['Source Barcode'])) { 
        srcBarcodes.push(cpd['Source Barcode']) 
        usedWellIdsMap.set(cpd['Source Barcode'],[])
      }
    }
    try {
      const usedWellIds = usedWellIdsMap.get(cpd['Source Barcode'])
      if (!usedWellIds) break
      const blockRanges = cpd['Well ID'].split(';');
      const cornerWellIds = blockRanges.flatMap(block => block.split(':'))
      let safeCornerWells = true;
      for (const cornerWellId of cornerWellIds) {
        const cornerWellCoords = getCoordsFromWellId(cornerWellId)
        if (cornerWellCoords.row >= testPlate.rows || cornerWellCoords.col >= testPlate.columns) {
          safeCornerWells = false
        }
      }
      if (safeCornerWells) {
        const wells = testPlate.getSomeWells(cpd['Well ID'])
        for (const well of wells) {
          if (!usedWellIds.includes(well.id)) {
            usedWellIds.push(well.id)
          }
          else {
            errors.push(`${cpd['Compound ID']} on line ${parseInt(idx) + 2} of Compounds tab is listed in well ${well.id} which already has contents`)
          }
        }
      }
      else {
        errors.push(`Well block in line ${parseInt(idx) + 2} of Compounds tab does not fit on source plate of size ${testPlate.rows * testPlate.columns}`)
      }

    } catch (err) {
      errors.push(`${cpd['Compound ID']} on line ${parseInt(idx) + 2} of Compounds tab has an invalid source location`)
    }
    try {
      if (isNaN(cpd['Volume (µL)'])) { errors.push(`${cpd['Compound ID']} on line ${parseInt(idx) + 2} of Compounds tab has a non-number Volume`) }
      else if (!(cpd['Volume (µL)'] > 0)) { errors.push(`${cpd['Compound ID']} on line ${parseInt(idx) + 2} of Compounds tab has a negative Volume`) }
    } catch (err) {
      errors.push(`${cpd['Compound ID']} on line ${parseInt(idx) + 2} of Compounds tab lacks a Volume`)
    }
    if (cpd['Compound ID'] != 'DMSO') {
      try {
        if (isNaN(cpd['Concentration (µM)'])) { errors.push(`${cpd['Compound ID']} on line ${parseInt(idx) + 2} of Compounds tab has a non-number Concentration`) }
        else if (!(cpd['Concentration (µM)'] > 0)) { errors.push(`${cpd['Compound ID']} on line ${parseInt(idx) + 2} of Compounds tab has a negative Concentration`) }
      } catch (err) {
        errors.push(`${cpd['Compound ID']} on line ${parseInt(idx) + 2} of Compounds tab lacks a Concentration`)
      }
      const patterns = cpd['Pattern'].split(';')
      for (const patternName of patterns) {
        if (!availablePatternNames.has(patternName)) {
          errors.push(`${patternName} on line ${parseInt(idx) + 2} of Compounds tab not present on Patterns tab`)
        }
      }
    }
  }
  return srcBarcodes
}

function barcodesTabValidation(inputData: InputDataType, srcBarcodes: string[], errors: string[]) {
  const barcodes = { int: [] as string[], dest: [] as string[] }
  for (let idx in inputData['Barcodes']) {
    const row = inputData['Barcodes'][idx]
    if (srcBarcodes.includes(row['Intermediate Plate Barcodes'])) { errors.push(`Line ${parseInt(idx) + 2} of Barcodes tab has a an Intermediate barcode listed as a Source on the Compounds tab`) }
    if (srcBarcodes.includes(row['Destination Plate Barcodes'])) { errors.push(`Line ${parseInt(idx) + 2} of Barcodes tab has a a Destination barcode listed as a Source on the Compounds tab`) }
    if (!barcodes.int.includes(row['Intermediate Plate Barcodes'])) { barcodes.int.push(row['Intermediate Plate Barcodes']) }
    else { errors.push(`Line ${parseInt(idx) + 2} of Barcodes tab has a repeated Intermediate barcode`) }
    if (!barcodes.dest.includes(row['Destination Plate Barcodes'])) { barcodes.dest.push(row['Destination Plate Barcodes']) }
    else { errors.push(`Line ${parseInt(idx) + 2} of Barcodes tab has a repeated Destination barcode`) }
  }
}

//@ts-ignore
//TODO implmenent checking for valid pattern names now that they don't need to start with Control or Treatment
function validPatternName(patternName: string, errors: string[]): boolean {
  if (!(patternName.startsWith('Control') || patternName.startsWith('Treatment'))) {
    errors.push('Pattern name ' + patternName + ' does not start with "Treatment" or "Control"')
    return false
  }
  let substringIdx = 7
  if (patternName.startsWith('Treatment')) { substringIdx = 9 }
  const numString = patternName.substring(substringIdx)
  if (!(parseInt(numString).toString() == numString)) {
    errors.push(`${patternName} iterator ${numString} is not an integer`)
    return false
  }
  return true
}

/**
 * Measures the execution time of a given function and logs it to the console.
 * @param name A descriptive name for the operation being timed.
 * @param fn The function to be executed and timed.
 * @returns The result of the executed function.
 */
export function timeFunction<T>(name: string, fn: () => T): T {
  const start = performance.now();
  const result = fn();
  const end = performance.now();
  const executionTime = end - start;
  console.log(`${name} took ${executionTime.toFixed(2)} milliseconds`);
  return result;
}

export type timeObj = {
    name: string,
    time: number
  }[]

export function timeIt(timeObj: timeObj, step: string) {
  if (timeObj.length == 0) {timeObj.push({name: 'start',time: performance.now()})}
  const nowPoint = {name: step, time: performance.now()}
  const lastPointIdx = timeObj.length - 1
  timeObj.push(nowPoint)
  console.log(step,(nowPoint.time - timeObj[lastPointIdx].time))
  return timeObj
}