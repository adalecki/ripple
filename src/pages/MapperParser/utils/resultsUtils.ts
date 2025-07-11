import { Plate } from '../../../classes/PlateClass';
import { Well } from '../../../classes/WellClass';

export interface TreatmentWell {
  wellId: string;
  concentration: number; // Assuming a single concentration value relevant for the treatment in this well.
                        // If a well can have multiple concentrations of *the same treatment combination*,
                        // this model might need adjustment. For now, taking the first content's concentration.
  response: number;
}

export interface TreatmentGroup {
  wells: TreatmentWell[];
  // We can add more aggregated data here later if needed, e.g., average response, SD, etc.
}

// Defines the structure for storing data points for a given treatment.
// Concentrations are X-values, Responses are Y-values for plotting.
export interface PlottingData {
  concentrations: number[];
  responses: number[];
  wellIds: string[]; // To keep track of which well contributed which point
}

// Generates a unique string key for a treatment based on its compound IDs.
// Sorts compound IDs to ensure order doesn't matter (e.g., A+B is same as B+A).
function getTreatmentKey(well: Well): string {
  const compoundIds = well.getContents()
    .map(content => content.compoundId)
    .filter((id): id is string => id !== undefined && id !== null) // Ensure IDs are strings and not undefined/null
    .sort();
  
  if (compoundIds.length === 0) {
    return 'CONTROL_EMPTY_WELL'; // Or some other placeholder for wells without compounds
  }
  return compoundIds.join('+');
}


export function groupDataByTreatment(plate: Plate): Map<string, PlottingData> {
  const treatments = new Map<string, PlottingData>();

  if (!plate || !plate.wells) {
    return treatments;
  }

  for (const wellId in plate.wells) {
    if (Object.prototype.hasOwnProperty.call(plate.wells, wellId)) {
      const well = plate.getWell(wellId);

      if (well && !well.getIsUnused() && well.rawResponse !== null) {
        const treatmentKey = getTreatmentKey(well);
        
        // For simplicity, assuming one primary compound/concentration drives the treatment definition.
        // If multiple compounds define a single "treatment dose", this needs refinement.
        // Taking the concentration of the first compound found, or 0 if none.
        // This part might need to be more sophisticated based on how "concentration of a treatment"
        // is defined when multiple compounds are present. For now, if a treatment is "CompA + CompB",
        // we need a single 'concentration' value for that X-axis point.
        // Let's assume for dose-response, one compound varies while others might be fixed.
        // Or, we use a convention: e.g., concentration of the first compound alphabetically.
        // For now, if a well has contents, we will take the concentration of the first item in contents array.
        // If contents is empty, but it's a control with a response, concentration is effectively 0 or not applicable.
        // This is a simplification. A more robust way would be to define which compound's concentration to use.
        const concentration = well.getContents().length > 0 ? well.getContents()[0].concentration : 0;

        const response = well.rawResponse; // Using rawResponse as per plan for curveFit

        if (!treatments.has(treatmentKey)) {
          treatments.set(treatmentKey, {
            concentrations: [],
            responses: [],
            wellIds: [],
          });
        }
        
        const treatmentData = treatments.get(treatmentKey)!; // Non-null assertion as we just set it
        treatmentData.concentrations.push(concentration);
        treatmentData.responses.push(response);
        treatmentData.wellIds.push(wellId);
      }
    }
  }
  return treatments;
}

export type AssayType = 'singlePoint' | 'doseResponse';

export function identifyAssayType(treatmentData: PlottingData): AssayType {
  if (!treatmentData || !treatmentData.concentrations) {
    return 'singlePoint'; // Default or error case
  }
  // Count unique, non-zero concentrations for dose-response determination.
  // Zero concentrations are often controls and shouldn't count towards DR points.
  const uniqueConcentrations = new Set(treatmentData.concentrations.filter(conc => conc > 0));
  
  return uniqueConcentrations.size >= 4 ? 'doseResponse' : 'singlePoint';
}
