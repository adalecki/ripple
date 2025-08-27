import { Plate } from '../../../classes/PlateClass';
import { Well } from '../../../classes/WellClass';
import { Protocol } from '../../../types/mapperTypes';

export interface TreatmentWell {
  wellId: string;
  concentration: number;
  response: number;
}

export interface TreatmentGroup {
  wells: TreatmentWell[];
}

export interface AggregatedPoint {
  concentration: number;
  mean: number;
  stdDev: number;
  count: number;
  wellIds: string[];
}

export interface CurveData {
  treatmentId: string;
  points: ConcentrationPoint[];
  aggregatedPoints: AggregatedPoint[];
}

export interface ConcentrationPoint {
  concentration: number;
  responseValue: number;
  wellId: string;
}

export interface FittedPoint {
  concentration: number;
  mean: number;
}

export type AssayType = 'SP' | 'DR';

function isControlWell(wellId: string, plate: Plate, protocol?: Protocol): boolean {
  if (!protocol) return false;

  for (const control of protocol.dataProcessing.controls) {
    if (!control.wells) continue;

    try {
      const controlWells = plate.getSomeWells(control.wells);
      if (controlWells.some(well => well.id === wellId)) {
        return true;
      }
    } catch (error) {
      console.warn(`Invalid control well range: ${control.wells}`, error);
    }
  }

  return false;
}

export function getCurveData(plate: Plate, normalized: Boolean, protocol?: Protocol): CurveData[] {
  const treatmentGroups = new Map<string, ConcentrationPoint[]>();

  for (const well of plate) {
    if (well.getIsUnused() ||
      (well.rawResponse === null && well.normalizedResponse === null) ||
      isControlWell(well.id, plate, protocol)) {
      continue;
    }

    const treatmentKey = getTreatmentKey(well)
    if (treatmentKey !== 'EMPTY_WELL') {
      const responseValue = (normalized ? well.normalizedResponse : well.rawResponse)
      if (!responseValue) continue
      if (!treatmentGroups.has(treatmentKey)) {
        treatmentGroups.set(treatmentKey, [])
      }
      const contents = well.getContents()
      treatmentGroups.get(treatmentKey)!.push({
        concentration: contents[0].concentration,
        responseValue,
        wellId: well.id
      })
    }
  }

  const curves: CurveData[] = [];
  for (const [treatmentKey, points] of treatmentGroups) {
    const uniqueConcentrations = new Set(points.map(p => p.concentration));

    if (uniqueConcentrations.size > 3) {
      const aggregatedPoints = aggregateData(points);
      aggregatedPoints.sort((a, b) => b.concentration - a.concentration);

      curves.push({
        treatmentId: treatmentKey,
        points,
        aggregatedPoints
      });
    }
  }

  return curves.sort((a, b) => a.treatmentId.localeCompare(b.treatmentId));
};

// Generates a unique string key for a treatment based on its compound IDs.
// Sorts compound IDs to ensure order doesn't matter (e.g., A+B is same as B+A).
export function getTreatmentKey(well: Well): string {
  const compoundIds = well.getContents()
    .filter(content => !isNaN(content.concentration) && content.compoundId !== null && content.compoundId !== undefined)
    .map(content => content.compoundId as string)
    .sort();

  if (compoundIds.length === 0) {
    return 'EMPTY_WELL';
  }
  return compoundIds.join('+');
}

export function groupDataByTreatment(plate: Plate | null): Map<string, TreatmentGroup> {
  const treatmentGroups = new Map<string, TreatmentGroup>()

  if (!plate || !plate.wells) {
    return treatmentGroups;
  }

  for (const wellId in plate.wells) {
    const well = plate.getWell(wellId);

    if (well && !well.getIsUnused() && well.rawResponse !== null) {
      const treatmentKey = getTreatmentKey(well);
      const concentration = well.getContents().length > 0 ? well.getContents()[0].concentration : 0; //just use first content's conc for now

      const response = well.rawResponse; // Using rawResponse as per plan for curveFit

      if (!treatmentGroups.has(treatmentKey)) {
        treatmentGroups.set(treatmentKey, { wells: [] })
      }
      const tData = treatmentGroups.get(treatmentKey)!
      tData.wells.push({ wellId: wellId, concentration: concentration, response: response })

    }
  }
  return treatmentGroups;
}

