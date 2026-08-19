import { utils, writeFile } from 'xlsx';
import { Plate, PlateSize } from '../../../classes/PlateClass';
import { Pattern } from '../../../classes/PatternClass';
import { formatWellBlock, getWellFromBarcodeAndId, getWellIdsFromRange } from '../../../utils/plateUtils';
import { Combination, MAX_COMBINATION_SLOTS, emptySlots, nextCombinationId } from '../types/combinatorTypes';

export type InputDataType = {
  'Patterns': {
    'Name': string;
    'Replicates': number;
    'Well Block': string;
    'CompVol1': number;
    'CompVol2'?: number;
    'CompVol3'?: number;
    'CompVol4'?: number;
    'CompVol5'?: number;
    'CompVol6'?: number;
    'CompVol7'?: number;
    'CompVol8'?: number;
    'CompVol9'?: number;
    'CompVol10'?: number;
  }[],
  'SourceLayout': {
    'Source Barcode': string;
    'Well ID': string;
    'Content': string;
    'Volume (µL)': number;
    'Plate Type': string;
  }[],
  'Combinations': {
    'Pattern': string;
    'Comp1': string;
    'Comp2'?: string;
    'Comp3'?: string;
    'Comp4'?: string;
    'Comp5'?: string;
    'Comp6'?: string;
    'Comp7'?: string;
    'Comp8'?: string;
    'Comp9'?: string;
    'Comp10'?: string;
  }[]
}

export const COMBINATOR_HEADERS: { [key: string]: string[] } = {
  Patterns: ['Name', 'Replicates', 'Well Block', ...Array.from({ length: MAX_COMBINATION_SLOTS }, (_, i) => `CompVol${i + 1}`)],
  SourceLayout: ['Source Barcode', 'Well ID', 'Content', 'Volume (µL)', 'Plate Type'],
  Combinations: ['Pattern', ...Array.from({ length: MAX_COMBINATION_SLOTS }, (_, i) => `Comp${i + 1}`)]
}

export interface TransferStep {
  sourceBarcode: string;
  sourcePlateType: string;
  sourceWellId: string;
  destinationBarcode: string;
  destinationWellId: string;
  volume: number;
}

export interface ProcessResult {
  dstPlates: Plate[];
  srcPlates: Plate[];
  transferSteps: TransferStep[];
  warnings: string[];
}

interface SourceWellLocation {
  barcode: string;
  wellId: string;
}

export function recipeSlotCount(recipe: Pattern): number {
  return recipe.volumes.filter(volume => volume != null).length;
}

export function inventoryContents(srcPlates: Plate[]): string[] {
  const contents = new Set<string>();
  for (const plate of srcPlates) {
    for (const well of Object.values(plate.getWells())) {
      for (const content of well.getContents()) {
        if (content.compoundId) contents.add(content.compoundId);
      }
    }
  }
  return [...contents];
}

export function buildInputData(recipes: Pattern[], srcPlates: Plate[], combinations: Combination[]): InputDataType | null {
  const Patterns: InputDataType['Patterns'] = recipes.filter(recipe => recipe.locations.length > 0).map(recipe => {
    const row: { [key: string]: string | number } = {
      Name: recipe.name,
      Replicates: recipe.replicates,
      'Well Block': formatWellBlock(recipe.locations.flatMap(location => getWellIdsFromRange(location)))
    };
    recipe.volumes.forEach((volume, index) => {
      if (volume != null && index < MAX_COMBINATION_SLOTS) row[`CompVol${index + 1}`] = volume;
    });
    return row as InputDataType['Patterns'][number];
  });

  const SourceLayout: InputDataType['SourceLayout'] = [];
  for (const plate of srcPlates) {
    //uuid delimiter so 'test1' + '10' can't collide with 'test11' + '1'
    const delimiter = 'e6c80df5-9d71-465a-837a-b25d5e9f4d02'
    const inventory = new Map<string, { content: string; volume: number; wellIds: string[] }>();
    const wells = Object.values(plate.getWells())
      .filter(well => well.getContents().length > 0)
      .sort((a, b) => a.id.localeCompare(b.id));

    for (const well of wells) {
      const content = well.getContents()[0];
      if (!content.compoundId) continue;
      const volume = well.getTotalVolume() / 1000;
      const key = `${content.compoundId}${delimiter}${volume}`;
      if (!inventory.has(key)) {
        inventory.set(key, { content: content.compoundId, volume, wellIds: [] });
      }
      inventory.get(key)!.wellIds.push(well.id);
    }

    for (const { content, volume, wellIds } of inventory.values()) {
      SourceLayout.push({
        'Source Barcode': plate.barcode,
        'Well ID': formatWellBlock(wellIds),
        Content: content,
        'Volume (µL)': volume,
        'Plate Type': plate.plateType ?? ''
      });
    }
  }

  const Combinations: InputDataType['Combinations'] = combinations.map(combination => {
    const row: { [key: string]: string } = { Pattern: combination.patternName };
    combination.slots.forEach((slot, index) => {
      if (slot && index < MAX_COMBINATION_SLOTS) row[`Comp${index + 1}`] = slot;
    });
    return row as InputDataType['Combinations'][number];
  });
  if (Patterns.length == 0 && SourceLayout.length == 0 && Combinations.length == 0) return null
  return { Patterns, SourceLayout, Combinations };
}

