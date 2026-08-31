import { EchoCalculator, TransferInfo } from '../classes/EchoCalculatorClass';
import { CheckpointTracker } from '../classes/CheckpointTrackerClass';
import { DilutionPattern, isCombinationType, getCombinationFold } from '../../../classes/PatternClass';
import { Plate, PlateSize } from '../../../classes/PlateClass';
import { TransferStepExport } from '../../../utils/plateUtils';
import { CommonSettings, CompoundGroup, CompoundInventory, ConcentrationCache, ConcentrationObj, TransferVolumeResult } from '../types/echoTypes';

export type InputDataType = {
  'Layout': {
    'Pattern': string;
    'Well Block': string;
  }[],
  'Patterns': {
    'Pattern': string;
    'Type': DilutionPattern['type'];
    'Direction': DilutionPattern['direction'];
    'Replicates': number;
    'Conc1'?: number;
    'Conc2'?: number;
    'Conc3'?: number;
    'Conc4'?: number;
    'Conc5'?: number;
    'Conc6'?: number;
    'Conc7'?: number;
    'Conc8'?: number;
    'Conc9'?: number;
    'Conc10'?: number;
    'Conc11'?: number;
    'Conc12'?: number;
    'Conc13'?: number;
    'Conc14'?: number;
    'Conc15'?: number;
    'Conc16'?: number;
    'Conc17'?: number;
    'Conc18'?: number;
    'Conc19'?: number;
    'Conc20'?: number;
  }[],
  'Compounds': {
    'Source Barcode': string;
    'Well ID': string;
    'Compound ID': string;
    'Concentration (µM)': number;
    'Volume (µL)': number;
    'Pattern': string;
  }[],
  'Barcodes': {
    'Intermediate Plate Barcodes': string;
    'Destination Plate Barcodes': string;
  }[],
  'CommonData': {
    'maxDMSOFraction': number;
    'intermediateBackfillVolume': number;
    'finalAssayVolume': number;
    'allowableError': number;
    'destReplicates': number;
    'createIntConcs': boolean;
    'dmsoNormalization': boolean;
    'evenDepletion': boolean;
    'updateFromSurveyVolumes': boolean;
    'skipUnusedBlocks': boolean;
    'fillIntColumnwise': boolean;
  }
}

type ConcentrationVolumeInput = {
  c1?: number;
  v1?: number;
  c2?: number;
  v2?: number;
};

interface ConcentrationRange {
  min: number;
  max: number;
}

interface ConcentrationGap {
  ranges: ConcentrationRange[];
  hasGaps: boolean;
}

interface CalculationConstraints {
  maxTransferVolume: number;
  dropletSize: number;
  dmsoLimit: number;
  backfillVolume: number;
  assayVolume: number;
  allowableError: number;
}

export function roundToInc({
  val,
  dir = 'both',
  inc = 2.5
}: {
  val: number;
  dir?: 'both' | 'up' | 'down';
  inc?: number
}): number {
  let roundedValue: number;
  if (dir === 'both') {
    roundedValue = Math.round(val / inc) * inc;
  } else if (dir === 'up') {
    roundedValue = Math.ceil(val / inc) * inc;
  } else {
    roundedValue = Math.floor(val / inc) * inc;
  }
  return roundedValue;
}


export function analyzeDilutionPatterns(patternRows: any[]) {
  let dilutionPatterns = new Map<string, DilutionPattern>()
  patternRows.forEach(row => {
    const concentrations: number[] = [];
    for (let i = 1; i <= 20; i++) {
      const concKey = `Conc${i}`;
      if (row[concKey] !== undefined && row[concKey] !== null) {
        concentrations.push(parseFloat(row[concKey]));
      }
    }

    const pattern: DilutionPattern = {
      patternName: row.Pattern,
      type: row.Type,
      concentrations,
      replicates: parseInt(row.Replicates),
      direction: ['Solvent', 'Unused'].includes(row.Type) ? [] : row.Direction.split('-'),
      fold: isCombinationType(row.Type) ? getCombinationFold(row.Type) : 1
    };

    dilutionPatterns.set(pattern.patternName, pattern);
  });
  return dilutionPatterns
}

export function calculateMissingValue({ c1, v1, c2, v2 }: ConcentrationVolumeInput): number {
  const inputs = [
    { value: c1, name: 'c1', opposite: 'v1' },
    { value: v1, name: 'v1', opposite: 'c1' },
    { value: c2, name: 'c2', opposite: 'v2' },
    { value: v2, name: 'v2', opposite: 'c2' },
  ];
  const missingInput = inputs.find(input => typeof input.value !== 'number');
  const providedInputs = inputs.filter((input): input is { value: number; name: string; opposite: string } =>
    typeof input.value === 'number'
  );
  if (providedInputs.length !== 3 || !missingInput) {
    return -Infinity; // substitutes as an error message to avoid returning a string
  }

  const [input1, input2] = providedInputs.filter(input => input.name !== missingInput.opposite);
  const oppositeInput = providedInputs.find(input => input.name === missingInput.opposite);

  if (!oppositeInput) {
    return Infinity; // substitutes as an error message to avoid returning a string
  }

  return (input1.value * input2.value) / oppositeInput.value;
}

export function initializeCheckpoints(): CheckpointTracker {
  const checkpointTracker = new CheckpointTracker
  checkpointTracker.addCheckpoint('File Validation');
  checkpointTracker.addCheckpoint('Pattern Analysis');
  checkpointTracker.addCheckpoint('Source Inventory');
  checkpointTracker.addCheckpoint('Destination Plate Calculation');
  checkpointTracker.addCheckpoint('Transfer Volume Calculation');
  return checkpointTracker
}

