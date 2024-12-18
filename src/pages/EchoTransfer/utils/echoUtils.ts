import { EchoCalculator, TransferStep } from '../classes/EchoCalculatorClass';
import { CheckpointTracker } from '../classes/CheckpointTrackerClass';
import { DilutionPattern } from '../classes/PatternClass';
import { CompoundInventory } from '../classes/EchoPreCalculatorClass';
import { Plate } from '../classes/PlateClass';

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
    'echoDeadVolume': number;
    'allowableError': number;
    'destReplicates': number;
    'createIntConcs': boolean;
    'dmsoNormalization': boolean;
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
  // If true, ranges are ordered high to low with gaps between
  hasGaps: boolean;  
}

interface CalculationConstraints {
  maxTransferVolume: number;     // Maximum volume that can be transferred
  dropletSize: number;           // Minimum volume that can be transferred
  dmsoLimit: number;             // Maximum fraction of DMSO allowed
  backfillVolume: number;        // Volume in intermediate plates
  assayVolume: number;           // Final assay volume
  allowableError: number;        // Acceptable concentration error
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
      direction: row.Type === 'Combination' ? row.Direction.split('-')[0] as 'LR' | 'RL' | 'TB' | 'BT' : row.Direction as 'LR' | 'RL' | 'TB' | 'BT',
      secondaryDirection: row.Type === 'Combination' ? row.Direction.split('-')[1] as 'LR' | 'RL' | 'TB' | 'BT' : undefined,  
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
  return (priorities as any)[`${sourceRole}-${destRole}`] || 6; // Default priority if not found
}

function getRole(barcode: string, plateArr: Plate[]) {
  const plate = plateArr.find((plt) => plt.barcode == barcode)
  if (plate) return plate.plateRole
  return 'Unknown';
}

export function customSort(arr: TransferStep[], echoCalc: EchoCalculator): Map<number, TransferStep[]> {
  const plateArr = [...echoCalc.sourcePlates, ...echoCalc.intermediatePlates, ...echoCalc.destinationPlates]
  const tsfrMap: Map<number, TransferStep[]> = new Map()
  for (let i = 0; i < 6; i++) {
    tsfrMap.set(i+1,[])
  }
  for (const step of arr) {
    const sourceRole = getRole(step.sourceBarcode, plateArr);
    const destRole = getRole(step.destinationBarcode, plateArr);

    const priority = getPriority(sourceRole, destRole);
    const m = tsfrMap.get(priority)
    if (m) {m.push(step)}

  }
  for (const [prio, steps] of tsfrMap) {
    const sorted = steps.sort((a,b) => {
    if (a.sourceBarcode !== b.sourceBarcode) {
      return a.sourceBarcode.localeCompare(b.sourceBarcode);
    }

    return a.destinationBarcode.localeCompare(b.destinationBarcode);
    })
    tsfrMap.set(prio,sorted)
  }
  return tsfrMap
}

export function calculateCombinationPairs(compounds: string[]): [string,string][] {
  const combinations: [string, string][] = [];
  for (let i = 0; i < compounds.length - 1; i++) {
    for (let j = i + 1; j < compounds.length; j++) {
      combinations.push([compounds[i], compounds[j]]);
    }
  }
  return combinations
}

export function compoundIdsWithPattern(srcCompoundInventory: CompoundInventory, patternName: string): string[] {
  return Array.from(srcCompoundInventory).filter(([_,patternMap]) => patternMap.has(patternName)).map((c) => c[0])
}

export function calculateFinalAchievableConcentration({
  stockConcentration,
  intTransferVolume,
  finTransferVolume,
  backfillVolume,
  assayVolume,
  intermediateSteps
}: {
  stockConcentration: number;  // Starting concentration in uM
  intTransferVolume: number;      // Source to intermediate or intermediate to intermediate transfer volume in nL
  finTransferVolume: number;      // Source to destination or intermediate to destination transfer volume in nL
  backfillVolume: number;      // Intermediate plate backfill volume in nL
  assayVolume: number;        // Final assay volume in nL
  intermediateSteps: number;   // Number of intermediate plate steps
}): number {
  const intermediateDilutionFactor = intTransferVolume / (intTransferVolume + backfillVolume);
  
  const finalDilutionFactor = finTransferVolume / (finTransferVolume + assayVolume);
  
  // Calculate final concentration
  // C₀ × (T ÷ (T + B))ⁿ × (T ÷ (T + A))
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
  // Based on: dmsoLimit = transferVolume / (transferVolume + assayVolume)
  // Solved for transferVolume
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

  // Direct transfer (no intermediates)
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

  // For each intermediate level
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

function mergeConcentrationRanges(ranges: ConcentrationRange[]): ConcentrationGap {
  // Sort ranges by max value descending
  ranges.sort((a, b) => b.max - a.max);
  
  const mergedRanges: ConcentrationRange[] = [];
  let currentRange = ranges[0];
  
  for (let i = 1; i < ranges.length; i++) {
    if (ranges[i].max <= currentRange.max && ranges[i].min >= currentRange.min) {
      // Range is completely contained in current range, skip it
      continue;
    } else if (ranges[i].max <= currentRange.min) {
      // There's a gap between ranges
      mergedRanges.push(currentRange);
      currentRange = ranges[i];
    } else {
      // Ranges overlap, merge them
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