export function buildDesignFromInputData(
  inputData: InputDataType,
  dstPlateSize: PlateSize,
  srcPlateSize: PlateSize
): { recipes: Pattern[]; previewPlate: Plate; srcPlates: Plate[]; combinations: Combination[] } {
  const previewPlate = new Plate({ barcode: 'PREVIEW', plateSize: dstPlateSize });

  const recipes = inputData.Patterns.map(patternRow => {
    const row = patternRow as { [key: string]: any };
    const volumes: (number | null)[] = [];
    for (let i = 1; i <= MAX_COMBINATION_SLOTS; i++) {
      const volume = row[`CompVol${i}`];
      volumes.push(typeof volume === 'number' ? volume : null);
    }
    while (volumes.length > 0 && volumes[volumes.length - 1] == null) volumes.pop();
    const recipe = new Pattern({
      name: patternRow.Name,
      type: 'Recipe',
      replicates: patternRow.Replicates,
      direction: ['LR'],
      concentrations: [],
      volumes,
      locations: []
    });

    const wellBlock = formatWellBlock(
      getWellIdsFromRange(patternRow['Well Block']).filter(wellId => previewPlate.getWell(wellId))
    );
    if (wellBlock) {
      previewPlate.applyPattern(wellBlock, recipe);
      recipe.locations.push(wellBlock);
    }
    return recipe;
  });

  const srcPlates: Plate[] = [];
  for (const row of inputData.SourceLayout) {
    let plate = srcPlates.find(p => p.barcode === row['Source Barcode']);
    if (!plate) {
      plate = new Plate({
        id: srcPlates.length + 1,
        barcode: row['Source Barcode'],
        plateSize: srcPlateSize,
        plateRole: 'source',
        plateType: row['Plate Type']
      });
      srcPlates.push(plate);
    }
    const solventName = plate.plateType?.includes('AQ') ? 'AQ' : 'DMSO';
    for (const well of plate.getSomeWells(row['Well ID'])) {
      well.addContent({ 
          compoundId: row.Content, 
          concentration: null, 
          volume: row['Volume (µL)'] * 1000,
          patternName: row.Content
        },
        { name: solventName, fraction: 1 }
      );
    }
  }

  const combinations: Combination[] = inputData.Combinations.map(combinationRow => {
    const row = combinationRow as { [key: string]: any };
    const slots = emptySlots();
    for (let i = 1; i <= MAX_COMBINATION_SLOTS; i++) {
      slots[i - 1] = row[`Comp${i}`] ?? '';
    }
    return { id: nextCombinationId(), patternName: combinationRow.Pattern, slots };
  });

  return { recipes, previewPlate, srcPlates, combinations };
}