function getPriority(sourceRole: string, destRole: string): number {
  const priorities = {
    'source-intermediate1': 1,
    'intermediate1-intermediate2': 2,
    'source-destination': 3,
    'intermediate1-destination': 4,
    'intermediate2-destination': 5
  };
  return (priorities as any)[`${sourceRole}-${destRole}`] || 6;
}

function getRole(barcode: string, plateArr: Plate[]) {
  const plate = plateArr.find((plt) => plt.barcode == barcode)
  if (plate) return plate.plateRole
  return 'Unknown';
}

export function customSort(arr: TransferStepExport[], echoCalc: EchoCalculator): Map<number, TransferStepExport[]> {
  const plateArr = [...echoCalc.sourcePlates, ...echoCalc.intermediatePlates, ...echoCalc.destinationPlates]
  const tsfrMap: Map<number, TransferStepExport[]> = new Map()
  for (let i = 0; i < 6; i++) {
    tsfrMap.set(i + 1, [])
  }
  for (const step of arr) {
    const sourceRole = getRole(step.sourceBarcode, plateArr);
    const destRole = getRole(step.destinationBarcode, plateArr);

    const priority = getPriority(sourceRole, destRole);
    const m = tsfrMap.get(priority)
    if (m) { m.push(step) }

  }
  for (const [prio, steps] of tsfrMap) {
    const sorted = steps.sort((a, b) => {
      if (a.sourceBarcode !== b.sourceBarcode) {
        return a.sourceBarcode.localeCompare(b.sourceBarcode);
      }

      return a.destinationBarcode.localeCompare(b.destinationBarcode);
    })
    tsfrMap.set(prio, sorted)
  }
  return tsfrMap
}

export function calculateCombinationPairs(compounds: string[]): [string, string][] {
  const combinations: [string, string][] = [];
  for (let i = 0; i < compounds.length - 1; i++) {
    for (let j = i + 1; j < compounds.length; j++) {
      combinations.push([compounds[i], compounds[j]]);
    }
  }
  return combinations
}

export function compoundIdsWithPattern(srcCompoundInventory: CompoundInventory, patternName: string): string[] {
  return Array.from(srcCompoundInventory).filter(([_, patternMap]) => patternMap.has(patternName)).map((c) => c[0])
}

export function calculateFinalAchievableConcentration({
  stockConcentration,
  intTransferVolume,
  finTransferVolume,
  backfillVolume,
  assayVolume,
  intermediateSteps
}: {
  stockConcentration: number;
  intTransferVolume: number;
  finTransferVolume: number;
  backfillVolume: number;
  assayVolume: number;
  intermediateSteps: number;
}): number {
  const intermediateDilutionFactor = intTransferVolume / (intTransferVolume + backfillVolume);

  const finalDilutionFactor = finTransferVolume / (finTransferVolume + assayVolume);

  //C₀ x (T ÷ (T + B))ⁿ x (T ÷ (T + A))
  const finalConcentration = stockConcentration *
    Math.pow(intermediateDilutionFactor, intermediateSteps) *
    finalDilutionFactor;

  return finalConcentration;
}

export function calculateMaxFinalTransferVolume({
  assayVolume,
  dmsoLimit,
}: {
  assayVolume: number;
  dmsoLimit: number;
}): number {
  //dmsoLimit = transferVolume / (transferVolume + assayVolume)
  return (dmsoLimit * assayVolume) / (1 - dmsoLimit);
}

export function analyzeAchievableRanges({
  stockConcentration,
  constraints,
  maxIntermediateLevels = 2
}: {
  stockConcentration: number;
  constraints: CalculationConstraints;
  maxIntermediateLevels?: number;
}): ConcentrationGap {
  const ranges: ConcentrationRange[] = [];
  const maxFinalTransfer = Math.min(
    constraints.maxTransferVolume,
    calculateMaxFinalTransferVolume({
      assayVolume: constraints.assayVolume,
      dmsoLimit: constraints.dmsoLimit
    })
  );

  const directMin = calculateFinalAchievableConcentration({
    stockConcentration,
    intTransferVolume: 0,
    finTransferVolume: constraints.dropletSize,
    backfillVolume: 0,
    assayVolume: constraints.assayVolume,
    intermediateSteps: 0
  });

  const directMax = calculateFinalAchievableConcentration({
    stockConcentration,
    intTransferVolume: 0,
    finTransferVolume: maxFinalTransfer,
    backfillVolume: 0,
    assayVolume: constraints.assayVolume,
    intermediateSteps: 0
  });

  ranges.push({ min: directMin, max: directMax });

  for (let i = 1; i <= maxIntermediateLevels; i++) {
    const minWithInt = calculateFinalAchievableConcentration({
      stockConcentration,
      intTransferVolume: constraints.dropletSize,
      finTransferVolume: constraints.dropletSize,
      backfillVolume: constraints.backfillVolume,
      assayVolume: constraints.assayVolume,
      intermediateSteps: i
    });

    const maxWithInt = calculateFinalAchievableConcentration({
      stockConcentration,
      intTransferVolume: constraints.maxTransferVolume,
      finTransferVolume: maxFinalTransfer,
      backfillVolume: constraints.backfillVolume,
      assayVolume: constraints.assayVolume,
      intermediateSteps: i
    });

    ranges.push({ min: minWithInt, max: maxWithInt });
  }

  return mergeConcentrationRanges(ranges);
}

export function mergeConcentrationRanges(ranges: ConcentrationRange[]): ConcentrationGap {
  ranges.sort((a, b) => b.max - a.max);

  const mergedRanges: ConcentrationRange[] = [];
  let currentRange = ranges[0];

  for (let i = 1; i < ranges.length; i++) {
    if (ranges[i].max <= currentRange.max && ranges[i].min >= currentRange.min) {
      continue;
    } else if (ranges[i].max <= currentRange.min) {
      mergedRanges.push(currentRange);
      currentRange = ranges[i];
    } else {
      currentRange = {
        min: Math.min(currentRange.min, ranges[i].min),
        max: Math.max(currentRange.max, ranges[i].max)
      };
    }
  }

  mergedRanges.push(currentRange);

  return {
    ranges: mergedRanges,
    hasGaps: mergedRanges.length > 1
  };
}

