import { Plate } from './PlateClass';
import { Well } from './WellClass';
import { formatWellBlock, mapWellsToConcentrations } from '../utils/plateUtils';
import { calculateCombinationPairs, compoundIdsWithPattern, InputDataType } from '../utils/echoUtils';
import { CompoundGroup, EchoPreCalculator } from './EchoPreCalculatorClass';
import { CheckpointTracker } from './CheckpointTrackerClass';
import { DilutionPattern } from './PatternClass';

// strings recorded instead of class references to avoid object reference issues
export interface TransferStep {
  sourceBarcode: string;
  sourceWellId: string;
  destinationBarcode: string;
  destinationWellId: string;
  volume: number;
}

export interface TransferInfo {
  transferType: 'compound' | 'solvent';
  solventName?: string; // Only used when transferType is 'solvent'
  compoundName?: string; // Only used when transferType is 'compound'
  patternName?: string;
}

type IntermediateWellCache = Map<string,
  Map<number,
    {
      barcode: string,
      wellIds: string[]
    }[]
  >
>

type ControlCompounds = Map<string,
  {
    memberCompounds: string[],
    destSlots: number
  }
>

export class EchoCalculator {
  sourcePlates: Plate[];
  intermediatePlates: Plate[];
  destinationPlates: Plate[];
  transferSteps: TransferStep[];
  maxDMSOFraction: number;
  intermediateBackfillVolume: number;
  finalAssayVolume: number;
  echoDeadVolume: number;
  allowableError: number;
  inputData: InputDataType;
  echoPreCalc: EchoPreCalculator;
  errors: string[];
  intermediateWellCache: IntermediateWellCache;
  checkpointTracker: CheckpointTracker;

  constructor(
    //inputData: InputDataType,
    echoPreCalc: EchoPreCalculator,
    checkpointTracker: CheckpointTracker,
  ) {
    this.errors = []
    this.inputData = echoPreCalc.inputData;
    this.maxDMSOFraction = echoPreCalc.maxDMSOFraction;
    this.intermediateBackfillVolume = echoPreCalc.intermediateBackfillVolume;
    this.finalAssayVolume = echoPreCalc.finalAssayVolume;
    this.echoDeadVolume = echoPreCalc.echoDeadVolume;
    this.allowableError = echoPreCalc.allowableError;
    this.echoPreCalc = echoPreCalc;
    this.transferSteps = [];
    this.intermediateWellCache = new Map();
    this.checkpointTracker = checkpointTracker;

    this.sourcePlates = this.prepareSrcPlates()
    this.intermediatePlates = this.prepareIntPlates();
    this.destinationPlates = this.prepareDestPlates()
    this.fillIntPlates()
    this.fillDestPlates()
    if (this.inputData.CommonData.dmsoNormalization) { this.dmsoNormalization() }

    for (const plate of [...this.sourcePlates, ...this.intermediatePlates, ...this.destinationPlates]) {
      this.findPlateMaxConcentration(plate)
    }

  }

  //prepares and fills contents on source plates
  prepareSrcPlates(): Plate[] {
    const srcPlates: Plate[] = [];
    for (const [compoundId, patternMap] of this.echoPreCalc.srcCompoundInventory) {
      const patternNames: string[] = []
      patternMap.forEach((_, patternName) => patternNames.push(patternName))
      const patternNameCombined = patternNames.join(';')
      for (const [_, compoundGroup] of patternMap) {
        for (const location of compoundGroup.locations) {
          const srcBarcode = location.barcode;
          let srcPlate = srcPlates.find((plate) => plate.barcode == srcBarcode);
          if (!srcPlate) {
            srcPlate = new Plate({ barcode: srcBarcode, plateSize: this.echoPreCalc.srcPltSize, plateRole: 'source' });
            srcPlates.push(srcPlate);
          }
          const well = srcPlate.getWell(location.wellId);
          // only support a single content per source plate for now as they're made from user input, not dynamically
          // only support DMSO as solvent, though could eventually move to 
          if (well && well.getContents().length === 0) {
            const pattern = this.echoPreCalc.dilutionPatterns.get(patternNameCombined) // only works if solvent pattern name is solo without another name included
            if (pattern && pattern.type == 'Solvent') {
              well.addSolvent({ name: pattern.patternName, volume: location.volume })
            }
            else {
              well.addContent(
                {
                  compoundId: compoundId,
                  concentration: location.concentration,
                  patternName: patternNameCombined
                },
                location.volume,
                { name: 'DMSO', fraction: 1 }
              );
            }
          }
        }
      }
    }
    return srcPlates;
  }

