import { Plate } from '../../../classes/PlateClass';
import { Well } from '../../../classes/WellClass';

export interface TreatmentWell {
  wellId: string;
  concentration: number;
  response: number;
}

export interface TreatmentGroup {
  wells: TreatmentWell[];
}

export function aggregateData(data: {wellId: string, concentration: number, response: number}[]) {
  const grouped = data.reduce((acc: {[key: number]: number[]}, val) => {
    if (!acc[val.concentration]) {
      acc[val.concentration] = [];
    }
    acc[val.concentration].push(val.response);
    return acc;
  }, {});

  return Object.entries(grouped).map(([concentration, values]) => {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const stdDev = Math.sqrt(values.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / values.length);
    return { concentration: +concentration, mean, stdDev };
  }).sort((a,b) => a.concentration-b.concentration);
};

// Generates a unique string key for a treatment based on its compound IDs.
// Sorts compound IDs to ensure order doesn't matter (e.g., A+B is same as B+A).
export function getTreatmentKey(well: Well): string {
  const compoundIds = well.getContents()
    .map(content => content.compoundId)
    .filter((id): id is string => id !== undefined && id !== null)
    .sort();

  if (compoundIds.length === 0) {
    return 'CONTROL_EMPTY_WELL';
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
      tData.wells.push({wellId: wellId, concentration: concentration, response: response})

    }
  }
  return treatmentGroups;
}

export type AssayType = 'SP' | 'DR';

export function identifyAssayType(treatmentGroup: TreatmentGroup): AssayType {
  if (!treatmentGroup) {
    return 'SP'; // Default or error case
  }
  // Count unique, non-zero concentrations for dose-response determination.
  const uniqueConcentrations = new Set(treatmentGroup.wells.map(well => well.concentration).filter(conc => conc > 0));

  return uniqueConcentrations.size >= 4 ? 'DR' : 'SP';
}
