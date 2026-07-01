import { PlateSize } from '../../../classes/PlateClass';
import { HslStringType } from '../../../classes/PatternClass';
import { ReformatScheme, SavedTransferBlock } from './reformatUtils';

const VALID_PLATE_SIZES: PlateSize[] = ['12', '24', '48', '96', '384', '1536'];

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  schemes?: ReformatScheme[];
}

export interface ImportableScheme extends ReformatScheme {
  isSelected?: boolean;
}

export function validateSchemeImport(fileContent: string, existingSchemes: ReformatScheme[]): ValidationResult {
  let parsed: any;
  try {
    parsed = JSON.parse(fileContent);
  } catch (e) {
    return {
      isValid: false,
      errors: ['Invalid JSON format']
    };
  }

  if (!Array.isArray(parsed)) {
    return {
      isValid: false,
      errors: ['File must contain an array of schemes']
    };
  }

  if (parsed.length === 0) {
    return {
      isValid: false,
      errors: ['File contains no schemes']
    };
  }

  const errors: string[] = [];
  const schemes: ImportableScheme[] = [];
  const existingNames = new Set(existingSchemes.map(s => s.name));
  const existingIds = new Set(existingSchemes.map(s => s.id));

  parsed.forEach((item: any, index: number) => {
    const sanitizedScheme = sanitizeScheme(item, index + 1);

    if (!sanitizedScheme) {
      errors.push(`Item ${index + 1} does not look like a reformat scheme and was skipped`);
      return;
    }

    let newId = Date.now() + index;
    while (existingIds.has(newId)) {
      newId += 1;
    }

    let newName = sanitizedScheme.name;
    if (existingNames.has(newName)) {
      let counter = 1;
      while (existingNames.has(`${newName} (${counter})`)) {
        counter++;
      }
      newName = `${newName} (${counter})`;
    }

    const scheme: ImportableScheme = {
      ...sanitizedScheme,
      id: newId,
      name: newName,
      isSelected: true
    };

    schemes.push(scheme);
    existingIds.add(newId);
    existingNames.add(newName);
  });

  if (schemes.length === 0) {
    return {
      isValid: false,
      errors: errors.length > 0 ? errors : ['No valid schemes found in file']
    };
  }

  return {
    isValid: true,
    errors,
    schemes
  };
}

function sanitizeScheme(scheme: any, index: number): ReformatScheme | null {
  if (!scheme || typeof scheme !== 'object') return null;

  const srcPlateSize = scheme.srcPlateSize?.toString();
  const dstPlateSize = scheme.dstPlateSize?.toString();

  const isValidScheme =
    VALID_PLATE_SIZES.includes(srcPlateSize) &&
    VALID_PLATE_SIZES.includes(dstPlateSize) &&
    typeof scheme.srcPlateCount === 'number' && scheme.srcPlateCount > 0 &&
    typeof scheme.dstPlateCount === 'number' && scheme.dstPlateCount > 0 &&
    Array.isArray(scheme.transfers);

  if (!isValidScheme) return null;

  const name = (typeof scheme.name === 'string' && scheme.name.trim()) ? scheme.name.trim() : `Imported Scheme ${index}`;

  const transfers: SavedTransferBlock[] = scheme.transfers
    .filter((t: any) => t && typeof t.sourceBlock === 'string' && typeof t.destinationBlock === 'string')
    .map((t: any) => ({
      sourcePlateIndex: (typeof t.sourcePlateIndex === 'number') ? t.sourcePlateIndex : 1,
      sourceBlock: t.sourceBlock,
      destinationPlateIndex: (typeof t.destinationPlateIndex === 'number') ? t.destinationPlateIndex : 1,
      destinationBlock: t.destinationBlock,
      volume: (typeof t.volume === 'number') ? t.volume : 0,
      color: (typeof t.color === 'string') ? t.color as HslStringType : undefined,
      treatIdentical: (typeof t.treatIdentical === 'boolean') ? t.treatIdentical : false
    }));

  return {
    id: 0,
    name,
    description: (typeof scheme.description === 'string') ? scheme.description : undefined,
    srcPlateCount: scheme.srcPlateCount,
    srcPlateSize: srcPlateSize as PlateSize,
    dstPlateCount: scheme.dstPlateCount,
    dstPlateSize: dstPlateSize as PlateSize,
    transfers
  };
}

export function exportSchemes(schemes: ReformatScheme[]): string {
  const exportData = schemes.map(scheme => ({
    id: scheme.id,
    name: scheme.name,
    description: scheme.description || '',
    srcPlateCount: scheme.srcPlateCount,
    srcPlateSize: scheme.srcPlateSize,
    dstPlateCount: scheme.dstPlateCount,
    dstPlateSize: scheme.dstPlateSize,
    transfers: scheme.transfers
  }));

  return JSON.stringify(exportData, null, 2);
}

export function downloadSchemesAsJson(schemes: ReformatScheme[], filename?: string): void {
  const jsonString = exportSchemes(schemes);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `reformat_schemes_${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