  //prepares necessary number of intermediate plates 
  prepareIntPlates(): Plate[] {
    let totalIntWellsNeeded = { level1: 0, level2: 0 };

    for (const [compoundId, patternMap] of this.echoPreCalc.srcCompoundInventory) {
      const middleMap = this.echoPreCalc.totalVolumes.get(compoundId);
      if (!middleMap) continue;

      for (const [patternName, compoundGroup] of patternMap) {
        const volumeMap = middleMap.get(patternName);
        if (!volumeMap) continue;

        const pattern = this.echoPreCalc.dilutionPatterns.get(patternName);
        if (!pattern) continue;

        const transferConcentrations = this.echoPreCalc.calculateTransferConcentrations(pattern, compoundGroup);

        for (const [intConc, concInfo] of transferConcentrations.intermediateConcentrations) {
          const concInnerMap = volumeMap.get(intConc);
          if (concInnerMap) {
            const newWellsNeeded = Math.ceil(concInnerMap / ((this.intermediateBackfillVolume + concInfo.volToTsfr) - this.echoDeadVolume));
            if (concInfo.sourceType == 'src') {
              totalIntWellsNeeded.level1 += newWellsNeeded;
            } else if (concInfo.sourceType == 'int1') {
              totalIntWellsNeeded.level2 += newWellsNeeded;
            }
          }
        }
      }
    }

    let dmsoVolAvailable = 0
    for (const srcPlate of this.sourcePlates) {
      for (const well of srcPlate) {
        if (well?.isSolventOnlyWell('DMSO')) {
          dmsoVolAvailable += (well.getSolventVolume('DMSO') - this.echoDeadVolume)
        }
      }
    }

    const dmsoWellsNeeded = Math.ceil((this.echoPreCalc.totalDMSOBackfillVol - dmsoVolAvailable) / (this.intermediateBackfillVolume - this.echoDeadVolume));
    totalIntWellsNeeded.level1 += dmsoWellsNeeded;

    const intPlatesCount1 = Math.ceil(totalIntWellsNeeded.level1 / 384);
    const intPlatesCount2 = Math.ceil(totalIntWellsNeeded.level2 / 384);
    const intPlates: Plate[] = [];

    // Create intermediate plates
    const barcodes = this.inputData.Barcodes.map(row => row['Intermediate Plate Barcodes']);
    const totalPlatesNeeded = intPlatesCount1 + intPlatesCount2;

    if (totalPlatesNeeded > barcodes.length) {
      for (let i = barcodes.length + 1; i <= totalPlatesNeeded; i++) {
        barcodes.push(`IntPlate_${i}`);
      }
    }

    for (let i = 0; i < totalPlatesNeeded; i++) {
      const newIntPlate = new Plate({
        barcode: barcodes[i],
        plateSize: '384',
        plateRole: i < intPlatesCount1 ? 'intermediate1' : 'intermediate2'
      });

      for (const well of newIntPlate) {
        if (well) {
          well.addSolvent({ name: 'DMSO', volume: this.intermediateBackfillVolume });
        }
      }
      intPlates.push(newIntPlate);
    }

    return intPlates;
  }