export function analyzeMultipleStockConcentrations({
  stockConcentrations,
  constraints,
  maxIntermediateLevels = 2
}: {
  stockConcentrations: number[];
  constraints: CalculationConstraints;
  maxIntermediateLevels?: number;
}): ConcentrationGap {
  const allRanges: ConcentrationRange[] = [];

  for (const stockConc of stockConcentrations) {
    const result = analyzeAchievableRanges({
      stockConcentration: stockConc,
      constraints,
      maxIntermediateLevels
    });
    allRanges.push(...result.ranges);
  }

  return mergeConcentrationRanges(allRanges);
}

export function fact(n: number) {
  let res = 1;
  for (let i = 1; i <= n; i++) {
    res *= i;
  }
  return res;
}

export function numberCombinations(elements: number, combinations: number) {
  if (elements < 0 || combinations < 0 || combinations > elements) return 0
  return Math.round((fact(elements) / (fact(combinations) * fact(elements - combinations))))
}

export function getCombinationsOfSizeR<T>(elements: T[], r: number): T[][] {
  const combinations: T[][] = [];
  const n = elements.length;

  if (r < 0 || r > n) {
    console.warn(`Invalid combination size r=${r} for elements array of size n=${n}. Returning empty array.`);
    return [];
  }
  if (r === 0) {
    return [[]];
  }
  if (r === n) {
    return [[...elements]];
  }


  /**
   * Recursive helper function to find combinations.
   * @param startIndex - The index in the elements array to start considering from.
   * @param currentCombination - The combination being built in the current recursive call.
   */
  function findCombinations(startIndex: number, currentCombination: T[]): void {
    // Base case: If the current combination has the desired size, add it to the results.
    if (currentCombination.length === r) {
      combinations.push([...currentCombination]); // Add a copy to avoid modifying it later
      return;
    }

    // Optimization (Pruning): If the number of remaining elements
    // is not enough to reach the target size 'r', stop this branch.
    // currentCombination.length is how many we have
    // n - startIndex is how many are left to consider
    // If currentCombination.length + (n - startIndex) < r, we can't reach r
    if (currentCombination.length + (n - startIndex) < r) {
      return; // Prune this path
    }


    // Recursive step: Iterate through the remaining elements starting from startIndex.
    for (let i = startIndex; i < n; i++) {
      // 1. Choose the element at index 'i'.
      currentCombination.push(elements[i]);

      // 2. Recurse: Find combinations for the remaining size (r - currentCombination.length)
      //    starting from the *next* index (i + 1) to avoid duplicates and ensure order.
      findCombinations(i + 1, currentCombination);

      // 3. Unchoose (Backtrack): Remove the element at index 'i' to explore other possibilities
      //    that do not include this element at this position.
      currentCombination.pop();
    }
  }

  // Start the recursion with an empty combination and starting index 0.
  findCombinations(0, []);

  return combinations;
}

export function prepareSrcPlates(srcCompoundInventory: CompoundInventory, plateSize: PlateSize, dilutionPatterns: Map<string, DilutionPattern>, inputData: InputDataType): Plate[] {
  const srcPlates: Plate[] = [];
  for (const [compoundId, patternMap] of srcCompoundInventory) {
    const patternNames: string[] = []
    patternMap.forEach((_, patternName) => patternNames.push(patternName))
    const patternNameCombined = patternNames.join(';')
    for (const [_, compoundGroup] of patternMap) {
      for (const location of compoundGroup.locations) {
        const srcBarcode = location.barcode;
        let srcPlate = srcPlates.find((plate) => plate.barcode == srcBarcode);
        if (!srcPlate) {
          srcPlate = new Plate({ barcode: srcBarcode, plateSize: plateSize, plateRole: 'source' });
          srcPlates.push(srcPlate)
        }
        const well = srcPlate.getWell(location.wellId);
        //only support a single content per source plate for now as they're made from user input, not dynamically
        //only support DMSO as solvent, though could eventually move to 
        if (well && well.getContents().length === 0) {
          const pattern = dilutionPatterns.get(patternNameCombined) //only works if solvent pattern name is solo without another name included
          if (pattern && pattern.type == 'Solvent') {
            well.addSolvent({ name: pattern.patternName, volume: location.volume })
          }
          else {
            well.addContent(
              {
                compoundId: compoundId,
                concentration: location.concentration,
                volume: location.volume,
                patternName: patternNameCombined
              },
              { name: 'DMSO', fraction: 1 }
            );
          }
        }
      }
    }
  }

  for (const compound of inputData.Compounds) {
    const isDMSOWithEmptyPattern = compound['Compound ID'] === 'DMSO' && (!compound['Pattern'] || compound['Pattern'].trim() === '');

    if (isDMSOWithEmptyPattern) {
      const srcBarcode = compound['Source Barcode'];
      let srcPlate = srcPlates.find((plate) => plate.barcode == srcBarcode);
      if (!srcPlate) {
        srcPlate = new Plate({ barcode: srcBarcode, plateSize: plateSize, plateRole: 'source' });
        srcPlates.push(srcPlate);
      }

      for (const well of srcPlate.getSomeWells(compound['Well ID'])) {
        if (well.getContents().length === 0) {
          well.addSolvent({ name: 'DMSO', volume: compound['Volume (µL)'] * 1000 });
        }
      }
    }
  }
  return srcPlates;
}

