import { Protocol } from '../../../types/mapperTypes';

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
      const protocolErrors = validateProtocolStructure(item, index);
      errors.push(...protocolErrors);
      
      if (protocolErrors.length === 0) {
        let newId = Date.now() + index;
        while (existingIds.has(newId)) {
          newId += 1;
        }
        
        let newName = item.name;
        if (existingNames.has(newName)) {
          let counter = 1;
          while (existingNames.has(`${newName} (${counter})`)) {
            counter++;
          }
          newName = `${newName} (${counter})`;
        }
        
        const protocol: ImportableProtocol = {
          ...item,
          id: newId,
          name: newName,
          createdAt: new Date(item.createdAt || new Date()),
          updatedAt: new Date(item.updatedAt || new Date()),
          isSelected: true
        };
        
        protocols.push(protocol);
        existingIds.add(newId);
        existingNames.add(newName);
      }
    });
    
    return {
      isValid: errors.length === 0,
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

function validateProtocolStructure(protocol: any, index: number): string[] {
  const errors: string[] = [];
  const prefix = `Protocol ${index + 1}:`;
  
  if (!protocol.name || typeof protocol.name !== 'string') {
    errors.push(`${prefix} Missing or invalid name`);
  }
  
  if (typeof protocol.id !== 'number') {
    errors.push(`${prefix} Missing or invalid id`);
  }
  
  if (!protocol.parseStrategy || typeof protocol.parseStrategy !== 'object') {
    errors.push(`${prefix} Missing parseStrategy`);
  } else {
    const { parseStrategy } = protocol;
    
    if (!['Table', 'Matrix'].includes(parseStrategy.format)) {
      errors.push(`${prefix} Invalid parseStrategy.format`);
    }
    
    if (![96, 384, 1536].includes(parseStrategy.plateSize)) {
      errors.push(`${prefix} Invalid parseStrategy.plateSize`);
    }
    
    if (!parseStrategy.rawData || typeof parseStrategy.rawData !== 'string') {
      errors.push(`${prefix} Missing parseStrategy.rawData`);
    }
    
    if (!['filename', 'cell'].includes(parseStrategy.plateBarcodeLocation)) {
      errors.push(`${prefix} Invalid parseStrategy.plateBarcodeLocation`);
    }
  }
  
  if (!Array.isArray(protocol.metadataFields)) {
    errors.push(`${prefix} Invalid metadataFields (must be array)`);
  } else {
    protocol.metadataFields.forEach((field: any, fieldIndex: number) => {
      if (!field.name || typeof field.name !== 'string') {
        errors.push(`${prefix} MetadataField ${fieldIndex + 1}: Missing or invalid name`);
      }
      
      if (!['Free Text', 'PickList'].includes(field.type)) {
        errors.push(`${prefix} MetadataField ${fieldIndex + 1}: Invalid type`);
      }
      
      if (typeof field.required !== 'boolean') {
        errors.push(`${prefix} MetadataField ${fieldIndex + 1}: Invalid required field`);
      }
    });
  }
  
  if (!protocol.dataProcessing || typeof protocol.dataProcessing !== 'object') {
    errors.push(`${prefix} Missing dataProcessing`);
  } else {
    const { dataProcessing } = protocol;
    
    if (!['PctOfCtrl', 'None'].includes(dataProcessing.normalization)) {
      errors.push(`${prefix} Invalid dataProcessing.normalization`);
    }
    
    if (!Array.isArray(dataProcessing.controls)) {
      errors.push(`${prefix} Invalid dataProcessing.controls (must be array)`);
    } else {
      dataProcessing.controls.forEach((control: any, controlIndex: number) => {
        if (!['MaxCtrl', 'MinCtrl', 'PosCtrl', 'NegCtrl', 'Reference'].includes(control.type)) {
          errors.push(`${prefix} Control ${controlIndex + 1}: Invalid type`);
        }
      });
    }
  }
  
  return errors;
}

export function exportProtocols(protocols: Protocol[]): string {
  // Create clean export data without UI-specific fields
  const exportData = protocols.map(protocol => ({
    id: protocol.id,
    name: protocol.name,
    description: protocol.description || '',
    parseStrategy: protocol.parseStrategy,
    metadataFields: protocol.metadataFields,
    dataProcessing: protocol.dataProcessing,
    createdAt: protocol.createdAt.toISOString(),
    updatedAt: protocol.updatedAt.toISOString()
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