  //fills intermediate plates and records transfer steps
  fillIntPlates() {
    // First, calculate total intermediate well needs per compound and concentration
    const intermediateNeeds = new Map<string, Map<number, number>>();

    for (const [compoundId, patternMap] of this.echoPreCalc.srcCompoundInventory) {
      if (!intermediateNeeds.has(compoundId)) {
        intermediateNeeds.set(compoundId, new Map());
      }
      if (!this.intermediateWellCache.has(compoundId)) {
        this.intermediateWellCache.set(compoundId, new Map());
      }
      const compoundNeeds = intermediateNeeds.get(compoundId)!;

      for (const [patternName, compoundGroup] of patternMap) {
        const pattern = this.echoPreCalc.dilutionPatterns.get(patternName);
        if (!pattern) continue;

        const transferConcentrations = this.echoPreCalc.calculateTransferConcentrations(pattern, compoundGroup);
        const volumeMap = this.echoPreCalc.totalVolumes.get(compoundId)?.get(patternName);
        if (!volumeMap) continue;

        for (const [intConc, _] of transferConcentrations.intermediateConcentrations) {
          const volumeNeeded = volumeMap.get(intConc) || 0;
          if (volumeNeeded === 0) continue;
          compoundNeeds.set(intConc, (compoundNeeds.get(intConc) || 0) + volumeNeeded);
        }
      }
    }

    // Create and fill all intermediate wells in one pass
    for (const [compoundId, compoundNeeds] of intermediateNeeds) {
      for (const [intConc, totalVolume] of compoundNeeds) {
        const wellsNeeded = Math.ceil(totalVolume / (this.intermediateBackfillVolume - this.echoDeadVolume)); //ignores actual transfered volume, but that just overestimates so should be fine

        // Find plates with available wells
        // Find suitable source location for this intermediate concentration
        const sourceInfo = this.findSourceForIntermediate(compoundId, intConc);
        if (!sourceInfo) {
          console.warn(`Could not find source for ${compoundId} at ${intConc}µM`);
          break;
        }

          // TODO - finds plate with total wells available. Will fail in edge case where total calculated wells needed is correct, but doesn't divide up
          // perfectly filling plates. It *should* be okay most of the time, with unused wells being counted for DMSO, but in extreme cases could still fail.
          // Need to redo this (or original int plate creation) to account for this.
        const intPlatesToSearch = this.intermediatePlates.filter(
          plt => plt.plateRole === (sourceInfo.sourceType === 'src' ? 'intermediate1' : 'intermediate2')
        );
        const location = this.findPlateWithNumWellsAvailable(intPlatesToSearch, wellsNeeded);
        if (!location.barcode || !location.wellBlock) break;

        const intPlate = this.intermediatePlates.find(plate => plate.barcode === location.barcode)!;
        const wellBlock = intPlate.getSomeWells(location.wellBlock);

        // Fill wells
        for (const intWell of wellBlock) {

          const sourceWell = this.findAvailableSourceWell(compoundId, sourceInfo)
          if (!sourceWell) break;

          const transferStep: TransferStep = {
            sourceBarcode: sourceWell.plateBarcode,
            sourceWellId: sourceWell.wellId,
            destinationBarcode: intPlate.barcode,
            destinationWellId: intWell.id,
            volume: sourceInfo.volToTransfer
          };

          const transferInfo: TransferInfo = {
            transferType: 'compound',
            compoundName: compoundId,
            patternName: sourceInfo.pattern.patternName
          };

          // Update cache
          const cacheArr = this.intermediateWellCache.get(compoundId)!.get(intConc) || [];
          const arrIdx = cacheArr.findIndex(e => e.barcode === transferStep.destinationBarcode);
          if (arrIdx > -1) {
            cacheArr[arrIdx].wellIds.push(transferStep.destinationWellId);
          } else {
            cacheArr.push({
              barcode: transferStep.destinationBarcode,
              wellIds: [transferStep.destinationWellId]
            });
          }
          this.intermediateWellCache.get(compoundId)!.set(intConc, cacheArr);

          this.executeAndRecordTransfer(transferStep, transferInfo);
        }
      }
    }
  }