export function executeAndRecordTransfer(transferStep: TransferStepExport, transferInfo: TransferInfo, sourcePlates: Plate[], intermediatePlates: Plate[], destinationPlates: Plate[]): boolean {
  const srcPlate = [...sourcePlates, ...intermediatePlates].find(plate => plate.barcode == transferStep.sourceBarcode);
  const destPlate = [...intermediatePlates, ...destinationPlates].find(plate => plate.barcode == transferStep.destinationBarcode);

  if (srcPlate && destPlate) {
    const srcWell = srcPlate.getWell(transferStep.sourceWellId);
    const destWell = destPlate.getWell(transferStep.destinationWellId);

    if (srcWell && destWell) {
      if (srcWell.getTotalVolume() < transferStep.volume) return false
      if (transferInfo.transferType === 'compound') {
        const wellContents = srcWell.getContents() //for cases when there are multiple contents in one source well
        if (wellContents.length > 0) {
          for (const content of wellContents) { //perform one 'transfer' for each content, at volume/n_contents
            const newConc = content.concentration === null ? null : content.concentration * wellContents.length
            const newVol = transferStep.volume / wellContents.length

            destWell.addContent(
              {
                compoundId: content.compoundId,
                concentration: newConc,
                volume: newVol,
                patternName: content.patternName
              },
              { name: 'DMSO', fraction: 1 }
            );
            srcWell.removeVolume(newVol);
          }

        }
      } else if (transferInfo.transferType === 'solvent' && transferInfo.solventName) {
        destWell.addSolvent({ name: transferInfo.solventName, volume: transferStep.volume });
        srcWell.removeVolume(transferStep.volume);
      }

      return true
    }
  }
  return false
}

export function buildSrcCompoundInventory(inputData: InputDataType, plateSize: PlateSize): CompoundInventory {
  const srcCompoundInventory: CompoundInventory = new Map();
  const testPlate = new Plate({ plateSize: plateSize })

  for (const compound of inputData.Compounds) {
    const compoundId = compound['Compound ID'];

    const isDMSOWithEmptyPattern = compoundId === 'DMSO' && (!compound['Pattern'] || compound['Pattern'].trim() === '');

    if (isDMSOWithEmptyPattern) {
      continue;
    }

    const patternNames = compound['Pattern'].split(';').map(g => g.trim());

    if (!srcCompoundInventory.has(compoundId)) {
      srcCompoundInventory.set(compoundId, new Map());
    }

    const compoundPatterns = srcCompoundInventory.get(compoundId)!;

    for (const patternName of patternNames) {
      if (!compoundPatterns.has(patternName)) {
        compoundPatterns.set(patternName, { locations: [] });
      }

      const compoundGroup = compoundPatterns.get(patternName)!;

      const wells = testPlate.getSomeWells(compound['Well ID'])
      for (const well of wells) {
        compoundGroup.locations.push({
          barcode: compound['Source Barcode'],
          wellId: well.id,
          volume: compound['Volume (µL)'] * 1000, //convert uL to nL
          concentration: compound['Concentration (µM)']
        });
      }
    }
  }
  return srcCompoundInventory;
}

export function calculateDMSOSources(compounds: InputDataType['Compounds'], srcPlates: Plate[], srcCompoundInventory: CompoundInventory, dilutionPatterns: Map<string, DilutionPattern>) {
  let dmsoWellCount = 0;
  let totalDMSOVolume = 0;
  const dmsoWellsByPlate = new Map<string, number>();

  for (const compound of compounds) {
    const isDMSOWithEmptyPattern = compound['Compound ID'] === 'DMSO' &&
      (!compound['Pattern'] || compound['Pattern'].trim() === '');

    if (isDMSOWithEmptyPattern) {
      const volumeNL = compound['Volume (µL)'] * 1000;
      const barcode = compound['Source Barcode'];
      const plate = srcPlates.find(p => p.barcode === barcode)
      if (!plate) continue
      const wells = plate.getSomeWells(compound['Well ID'])
      const deadVolume = plate.getDeadVolume()

      dmsoWellCount += wells.length;
      totalDMSOVolume += wells.length * Math.max(0, volumeNL - deadVolume);

      dmsoWellsByPlate.set(barcode, (dmsoWellsByPlate.get(barcode) || 0) + wells.length);
    }
  }

  for (const [_, patternMap] of srcCompoundInventory) {
    for (const [patternName, compoundGroup] of patternMap) {
      const pattern = dilutionPatterns.get(patternName);
      if (pattern && pattern.type === 'Solvent') {
        dmsoWellCount += compoundGroup.locations.length;
        for (const loc of compoundGroup.locations) {
          const plate = srcPlates.find(p => p.barcode === loc.barcode)
          if (!plate) continue
          const deadVolume = plate.getDeadVolume()
          totalDMSOVolume += Math.max(0, loc.volume - deadVolume);
        }
      }
    }
  }
  return { dmsoWellCount, totalDMSOVolume }
}

export function calculateDestinationPlates(srcCompoundInventory: CompoundInventory, dilutionPatterns: Map<string, DilutionPattern>, inputData: InputDataType): number {
  const patternCounts = new Map<string, number>();
  const patternSlots = new Map<string, number>();

  //count compounds per pattern
  for (const [_, compoundPatterns] of srcCompoundInventory) {
    for (const [patternName, _] of compoundPatterns) {
      const pattern = dilutionPatterns.get(patternName);
      if (pattern && pattern.type !== 'Unused') {
        patternCounts.set(patternName, (patternCounts.get(patternName) || 0) + 1)
      }
    }
  }

  //count slots per pattern
  inputData.Layout.forEach((layout: any) => {
    const pattern = dilutionPatterns.get(layout.Pattern);
    if (pattern && pattern.type !== 'Unused') {
      patternSlots.set(layout.Pattern, (patternSlots.get(layout.Pattern) || 0) + 1);
    }
  });

  //calculate plates needed for each pattern
  let maxPlates = 0;
  for (const [patternName, count] of patternCounts) {
    const slots = patternSlots.get(patternName) || 1;
    let platesNeeded = Math.ceil(count / slots);
    //extra handling specifically for combination patterns
    const pattern = dilutionPatterns.get(patternName)
    if (pattern && isCombinationType(pattern.type)) {
      const combinationCount = numberCombinations(count, pattern.fold) //nCr notation
      platesNeeded = Math.ceil(combinationCount / slots)
    }
    maxPlates = Math.max(maxPlates, platesNeeded);
  }
  maxPlates = maxPlates * inputData.CommonData.destReplicates
  return maxPlates;
}