export function exportCombinatorWorkbook(inputData: InputDataType | null, filename?: string): void {
  if (!inputData) return;

  const workbook = utils.book_new();

  for (const sheetName of ['Patterns', 'SourceLayout', 'Combinations'] as const) {
    const headers = COMBINATOR_HEADERS[sheetName];
    const sheet = utils.aoa_to_sheet([headers]);
    const rows = (inputData[sheetName] as { [key: string]: any }[])
      .map(row => headers.map(header => row[header] ?? null));
    utils.sheet_add_aoa(sheet, rows, { origin: 'A2' });
    utils.book_append_sheet(workbook, sheet, sheetName);
  }

  const date = new Date().toISOString().split('T')[0];
  writeFile(workbook, filename ?? `Combinator_Design_${date}.xlsx`);
}

export function processInputData(inputData: InputDataType, plateSize: PlateSize): ProcessResult {
  const warnings: string[] = [];
  const transferSteps: TransferStep[] = [];

  const srcPlates: Plate[] = [];
  const dstPlates: Plate[] = [];
  const srcPlateInventory = new Map<string, SourceWellLocation[]>();

  const testPlate = new Plate({ plateSize });

  for (const row of inputData.SourceLayout) {
    const barcode = row['Source Barcode'];
    let srcPlate = srcPlates.find(p => p.barcode === barcode);
    if (!srcPlate) {
      srcPlate = new Plate({ id: srcPlates.length + 1, barcode, plateSize, plateRole: 'source', plateType: row['Plate Type'] });
      srcPlates.push(srcPlate);
    }

    const wells = testPlate.getSomeWells(row['Well ID']);

    if (!srcPlateInventory.has(row['Content'])) {
      srcPlateInventory.set(row['Content'], []);
    }
    const srcWellLocs = srcPlateInventory.get(row['Content'])!

    const solventName = srcPlate.plateType?.includes('AQ') ? 'AQ' : 'DMSO';
    for (const well of wells) {
      const srcWell = srcPlate.getWell(well.id);
      if (!srcWell) continue
      srcWell.addContent({ 
        compoundId: row['Content'], 
        concentration: null,
        volume: row['Volume (µL)'] * 1000,
        patternName: row['Content'] 
      },
        { name: solventName, fraction: 1 }
      )
      srcWellLocs.push({ barcode: srcPlate.barcode, wellId: well.id })
    }
  }

  const recipeVolumes = new Map<string, (number | undefined)[]>();
  for (const row of inputData.Patterns) {
    const compVols: (number | undefined)[] = [];
    for (let i = 1; i <= MAX_COMBINATION_SLOTS; i++) {
      const key = `CompVol${i}` as keyof typeof row;
      const val = row[key];
      compVols.push(typeof val === 'number' ? val : undefined);
    }
    recipeVolumes.set(row['Name'], compVols);
  }

  const dstPlateCount = calculateDestinationPlates(inputData, testPlate)
  for (let i = 0; i < dstPlateCount; i++) {
    const barcode = `DstPlate_${(i + 1).toString().padStart(2, '0')}`;
    const plate = new Plate({ id: srcPlates.length + i + 1, barcode, plateSize, plateRole: 'destination' });
    dstPlates.push(plate);
  }

  for (const combo of inputData.Combinations) {
    const patternName = combo['Pattern'];
    const compVols = recipeVolumes.get(patternName);

    if (!compVols) {
      warnings.push(`Combination references unknown pattern "${patternName}" — skipped`);
      continue;
    }

    const compoundEntries: { contentName: string; volume: number }[] = [];
    for (let i = 1; i <= MAX_COMBINATION_SLOTS; i++) {
      const compKey = `Comp${i}` as keyof typeof combo;
      const compName = combo[compKey];
      if (!compName) continue;

      const vol = compVols[i - 1];
      if (vol === undefined) {
        warnings.push(`Pattern "${patternName}" has no CompVol${i} for Comp${i} ("${compName}") — skipped`);
        continue;
      }
      if (!srcPlateInventory.has(compName)) {
        warnings.push(`Compound "${compName}" in combination not found in SourceLayout — skipped`);
        continue;
      }
      compoundEntries.push({ contentName: compName, volume: vol });
    }

    if (compoundEntries.length === 0) {
      warnings.push(`Combination for pattern "${patternName}" has no resolvable compounds — skipped`);
      continue;
    }

    const dstBlock = findNextAvailableBlock(dstPlates, inputData.Patterns, patternName)

    if (dstBlock.barcode == '') continue
    const dstPlate = dstPlates.find(p => p.barcode == dstBlock.barcode)
    if (!dstPlate) continue
    const dstWells = dstPlate.getSomeWells(dstBlock.wellBlock)

    for (const dstWell of dstWells) {
      for (const { contentName, volume } of compoundEntries) {
        const srcLocations = srcPlateInventory.get(contentName)
        if (!srcLocations) continue
        const srcLoc = findSourceLocation(srcLocations, srcPlates, volume)
        if (!srcLoc) {
          warnings.push(`No source well available for "${contentName}"`);
          continue;
        }
        const srcWell = getWellFromBarcodeAndId(srcLoc.barcode, srcLoc.wellId, srcPlates)
        if (!srcWell) continue
        const srcPlate = srcPlates.find(p => p.barcode === srcLoc.barcode)

        if (srcWell.getTotalVolume() < volume) {
          warnings.push(`Transfer of ${volume} nL of "${contentName}" from ${srcLoc.barcode} ${srcLoc.wellId} failed`);
          continue;
        }
        dstWell.addContent({ 
          compoundId: contentName, 
          concentration: null, 
          volume: volume,
          patternName: patternName 
        },
          { name: 'AQ', fraction: 1 }
        );
        srcWell.removeVolume(volume);
        transferSteps.push({
          sourceBarcode: srcLoc.barcode,
          sourcePlateType: srcPlate?.plateType ?? '',
          sourceWellId: srcLoc.wellId,
          destinationBarcode: dstPlate.barcode,
          destinationWellId: dstWell.id,
          volume: volume
        })
      }
    }
  }
  return { dstPlates, srcPlates, transferSteps, warnings };
}

