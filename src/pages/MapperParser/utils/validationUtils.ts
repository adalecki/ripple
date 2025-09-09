import { CONTROL_TYPES, FIELD_TYPES, NORMALIZATION_TYPES, PARSE_FORMATS, PLATE_SIZES, Protocol } from '../../../types/mapperTypes';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  protocols?: Protocol[];
}

export interface ImportableProtocol extends Protocol {
  isSelected?: boolean;
}

export function validateProtocolImport(fileContent: string, existingProtocols: Protocol[]): ValidationResult {
  const errors: string[] = [];

  try {
    const parsed = JSON.parse(fileContent);

    if (!Array.isArray(parsed)) {
      return {
        isValid: false,
        errors: ['File must contain an array of protocols']
      };
    }

    if (parsed.length === 0) {
      return {
        isValid: false,
        errors: ['File contains no protocols']
      };
    }

    const protocols: ImportableProtocol[] = [];
    const existingNames = new Set(existingProtocols.map(p => p.name));
    const existingIds = new Set(existingProtocols.map(p => p.id));

    parsed.forEach((item: any, index: number) => {
      const sanitizedProtocol = sanitizeProtocol(item, index + 1);

      let newId = Date.now() + index;
      while (existingIds.has(newId)) {
        newId += 1;
      }

      let newName = sanitizedProtocol.name;
      if (existingNames.has(newName)) {
        let counter = 1;
        while (existingNames.has(`${newName} (${counter})`)) {
          counter++;
        }
        newName = `${newName} (${counter})`;
      }

      const protocol: ImportableProtocol = {
        ...sanitizedProtocol,
        id: newId,
        name: newName,
        isSelected: true
      };

      protocols.push(protocol);
      existingIds.add(newId);
      existingNames.add(newName);
    });

    return {
      isValid: true,
      errors,
      protocols
    };

  } catch (e) {
    return {
      isValid: false,
      errors: ['Invalid JSON format']
    };
  }
}

function sanitizeProtocol(protocol: any, index: number): Protocol {
  const name = (typeof protocol.name === 'string' && protocol.name.trim()) ? protocol.name.trim() : `Imported Protocol ${index}`;

  const parseStrategy = {
    format: (PARSE_FORMATS.includes(protocol.parseStrategy?.format)) ? protocol.parseStrategy.format : 'Matrix',
    plateSize: (PLATE_SIZES.includes(protocol.parseStrategy?.plateSize.toString())) ? protocol.parseStrategy.plateSize.toString() : '384',
    rawData: (typeof protocol.parseStrategy?.rawData === 'string') ? protocol.parseStrategy.rawData : '',
    plateBarcodeLocation: (['filename', 'cell'].includes(protocol.parseStrategy?.plateBarcodeLocation)) ? protocol.parseStrategy.plateBarcodeLocation : 'filename',
    autoParse: typeof protocol.parseStrategy?.autoParse === 'boolean' ? protocol.parseStrategy.autoParse : false,

    xLabels: (typeof protocol.parseStrategy?.xLabels === 'string') ? protocol.parseStrategy.xLabels : '',
    yLabels: (typeof protocol.parseStrategy?.yLabels === 'string') ? protocol.parseStrategy.yLabels : '',
    wellIDs: (typeof protocol.parseStrategy?.wellIDs === 'string') ? protocol.parseStrategy.wellIDs : '',
    plateBarcodeCell: (typeof protocol.parseStrategy?.plateBarcodeCell === 'string') ? protocol.parseStrategy.plateBarcodeCell : '',
    useFullFilename: (typeof protocol.parseStrategy?.useFullFilename === 'boolean') ? protocol.parseStrategy.useFullFilename : true,
    barcodeDelimiter: (typeof protocol.parseStrategy?.barcodeDelimiter === 'string') ? protocol.parseStrategy.barcodeDelimiter : '',
    barcodeChunk: (typeof protocol.parseStrategy?.barcodeChunk === 'number') ? protocol.parseStrategy.barcodeChunk : 1,
  };

  const metadataFields = Array.isArray(protocol.metadataFields) ?
    protocol.metadataFields
      .filter((field: any) => field && typeof field.name === 'string' && field.name.trim())
      .map((field: any) => ({
        name: field.name.trim(),
        type: (FIELD_TYPES.includes(field.type)) ? field.type : 'Free Text',
        required: typeof field.required === 'boolean' ? field.required : false,
        defaultValue: field.defaultValue || undefined,
        values: (['PickList'].includes(field.type) && Array.isArray(field.values)) ? field.values : undefined
      })) : [];

  const controls = Array.isArray(protocol.dataProcessing?.controls) ?
    protocol.dataProcessing.controls
      .filter((control: any) => control && CONTROL_TYPES.includes(control.type))
      .map((control: any) => ({
        type: control.type,
        wells: (typeof control.wells === 'string') ? control.wells : ''
      })) : [];

  const dataProcessing = {
    normalization: (NORMALIZATION_TYPES.includes(protocol.dataProcessing?.normalization)) ?
      protocol.dataProcessing.normalization : 'None',
    controls
  };

  return {
    id: 0,
    name,
    description: (typeof protocol.description === 'string') ? protocol.description : '',
    parseStrategy,
    metadataFields,
    dataProcessing
  };
}

export function exportProtocols(protocols: Protocol[]): string {
  const exportData = protocols.map(protocol => ({
    id: protocol.id,
    name: protocol.name,
    description: protocol.description || '',
    parseStrategy: protocol.parseStrategy,
    metadataFields: protocol.metadataFields,
    dataProcessing: protocol.dataProcessing
  }));

  return JSON.stringify(exportData, null, 2);
}

export function downloadProtocolsAsJson(protocols: Protocol[], filename?: string): void {
  const jsonString = exportProtocols(protocols);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `protocols_${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}