import { mapWellsToConcentrations, getWellIdFromCoords, getCoordsFromWellId } from "../utils/plateUtils";
import { Pattern } from "./PatternClass";
import { Well } from "./WellClass";
export type PlateRole = 'source' | 'intermediate1' | 'intermediate2' | 'destination';
export type PlateSize = '12' | '24' | '48' | '96' | '384' | '1536';
export type PlateType = 'LDV' | 'PP' | 'other'

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
    plateType?: PlateType;
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

  [Symbol.iterator]() {
    const wellIds = Object.keys(this.wells);
    let index = 0;
    return {
      next: () => {
        if (index < wellIds.length) {
          return { value: this.getWell(wellIds[index++]), done: false };
        } else {
          return { done: true };
        }
      }
    };
  }

  clone(): Plate {
    const clonedData = structuredClone(this);
    const clonedPlate = Object.create(Plate.prototype);
    Object.assign(clonedPlate, clonedData);

    // Reconstruct Well instances
    for (const wellId in clonedPlate.wells) {
      if (clonedPlate.wells.hasOwnProperty(wellId)) {
        const wellData = clonedPlate.wells[wellId];
        clonedPlate.wells[wellId] = Object.create(Well.prototype);
        Object.assign(clonedPlate.wells[wellId], wellData);
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
        wells[wellId] = new Well({ id: wellId });
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
    return this.wells[wellId] || null;
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

    // Split the input into block ranges and process each one
    const blockRanges = rawRange.split(';');
    const wellIDs: string[] = blockRanges.flatMap(blockRange => getWellsFromRange(blockRange.trim()));

    // Convert well IDs to Well objects
    return wellIDs.map(wellID => {
      const well = this.wells[wellID];
      if (!well) {
        throw new Error(`Well ${wellID} not found`);
      }
      return well;
    });
  }

  applyPattern(wellBlock: string, pattern: Pattern): void {
    const concentrations = pattern.concentrations.filter(c => c != null)
    const concentrationArr = mapWellsToConcentrations(this,wellBlock,concentrations,pattern.replicates,pattern.direction)
    for (const concIdx in concentrations) {
      for (const wellId of concentrationArr[concIdx]) {
        const well = this.getWell(wellId)
        if (well) {well.applyPattern(pattern.name,concentrations[concIdx])}
      }
    }
  }

  removePattern(wellBlock: string, patternName: string): void {
    const wells = this.getSomeWells(wellBlock)
    for (const well of wells) {
      well.removePattern(patternName)
    }
  }
}