function findSourceLocation(locations: SourceWellLocation[], plates: Plate[], volume: number): SourceWellLocation | null {
  let plate: Plate | undefined;
  for (const loc of locations) {
    const well = getWellFromBarcodeAndId(loc.barcode, loc.wellId, plates, plate)
    if (!well) continue
    if (!plate || well.parentBarcode != plate.barcode) { plate = plates.find(p => p.barcode === well.parentBarcode) }
    const srcDeadVolume = plate?.getDeadVolume() ?? 2500
    if (well.getTotalVolume() >= (volume + srcDeadVolume)) {
      return { barcode: well.parentBarcode, wellId: well.id }
    }
  }
  return null
}

function calculateDestinationPlates(inputData: InputDataType, testPlate: Plate): number {
  let maxDestPlatesNeeded = 0;
  for (const row of inputData['Patterns']) {
    const wells = testPlate.getSomeWells(row['Well Block'])
    if (!wells || wells.length < 1) return maxDestPlatesNeeded
    const slotsPerPlate = Math.floor(wells.length / row['Replicates'])
    const slotsNeeded = inputData['Combinations'].filter(combo => combo['Pattern'] == row['Name']).length
    maxDestPlatesNeeded = Math.max(maxDestPlatesNeeded, Math.ceil(slotsNeeded / slotsPerPlate))
  }

  return maxDestPlatesNeeded
}

function findNextAvailableBlock(plates: Plate[], patterns: InputDataType['Patterns'], patternName: string): { barcode: string, wellBlock: string } {
  const possibleLocs: { barcode: string, blocks: string[] }[] = []
  for (const plate of plates) {
    const availableBlocks: string[] = [];
    const possibleLocations = patterns.filter((row) => row.Name === patternName);

    for (const patternRow of possibleLocations) {
      const replicates = patternRow['Replicates']
      const wellBlock = patternRow['Well Block'];
      const wells = plate.getSomeWells(wellBlock);
      const availableWellIds = wells.filter(w => w.getContents().length == 0).map(w => w.id)
      for (let i = 0; i < availableWellIds.length; i += replicates) {
        const block = availableWellIds.slice(i, i + replicates)
        if (block.length == replicates) availableBlocks.push(formatWellBlock(block))
      }
    }
    possibleLocs.push({ barcode: plate.barcode, blocks: availableBlocks })
  }

  for (const { barcode, blocks } of possibleLocs) {
    if (blocks.length > 0) {
      const wellBlock = blocks[0];
      blocks.splice(0, 1);
      return { barcode, wellBlock };
    }
  }

  return { barcode: '', wellBlock: '' };
}