  // Helper method to find source well with enough volume
  findAvailableSourceWell(compoundId: string, sourceInfo: {
    pattern: DilutionPattern;
    sourceConc: number;
    sourceType: string;
    volToTransfer: number;
}) {
    let possibleLocs: {barcode: string, wellId: string}[] = []
    if (sourceInfo.sourceType === 'src') {
      const patternMap = this.echoPreCalc.srcCompoundInventory.get(compoundId)
      if (!patternMap) return null;
      const compoundGroup = patternMap.get(sourceInfo.pattern.patternName)
      if (!compoundGroup) return null;
      const locs = compoundGroup.locations.filter((loc) => loc.concentration == sourceInfo.sourceConc)
      for (const loc of locs) {
        possibleLocs.push({barcode: loc.barcode, wellId: loc.wellId})
      }
    }
    else {
      const cpdIntWellCache = this.intermediateWellCache.get(compoundId)
      if (!cpdIntWellCache) return null;
      const concWellCache = cpdIntWellCache.get(sourceInfo.sourceConc)
      if (!concWellCache) return null;
      for (const plateObj of concWellCache) {
        for (const wellId of plateObj.wellIds) {
          possibleLocs.push({barcode: plateObj.barcode, wellId: wellId})
        }
      }
    }
    const srcPlts = [...this.sourcePlates, ...this.intermediatePlates]
    for (const location of possibleLocs) {
      const srcPlt = srcPlts.find(plate => plate.barcode == location.barcode)
      if (!srcPlt) continue
      const srcWell = srcPlt.getWell(location.wellId)
      if (!srcWell) continue
      if (srcWell.getTotalVolume() >= (sourceInfo.volToTransfer + this.echoDeadVolume)) {
        return {
          plateBarcode: srcPlt.barcode,
          wellId: srcWell.id
        }
      }
    }
    return null;
  }

  // Helper method to find source information for intermediate concentration
  findSourceForIntermediate(compoundId: string, targetConc: number): {
    pattern: DilutionPattern,
    sourceConc: number,
    sourceType: string,
    volToTransfer: number
  } | null {
    for (const [patternName, compoundGroup] of this.echoPreCalc.srcCompoundInventory.get(compoundId)!) {
      const pattern = this.echoPreCalc.dilutionPatterns.get(patternName);
      if (!pattern) continue;

      const transferConcentrations = this.echoPreCalc.calculateTransferConcentrations(pattern, compoundGroup);
      const concInfo = transferConcentrations.intermediateConcentrations.get(targetConc);
      if (concInfo) {
        return {
          pattern,
          sourceConc: concInfo.sourceConc,
          sourceType: concInfo.sourceType,
          volToTransfer: concInfo.volToTsfr
        };
      }
    }
    return null;
  }

  prepareDestPlates(): Plate[] {
    const destPlates: Plate[] = []
    const barcodes = []
    for (const row of this.inputData.Barcodes) {
      barcodes.push(row['Destination Plate Barcodes'])
    }
    if (this.echoPreCalc.destinationPlatesCount > barcodes.length) {
      const extraNumNeeded = this.echoPreCalc.destinationPlatesCount - barcodes.length
      for (let i = 1; i <= extraNumNeeded; i++) {
        const barcode = `DestPlate_${i}`
        barcodes.push(barcode)
      }
    }
    for (let i = 0; i < this.echoPreCalc.destinationPlatesCount; i++) {
      const newDestPlate = new Plate({ barcode: barcodes[i], plateSize: this.echoPreCalc.dstPltSize, plateRole: 'destination' })
      for (const well of newDestPlate) {
        if (well) { well.addSolvent({ name: 'Assay Buffer', volume: this.finalAssayVolume }); }
      }
      destPlates.push(newDestPlate)
    }
    return destPlates
  }

