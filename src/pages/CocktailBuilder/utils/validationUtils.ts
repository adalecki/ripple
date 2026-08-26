import { utils, type WorkBook, type WorkSheet } from "xlsx";
import { Plate, PlateSize } from "../../../classes/PlateClass";
import { getCoordsFromWellId } from "../../../utils/plateUtils";
import { COCKTAIL_HEADERS, InputDataType, MAX_RECIPE_SLOTS } from "./cocktailUtils";


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

export function isDropletMultiple(volume: number, dropletSize: number): boolean {
  const steps = volume / dropletSize;
  return Math.abs(steps - Math.round(steps)) < 1e-9;
}

export function validateInputData(inputData: InputDataType, srcPlateSize: PlateSize, dstPlateSize: PlateSize, dropletSize: number): string[] {
  const errors: string[] = []
  const dstTestPlate = new Plate({ plateSize: dstPlateSize })
  const srcTestPlate = new Plate({ plateSize: srcPlateSize })
  const availableRecipeNames = recipesTabValidation(inputData, dstTestPlate, errors, dropletSize)
  const contents = sourceLayoutTabValidation(inputData, srcTestPlate, errors)
  cocktailsTabValidation(inputData, availableRecipeNames, contents, errors)
  return errors
}

export function echoInputValidation(wb: WorkBook, srcPlateSize: PlateSize, dstPlateSize: PlateSize, dropletSize: number): {inputData: InputDataType, errors: string[]} {
  let errors: string[] = []
  let inputData: InputDataType = {
    Recipes: [],
    SourceLayout: [],
    Cocktails: []
  }
  if (fileHeaders(wb.Sheets['Recipes'], COCKTAIL_HEADERS['Recipes'])) {
    inputData['Recipes'] = utils.sheet_to_json(wb.Sheets['Recipes'])
  }
  else {
    errors.push('Error in Recipes headers')
  }
  if (fileHeaders(wb.Sheets['SourceLayout'], COCKTAIL_HEADERS['SourceLayout'])) {
    inputData['SourceLayout'] = utils.sheet_to_json(wb.Sheets['SourceLayout'])
  }
  else {
    errors.push('Error in SourceLayout headers')
  }
  if (fileHeaders(wb.Sheets['Cocktails'], COCKTAIL_HEADERS['Cocktails'])) {
    inputData['Cocktails'] = utils.sheet_to_json(wb.Sheets['Cocktails'])
  }
  else {
    errors.push('Error in Cocktails headers')
  }
  if (errors.length == 0) {
    inputData = stringConversion(inputData)
  }
  errors.push(...validateInputData(inputData, srcPlateSize, dstPlateSize, dropletSize))
  return { inputData, errors }
}

function stringConversion(inputData: InputDataType) {
  for (let lineIdx in inputData.Recipes) {
    inputData.Recipes[lineIdx]['Name'] = (inputData.Recipes[lineIdx]['Name']?.toString().trim() || '');
  }
  for (let lineIdx in inputData.SourceLayout) {
    inputData.SourceLayout[lineIdx]['Source Barcode'] = (inputData.SourceLayout[lineIdx]['Source Barcode']?.toString().trim() || '');
    inputData.SourceLayout[lineIdx]['Content'] = (inputData.SourceLayout[lineIdx]['Content']?.toString().trim() || '');
    inputData.SourceLayout[lineIdx]['Plate Type'] = (inputData.SourceLayout[lineIdx]['Plate Type']?.toString().trim() || '');
  }
  for (let lineIdx in inputData.Cocktails) {
    inputData.Cocktails[lineIdx]['Recipe'] = (inputData.Cocktails[lineIdx]['Recipe']?.toString().trim() || '');
    for (let i = 1; i <= MAX_RECIPE_SLOTS; i++) {
      const header = `Comp${i}`;
      const row = inputData.Cocktails[lineIdx] as Record<string, string | undefined>;
      if (row[header]) { row[header] = row[header]!.toString().trim() || ''; }
    }
  }
  return inputData
}

function recipesTabValidation(inputData: InputDataType, testPlate: Plate, errors: string[], dropletSize?: number): string[] {
  const availableRecipeNames: string[] = []
  for (let idx in inputData['Recipes']) {
    const row = inputData['Recipes'][idx] as { [key: string]: any }
    const recipeName = inputData['Recipes'][idx]['Name']
    if (!availableRecipeNames.includes(recipeName)) {
      availableRecipeNames.push(recipeName)
    }
    else {
      errors.push(`${recipeName} on line ${parseInt(idx) + 2} is already present earlier`)
    }
    if (!row['Replicates'] || Number.isNaN(parseInt(row['Replicates'].toString()))) {
      errors.push(`${row['Replicates']} on line ${parseInt(idx) + 2} of Recipes tab is not a valid integer`)
    }
    try {
      const cornerWellIds = row['Well Block'].split(';').flatMap((block: string) => block.split(':'))
      const fitsOnPlate = cornerWellIds.every((cornerWellId: string) => {
        const coords = getCoordsFromWellId(cornerWellId.trim())
        return coords.row < testPlate.rows && coords.col < testPlate.columns
      })
      if (!fitsOnPlate) {
        errors.push(`Well block on line ${parseInt(idx) + 2} of Recipes tab does not fit on a plate of size ${testPlate.rows * testPlate.columns}`)
      }
      else if (testPlate.getSomeWells(row['Well Block']).length < 1) {
        errors.push(`Well block on line ${parseInt(idx) + 2} of Recipes tab is not valid`)
      }
    } catch (err) {
      errors.push(`Well block on line ${parseInt(idx) + 2} of Recipes tab is not valid`)
    }
    for (let i = 1; i <= MAX_RECIPE_SLOTS; i++) {
      const header = `CompVol${i}`;
      const vol = row[header]
      const isNum = typeof vol === "number"
      if (vol) {
        if (!isNum) {
          errors.push(`${vol} on line ${parseInt(idx) + 2} of Recipes tab is not a valid number`)
        }
        else if(dropletSize && !isDropletMultiple(row[header], dropletSize)) {
           errors.push(`${header} of ${recipeName} (${row[header]} nL) is not a multiple of the ${dropletSize} nL droplet size`)
        }
      }
      /*if (vol && !isNum) {
        errors.push(`${vol} on line ${parseInt(idx) + 2} of Recipes tab is not a valid number`)
      }
      else if (dropletSize && vol && isNum && !isDropletMultiple(row[header], dropletSize)) {
        errors.push(`${header} of ${recipeName} (${row[header]} nL) is not a multiple of the ${dropletSize} nL droplet size`)
      }*/
    }
  }
  return availableRecipeNames
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

function cocktailsTabValidation(inputData: InputDataType, availableRecipeNames: string[], contents: string[], errors: string[]) {
  for (let idx in inputData['Cocktails']) {
    const row = inputData['Cocktails'][idx] as { [key: string]: any }
    const recipeName = inputData['Cocktails'][idx]['Recipe']
    if (!availableRecipeNames.includes(recipeName)) {
      errors.push(`${recipeName} on line ${parseInt(idx) + 2} of Cocktails is not present on the Recipes tab`)
    }

    for (let i = 1; i <= MAX_RECIPE_SLOTS; i++) {
      const header = `Comp${i}`;
      if (row[header] && !contents.includes(row[header])) {
        errors.push(`${row[header]} on line ${parseInt(idx) + 2} of Cocktails tab is not present on SourceLayout`)
      }
    }
  }
}
