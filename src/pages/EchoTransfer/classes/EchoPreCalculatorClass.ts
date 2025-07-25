import { analyzeDilutionPatterns, calculateMissingValue, roundToInc, InputDataType, compoundIdsWithPattern, numberCombinations, buildSrcCompoundInventory } from '../utils/echoUtils';
import { CheckpointTracker } from './CheckpointTrackerClass';
import { Plate, PlateSize } from '../../../classes/PlateClass';
import { DilutionPattern } from '../../../classes/PatternClass';
import { PreferencesState } from '../../../hooks/usePreferences';

export interface CompoundLocation {
  barcode: string;
  wellId: string;
  volume: number;
  concentration: number;
}

export interface CompoundGroup {
  locations: CompoundLocation[];
}

export type CompoundInventory = Map<string, Map<string, CompoundGroup>>;

export interface ConcentrationObj {
  sourceConc: number;
  sourceType: string;
  volToTsfr: number;
}

interface TransferVolumeResult {
  totalVolumes: Map<number, number>;
  destinationWellsCount: number;
  totalDMSOBackfillVol: number;
}

export class EchoPreCalculator {
  inputData: InputDataType;
  maxDMSOFraction: number;
  intermediateBackfillVolume: number;
  finalAssayVolume: number;
  plateDeadVolumes: Map<string, number>;
  allowableError: number;
  destinationPlatesCount: number;
  destinationWellsCount: number;
  dilutionPatterns: Map<string, DilutionPattern>;
  concentrationCache: Map<string, { intermediateConcentrations: Map<number, ConcentrationObj>, destinationConcentrations: Map<number, ConcentrationObj> }>;
  totalVolumes: Map<string, Map<string, Map<number, number>>>; // keys: compound ID, pattern name, concentration; final val = total vol for that concentration on that pattern
  maxDMSOVol: number;
  totalDMSOBackfillVol: number;
  srcCompoundInventory: CompoundInventory;
  checkpointTracker: CheckpointTracker;
  maxTransferVolume: number;
  dropletSize: number;
  srcPltSize: PlateSize;
  dstPltSize: PlateSize;

  constructor(
    inputData: InputDataType,
    checkpointTracker: CheckpointTracker,
    preferences: PreferencesState
  ) {
    this.inputData = inputData;
    this.maxDMSOFraction = inputData.CommonData.maxDMSOFraction;
    this.intermediateBackfillVolume = inputData.CommonData.intermediateBackfillVolume * 1000; //convert from µL on form to nL
    this.finalAssayVolume = inputData.CommonData.finalAssayVolume * 1000; //convert from µL on form to nL
    this.plateDeadVolumes = new Map();
    this.allowableError = inputData.CommonData.allowableError;
    this.destinationPlatesCount = 0;
    this.destinationWellsCount = 0;
    this.dilutionPatterns = new Map()
    this.concentrationCache = new Map()
    this.totalVolumes = new Map()
    this.srcCompoundInventory = new Map()
    this.maxDMSOVol = 0;
    this.totalDMSOBackfillVol = 0;
    this.checkpointTracker = checkpointTracker;
    this.maxTransferVolume = (typeof(preferences.maxTransferVolume) == 'number' ? preferences.maxTransferVolume : 500)
    this.dropletSize = (typeof(preferences.dropletSize) == 'number' ? preferences.dropletSize : 2.5);
    this.srcPltSize = ['384','1536'].includes(preferences.sourcePlateSize as PlateSize) ? preferences.sourcePlateSize as PlateSize : '384';
    this.dstPltSize = ['96','384','1536'].includes(preferences.destinationPlateSize as PlateSize) ? preferences.destinationPlateSize as PlateSize : '384';

    const maxVolumesPerPlate = new Map<string, number>();
    for (const compound of this.inputData.Compounds) {
      const barcode = compound['Source Barcode'];
      const volume = compound['Volume (µL)'] * 1000; // convert to nL
      if (!maxVolumesPerPlate.has(barcode) || volume > maxVolumesPerPlate.get(barcode)!) {
        maxVolumesPerPlate.set(barcode, volume);
      }
    }

    for (const [barcode, maxVolume] of maxVolumesPerPlate) {
      if (maxVolume > 15000) {
        this.plateDeadVolumes.set(barcode, 15000);
      } else {
        this.plateDeadVolumes.set(barcode, 2500);
      }
    }
  }