  fillDestPlates() {
    const controlCompounds: ControlCompounds = new Map()
    for (const [_, pattern] of this.echoPreCalc.dilutionPatterns) {
      if (pattern.type == 'Control' && !controlCompounds.has(pattern.patternName)) {
        const controlSlots = this.inputData.Layout.filter((block) => block.Pattern === pattern.patternName)
        controlCompounds.set(pattern.patternName, { memberCompounds: [], destSlots: controlSlots.length })
      }
    }

    const replicates = this.inputData.CommonData.destReplicates;
    const platesPerReplicate = this.destinationPlates.length / replicates;
    const destinationPlateGroups = Array.from({ length: replicates }, (_, i) =>
      this.destinationPlates.slice(i * platesPerReplicate, (i + 1) * platesPerReplicate)
    );

    for (const [compoundId, compoundGroups] of this.echoPreCalc.srcCompoundInventory) {
      for (const [patternName, compoundGroup] of compoundGroups) {
        const dilutionPattern = this.echoPreCalc.dilutionPatterns.get(patternName)
        if (dilutionPattern && dilutionPattern.type == 'Treatment') {
          for (const plateGroup of destinationPlateGroups) {
            const destLocation = this.findNextAvailableBlock(plateGroup, this.inputData.Layout, patternName)
            this.transferCompound(plateGroup, destLocation, compoundId, dilutionPattern, compoundGroup)
          }
        }
        else if (dilutionPattern && dilutionPattern.type == 'Control') {
          const controlPatternInfo = controlCompounds.get(patternName)!
          if (!controlPatternInfo.memberCompounds.includes(compoundId)) {
            controlPatternInfo.memberCompounds.push(compoundId)
          }
        }
      }
    }

    for (const [patternName, dilutionPattern] of this.echoPreCalc.dilutionPatterns) {
      if (dilutionPattern.type == 'Combination') {
        const comboCompounds = compoundIdsWithPattern(this.echoPreCalc.srcCompoundInventory, patternName)
        const combinationPairs = calculateCombinationPairs(comboCompounds)
        for (const [cpd1, cpd2] of combinationPairs) {
          for (const plateGroup of destinationPlateGroups) {
            const destLocation = this.findNextAvailableBlock(plateGroup, this.inputData.Layout, patternName)
            const cpdGroup1 = this.echoPreCalc.srcCompoundInventory.get(cpd1)!.get(patternName)!
            const cpdGroup2 = this.echoPreCalc.srcCompoundInventory.get(cpd2)!.get(patternName)!
            this.transferCompound(plateGroup, destLocation, cpd1, dilutionPattern, cpdGroup1, false)
            this.transferCompound(plateGroup, destLocation, cpd2, dilutionPattern, cpdGroup2, true)
          }
        }
      }
    }

    for (const [patternName, controlPatternInfo] of controlCompounds) {
      const ctrlTransfers = controlPatternInfo.destSlots * this.destinationPlates.length
      const dilutionPattern = this.echoPreCalc.dilutionPatterns.get(patternName)
      if (dilutionPattern) {
        for (let i = 0; i < ctrlTransfers; i++) {
          const ctrlIdx = i % controlPatternInfo.memberCompounds.length
          const compoundId = controlPatternInfo.memberCompounds[ctrlIdx]
          const compoundGroup = this.echoPreCalc.srcCompoundInventory.get(compoundId)!.get(patternName)!
          const destLocation = this.findNextAvailableBlock(this.destinationPlates, this.inputData.Layout, patternName)
          this.transferCompound(this.destinationPlates, destLocation, compoundId, dilutionPattern, compoundGroup)
        }
      }
    }
  }

  dmsoNormalization() {
    let srcLocation = { barcode: '', wellId: '' }
    for (const plate of this.destinationPlates) {
      let maxVolume = 0
      for (const well of plate) {
        if (well) {
          const vol = well.getTotalVolume()
          if (vol > maxVolume) { maxVolume = vol }
        }
      }
      for (const well of plate) {
        if (well) {
          const volToAdd = (maxVolume - well.getTotalVolume())
          if (volToAdd > 0) {
            srcLocation = this.findNextAvailableDMSOWell([...this.sourcePlates, ...this.intermediatePlates], srcLocation, volToAdd)
            if (srcLocation.barcode != '' && srcLocation.wellId != '') {
              const transferStep: TransferStep = {
                sourceBarcode: srcLocation.barcode,
                sourceWellId: srcLocation.wellId,
                destinationBarcode: plate.barcode,
                destinationWellId: well.id,
                volume: volToAdd
              }
              const transferInfo: TransferInfo = {
                transferType: 'solvent',
                solventName: 'DMSO'
              }
              this.executeAndRecordTransfer(transferStep, transferInfo)
            }
          }
        }
      }
    }
  }

