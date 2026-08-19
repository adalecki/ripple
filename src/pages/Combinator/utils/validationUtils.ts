import { utils, type WorkBook, type WorkSheet } from "xlsx";
import { Plate, PlateSize } from "../../../classes/PlateClass";
import { getCoordsFromWellId } from "../../../utils/plateUtils";
import { MAX_COMBINATION_SLOTS } from "../types/combinatorTypes";
import { COMBINATOR_HEADERS, InputDataType } from "./combinatorUtils";


function arraysMatch(arr1: any[], arr2: any[]) {
  if (arr1.length !== arr2.length) return false
  for (let i = 0; i < arr1.length; i++) {
    if (arr1[i] !== arr2[i]) return false
  }
  return true
}

export function fileHeaders(ws: WorkSheet, validHeaders: string[]) {
  let headers = []
  for (let key in ws) {
    let regEx = new RegExp("^\(\\w\)\(1\){1}$")
    if (regEx.test(key) == true) {
      headers.push(ws[key].v)
    }
  }
  return (arraysMatch(headers, validHeaders))
}

export interface ValidationPreferences {
  dropletSize?: number;
  sourcePlateSize?: PlateSize;
  destinationPlateSize?: PlateSize;
}

export function isDropletMultiple(volume: number, dropletSize: number): boolean {
  const steps = volume / dropletSize;
  return Math.abs(steps - Math.round(steps)) < 1e-9;
}

export function validateInputData(inputData: InputDataType, preferences: ValidationPreferences = {}): string[] {
  const errors: string[] = []
  const dstTestPlate = new Plate({ plateSize: preferences.destinationPlateSize ?? '384' })
  const srcTestPlate = new Plate({ plateSize: preferences.sourcePlateSize ?? '384' })
  const availablePatternNames = patternsTabValidation(inputData, dstTestPlate, errors, preferences.dropletSize)
  const contents = sourceLayoutTabValidation(inputData, srcTestPlate, errors)
  combinationsTabValidation(inputData, availablePatternNames, contents, errors)
  return errors
}

export function echoInputValidation(wb: WorkBook, preferences: ValidationPreferences = {}): {inputData: InputDataType, errors: string[]} {
  let errors: string[] = []
  let inputData: InputDataType = {
    Patterns: [],
    SourceLayout: [],
    Combinations: []
  }
  if (fileHeaders(wb.Sheets['Patterns'], COMBINATOR_HEADERS['Patterns'])) {
    inputData['Patterns'] = utils.sheet_to_json(wb.Sheets['Patterns'])
  }
  else {
    errors.push('Error in Patterns headers')
  }
  if (fileHeaders(wb.Sheets['SourceLayout'], COMBINATOR_HEADERS['SourceLayout'])) {
    inputData['SourceLayout'] = utils.sheet_to_json(wb.Sheets['SourceLayout'])
  }
  else {
    errors.push('Error in SourceLayout headers')
  }
  if (fileHeaders(wb.Sheets['Combinations'], COMBINATOR_HEADERS['Combinations'])) {
    inputData['Combinations'] = utils.sheet_to_json(wb.Sheets['Combinations'])
  }
  else {
    errors.push('Error in Combinations headers')
  }
  if (errors.length == 0) {
    inputData = stringConversion(inputData)
  }
  errors.push(...validateInputData(inputData, preferences))
  return { inputData, errors }
}

function stringConversion(inputData: InputDataType) {
  for (let lineIdx in inputData.Patterns) {
    inputData.Patterns[lineIdx]['Name'] = (inputData.Patterns[lineIdx]['Name']?.toString().trim() || '');
  }
  for (let lineIdx in inputData.SourceLayout) {
    inputData.SourceLayout[lineIdx]['Source Barcode'] = (inputData.SourceLayout[lineIdx]['Source Barcode']?.toString().trim() || '');
    inputData.SourceLayout[lineIdx]['Content'] = (inputData.SourceLayout[lineIdx]['Content']?.toString().trim() || '');
    inputData.SourceLayout[lineIdx]['Plate Type'] = (inputData.SourceLayout[lineIdx]['Plate Type']?.toString().trim() || '');
  }
  for (let lineIdx in inputData.Combinations) {
    inputData.Combinations[lineIdx]['Pattern'] = (inputData.Combinations[lineIdx]['Pattern']?.toString().trim() || '');
    for (let i = 1; i <= MAX_COMBINATION_SLOTS; i++) {
      const header = `Comp${i}`;
      const row = inputData.Combinations[lineIdx] as Record<string, string | undefined>;
      if (row[header]) { row[header] = row[header]!.toString().trim() || ''; }
    }
  }
  return inputData
}

