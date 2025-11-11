import { Plate } from '../../../classes/PlateClass';
import { Well } from '../../../classes/WellClass';
import { formatWellBlock, getWellFromBarcodeAndId, mapWellsToConcentrations } from '../utils/plateUtils';
import { compoundIdsWithPattern, executeAndRecordTransfer, getCombinationsOfSizeR, InputDataType, prepareSrcPlates } from '../utils/echoUtils';
import { CompoundGroup, ConcentrationObj, EchoPreCalculator } from './EchoPreCalculatorClass';
import { CheckpointTracker } from './CheckpointTrackerClass';
import { DilutionPattern } from '../../../classes/PatternClass';

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
}

type IntermediateWellCache = Map<string,
  Map<number,
    {
      barcode: string,
      wellIds: string[]
    }[]
  >
>

type PatternLocationCache = Map<string, Map<string, string[]>>;

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
  allowableError: number;
  inputData: InputDataType;
  echoPreCalc: EchoPreCalculator;
  errors: string[];
  intermediateWellCache: IntermediateWellCache;
  patternLocationCache: PatternLocationCache;
  checkpointTracker: CheckpointTracker;
  evenDepletion: boolean;

  constructor(
    echoPreCalc: EchoPreCalculator,
    checkpointTracker: CheckpointTracker,
  ) {
    this.errors = []
    this.inputData = echoPreCalc.inputData;
    this.maxDMSOFraction = echoPreCalc.maxDMSOFraction;
    this.intermediateBackfillVolume = echoPreCalc.intermediateBackfillVolume;
    this.finalAssayVolume = echoPreCalc.finalAssayVolume;
    this.allowableError = echoPreCalc.allowableError;
    this.echoPreCalc = echoPreCalc;
    this.transferSteps = [];
    this.intermediateWellCache = new Map();
    this.patternLocationCache = new Map();
    this.checkpointTracker = checkpointTracker;
    this.evenDepletion = this.inputData.CommonData.evenDepletion || false;

    this.sourcePlates = prepareSrcPlates(this.echoPreCalc.srcCompoundInventory, this.echoPreCalc.srcPltSize, this.echoPreCalc.dilutionPatterns, this.inputData)
    this.intermediatePlates = this.prepareIntPlates();
    this.destinationPlates = this.prepareDestPlates()
    this.fillIntPlates()
    this.fillDestPlates()
    if (this.inputData.CommonData.dmsoNormalization) { this.dmsoNormalization() }
    for (const plate of [...this.sourcePlates, ...this.intermediatePlates, ...this.destinationPlates]) {
      this.findPlateMaxConcentration(plate)
    }

  }

  //prepares necessary number of intermediate plates 
  prepareIntPlates(): Plate[] {
    let totalIntWellsNeeded = { level1: 0, level2: 0 };
    const echoIntDeadVolume = this.intermediateBackfillVolume < 15000 ? 2500 : 15000

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
            const newWellsNeeded = Math.ceil(concInnerMap / ((this.intermediateBackfillVolume + concInfo.volToTsfr) - echoIntDeadVolume));
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
          const plateDeadVolume = this.echoPreCalc.plateDeadVolumes.get(srcPlate.barcode) || echoIntDeadVolume;
          dmsoVolAvailable += Math.max(0, well.getSolventVolume('DMSO') - plateDeadVolume);
        }
      }
    }
    if (dmsoVolAvailable < this.echoPreCalc.totalDMSOBackfillVol) {
      const dmsoWellsNeeded = Math.ceil((this.echoPreCalc.totalDMSOBackfillVol - dmsoVolAvailable) / (this.intermediateBackfillVolume - echoIntDeadVolume));
      totalIntWellsNeeded.level1 += dmsoWellsNeeded;
    }

    const intPlatesCount1 = Math.ceil(totalIntWellsNeeded.level1 / 384);
    const intPlatesCount2 = Math.ceil(totalIntWellsNeeded.level2 / 384);
    const intPlates: Plate[] = [];

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
      this.echoPreCalc.plateDeadVolumes.set(newIntPlate.barcode, echoIntDeadVolume)

      for (const well of newIntPlate) {
        if (well) {
          well.addSolvent({ name: 'DMSO', volume: this.intermediateBackfillVolume });
        }
      }
      intPlates.push(newIntPlate);
    }

    return intPlates;
  }

  fillIntPlates() {
    const echoIntDeadVolume = this.intermediateBackfillVolume < 15000 ? 2500 : 15000
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

    for (const [compoundId, compoundNeeds] of intermediateNeeds) {
      for (const [intConc, totalVolume] of compoundNeeds) {
        const wellsNeeded = Math.ceil(totalVolume / (this.intermediateBackfillVolume - echoIntDeadVolume)); //ignores actual transfered volume, but that just overestimates so should be fine

        const concInfo = this.findConcInfo(compoundId, intConc);
        if (!concInfo) {
          console.warn(`Could not find source for ${compoundId} at ${intConc}µM`);
          break;
        }

        // TODO - finds plate with total wells available. Will fail in edge case where total calculated wells needed is correct, but doesn't divide up
        // perfectly filling plates. It *should* be okay most of the time, with unused wells being counted for DMSO, but in extreme cases could still fail.
        // Need to redo this (or original int plate creation) to account for this.
        const intPlatesToSearch = this.intermediatePlates.filter(
          plt => plt.plateRole === (concInfo.sourceType === 'src' ? 'intermediate1' : 'intermediate2')
        );
        const location = this.findPlateWithNumWellsAvailable(intPlatesToSearch, wellsNeeded);
        if (!location.barcode || !location.wellBlock) break;

        const intPlate = this.intermediatePlates.find(plate => plate.barcode === location.barcode)!;
        const wellBlock = intPlate.getSomeWells(location.wellBlock);

        for (const intWell of wellBlock) {

          const possibleLocs = this.findAvailableIntermediates(compoundId, concInfo)
          const sourceWell = this.findSourceWell(possibleLocs,concInfo.volToTsfr,this.evenDepletion)
          if (!sourceWell) break;

          const transferStep: TransferStep = {
            sourceBarcode: sourceWell.barcode,
            sourceWellId: sourceWell.wellId,
            destinationBarcode: intPlate.barcode,
            destinationWellId: intWell.id,
            volume: concInfo.volToTsfr
          };

          const transferInfo: TransferInfo = {
            transferType: 'compound',
            compoundName: compoundId
          };

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

          executeAndRecordTransfer(transferStep, transferInfo, this.sourcePlates, this.intermediatePlates, this.destinationPlates) ? this.transferSteps.push(transferStep) : null
        }
      }
    }
  }

  findSourceWell(locations: { barcode: string, wellId: string }[], volume: number, evenDepletion: boolean): { barcode: string, wellId: string } | null {
    const plates = [...this.sourcePlates, ...this.intermediatePlates]
    let plate: Plate | undefined;
    if (evenDepletion) {
      const wells: Well[] = []
      for (const loc of locations) {
        const well = getWellFromBarcodeAndId(loc.barcode, loc.wellId, plates, plate)
        if (!well) continue
        if (!plate || well.parentBarcode != plate.barcode) { plate = plates.find(p => p.barcode === well.parentBarcode) }
        if (!plate) continue
        const srcDeadVolume = this.echoPreCalc.plateDeadVolumes.get(plate.barcode) || (well.getTotalVolume() < 15000 ? 2500 : 15000) //might as well check volumes in first pass
        if (well.getTotalVolume() >= (volume + srcDeadVolume)) {
          wells.push(well)
        }
      }
      if (wells.length > 0) {
        const maxWell = wells.reduce((prev, current) => (prev.getTotalVolume() >= current.getTotalVolume()) ? prev : current)
        return { barcode: maxWell.parentBarcode, wellId: maxWell.id }
      }
    }
    else {
      for (const loc of locations) {
        const well = getWellFromBarcodeAndId(loc.barcode, loc.wellId, plates, plate)
        if (!well) continue
        if (!plate || well.parentBarcode != plate.barcode) { plate = plates.find(p => p.barcode === well.parentBarcode) }
        const srcDeadVolume = this.echoPreCalc.plateDeadVolumes.get(well.parentBarcode) || (well.getTotalVolume() < 15000 ? 2500 : 15000)
        if (well.getTotalVolume() >= (volume + srcDeadVolume)) {
          return { barcode: well.parentBarcode, wellId: well.id }
        }
      }
    }
    return null
  }

  findAvailableIntermediates(compoundId: string, concInfo: ConcentrationObj): { barcode: string, wellId: string }[] {
    let possibleLocs: { barcode: string, wellId: string }[] = []
    if (concInfo.sourceType === 'src') {
      const patternMap = this.echoPreCalc.srcCompoundInventory.get(compoundId)
      if (!patternMap) return possibleLocs;
      for (const compoundGroup of patternMap.values()) {
        for (const loc of compoundGroup.locations) {
          if (loc.concentration === concInfo.sourceConc) {
              possibleLocs.push({barcode: loc.barcode, wellId: loc.wellId});
          }
        }
      }
    }
    else {
      const cpdIntWellCache = this.intermediateWellCache.get(compoundId)
      if (!cpdIntWellCache) return possibleLocs;
      const concWellCache = cpdIntWellCache.get(concInfo.sourceConc)
      if (!concWellCache) return possibleLocs;
      for (const plateObj of concWellCache) {
        for (const wellId of plateObj.wellIds) {
          possibleLocs.push({ barcode: plateObj.barcode, wellId: wellId })
        }
      }
    }
    return possibleLocs
  }

  findConcInfo(compoundId: string, targetConc: number): ConcentrationObj | null {
    for (const [patternName, compoundGroup] of this.echoPreCalc.srcCompoundInventory.get(compoundId)!) {
      const pattern = this.echoPreCalc.dilutionPatterns.get(patternName);
      if (!pattern) continue;

      const transferConcentrations = this.echoPreCalc.calculateTransferConcentrations(pattern, compoundGroup);
      const concInfo = transferConcentrations.intermediateConcentrations.get(targetConc);
      if (concInfo) {
        return concInfo
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
        const barcode = `DestPlate_${i.toString().padStart(this.echoPreCalc.destinationPlatesCount.toString().length, '0')}` //padding for sorting of transfer list
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

    for (const plate of this.destinationPlates) {
      for (const layoutBlock of this.inputData.Layout) {
        const pattern = this.echoPreCalc.dilutionPatterns.get(layoutBlock.Pattern);
        if (pattern && pattern.type === 'Unused') {
          const wells = plate.getSomeWells(layoutBlock['Well Block']);
          for (const well of wells) {
            well.markAsUnused();
          }
        }
      }
    }

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

    for (let replicateIndex = 0; replicateIndex < replicates; replicateIndex++) {
      this.patternLocationCache.clear();

      const plateGroup = destinationPlateGroups[replicateIndex];

      //treatments
      for (const [compoundId, compoundGroups] of this.echoPreCalc.srcCompoundInventory) {
        for (const [patternName, compoundGroup] of compoundGroups) {
          const dilutionPattern = this.echoPreCalc.dilutionPatterns.get(patternName);
          if (dilutionPattern && dilutionPattern.type == 'Treatment') {
            const destLocation = this.findNextAvailableBlock(plateGroup, this.inputData.Layout, patternName);
            this.transferCompound(plateGroup, destLocation, compoundId, dilutionPattern, compoundGroup);
          }
          else if (dilutionPattern && dilutionPattern.type == 'Control') {
            const controlPatternInfo = controlCompounds.get(patternName)!;
            if (!controlPatternInfo.memberCompounds.includes(compoundId)) {
              controlPatternInfo.memberCompounds.push(compoundId);
            }
          }
        }
      }

      //combinations
      for (const [patternName, dilutionPattern] of this.echoPreCalc.dilutionPatterns) {
        if (dilutionPattern.type == 'Combination') {
          const comboCompounds = compoundIdsWithPattern(this.echoPreCalc.srcCompoundInventory, patternName);

          const combinations = getCombinationsOfSizeR(comboCompounds, dilutionPattern.fold);

          for (const combo of combinations) {
            const destLocation = this.findNextAvailableBlock(plateGroup, this.inputData.Layout, patternName);
            for (const [idx, cpd] of combo.entries()) {
              const cpdGroup = this.echoPreCalc.srcCompoundInventory.get(cpd)!.get(patternName)!;
              this.transferCompound(plateGroup, destLocation, cpd, dilutionPattern, cpdGroup, idx);
            }
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
          const srcCompound = this.echoPreCalc.srcCompoundInventory.get(compoundId)
          if (!srcCompound) continue
          const compoundGroup = srcCompound.get(patternName)
          if (!compoundGroup) continue
          const destLocation = this.findNextAvailableBlock(this.destinationPlates, this.inputData.Layout, patternName)
          this.transferCompound(this.destinationPlates, destLocation, compoundId, dilutionPattern, compoundGroup)
        }
      }
    }
  }

  dmsoNormalization() {
    let possibleLocs: {barcode: string, wellId: string}[] = []
    for (const plate of [...this.sourcePlates, ...this.intermediatePlates]) {
      for (const well of plate) {
        if (well && well.isSolventOnlyWell('DMSO')) {possibleLocs.push({barcode: well.parentBarcode, wellId: well.id})}
      }
    }
    for (const plate of this.destinationPlates) {
      let maxVolume = 0
      for (const well of plate) {
        if (well && !well.getIsUnused()) {
          const vol = well.getTotalVolume()
          if (vol > maxVolume) { maxVolume = vol }
        }
      }
      for (const well of plate) {
        if (well && !well.getIsUnused()) {
          const volToAdd = (maxVolume - well.getTotalVolume())
          if (volToAdd > 0) {
            const srcWell = this.findSourceWell(possibleLocs,volToAdd,this.evenDepletion)
            if (srcWell) {
              const transferStep: TransferStep = {
                sourceBarcode: srcWell.barcode,
                sourceWellId: srcWell.wellId,
                destinationBarcode: plate.barcode,
                destinationWellId: well.id,
                volume: volToAdd
              }
              const transferInfo: TransferInfo = {
                transferType: 'solvent',
                solventName: 'DMSO'
              }
              executeAndRecordTransfer(transferStep, transferInfo, this.sourcePlates, this.intermediatePlates, this.destinationPlates) ? this.transferSteps.push(transferStep) : null
            }
          }
        }
      }
    }
  }

  transferCompound(destPlates: Plate[], destLocation: { barcode: string, wellBlock: string }, compoundId: string, dilutionPattern: DilutionPattern, compoundGroup: CompoundGroup, dirIdx: number = 0) {
    const transferMap = this.echoPreCalc.calculateTransferConcentrations(dilutionPattern, compoundGroup);
    const destPlate = destPlates.find(plate => plate.barcode === destLocation.barcode)
    if (!destPlate) return
    const direction = dilutionPattern.direction[dirIdx]
    const wellConcentrationArr = mapWellsToConcentrations(destPlate, destLocation.wellBlock, dilutionPattern.concentrations, direction)
    for (const concIdx in dilutionPattern.concentrations) {
      const conc = dilutionPattern.concentrations[concIdx]
      const concInfo = transferMap.destinationConcentrations.get(conc)
      const wellsToTransferTo = wellConcentrationArr[concIdx]
      if (!concInfo) continue
      for (const wellId of wellsToTransferTo) {
        let possibleSrcLocs: { barcode: string, wellId: string }[]
        if (concInfo.sourceType == 'src') {
          possibleSrcLocs = this.echoPreCalc.srcCompoundInventory.get(compoundId)!.get(dilutionPattern.patternName)!.locations.filter((inv) => inv.concentration == concInfo.sourceConc).map(loc => { return { barcode: loc.barcode, wellId: loc.wellId } })
        }
        else {
          const possibleIntLocs = this.intermediateWellCache.get(compoundId)!.get(concInfo.sourceConc)!
          possibleSrcLocs = possibleIntLocs.flatMap(item => {
            return item.wellIds.map(wellId => ({
              barcode: item.barcode,
              wellId: wellId
            }));
          });
        }
        const srcWell = this.findSourceWell(possibleSrcLocs, concInfo.volToTsfr, this.evenDepletion)
        if (srcWell) {
          const transferStep: TransferStep = {
            sourceBarcode: srcWell.barcode,
            sourceWellId: srcWell.wellId,
            destinationBarcode: destPlate.barcode,
            destinationWellId: wellId,
            volume: concInfo.volToTsfr
          }
          const transferInfo: TransferInfo = {
            transferType: 'compound',
            compoundName: compoundId
          }
          executeAndRecordTransfer(transferStep, transferInfo, this.sourcePlates, this.intermediatePlates, this.destinationPlates) ? this.transferSteps.push(transferStep) : null
        }
      }
    }
  }

  hasWellsAvailable(wells: Well[]): boolean {
    for (const well of wells) {
      if (well.getContents().length != 0 && !well.getIsUnused()) {
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
      const echoDeadVolume = this.echoPreCalc.plateDeadVolumes.get(plates[plateIdx].barcode) as number
      const well = plates[plateIdx].getWell(lastUsed.wellId);
      if (well && well.isSolventOnlyWell(solventName) && well.getTotalVolume() > (volume + echoDeadVolume)) {
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
            if (well && well.isSolventOnlyWell(solventName) && well.getTotalVolume() > (volume + echoDeadVolume)) {
              return { barcode: lastUsed.barcode, wellId: wellId };
            }
          }
        }
      }
      //if didn't already return, need to do more plates
      for (const plate of plates.slice(plateIdx + 1)) {
        for (const well of plate) {
          if (well && well.isSolventOnlyWell(solventName) && well.getTotalVolume() > (volume + echoDeadVolume)) {
            return { barcode: plate.barcode, wellId: well.id };
          }
        }
      }
    }
    //start from the beginning and check every well of every plate
    else {
      for (const plate of plates) {
        const echoDeadVolume = this.echoPreCalc.plateDeadVolumes.get(plate.barcode) as number
        for (const well of plate) {
          if (well && well.isSolventOnlyWell(solventName) && well.getTotalVolume() > (volume + echoDeadVolume)) {
            return { barcode: plate.barcode, wellId: well.id };
          }
        }
      }
    }
    //only should return if no available wells found 
    return { barcode: '', wellId: '' }
  }

  findNextAvailableBlock(plates: Plate[], layout: InputDataType['Layout'], patternName: string): { barcode: string, wellBlock: string } {
    if (!this.patternLocationCache.has(patternName)) {
      const patternCache = new Map<string, string[]>();

      for (const plate of plates) {
        const availableBlocks: string[] = [];
        const possibleLocations = layout.filter((row) => row.Pattern === patternName);

        for (const layoutRow of possibleLocations) {
          const wellBlock = layoutRow['Well Block'];
          const wells = plate.getSomeWells(wellBlock);

          const isAvailable = wells.every(well => {
            if (well.getIsUnused()) return false;
            const wellContents = well.getContents();
            return wellContents.length === 0 || !wellContents.some(content => content.patternName === patternName);
          });

          if (isAvailable) {
            availableBlocks.push(wellBlock);
          }
        }

        if (availableBlocks.length > 0) {
          patternCache.set(plate.barcode, availableBlocks);
        }
      }

      this.patternLocationCache.set(patternName, patternCache);
    }

    const patternCache = this.patternLocationCache.get(patternName)!;

    for (const [barcode, blocks] of patternCache) {
      if (blocks.length > 0) {
        const wellBlock = blocks[0];
        blocks.splice(0, 1);
        if (blocks.length === 0) {
          patternCache.delete(barcode);
        }
        return { barcode, wellBlock };
      }
    }

    this.patternLocationCache.delete(patternName);

    for (const plate of plates) {
      const possibleLocations = layout.filter((row) => row.Pattern === patternName);
      for (const layoutRow of possibleLocations) {
        const wells = plate.getSomeWells(layoutRow['Well Block']);
        const isAvailable = wells.every(well => {
          if (well.getIsUnused()) return false;
          const wellContents = well.getContents();
          return wellContents.length === 0 || !wellContents.some(content => content.patternName === patternName);
        });

        if (isAvailable) {
          return { barcode: plate.barcode, wellBlock: layoutRow['Well Block'] };
        }
      }
    }

    return { barcode: '', wellBlock: '' };
  }

  findPlateWithNumWellsAvailable(plates: Plate[], numberWells: number): { barcode: string, wellBlock: string } {
    for (const plate of plates) {
      const availableWells = Object.values(plate.wells)
        .filter(well => (well.getContents().length == 0 && !well.getIsUnused()))
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

  getTransferSteps(): TransferStep[] {
    return this.transferSteps;
  }
}