export function maxDMSOVolume(srcCompoundInventory: CompoundInventory, dilutionPatterns: Map<string, DilutionPattern>, inputData: InputDataType, commonSettings: CommonSettings): number {
  const transferConcentrations = new Map<string, {
    intermediateConcentrations: Map<number, ConcentrationObj>,
    destinationConcentrations: Map<number, ConcentrationObj>
  }>();

  for (const [compoundId, patternMap] of srcCompoundInventory) {
    for (const [patternName, compoundGroup] of patternMap) {
      const pattern = dilutionPatterns.get(patternName);
      if (pattern && pattern.type !== 'Unused') {
        const concentrations = calculateTransferConcentrations(inputData, transferConcentrations, pattern, compoundGroup, commonSettings);
        transferConcentrations.set(compoundId, concentrations);
      }
    }
  }
  const testPlate = new Plate({ plateSize: commonSettings.dstPltSize });

  for (const layoutBlock of inputData.Layout) {
    const pattern = dilutionPatterns.get(layoutBlock.Pattern);
    if (!pattern || pattern.type === 'Unused') continue;
    const compoundsUsingPattern = compoundIdsWithPattern(srcCompoundInventory, pattern.patternName)
    let maxVolOfPattern = 0;
    for (const compoundId of compoundsUsingPattern) {
      const transferInfo = transferConcentrations.get(compoundId)
      if (!transferInfo) continue
      for (const conc of pattern.concentrations) {
        const patternDestConc = transferInfo.destinationConcentrations.get(conc)
        if (patternDestConc) { maxVolOfPattern = Math.max(patternDestConc.volToTsfr, maxVolOfPattern) }
      }
    }

    if (isCombinationType(pattern.type)) { maxVolOfPattern = maxVolOfPattern * pattern.fold }
    const wells = testPlate.getSomeWells(layoutBlock['Well Block']);
    for (const well of wells) {
      well.bulkFill(maxVolOfPattern)
    }
  }
  const maxVols: number[] = []
  for (const well of testPlate) {
    if (!well || well.getIsUnused()) continue
    maxVols.push(well.getTotalVolume())
  }
  return Math.max(...maxVols, 0);
}