  calculateNeeds() {
    const checkpointNames = {
      step1: "Valid Dilution Patterns",
      step2: "Build Source Inventory",
      step3: "Calculated Transfer Volumes",
      step4: "Sufficient Source Volumes"
    }
    try {
      this.dilutionPatterns = analyzeDilutionPatterns(this.inputData.Patterns);
      this.checkpointTracker.updateCheckpoint(checkpointNames.step1, "Passed")
    } catch (err: unknown) {
      if (err instanceof Error) {
        this.checkpointTracker.updateCheckpoint(checkpointNames.step1, "Failed", [err.message])
        console.log(err.stack)
      }
    }
    try {
      this.srcCompoundInventory = buildSrcCompoundInventory(this.inputData,this.srcPltSize)
      this.checkpointTracker.updateCheckpoint(checkpointNames.step2, "Pending")
      const missingPatterns: string[] = []
      for (const [patternName, pattern] of this.dilutionPatterns) {
        if (pattern.type !== 'Solvent' && pattern.type !== 'Unused') {
          let hasCompounds = false
          for (const [_, compoundPatterns] of this.srcCompoundInventory) {
            if (compoundPatterns.has(patternName)) {
              hasCompounds = true
              break
            }
          }
          if (!hasCompounds) {
            missingPatterns.push(patternName)
          }
        }
      }
      if (missingPatterns.length > 0) {
        this.checkpointTracker.updateCheckpoint(checkpointNames.step2, "Warning",missingPatterns.map(p => `Pattern '${p}' has no compounds associated with it`))
      }
      else { this.checkpointTracker.updateCheckpoint(checkpointNames.step2, "Passed") }
      
    } catch (err: unknown) {
      if (err instanceof Error) {
        this.checkpointTracker.updateCheckpoint(checkpointNames.step2, "Failed", [err.message])
        console.log(err.stack)
      }
    }
    this.destinationPlatesCount = this.calculateDestinationPlates();
    this.maxDMSOVol = this.maxDMSOVolume()
    this.checkpointTracker.updateCheckpoint(checkpointNames.step3, "Pending")
    for (const [compoundId, patternMap] of this.srcCompoundInventory) {
      if (!this.totalVolumes.get(compoundId)) {
        this.totalVolumes.set(compoundId, new Map());
      }
      for (const [patternName, compoundGroup] of patternMap.entries()) {
        const pattern = this.dilutionPatterns.get(patternName);
        if (!pattern) continue;
        try {
          const middleMap = this.totalVolumes.get(compoundId)!;
          if (!middleMap.get(patternName)) {
            middleMap.set(patternName, new Map());
          }
          const innerMap = middleMap.get(patternName)!;
          const result = this.calculateTransferVolumes(pattern, compoundGroup);
          for (const [conc, volume] of result.totalVolumes) {
            innerMap.set(conc, volume);
          }
          this.destinationWellsCount += result.destinationWellsCount //removed conditional as we're handling combo modifier in calculateTransferVolumes
          if (this.inputData.CommonData.dmsoNormalization) {this.totalDMSOBackfillVol += result.totalDMSOBackfillVol}
          const transferConcentrations = this.calculateTransferConcentrations(pattern, compoundGroup);
          for (const conc of pattern.concentrations) {
            if (!(transferConcentrations.destinationConcentrations.get(conc))) {
              const msg = `Couldn't build ${compoundId} concentration ${conc} in ${patternName}`;
              const checkpoint = this.checkpointTracker.getCheckpoint(checkpointNames.step3);
              if (checkpoint) {
                this.checkpointTracker.updateCheckpoint(checkpointNames.step3, "Warning", [...checkpoint.message, msg]);
              }
            }
          }
        } catch (err) {
          if (err instanceof Error) {
            let checkpoint = this.checkpointTracker.getCheckpoint(checkpointNames.step3);
            let msg = `${compoundId} failed: ${err}`;
            if (checkpoint) {
              this.checkpointTracker.updateCheckpoint(checkpointNames.step3, "Failed", [...checkpoint.message, msg]);
            }
            console.log(err.stack);
          }
        }
      }
    }
    if (this.inputData.CommonData.dmsoNormalization) {this.calculateFinalDMSONeeded()}
    if (this.checkpointTracker.getCheckpoint(checkpointNames.step3)?.status == "Pending") {
      this.checkpointTracker.updateCheckpoint(checkpointNames.step3, "Passed")
    }
    try {
      this.checkpointTracker.updateCheckpoint(checkpointNames.step4, "Pending")
      this.checkSourceVolumes(checkpointNames.step4)
    } catch (err) {
      if (err instanceof Error) {
        let checkpoint = this.checkpointTracker.getCheckpoint(checkpointNames.step4)
        let msg = `Volume checking failed failed: ${err}`
        if (checkpoint) { this.checkpointTracker.updateCheckpoint(checkpointNames.step4, "Failed", [...checkpoint.message, msg]) }
        else { this.checkpointTracker.updateCheckpoint(checkpointNames.step4, "Failed", [msg]) }
      }
    }
  }