  transferCompound(destPlates: Plate[], destLocation: { barcode: string, wellBlock: string }, compoundId: string, dilutionPattern: DilutionPattern, compoundGroup: CompoundGroup, isComboSecondary?: boolean) {
    //const dilutionPattern = this.echoPreCalc.dilutionPatterns.get(patternName)!;
    const transferMap = this.echoPreCalc.calculateTransferConcentrations(dilutionPattern, compoundGroup);
    const destPlate = destPlates.find(plate => plate.barcode === destLocation.barcode)
    if (destPlate) {
      const direction = (isComboSecondary && dilutionPattern.secondaryDirection) ? dilutionPattern.secondaryDirection : dilutionPattern.direction
      const wellConcentrationArr = mapWellsToConcentrations(destPlate, destLocation.wellBlock, dilutionPattern.concentrations, dilutionPattern.replicates, direction)
      for (const concIdx in dilutionPattern.concentrations) {
        const conc = dilutionPattern.concentrations[concIdx]
        const concInfo = transferMap.destinationConcentrations.get(conc)
        const wellsToTransferTo = wellConcentrationArr[concIdx]
        if (concInfo) {
          if (concInfo.sourceType == 'src') {
            for (const wellId of wellsToTransferTo) {
              const possibleSrcLocs = this.echoPreCalc.srcCompoundInventory.get(compoundId)!.get(dilutionPattern.patternName)!.locations.filter((inv) => inv.concentration == concInfo.sourceConc)
              for (const loc of possibleSrcLocs) {
                const plt = this.sourcePlates.find(plate => plate.barcode === loc.barcode)
                if (plt) {
                  const well = plt.getWell(loc.wellId)
                  if (well && well.getTotalVolume() >= (concInfo.volToTsfr + this.echoDeadVolume)) {
                    const transferStep: TransferStep = {
                      sourceBarcode: plt.barcode,
                      sourceWellId: well.id,
                      destinationBarcode: destPlate.barcode,
                      destinationWellId: wellId,
                      volume: concInfo.volToTsfr
                    }
                    const transferInfo: TransferInfo = {
                      transferType: 'compound',
                      compoundName: compoundId,
                      patternName: dilutionPattern.patternName,
                    }
                    this.executeAndRecordTransfer(transferStep, transferInfo)
                    break
                  }
                }
              }
            }
          }
          else {
            for (const wellId of wellsToTransferTo) {
              const possibleIntLocs = this.intermediateWellCache.get(compoundId)!.get(concInfo.sourceConc)!
              for (const loc of possibleIntLocs) {
                const plt = this.intermediatePlates.find(plate => plate.barcode === loc.barcode)
                if (plt) {
                  for (const intWellId of loc.wellIds) {
                    const well = plt.getWell(intWellId)
                    if (well && well.getTotalVolume() >= (concInfo.volToTsfr + this.echoDeadVolume)) {
                      const transferStep: TransferStep = {
                        sourceBarcode: plt.barcode,
                        sourceWellId: well.id,
                        destinationBarcode: destPlate.barcode,
                        destinationWellId: wellId,
                        volume: concInfo.volToTsfr
                      }
                      const transferInfo: TransferInfo = {
                        transferType: 'compound',
                        compoundName: compoundId,
                        patternName: dilutionPattern.patternName,
                      }
                      this.executeAndRecordTransfer(transferStep, transferInfo)
                      break
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  hasWellsAvailable(wells: Well[]): boolean {
    for (const well of wells) {
      if (well.getContents().length != 0) {
        return false;
      }
    }
    return true;
  }

  findNextAvailableDMSOWell(plates: Plate[], lastUsed: { barcode: string, wellId: string }, volume: number): { barcode: string, wellId: string } {
    //hard coded solvent name for now, could expand to aqueous later
    const solventName = 'DMSO'
    //check if last used well is still fine
    let plateIdx = plates.findIndex(plate => plate.barcode == lastUsed.barcode);
    if (plateIdx > -1) {
      const well = plates[plateIdx].getWell(lastUsed.wellId);
      if (well && well.isSolventOnlyWell(solventName) && well.getTotalVolume() > (volume + this.echoDeadVolume)) {
        return lastUsed;
      }
      //iterate through remaining wells on plate
      else if (lastUsed.wellId) {
        let wellIds = plates[plateIdx].getWellIds();
        const wellIdIdx = wellIds.findIndex(wellId => wellId == lastUsed.wellId);
        if (wellIdIdx !== -1) {
          wellIds = wellIds.slice(wellIdIdx + 1);
          for (const wellId of wellIds) {
            const well = plates[plateIdx].getWell(wellId);
            if (well && well.isSolventOnlyWell(solventName) && well.getTotalVolume() > (volume + this.echoDeadVolume)) {
              return { barcode: lastUsed.barcode, wellId: wellId };
            }
          }
        }
      }
      //if didn't already return, need to do more plates
      for (const plate of plates.slice(plateIdx + 1)) {
        for (const well of plate) {
          if (well && well.isSolventOnlyWell(solventName) && well.getTotalVolume() > (volume + this.echoDeadVolume)) {
            return { barcode: plate.barcode, wellId: well.id };
          }
        }
      }
    }
    //start from the beginning and check every well of every plate
    else {
      for (const plate of plates) {
        for (const well of plate) {
          if (well && well.isSolventOnlyWell(solventName) && well.getTotalVolume() > (volume + this.echoDeadVolume)) {
            return { barcode: plate.barcode, wellId: well.id };
          }
        }
      }
    }
    //only should return if no available wells found 
    return { barcode: '', wellId: '' }
  }

  findNextAvailableBlock(plates: Plate[], layout: InputDataType['Layout'], patternName: string): { barcode: string, wellBlock: string } {
    let barcode = ''
    let wellBlock = ''
    const possibleLocations = layout.filter((row) => row.Pattern == patternName)
    for (const plate of plates) {
      for (const layoutRow of possibleLocations) {
        const wells = plate.getSomeWells(layoutRow['Well Block']);
        const isAvailable = wells.every(well => {
          const wellContents = well.getContents();
          // Check if the well is empty or if it doesn't already contain the current pattern
          return wellContents.length === 0 || !wellContents.some(content => content.patternName == patternName);
        });

        if (isAvailable) {
          barcode = plate.barcode;
          wellBlock = layoutRow['Well Block'];
          return { barcode: barcode, wellBlock: wellBlock };
        }
      }
    }
    return { barcode: barcode, wellBlock: wellBlock }
  }

  findPlateWithNumWellsAvailable(plates: Plate[], numberWells: number): { barcode: string, wellBlock: string } {
    for (const plate of plates) {
      const availableWells = Object.values(plate.wells)
        .filter(well => (well.getContents().length == 0))
        .map(well => well.id)
        .sort();

      if (availableWells.length >= numberWells) {
        const wellBlock = formatWellBlock(availableWells.slice(0, numberWells));
        return { barcode: plate.barcode, wellBlock };
      }
    }

    return { barcode: '', wellBlock: '' }
  }

  findPlateMaxConcentration(plate: Plate) {
    let maxConcentration = 0;

    for (const well of plate) {
      if (well) {
        const wellContents = well.getContents();
        for (const content of wellContents) {
          if (content.compoundId) {
            const currentConcentration = well.getConcentrationFromCompound(content.compoundId);
            if (currentConcentration > maxConcentration) {
              maxConcentration = currentConcentration;
            }
          }
        }
      }
    }

    plate.metadata.globalMaxConcentration = maxConcentration;
  }

  executeAndRecordTransfer(transferStep: TransferStep, transferInfo: TransferInfo) {
    const srcPlate = [...this.sourcePlates, ...this.intermediatePlates].find(plate => plate.barcode == transferStep.sourceBarcode);
    const destPlate = [...this.intermediatePlates, ...this.destinationPlates].find(plate => plate.barcode == transferStep.destinationBarcode);

    if (srcPlate && destPlate) {
      const srcWell = srcPlate.getWell(transferStep.sourceWellId);
      const destWell = destPlate.getWell(transferStep.destinationWellId);

      if (srcWell && destWell) {
        if (transferInfo.transferType === 'compound' && transferInfo.patternName) {
          const srcContents = srcWell.getContents().find(content => content.compoundId === transferInfo.compoundName);
          if (srcContents) {
            destWell.addContent(
              {
                compoundId: srcContents.compoundId,
                concentration: srcContents.concentration,
                patternName: transferInfo.patternName
              },
              transferStep.volume,
              { name: 'DMSO', fraction: 1 }
            );
            srcWell.removeVolume(transferStep.volume);
          }
        } else if (transferInfo.transferType === 'solvent' && transferInfo.solventName) {
          destWell.addSolvent({ name: transferInfo.solventName, volume: transferStep.volume });
          srcWell.removeVolume(transferStep.volume);
        }

        this.transferSteps.push(transferStep);
      }
    }
  }

  getTransferSteps(): TransferStep[] {
    return this.transferSteps;
  }
}