//not pure due to cache being passed in and potentially set, but that's on purpose
export function calculateTransferConcentrations(
  inputData: InputDataType,
  concentrationCache: ConcentrationCache,
  pattern: DilutionPattern,
  compoundGroup: CompoundGroup,
  commonSettings: CommonSettings
): { intermediateConcentrations: Map<number, ConcentrationObj>, destinationConcentrations: Map<number, ConcentrationObj> } {
  const availableConcentrations = Array.from(new Set(compoundGroup.locations.map(loc => loc.concentration))).sort((a, b) => b - a);
  const cacheKey = `${pattern.concentrations.join(',')}_${availableConcentrations.join(',')}`;

  if (concentrationCache.has(cacheKey)) {
    return concentrationCache.get(cacheKey)!;
  }
  const concentrationMap: Map<number, ConcentrationObj> = new Map()
  const intermediateConcentrations: Map<number, ConcentrationObj> = new Map() // map of intermed conc and volume used to make it
  let intermediateConcRange = { 'max': calculateMissingValue({ v1: commonSettings.maxTransferVolume, c1: Math.max(...availableConcentrations), v2: (commonSettings.intermediateBackfillVolume + commonSettings.maxTransferVolume) }), 'min': calculateMissingValue({ v1: commonSettings.dropletSize, c1: Math.min(...availableConcentrations), v2: (commonSettings.intermediateBackfillVolume + commonSettings.dropletSize) }) }

  //if 0 is added to pattern concentrations, set it manually here
  if (pattern.concentrations.includes(0)) {
    concentrationMap.set(0, { sourceConc: availableConcentrations[0], sourceType: 'src', volToTsfr: 0 })
  }

  //first try to satisfy using source plate concentrations
  for (const sourceConc of availableConcentrations) {
    const directTransferMap = concentrationsFilter(pattern.concentrations, sourceConc, 'src', commonSettings)
    for (const [conc, obj] of directTransferMap) {
      if (!concentrationMap.has(conc)) { concentrationMap.set(conc, obj) }
    }
  }
  //first intermediate plate concs
  //iterate through each remaining conc and try to find a good intermediate conc
  //if it passes criteria, find other remaining concs that would also work with it
  //set all satisfied concs in concentrationMap, and set int conc in intermediateConcentrations
  if (inputData.CommonData.createIntConcs) {
    let remainingConcentrations = pattern.concentrations.filter(conc => !concentrationMap.has(conc)).sort((a, b) => b - a);
    for (const conc of remainingConcentrations) {
      if (!concentrationMap.has(conc)) {
        for (const srcConc of availableConcentrations) {
          let intermediateConcRange = { 'max': calculateMissingValue({ v1: commonSettings.maxTransferVolume, c1: srcConc, v2: (commonSettings.intermediateBackfillVolume + commonSettings.maxTransferVolume) }), 'min': calculateMissingValue({ v1: commonSettings.dropletSize, c1: srcConc, v2: (commonSettings.intermediateBackfillVolume + commonSettings.dropletSize) }) }
          const { actualIntermediateConc, actualIntermediateConcVol } = buildIntermediateConc(conc, srcConc, commonSettings)
          if (actualIntermediateConc >= intermediateConcRange.min && actualIntermediateConc <= intermediateConcRange.max) {
            const intermediateTransferMap = concentrationsFilter(remainingConcentrations.filter(conc => !concentrationMap.has(conc)).sort((a, b) => b - a), actualIntermediateConc, 'int1', commonSettings)
            for (const [conc, obj] of intermediateTransferMap) {
              if (!concentrationMap.has(conc)) { concentrationMap.set(conc, obj) }
            }
            if (!intermediateConcentrations.has(actualIntermediateConc) && intermediateTransferMap.size > 0) { intermediateConcentrations.set(actualIntermediateConc, { sourceConc: srcConc, sourceType: 'src', volToTsfr: actualIntermediateConcVol }) }
            break
          }
        }
      }
    }
    //first pass was for int1 level, second pass is for int2 level
    //this time use existing int1 concentrations and iterate through, finding the lowest error result
    //use that to build a "true" int concentration and do the same as above - pass into concentrationsFilter and set in concentrationMap
    remainingConcentrations = pattern.concentrations.filter(conc => !concentrationMap.has(conc)).sort((a, b) => b - a);
    if (remainingConcentrations.length > 0) {
      for (const conc of remainingConcentrations) {
        if (!concentrationMap.has(conc)) {
          let intConcErrors: { srcConc: number, int2Conc: number, volToTsfr: number, error: number }[] = []
          // find the intermediate concentration closest to the ideal
          for (const [intConc, _] of [...intermediateConcentrations].filter(([_, v]) => v.sourceType == 'src')) {
            for (let area of ['hi', 'mid', 'lo']) {
              let errorObj = calculateC4(conc, intConc, area, commonSettings)
              if (errorObj.volToTsfr < commonSettings.maxTransferVolume && errorObj.volToTsfr >= commonSettings.dropletSize) { // max src to int or int to int transfer volume of this.maxTransferVolume
                intConcErrors.push(errorObj)
              }
            }
          }
          let bestIntConc = intConcErrors.find((item) => item.error == Math.min(...intConcErrors.map(i => i.error)))
          //a failsafe; need an "else" condition in case nothing worked
          if (bestIntConc) {
            intermediateConcRange = { 'max': calculateMissingValue({ v1: commonSettings.maxTransferVolume, c1: bestIntConc.srcConc, v2: (commonSettings.intermediateBackfillVolume + commonSettings.maxTransferVolume) }), 'min': calculateMissingValue({ v1: commonSettings.dropletSize, c1: bestIntConc.srcConc, v2: (commonSettings.intermediateBackfillVolume + commonSettings.dropletSize) }) }
            const { actualIntermediateConc, actualIntermediateConcVol } = buildIntermediateConc(conc, bestIntConc.srcConc, commonSettings)
            if (actualIntermediateConc >= intermediateConcRange.min && actualIntermediateConc <= intermediateConcRange.max) {
              const intermediateTransferMap = concentrationsFilter(remainingConcentrations.filter(conc => !concentrationMap.has(conc)).sort((a, b) => b - a), actualIntermediateConc, 'int2', commonSettings)
              for (const [conc, obj] of intermediateTransferMap) {
                if (!concentrationMap.has(conc)) { concentrationMap.set(conc, obj) }
              }
              if (!intermediateConcentrations.has(actualIntermediateConc) && intermediateTransferMap.size > 0) { intermediateConcentrations.set(actualIntermediateConc, { sourceConc: bestIntConc.srcConc, sourceType: 'int1', volToTsfr: actualIntermediateConcVol }) }
            }
          }
        }
      }
    }
  }
  concentrationCache.set(cacheKey, { intermediateConcentrations: intermediateConcentrations, destinationConcentrations: concentrationMap });
  return { intermediateConcentrations: intermediateConcentrations, destinationConcentrations: concentrationMap };
}

export function concentrationsFilter(concentrations: number[], sourceConcentration: number, sourceType: string, commonSettings: CommonSettings) {
  const transferMap: Map<number, ConcentrationObj> = new Map()
  for (const conc of concentrations) {
    // to deal with rounding issues; checks both directions to hopefully overcome DMSO % and error % mismatches
    const transferVolume = roundToInc({ val: (commonSettings.finalAssayVolume * conc) / (sourceConcentration - conc), dir: 'both', inc: commonSettings.dropletSize })
    const transferVolumeHi = roundToInc({ val: (commonSettings.finalAssayVolume * conc) / (sourceConcentration - conc), dir: 'up', inc: commonSettings.dropletSize })
    const transferVolumeLo = roundToInc({ val: (commonSettings.finalAssayVolume * conc) / (sourceConcentration - conc), dir: 'down', inc: commonSettings.dropletSize })
    const transferVolumeMax = roundToInc({ val: (commonSettings.finalAssayVolume * commonSettings.maxDMSOFraction) / (1 - commonSettings.maxDMSOFraction), dir: 'down', inc: commonSettings.dropletSize })
    for (let vol of [transferVolume, transferVolumeHi, transferVolumeLo, transferVolumeMax, commonSettings.dropletSize]) { // max and droplet included as last ditch attempts
      if (concentrationPasses(sourceConcentration, conc, vol, commonSettings.dropletSize, commonSettings.allowableError, commonSettings.finalAssayVolume, commonSettings.maxTransferVolume, commonSettings.maxDMSOFraction)) {
        transferMap.set(conc, { sourceConc: sourceConcentration, sourceType: sourceType, volToTsfr: vol })
        break
      }
    }
  }
  return transferMap
}