  calculateDestinationPlates(): number {
    const patternCounts = new Map<string, number>();
    const patternSlots = new Map<string, number>();
  
    //count compounds per pattern
    for (const [_, compoundPatterns] of this.srcCompoundInventory) {
      for (const [patternName, _] of compoundPatterns) {
        const pattern = this.dilutionPatterns.get(patternName);
        if (pattern && pattern.type !== 'Unused') {
          patternCounts.set(patternName, (patternCounts.get(patternName) || 0) + 1)
        }
      }
    }
  
    //count slots per pattern
    this.inputData.Layout.forEach((layout: any) => {
      const pattern = this.dilutionPatterns.get(layout.Pattern);
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
      const pattern = this.dilutionPatterns.get(patternName)
      if (pattern && pattern.type == 'Combination') {
        const combinationCount = numberCombinations(count,pattern.fold) //nCr notation
        platesNeeded = Math.ceil(combinationCount / slots)
      }
      maxPlates = Math.max(maxPlates, platesNeeded);
    }
    maxPlates = maxPlates * this.inputData.CommonData.destReplicates
    return maxPlates;
  }

  calculateTransferVolumes(
    pattern: DilutionPattern,
    compoundGroup: CompoundGroup
  ): TransferVolumeResult {
    const totalVolumes = new Map<number, number>();
    let destinationWellsCount = 0;
    let totalDMSOBackfillVol = 0;

    const transferConcentrations = this.calculateTransferConcentrations(pattern, compoundGroup);
    let comboModifier = 1;
    if (pattern.type == 'Combination') {
      this.srcCompoundInventory.entries()
      let n = Array.from(this.srcCompoundInventory).filter(([_, patternMap]) => patternMap.has(pattern.patternName)).length;
      let r = pattern.fold; //if combination, should be at least two
      comboModifier = numberCombinations(n-1, r-1) //nCr; each entity will be used (n-1)C(r-1) times
    }
    const specificSlots = pattern.type == 'Control'
      ? this.calculateControlSlots(pattern.patternName)
      : this.inputData.CommonData.destReplicates * comboModifier;

    for (const [_, concInfo] of transferConcentrations.destinationConcentrations) {
      const newDestWells = pattern.replicates * specificSlots; //we consider replicates in specificSlots; do we need it again here?
      const currentVolume = totalVolumes.get(concInfo.sourceConc) || 0;
      const newVolume = currentVolume + (concInfo.volToTsfr * newDestWells);
      totalVolumes.set(concInfo.sourceConc, newVolume);
      totalDMSOBackfillVol += ((this.maxDMSOVol - concInfo.volToTsfr) * newDestWells);
      destinationWellsCount += newDestWells;
    }

    for (const [intConc, concInfo] of transferConcentrations.intermediateConcentrations) {
      let intermediatePlateDeadVolume = 15000;
      if (this.intermediateBackfillVolume < 15000) {
        intermediatePlateDeadVolume = 2500;
      }
      const intWellsNeeded = Math.ceil(
        (totalVolumes.get(intConc) || 0) / 
        ((this.intermediateBackfillVolume + concInfo.volToTsfr) - intermediatePlateDeadVolume)
      );
      const currentVolume = totalVolumes.get(concInfo.sourceConc) || 0;
      const newVolume = currentVolume + (concInfo.volToTsfr * intWellsNeeded);
      totalVolumes.set(concInfo.sourceConc, newVolume);
    }

    return { totalVolumes, destinationWellsCount, totalDMSOBackfillVol };
  }



  calculateControlSlots(patternName: string): number {
    const totalSlots = this.inputData.Layout.filter((row) => row.Pattern == patternName).length * this.destinationPlatesCount;
    const uniqueCompounds = new Set(this.inputData.Compounds.filter((row) => (row.Pattern && row.Pattern.includes(patternName))).map(row => row['Compound ID']));
    return totalSlots / uniqueCompounds.size;
  }

  calculateTransferConcentrations(pattern: DilutionPattern, compoundGroup: CompoundGroup): { intermediateConcentrations: Map<number, ConcentrationObj>, destinationConcentrations: Map<number, ConcentrationObj> } {
    const availableConcentrations = Array.from(new Set(compoundGroup.locations.map(loc => loc.concentration))).sort((a, b) => b - a);
    const cacheKey = `${pattern.concentrations.join(',')}_${availableConcentrations.join(',')}`;

    if (this.concentrationCache.has(cacheKey)) {
      return this.concentrationCache.get(cacheKey)!;
    }
    const concentrationMap: Map<number, ConcentrationObj> = new Map()
    const intermediateConcentrations: Map<number, ConcentrationObj> = new Map() // map of intermed conc and volume used to make it
    let intermediateConcRange = { 'max': calculateMissingValue({ v1: this.maxTransferVolume, c1: Math.max(...availableConcentrations), v2: (this.intermediateBackfillVolume + this.maxTransferVolume) }), 'min': calculateMissingValue({ v1: this.dropletSize, c1: Math.min(...availableConcentrations), v2: (this.intermediateBackfillVolume + this.dropletSize) }) }
    //const maxConcentrations = 4; // Maximum number of intermediate concentrations

    //first try to satisfy using source plate concentrations
    for (const sourceConc of availableConcentrations) {
      const directTransferMap = this.concentrationsFilter(pattern.concentrations, sourceConc, 'src', this.dropletSize)
      for (const [conc, obj] of directTransferMap) {
        if (!concentrationMap.has(conc)) { concentrationMap.set(conc, obj) }
      }
    }
    //first intermediate plate concs
    //iterate through each remaining conc and try to find a good intermediate conc
    //if it passes criteria, find other remaining concs that would also work with it
    //set all satisfied concs in concentrationMap, and set int conc in intermediateConcentrations
    if (this.inputData.CommonData.createIntConcs) {
      let remainingConcentrations = pattern.concentrations.filter(conc => !concentrationMap.has(conc)).sort((a, b) => b - a);
      for (const conc of remainingConcentrations) {
        if (!concentrationMap.has(conc)) {
          for (const srcConc of availableConcentrations) {
            let intermediateConcRange = { 'max': calculateMissingValue({ v1: this.maxTransferVolume, c1: srcConc, v2: (this.intermediateBackfillVolume + this.maxTransferVolume) }), 'min': calculateMissingValue({ v1: this.dropletSize, c1: srcConc, v2: (this.intermediateBackfillVolume + this.dropletSize) }) }
            const { actualIntermediateConc, actualIntermediateConcVol } = this.buildIntermediateConc(conc, srcConc)
            if (actualIntermediateConc >= intermediateConcRange.min && actualIntermediateConc <= intermediateConcRange.max) {
              const intermediateTransferMap = this.concentrationsFilter(remainingConcentrations.filter(conc => !concentrationMap.has(conc)).sort((a, b) => b - a), actualIntermediateConc, 'int1', this.dropletSize)
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
                let errorObj = this.calculateC4(conc, intConc, area)
                if (errorObj.volToTsfr < this.maxTransferVolume && errorObj.volToTsfr >= this.dropletSize) { // max src to int or int to int transfer volume of this.maxTransferVolume
                  intConcErrors.push(errorObj)
                }
              }
            }
            let bestIntConc = intConcErrors.find((item) => item.error == Math.min(...intConcErrors.map(i => i.error)))
            //a failsafe; need an "else" condition in case nothing worked
            if (bestIntConc) {
              intermediateConcRange = { 'max': calculateMissingValue({ v1: this.maxTransferVolume, c1: bestIntConc.srcConc, v2: (this.intermediateBackfillVolume + this.maxTransferVolume) }), 'min': calculateMissingValue({ v1: this.dropletSize, c1: bestIntConc.srcConc, v2: (this.intermediateBackfillVolume + this.dropletSize) }) }
              const { actualIntermediateConc, actualIntermediateConcVol } = this.buildIntermediateConc(conc, bestIntConc.srcConc)
              if (actualIntermediateConc >= intermediateConcRange.min && actualIntermediateConc <= intermediateConcRange.max) {
                const intermediateTransferMap = this.concentrationsFilter(remainingConcentrations.filter(conc => !concentrationMap.has(conc)).sort((a, b) => b - a), actualIntermediateConc, 'int2', this.dropletSize)
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
    this.concentrationCache.set(cacheKey, { intermediateConcentrations: intermediateConcentrations, destinationConcentrations: concentrationMap });
    return { intermediateConcentrations: intermediateConcentrations, destinationConcentrations: concentrationMap };
  }

  buildIntermediateConc(
    conc: number,
    stockConcentration: number): { actualIntermediateConc: number, actualIntermediateConcVol: number } {
    //const lowestConc = Math.min(...remainingConcentrations);

    let maxVolToDest = roundToInc({ val: (this.finalAssayVolume * this.maxDMSOFraction), dir: 'down', inc: this.dropletSize }) // round down to avoid accidentally going over DMSO limit
    let idealIntermediateConc = calculateMissingValue({ v1: maxVolToDest, c2: conc, v2: (this.finalAssayVolume + maxVolToDest) });
    let idealIntermediateConcVol = (this.intermediateBackfillVolume * idealIntermediateConc) / (stockConcentration - idealIntermediateConc)
    let actualIntermediateConcVol = roundToInc({ val: idealIntermediateConcVol, dir: 'up', inc: this.dropletSize }) // round up to make sure this conc is high enough to satisfy dest within DMSO limit
    if (actualIntermediateConcVol > this.maxTransferVolume) { actualIntermediateConcVol = this.maxTransferVolume } // put a limit of this.maxTransferVolume transfer from stock to make intermediates, and try with this instead of highest possible
    let actualIntermediateConc = calculateMissingValue({ c1: stockConcentration, v1: actualIntermediateConcVol, v2: (this.intermediateBackfillVolume + actualIntermediateConcVol) })

    return { actualIntermediateConc, actualIntermediateConcVol }
  }

  concentrationsFilter(concentrations: number[], sourceConcentration: number, sourceType: string, dropletVolume: number) {
    const transferMap: Map<number, ConcentrationObj> = new Map()
    for (const conc of concentrations) {
      // to deal with rounding issues; checks both directions to hopefully overcome DMSO % and error % mismatches
      const transferVolume = roundToInc({ val: (this.finalAssayVolume * conc) / (sourceConcentration - conc), dir: 'both', inc: this.dropletSize })
      const transferVolumeHi = roundToInc({ val: (this.finalAssayVolume * conc) / (sourceConcentration - conc), dir: 'up', inc: this.dropletSize })
      const transferVolumeLo = roundToInc({ val: (this.finalAssayVolume * conc) / (sourceConcentration - conc), dir: 'down', inc: this.dropletSize })
      const transferVolumeMax = roundToInc({ val: (this.finalAssayVolume * this.maxDMSOFraction)/(1 - this.maxDMSOFraction) })
      for (let vol of [transferVolume, transferVolumeHi, transferVolumeLo, transferVolumeMax, dropletVolume]) { // max and droplet included as last ditch attempts
        if (this.concentrationPasses(sourceConcentration, conc, vol, dropletVolume)) {
          transferMap.set(conc, { sourceConc: sourceConcentration, sourceType: sourceType, volToTsfr: vol })
          break
        }
      }
    }
    return transferMap
  }

  concentrationPasses(sourceConcentration: number, conc: number, volume: number, dropletVolume: number): boolean {
    const minTransferVolume = (conc * (1 - this.allowableError) / sourceConcentration) * (this.finalAssayVolume + volume);
    const maxTransferVolume = (conc * (1 + this.allowableError) / sourceConcentration) * (this.finalAssayVolume + volume);
    const dmsoPercentage = volume / (this.finalAssayVolume + volume);
    return (
      volume >= dropletVolume &&
      volume <= maxTransferVolume &&
      volume >= minTransferVolume &&
      dmsoPercentage <= this.maxDMSOFraction
    )
  }

  calculateC4(targetConc: number, conc: number, area: string): { srcConc: number, int2Conc: number, volToTsfr: number, error: number } {
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
        c4 = (targetConc * (this.finalAssayVolume * (1 + this.maxDMSOFraction))) / (this.finalAssayVolume * this.maxDMSOFraction)
        break
      case 'mid':
        let midVol = ((this.finalAssayVolume * this.maxDMSOFraction) + this.dropletSize) / 2
        c4 = (targetConc * (this.finalAssayVolume + midVol) / midVol)
        break
      case 'lo':
        c4 = (targetConc * (this.finalAssayVolume + this.dropletSize)) / (this.dropletSize)
        break
      default:
        c4 = (targetConc * (this.finalAssayVolume * (1 + this.maxDMSOFraction))) / (this.finalAssayVolume * this.maxDMSOFraction)
    }
    let v3 = (this.intermediateBackfillVolume * c4) / (conc - c4)
    let actualV3 = roundToInc({ val: v3, inc: this.dropletSize })
    let error = Math.abs(v3 - actualV3) / v3
    let actualInt2Conc = calculateMissingValue({ c1: conc, v1: actualV3, v2: (actualV3 + this.intermediateBackfillVolume) })
    return { srcConc: conc, int2Conc: actualInt2Conc, volToTsfr: actualV3, error: error }
  }

  maxDMSOVolume(): number {
    if (this.maxDMSOVol === 0) {
      const transferConcentrations = new Map<string, {
        intermediateConcentrations: Map<number, ConcentrationObj>,
        destinationConcentrations: Map<number, ConcentrationObj>
      }>();

      for (const [compoundId, patternMap] of this.srcCompoundInventory) {
        for (const [patternName, compoundGroup] of patternMap) {
          const pattern = this.dilutionPatterns.get(patternName);
          if (pattern && pattern.type !== 'Unused') {
            const concentrations = this.calculateTransferConcentrations(pattern, compoundGroup);
            transferConcentrations.set(compoundId, concentrations);
          }
        }
      }
      const testPlate = new Plate({ plateSize: this.dstPltSize });

      for (const layoutBlock of this.inputData.Layout) {
        const pattern = this.dilutionPatterns.get(layoutBlock.Pattern);
        if (!pattern || pattern.type === 'Unused') continue;
        const compoundsUsingPattern = compoundIdsWithPattern(this.srcCompoundInventory, pattern.patternName)
        let maxVolOfPattern = 0;
        for (const compoundId of compoundsUsingPattern) {
          const transferInfo = transferConcentrations.get(compoundId)
          if (!transferInfo) continue
          for (const conc of pattern.concentrations) {
            const patternDestConc = transferInfo.destinationConcentrations.get(conc)
            if (patternDestConc) {maxVolOfPattern = Math.max(patternDestConc.volToTsfr, maxVolOfPattern)}
          }
            //const maxDMSO = Math.max(...Array.from(transferInfo.destinationConcentrations.values()).map(info => info.volToTsfr))
            //maxVolOfPattern = Math.max(maxDMSO, maxVolOfPattern)
        }
        
        if (pattern.type == 'Combination') { maxVolOfPattern = maxVolOfPattern * pattern.fold }
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
      this.maxDMSOVol = Math.max(...maxVols,0)
    }
    return this.maxDMSOVol;
  }

  calculateFinalDMSONeeded() {
    const totalDestinationWells = this.destinationPlatesCount * parseInt(this.dstPltSize)
    
    // Calculate unused wells count
    let unusedWellsCount = 0;
    for (const layout of this.inputData.Layout) {
      const pattern = this.dilutionPatterns.get(layout.Pattern);
      if (pattern && pattern.type === 'Unused') {
        const testPlate = new Plate({ plateSize: this.dstPltSize });
        const wells = testPlate.getSomeWells(layout['Well Block']);
        unusedWellsCount += wells.length * this.destinationPlatesCount;
      }
    }
    
    const unusedDestinationWells = totalDestinationWells - this.destinationWellsCount - unusedWellsCount;
    const additionalDMSOVol = unusedDestinationWells * this.maxDMSOVol
    this.totalDMSOBackfillVol += additionalDMSOVol
  }

  checkSourceVolumes(checkpointName: string) {
    const volumeCommitments = new Map<string, Map<number, number>>();
    const checkpointMessages: string[] = [];

    for (const [compoundId, patternMap] of this.srcCompoundInventory) {
      if (!volumeCommitments.has(compoundId)) {
        volumeCommitments.set(compoundId, new Map());
      }
      for (const [patternName, compoundGroup] of patternMap) {
        const pattern = this.dilutionPatterns.get(patternName)
        if (pattern && pattern.type != 'Solvent') {
          const volumeMap = this.totalVolumes.get(compoundId)?.get(patternName);
          if (!volumeMap) {
            checkpointMessages.push(`Couldn't find volume requirements for combination ${patternName}-${compoundId}`);
            continue;
          }

          for (const [concentration, requiredVol] of volumeMap) {

            const compoundCommitments = volumeCommitments.get(compoundId)!;
            const availableVolLocs = compoundGroup.locations.filter(location => location.concentration === concentration)
            if (availableVolLocs.length < 1) { break } // don't try to check intermediate concentrations
            const plateBarcode = availableVolLocs.length > 0 ? availableVolLocs[0].barcode : undefined;
            const deadVolume = plateBarcode ? (this.plateDeadVolumes.get(plateBarcode) || 2500) : 2500;
            const availableVolume = availableVolLocs.reduce((total, location) => total + (location.volume - deadVolume), 0);
            const committedVolume = compoundCommitments?.get(concentration) || 0;
            const uncommittedVolume = Math.max(0, availableVolume - committedVolume);

            if (uncommittedVolume < requiredVol) {
              const message = this.generateErrorMessage(compoundId, patternName, concentration, requiredVol, uncommittedVolume, availableVolume);
              checkpointMessages.push(message);
            } else {
              compoundCommitments.set(concentration, (compoundCommitments.get(concentration) || 0) + requiredVol);
            }
          }
        }
      }
    }

    if (checkpointMessages.length === 0) {
      this.checkpointTracker.updateCheckpoint(checkpointName, "Passed");
    } else {
      this.checkpointTracker.updateCheckpoint(checkpointName, "Warning", checkpointMessages);
    }
  }

  generateErrorMessage(
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

  public updateDeadVolume(barcode: string, newDeadVolumeNL: number): void {
    this.plateDeadVolumes.set(barcode, newDeadVolumeNL);
    this.calculateNeeds(); // Re-run calculations
  }
}