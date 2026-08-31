import { analyzeDilutionPatterns, InputDataType, buildSrcCompoundInventory, prepareSrcPlates, calculateDMSOSources, calculateDestinationPlates, maxDMSOVolume, calculateTransferVolumes, calculateTransferConcentrations, calculateFinalDMSONeeded, checkSourceVolumes } from '../utils/echoUtils';
import { CheckpointTracker } from './CheckpointTrackerClass';
import { Plate, PlateSize } from '../../../classes/PlateClass';
import { DilutionPattern } from '../../../classes/PatternClass';
import { PreferencesState } from '../../../hooks/usePreferences';
import { ConcentrationObj, CompoundInventory, CommonSettings } from '../types/echoTypes';

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
  dmsoSourceWells: number;
  dmsoUsableVolume: number;
  sourcePlates: Plate[];

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
    this.maxTransferVolume = (typeof (preferences.maxTransferVolume) == 'number' ? preferences.maxTransferVolume : 500)
    this.dropletSize = (typeof (preferences.dropletSize) == 'number' ? preferences.dropletSize : 2.5);
    this.srcPltSize = ['384', '1536'].includes(preferences.sourcePlateSize as PlateSize) ? preferences.sourcePlateSize as PlateSize : '384';
    this.dstPltSize = ['96', '384', '1536'].includes(preferences.destinationPlateSize as PlateSize) ? preferences.destinationPlateSize as PlateSize : '384';
    this.dmsoSourceWells = 0;
    this.dmsoUsableVolume = 0;
    this.sourcePlates = [];

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

  getCommonSettings() {
    const commonSettings: CommonSettings = {
      srcPltSize: this.srcPltSize,
      dstPltSize: this.dstPltSize,
      finalAssayVolume: this.finalAssayVolume,
      maxDMSOFraction: this.maxDMSOFraction,
      maxTransferVolume: this.maxTransferVolume,
      dropletSize: this.dropletSize,
      intermediateBackfillVolume: this.intermediateBackfillVolume,
      allowableError: this.allowableError
    }
    return commonSettings
  }

  calculateNeeds() {
    const checkpointNames = {
      step1: "Valid Dilution Patterns",
      step2: "Build Source Inventory",
      step3: "Calculated Transfer Volumes",
      step4: "Sufficient Source Volumes",
      step5: "DMSO Source Detection"
    }
    const commonSettings: CommonSettings = this.getCommonSettings()

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
      this.srcCompoundInventory = buildSrcCompoundInventory(this.inputData, this.srcPltSize)
      this.sourcePlates = prepareSrcPlates(this.srcCompoundInventory, this.srcPltSize, this.dilutionPatterns, this.inputData, this.sourcePlates)
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
        this.checkpointTracker.updateCheckpoint(checkpointNames.step2, "Warning", missingPatterns.map(p => `Pattern '${p}' has no compounds associated with it`))
      }
      else { this.checkpointTracker.updateCheckpoint(checkpointNames.step2, "Passed") }

    } catch (err: unknown) {
      if (err instanceof Error) {
        this.checkpointTracker.updateCheckpoint(checkpointNames.step2, "Failed", [err.message])
        console.log(err.stack)
      }
    }
    const { dmsoWellCount, totalDMSOVolume } = calculateDMSOSources(this.inputData['Compounds'], this.sourcePlates, this.srcCompoundInventory, this.dilutionPatterns);
    this.dmsoSourceWells = dmsoWellCount
    this.dmsoUsableVolume = totalDMSOVolume
    if (dmsoWellCount > 0) {
      const messages = [`Detected ${dmsoWellCount} DMSO source wells with ${(totalDMSOVolume / 1000).toFixed(1)} µL usable volume`];
      this.checkpointTracker.updateCheckpoint(checkpointNames.step5, "Passed", messages);
    } else {
      this.checkpointTracker.updateCheckpoint(checkpointNames.step5, "Passed", ["No DMSO source wells detected"]);
    }
    this.destinationPlatesCount = calculateDestinationPlates(this.srcCompoundInventory, this.dilutionPatterns, this.inputData)
    this.maxDMSOVol = maxDMSOVolume(this.srcCompoundInventory, this.dilutionPatterns, this.inputData, commonSettings)
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
          const result = calculateTransferVolumes(pattern, compoundGroup, this.inputData, this.concentrationCache, commonSettings, this.srcCompoundInventory, this.destinationPlatesCount, this.maxDMSOVol)
          for (const [conc, volume] of result.totalVolumes) {
            innerMap.set(conc, volume);
          }
          this.destinationWellsCount += result.destinationWellsCount
          if (this.inputData.CommonData.dmsoNormalization) { this.totalDMSOBackfillVol += result.totalDMSOBackfillVol }
          const transferConcentrations = calculateTransferConcentrations(this.inputData, this.concentrationCache, pattern, compoundGroup, commonSettings)
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
    if (this.inputData.CommonData.dmsoNormalization) { this.totalDMSOBackfillVol += calculateFinalDMSONeeded(this.inputData, commonSettings, this.destinationPlatesCount, this.destinationWellsCount, this.dilutionPatterns, this.maxDMSOVol) }
    if (this.checkpointTracker.getCheckpoint(checkpointNames.step3)?.status == "Pending") {
      this.checkpointTracker.updateCheckpoint(checkpointNames.step3, "Passed")
    }
    try {
      this.checkpointTracker.updateCheckpoint(checkpointNames.step4, "Pending")
      const messages = checkSourceVolumes(this.srcCompoundInventory, this.sourcePlates, this.dilutionPatterns, this.totalVolumes)
      if (messages.length === 0) {
        this.checkpointTracker.updateCheckpoint(checkpointNames.step4, "Passed");
      } else {
        this.checkpointTracker.updateCheckpoint(checkpointNames.step4, "Warning", messages);
      }
    } catch (err) {
      if (err instanceof Error) {
        let checkpoint = this.checkpointTracker.getCheckpoint(checkpointNames.step4)
        let msg = `Volume checking failed failed: ${err}`
        if (checkpoint) { this.checkpointTracker.updateCheckpoint(checkpointNames.step4, "Failed", [...checkpoint.message, msg]) }
        else { this.checkpointTracker.updateCheckpoint(checkpointNames.step4, "Failed", [msg]) }
      }
    }
  }

  updateDeadVolume(barcode: string, newDeadVolumeNL: number): void {
    this.plateDeadVolumes.set(barcode, newDeadVolumeNL);
    const srcPlate = this.sourcePlates.find(p => p.barcode === barcode)
    if (srcPlate) { srcPlate.setDeadVolume(newDeadVolumeNL) }
    this.calculateNeeds();
  }
}