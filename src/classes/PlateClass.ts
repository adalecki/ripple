import { mapWellsToConcentrations, getWellIdFromCoords, getCoordsFromWellId } from "../utils/plateUtils";
import { Pattern } from "./PatternClass";
import { Well } from "./WellClass";
export type PlateRole = 'source' | 'intermediate1' | 'intermediate2' | 'destination';
export type PlateSize = '12' | '24' | '48' | '96' | '384' | '1536';

export class Plate {
  id: number;
  barcode: string;
  metadata: any;
  rows: number;
  columns: number;
  wells: { [key: string]: Well };
  plateRole: PlateRole;
  patterns: { [key: string]: Pattern };

  constructor(config: {
    id?: number;
    barcode?: string;
    metadata?: any;
    plateSize?: PlateSize;
    plateRole?: PlateRole;
  }) {
    this.id = config.id || Date.now();
    this.barcode = config.barcode || '';
    this.metadata = config.metadata || {globalMaxConcentration: 0};
    const plateDimensions = this.getPlateDimensions(config.plateSize || '384');
    this.rows = plateDimensions.rows;
    this.columns = plateDimensions.cols;
    this.wells = this.initializeWells();
    this.plateRole = config.plateRole || 'destination';
    this.patterns = {};
  }

  *[Symbol.iterator](): IterableIterator<Well> {
    for (const wellId of Object.keys(this.wells)) {
      const well = this.wells[wellId];
      if (well) {
        yield well;
      }
    }
  }

  clone(): Plate {
    const clonedData = structuredClone(this);
    const clonedPlate = Object.create(Plate.prototype);
    Object.assign(clonedPlate, clonedData);

    for (const wellId in clonedPlate.wells) {
      if (clonedPlate.wells.hasOwnProperty(wellId)) {
        const wellData = clonedPlate.wells[wellId];
        clonedPlate.wells[wellId] = Object.create(Well.prototype);
        Object.assign(clonedPlate.wells[wellId], wellData);
      }
    }

    for (const patternName in clonedPlate.patterns) {
      if (clonedPlate.patterns.hasOwnProperty(patternName)) {
        const patternData = clonedPlate.patterns[patternName];
        clonedPlate.patterns[patternName] = Object.create(Pattern.prototype);
        Object.assign(clonedPlate.patterns[patternName], patternData);
      }
    }

    return clonedPlate;
  }

  getPlateDimensions(plateSize: PlateSize) {
    const dimensions = {
      '12': { rows: 3, cols: 4 },
      '24': { rows: 4, cols: 6 },
      '48': { rows: 6, cols: 8 },
      '96': { rows: 8, cols: 12 },
      '384': { rows: 16, cols: 24 },
      '1536': { rows: 32, cols: 48 }
    };
    return dimensions[plateSize] || dimensions['384'];
  }

  initializeWells(): { [key: string]: Well } {
    const wells: { [key: string]: Well } = {};
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.columns; col++) {
        const wellId = getWellIdFromCoords(row, col);
        wells[wellId] = new Well({ id: wellId, parentBarcode: this.barcode });
      }
    }
    return wells;
  }

  bulkFillWells(wellIds: string[], volume: number, solventName: string = 'DMSO'): void {
    for (const wellId of wellIds) {
      const well = this.wells[wellId];
      if (well) {
        well.bulkFill(volume, solventName);
      }
    }
  }

  getWell(wellId: string): Well | null {
    let paddedWellId = wellId
    const splitWell = wellId.match(/([A-Z]+)(\d+)/)
    
    if (splitWell && splitWell[2].length === 1) {
      paddedWellId = `${splitWell[1]}${splitWell[2].toString().padStart(2, '0')}`
    }
    return this.wells[paddedWellId] || null;
  }

  getWells(): { [key: string]: Well } {
    return this.wells;
  }

  getWellIds() {
    return Object.keys(this.wells)
  }

  getSomeWells(rawRange: string): Well[] {
    const getWellsFromRange = (range: string): string[] => {
      const [startWell, endWell = startWell] = range.split(':');

      const startMatch = startWell.match(/([A-Z]+)(\d+)/);
      const endMatch = endWell.match(/([A-Z]+)(\d+)/);

      if (!startMatch || !endMatch || !(startMatch[0] == startWell) || !(endMatch[0] == endWell)) {
        throw new Error(`Invalid well format in range: ${range}`);
      }

      const startCoords = getCoordsFromWellId(startWell);
      const endCoords = getCoordsFromWellId(endWell);

      const wellIDs: string[] = [];
      const fromRow = Math.min(startCoords.row, endCoords.row);
      const toRow = Math.max(startCoords.row, endCoords.row);
      const fromCol = Math.min(startCoords.col, endCoords.col);
      const toCol = Math.max(startCoords.col, endCoords.col);

      for (let rowNum = fromRow; rowNum <= toRow; rowNum++) {
        for (let colNum = fromCol; colNum <= toCol; colNum++) {
          wellIDs.push(getWellIdFromCoords(rowNum, colNum));
        }
      }
      
      return wellIDs;
    };

    const blockRanges = rawRange.split(';');
    const wellIDs: string[] = blockRanges.flatMap(blockRange => getWellsFromRange(blockRange.trim()));

    return wellIDs.map(wellID => {
      const well = this.wells[wellID];
      if (!well) {
        throw new Error(`Well ${wellID} not found`);
      }
      return well;
    });
  }

  applyPattern(wellBlock: string, pattern: Pattern): void {
    if (pattern.type === 'Unused') {
      const wells = this.getSomeWells(wellBlock);
      for (const well of wells) {
        well.markAsUnused();
      }
    } else {
      const concentrations = pattern.concentrations.filter(c => c != null)
      const concentrationArr = mapWellsToConcentrations(this,wellBlock,concentrations,pattern.direction[0])
      for (const concIdx in concentrations) {
        for (const wellId of concentrationArr[concIdx]) {
          const well = this.getWell(wellId)
          if (well) {well.applyPattern(pattern.name,concentrations[concIdx])}
        }
      }
    }

    if (!this.patterns[pattern.name]) {
      this.patterns[pattern.name] = pattern.clone();
      this.patterns[pattern.name].locations = [wellBlock];
    } else {
      if (!this.patterns[pattern.name].locations.includes(wellBlock)) {
        this.patterns[pattern.name].locations.push(wellBlock);
      }
    }
  }

  removePattern(wellBlock: string, patternName: string): void {
    const wells = this.getSomeWells(wellBlock)
    for (const well of wells) {
      well.removePattern(patternName)
      if (this.patterns[patternName]?.type === 'Unused') {
        well.markAsUsed();
      }
    }

    if (this.patterns[patternName]) {
      this.patterns[patternName].locations = this.patterns[patternName].locations.filter(
        block => block !== wellBlock
      );
      
      if (this.patterns[patternName].locations.length === 0) {
        delete this.patterns[patternName];
      }
    }
  }

  getPatternBlocks(patternName: string): string[] {
    return this.patterns[patternName]?.locations || [];
  }

  getAllPatterns(): Pattern[] {
    return Object.values(this.patterns);
  }

  hasPattern(patternName: string): boolean {
    return patternName in this.patterns;
  }
}