export function concentrationPasses(sourceConcentration: number, conc: number, volume: number, dropletSize: number, allowableError: number, finalAssayVolume: number, echoMaxTransferVolume: number, maxDMSOFraction: number): boolean {
  const minTransferVolume = (conc * (1 - allowableError) / sourceConcentration) * (finalAssayVolume + volume);
  const maxTransferVolume = Math.min((conc * (1 + allowableError) / sourceConcentration) * (finalAssayVolume + volume), echoMaxTransferVolume);
  const dmsoPercentage = volume / (finalAssayVolume + volume);
  return (
    volume >= dropletSize &&
    volume <= maxTransferVolume &&
    volume >= minTransferVolume &&
    dmsoPercentage <= maxDMSOFraction
  )
}

export function buildIntermediateConc(
  conc: number,
  stockConcentration: number,
  commonSettings: CommonSettings
): { actualIntermediateConc: number, actualIntermediateConcVol: number } {
  const maxOf = Math.min((commonSettings.finalAssayVolume * commonSettings.maxDMSOFraction), commonSettings.maxTransferVolume)
  let maxVolToDest = roundToInc({ val: maxOf, dir: 'down', inc: commonSettings.dropletSize }) // round down to avoid accidentally going over DMSO limit
  let idealIntermediateConc = calculateMissingValue({ v1: maxVolToDest, c2: conc, v2: (commonSettings.finalAssayVolume + maxVolToDest) });
  let idealIntermediateConcVol = (commonSettings.intermediateBackfillVolume * idealIntermediateConc) / (stockConcentration - idealIntermediateConc)
  let actualIntermediateConcVol = roundToInc({ val: idealIntermediateConcVol, dir: 'up', inc: commonSettings.dropletSize }) // round up to make sure this conc is high enough to satisfy dest within DMSO limit
  if (actualIntermediateConcVol > commonSettings.maxTransferVolume) { actualIntermediateConcVol = commonSettings.maxTransferVolume } // put a limit of this.maxTransferVolume transfer from stock to make intermediates, and try with this instead of highest possible
  let actualIntermediateConc = calculateMissingValue({ c1: stockConcentration, v1: actualIntermediateConcVol, v2: (commonSettings.intermediateBackfillVolume + actualIntermediateConcVol) })

  return { actualIntermediateConc, actualIntermediateConcVol }
}

export function calculateC4(
  targetConc: number,
  conc: number,
  area: string,
  commonSettings: CommonSettings
): { srcConc: number, int2Conc: number, volToTsfr: number, error: number } {
  // based on c1v1 = c2v2, where
  // c2 = int plate 1 conc1
  // v3 = vol of int plate1 conc1 to int plate 2
  // c4 = int plate 2 conc1
  // v4 = vol of int plate2 conc1
  // v5 = vol of int plate2 conc1 to dest plate
  // c6 = desired final assay conc in dest plate
  // v6 = total final assay vol in dest plate
  // c2v3 = c4v4
  // v3 = (c4v4)/c2
  // c4v5 = c6v6
  // c4 = (c6v6)/v5
  // v3 = (backfill * c4)/(c2 - c4)
  let c4: number
  switch (area) {
    case 'hi':
      c4 = (targetConc * (commonSettings.finalAssayVolume * (1 + commonSettings.maxDMSOFraction))) / (commonSettings.finalAssayVolume * commonSettings.maxDMSOFraction)
      break
    case 'mid':
      let midVol = ((commonSettings.finalAssayVolume * commonSettings.maxDMSOFraction) + commonSettings.dropletSize) / 2
      c4 = (targetConc * (commonSettings.finalAssayVolume + midVol) / midVol)
      break
    case 'lo':
      c4 = (targetConc * (commonSettings.finalAssayVolume + commonSettings.dropletSize)) / (commonSettings.dropletSize)
      break
    default:
      c4 = (targetConc * (commonSettings.finalAssayVolume * (1 + commonSettings.maxDMSOFraction))) / (commonSettings.finalAssayVolume * commonSettings.maxDMSOFraction)
  }
  let v3 = (commonSettings.intermediateBackfillVolume * c4) / (conc - c4)
  let actualV3 = roundToInc({ val: v3, inc: commonSettings.dropletSize })
  let error = Math.abs(v3 - actualV3) / v3
  let actualInt2Conc = calculateMissingValue({ c1: conc, v1: actualV3, v2: (actualV3 + commonSettings.intermediateBackfillVolume) })
  return { srcConc: conc, int2Conc: actualInt2Conc, volToTsfr: actualV3, error: error }
}

export function calculateTransferVolumes(
  pattern: DilutionPattern,
  compoundGroup: CompoundGroup,
  inputData: InputDataType,
  concentrationCache: ConcentrationCache,
  commonSettings: CommonSettings,
  srcCompoundInventory: CompoundInventory,
  destinationPlatesCount: number,
  maxDMSOVol: number
): TransferVolumeResult {
  const totalVolumes = new Map<number, number>();
  let destinationWellsCount = 0;
  let totalDMSOBackfillVol = 0;

  const transferConcentrations = calculateTransferConcentrations(inputData, concentrationCache, pattern, compoundGroup, commonSettings);
  let comboModifier = 1;
  if (isCombinationType(pattern.type)) {
    srcCompoundInventory.entries()
    let n = Array.from(srcCompoundInventory).filter(([_, patternMap]) => patternMap.has(pattern.patternName)).length;
    let r = pattern.fold; //if combination, should be at least two
    comboModifier = numberCombinations(n - 1, r - 1) //nCr; each entity will be used (n-1)C(r-1) times
  }
  const specificSlots = pattern.type == 'Control'
    ? calculateControlSlots(inputData, destinationPlatesCount, pattern.patternName)
    : inputData.CommonData.destReplicates * comboModifier;

  for (const [_, concInfo] of transferConcentrations.destinationConcentrations) {
    const newDestWells = pattern.replicates * specificSlots; //we consider replicates in specificSlots; do we need it again here?
    const currentVolume = totalVolumes.get(concInfo.sourceConc) || 0;
    const newVolume = currentVolume + (concInfo.volToTsfr * newDestWells);
    totalVolumes.set(concInfo.sourceConc, newVolume);
    totalDMSOBackfillVol += ((maxDMSOVol - concInfo.volToTsfr) * newDestWells);
    destinationWellsCount += newDestWells;
  }

  for (const [intConc, concInfo] of transferConcentrations.intermediateConcentrations) {
    let intermediatePlateDeadVolume = 15000;
    if (commonSettings.intermediateBackfillVolume <= 15000) {
      intermediatePlateDeadVolume = 2500;
    }
    const intWellsNeeded = Math.ceil(
      (totalVolumes.get(intConc) || 0) /
      ((commonSettings.intermediateBackfillVolume + concInfo.volToTsfr) - intermediatePlateDeadVolume)
    );
    const currentVolume = totalVolumes.get(concInfo.sourceConc) || 0;
    const newVolume = currentVolume + (concInfo.volToTsfr * intWellsNeeded);
    totalVolumes.set(concInfo.sourceConc, newVolume);
  }

  return { totalVolumes, destinationWellsCount, totalDMSOBackfillVol };
}