export function identifyAssayType(treatmentGroup: TreatmentGroup): AssayType {
  if (!treatmentGroup) {
    return 'SP'; // Default or error case
  }
  // Count unique, non-zero concentrations for dose-response determination.
  const uniqueConcentrations = new Set(treatmentGroup.wells.map(well => well.concentration).filter(conc => conc > 0));

  return uniqueConcentrations.size >= 4 ? 'DR' : 'SP';
}

export function yAxisDomains(plate: Plate, normalized: Boolean): { yLo: number, yHi: number } {
  let yLo = 0;
  let yHi = 100;

  if (normalized) {
    if (isNaN(parseFloat(plate.metadata.normalizedMinValue)) || isNaN(parseFloat(plate.metadata.normalizedMaxValue))) return { yLo, yHi }
    const window = plate.metadata.normalizedMaxValue - plate.metadata.normalizedMinValue;
    yLo = Math.min(yLo, plate.metadata.normalizedMinValue - (window / 20))
    yHi = Math.max(yHi, plate.metadata.normalizedMaxValue + (window / 20))
  }
  else {
    if (isNaN(parseFloat(plate.metadata.globalMinResponse)) || isNaN(parseFloat(plate.metadata.globalMaxResponse))) return { yLo, yHi }
    const window = plate.metadata.globalMaxResponse - plate.metadata.globalMinResponse;
    yLo = plate.metadata.globalMinResponse - (window / 20)
    yHi = plate.metadata.globalMaxResponse + (window / 20)
  }
  return { yLo, yHi }
}

export function aggregateData(points: ConcentrationPoint[]): AggregatedPoint[] {
  const grouped = points.reduce((acc: { [key: number]: ConcentrationPoint[] }, point) => {
    if (!acc[point.concentration]) {
      acc[point.concentration] = [];
    }
    acc[point.concentration].push(point);
    return acc;
  }, {});

  return Object.entries(grouped).map(([concentration, pointsAtConc]) => {
    const values = pointsAtConc.map(p => p.responseValue);
    const wellIds = pointsAtConc.map(p => p.wellId);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    return {
      concentration: +concentration,
      mean,
      stdDev,
      count: values.length,
      wellIds
    };
  });
}

export function fourPL(x: number, top: number, bottom: number, hillslope: number, ec50: number): number {
  return bottom + (top - bottom) / (1 + Math.pow(ec50 / x, hillslope));
}

export function formatEC50(value: number): string {
  if (value === 0 || isNaN(value) || !isFinite(value)) return "N/A";
  if (value < 0.001) return value.toExponential(2);
  if (value < 1) return value.toFixed(3);
  if (value < 1000) return value.toFixed(1);
  return value.toExponential(2);
};

export function hasResponseData(plate: Plate): boolean {
  if (!plate) return false;
  for (const well of plate) {
    if (!well) continue
    if (well.rawResponse !== null || well.normalizedResponse !== null) {
      return true;
    }
  }
  return false;
};

export function hasCompounds(plate: Plate): boolean {
  if (!plate) return false;
  for (const well of plate) {
    if (!well) continue
    const contents = well.getContents();
    if (contents.some(content => content.compoundId && content.concentration > 0)) {
      return true;
    }
  }
  return false;
};

export function getMaskedWells(plate: Plate): string[] {
  if (!plate) return [];
  const maskedWells: string[] = [];
  for (const well of plate) {
    if (!well) continue
    if (well.getIsUnused()) {
      maskedWells.push(well.id);
    }
  }
  return maskedWells;
};

export function getPlatesWithData(plates: Plate[]): Plate[] {
  return plates.filter(plate => {
    for (const well of plate) {
      if (well.rawResponse !== null || well.normalizedResponse !== null) {
        return true;
      }
    }
    return false;
  });
};

export function createLogTicks(min: number, max: number, gridSize: number) {
  const logMin = Math.log10(min);
  const logMax = Math.log10(max);
  const range = logMax - logMin;
  const numTicks = Math.min(10, (14 - 2 * gridSize));

  const ticks: number[] = [];
  for (let i = 0; i < numTicks; i++) {
    const logValue = logMin + (i / (numTicks - 1)) * range;
    ticks.push(Math.pow(10, logValue));
  }
  return ticks;
};