function patternsTabValidation(inputData: InputDataType, testPlate: Plate, errors: string[], dropletSize?: number): string[] {
  const availablePatternNames: string[] = []
  for (let idx in inputData['Patterns']) {
    const row = inputData['Patterns'][idx] as { [key: string]: any }
    const patternName = inputData['Patterns'][idx]['Name']
    if (!availablePatternNames.includes(patternName)) {
      availablePatternNames.push(patternName)
    }
    else {
      errors.push(`${patternName} on line ${parseInt(idx) + 2} is already present earlier`)
    }
    if (!row['Replicates'] || Number.isNaN(parseInt(row['Replicates'].toString()))) {
      errors.push(`${row['Replicates']} on line ${parseInt(idx) + 2} of Patterns tab is not a valid integer`)
    }
    //getSomeWells silently drops wells that fall off the plate, so a block authored on a larger plate
    //would lose wells without complaint unless the corners are checked first
    try {
      const cornerWellIds = row['Well Block'].split(';').flatMap((block: string) => block.split(':'))
      const fitsOnPlate = cornerWellIds.every((cornerWellId: string) => {
        const coords = getCoordsFromWellId(cornerWellId.trim())
        return coords.row < testPlate.rows && coords.col < testPlate.columns
      })
      if (!fitsOnPlate) {
        errors.push(`Well block on line ${parseInt(idx) + 2} of Patterns tab does not fit on a plate of size ${testPlate.rows * testPlate.columns}`)
      }
      else if (testPlate.getSomeWells(row['Well Block']).length < 1) {
        errors.push(`Well block on line ${parseInt(idx) + 2} of Patterns tab is not valid`)
      }
    } catch (err) {
      errors.push(`Well block on line ${parseInt(idx) + 2} of Patterns tab is not valid`)
    }
    for (let i = 1; i <= MAX_COMBINATION_SLOTS; i++) {
      const header = `CompVol${i}`;
      if (row[header] && Number.isNaN(parseFloat(row[header].toString()))) {
        errors.push(`${row[header]} on line ${parseInt(idx) + 2} of Patterns tab is not a valid number`)
      }
      else if (dropletSize && typeof row[header] === 'number' && !isDropletMultiple(row[header], dropletSize)) {
        errors.push(`${header} of ${patternName} (${row[header]} nL) is not a multiple of the ${dropletSize} nL droplet size`)
      }
    }
  }
  return availablePatternNames
}

function sourceLayoutTabValidation(inputData: InputDataType, testPlate: Plate, errors: string[]): string[] {
  const srcBarcodes: string[] = []
  const usedWellIdsMap: Map<string, string[]> = new Map();
  const contents: string[] = [];
  for (let idx in inputData['SourceLayout']) {
    const row = inputData['SourceLayout'][idx]
    if (!(row['Content'].length > 0)) {
      errors.push(`Line ${parseInt(idx) + 2} of SourceLayout tab lacks a Content name`)
      break
    }
    if (!(row['Source Barcode'].toString().length > 0)) {
      errors.push(`${row['Content']} on line ${parseInt(idx) + 2} of SourceLayout tab lacks a source plate barcode`)
    }
    else {
      if (!srcBarcodes.includes(row['Source Barcode'])) {
        srcBarcodes.push(row['Source Barcode'])
        usedWellIdsMap.set(row['Source Barcode'], [])
      }
    }
    try {
      const usedWellIds = usedWellIdsMap.get(row['Source Barcode'])
      if (!usedWellIds) break
      const blockRanges = row['Well ID'].split(';');
      const cornerWellIds = blockRanges.flatMap(block => block.split(':'))
      let safeCornerWells = true;
      for (const cornerWellId of cornerWellIds) {
        const cornerWellCoords = getCoordsFromWellId(cornerWellId)
        if (cornerWellCoords.row >= testPlate.rows || cornerWellCoords.col >= testPlate.columns) {
          safeCornerWells = false
        }
      }
      if (safeCornerWells) {
        const wells = testPlate.getSomeWells(row['Well ID'])
        for (const well of wells) {
          if (!usedWellIds.includes(well.id)) {
            usedWellIds.push(well.id)
          }
          else {
            errors.push(`${row['Content']} on line ${parseInt(idx) + 2} of SourceLayout tab is listed in well ${well.id} which already has contents`)
          }
        }
      }
      else {
        errors.push(`Well block in line ${parseInt(idx) + 2} of SourceLayout tab does not fit on source plate of size ${testPlate.rows * testPlate.columns}`)
      }

    } catch (err) {
      errors.push(`${row['Content']} on line ${parseInt(idx) + 2} of SourceLayout tab has an invalid source location`)
    }
    try {
      if (isNaN(row['Volume (µL)'])) { errors.push(`${row['Content']} on line ${parseInt(idx) + 2} of SourceLayout tab has a non-number Volume`) }
      else if (!(row['Volume (µL)'] > 0)) { errors.push(`${row['Content']} on line ${parseInt(idx) + 2} of SourceLayout tab has a negative Volume`) }
    } catch (err) {
      errors.push(`${row['Content']} on line ${parseInt(idx) + 2} of SourceLayout tab lacks a Volume`)
    }
    if (!contents.includes(row['Content'])) {contents.push(row['Content'])}
  }
  return contents
}

function combinationsTabValidation(inputData: InputDataType, availablePatternNames: string[], contents: string[], errors: string[]) {
  for (let idx in inputData['Combinations']) {
    const row = inputData['Combinations'][idx] as { [key: string]: any }
    const patternName = inputData['Combinations'][idx]['Pattern']
    if (!availablePatternNames.includes(patternName)) {
      errors.push(`${patternName} on line ${parseInt(idx) + 2} of Combinations is not present on the Patterns tab`)
    }

    for (let i = 1; i <= MAX_COMBINATION_SLOTS; i++) {
      const header = `Comp${i}`;
      if (row[header] && !contents.includes(row[header])) {
        errors.push(`${row[header]} on line ${parseInt(idx) + 2} of Combinations tab is not present on SourceLayout`)
      }
    }
  }
}