export function calculateControlSlots(inputData: InputDataType, destinationPlatesCount: number, patternName: string): number {
  const totalSlots = inputData.Layout.filter((row) => row.Pattern == patternName).length * destinationPlatesCount;
  const uniqueCompounds = new Set(inputData.Compounds.filter((row) => (row.Pattern && row.Pattern.includes(patternName))).map(row => row['Compound ID']));
  return totalSlots / uniqueCompounds.size;
}

export function calculateFinalDMSONeeded(inputData: InputDataType, commonSettings: CommonSettings, destinationPlatesCount: number, destinationWellsCount: number, dilutionPatterns: Map<string, DilutionPattern>, maxDMSOVol: number): number {
  const totalDestinationWells = destinationPlatesCount * parseInt(commonSettings.dstPltSize)
  const testPlate = new Plate({ plateSize: commonSettings.dstPltSize });
  let unusedWellsCount = 0;
  for (const layout of inputData.Layout) {
    const pattern = dilutionPatterns.get(layout.Pattern);
    if (pattern && pattern.type === 'Unused') {

      const wells = testPlate.getSomeWells(layout['Well Block']);
      unusedWellsCount += wells.length * destinationPlatesCount;
    }
  }
  let totalPatternWells = 0
  if (inputData.CommonData.skipUnusedBlocks) {
    for (const layout of inputData.Layout) {
      const wells = testPlate.getSomeWells(layout['Well Block'])
      totalPatternWells += wells.length
    }
  }

  const unusedDestinationWells = (inputData.CommonData.skipUnusedBlocks ? totalDestinationWells - totalPatternWells * destinationPlatesCount : totalDestinationWells - destinationWellsCount - unusedWellsCount);
  const additionalDMSOVol = unusedDestinationWells * maxDMSOVol
  return additionalDMSOVol
}

export function checkSourceVolumes(srcCompoundInventory: CompoundInventory, srcPlates: Plate[], dilutionPatterns: Map<string, DilutionPattern>, totalVolumes: Map<string, Map<string, Map<number, number>>>): string[] {
  const volumeCommitments = new Map<string, Map<number, number>>();
  const checkpointMessages: string[] = [];

  for (const [compoundId, patternMap] of srcCompoundInventory) {
    if (!volumeCommitments.has(compoundId)) {
      volumeCommitments.set(compoundId, new Map());
    }
    for (const [patternName, compoundGroup] of patternMap) {
      const pattern = dilutionPatterns.get(patternName)
      if (pattern && pattern.type != 'Solvent') {
        const volumeMap = totalVolumes.get(compoundId)?.get(patternName);
        if (!volumeMap) {
          checkpointMessages.push(`Couldn't find volume requirements for combination ${patternName}-${compoundId}`);
          continue;
        }

        for (const [concentration, requiredVol] of volumeMap) {

          const compoundCommitments = volumeCommitments.get(compoundId)!;
          const availableVolLocs = compoundGroup.locations.filter(location => location.concentration === concentration)
          if (availableVolLocs.length < 1) { break } // don't try to check intermediate concentrations
          const plateBarcode = availableVolLocs.length > 0 ? availableVolLocs[0].barcode : undefined; //bug - assumes one deadvol for all locations, doesn't consider individually per plate
          const plate = srcPlates.find(p => p.barcode === plateBarcode)
          if (!plate) continue
          const deadVolume = plate.getDeadVolume()
          const availableVolume = availableVolLocs.reduce((total, location) => total + (location.volume - deadVolume), 0);
          const committedVolume = compoundCommitments?.get(concentration) || 0;
          const uncommittedVolume = Math.max(0, availableVolume - committedVolume);

          if (uncommittedVolume < requiredVol) {
            const message = generateErrorMessage(compoundId, patternName, concentration, requiredVol, uncommittedVolume, availableVolume);
            checkpointMessages.push(message);
          } else {
            compoundCommitments.set(concentration, (compoundCommitments.get(concentration) || 0) + requiredVol);
          }
        }
      }
    }
  }
  return checkpointMessages
}

export function generateErrorMessage(
    compoundId: string,
    patternName: string,
    concentration: number,
    requiredVol: number,
    uncommittedVolume: number,
    availableVolume: number
  ): string {
    if (uncommittedVolume === availableVolume) {
      return `Insufficient source volume of ${compoundId} for ${patternName} at ${concentration}µM; ${requiredVol}nL required but only ${availableVolume}nL available`;
    } else {
      return `Insufficient uncommitted volume of ${compoundId} for ${patternName} at ${concentration}µM; ${requiredVol}nL required, ${availableVolume}nL total available, but only ${uncommittedVolume}nL uncommitted`;
    }
  }