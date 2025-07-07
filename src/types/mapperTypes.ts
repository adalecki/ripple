export const PARSE_FORMATS = ['eh', 'Matrix', 'Table'] as const;
export const CONTROL_TYPES = ['pretest', 'MaxCtrl', 'MinCtrl', 'PosCtrl', 'NegCtrl', 'Reference', 'Test'] as const;
export const NORMALIZATION_TYPES = ['PctOfCtrl','midnorm', 'None'] as const;
export const FIELD_TYPES = ['Free Text','midtest', 'PickList'] as const;
export const PLATE_SIZES = [96, 384, 1536] as const;
export const BARCODE_LOCATIONS = ['filename', 'cell'] as const;

export type ParseFormat = typeof PARSE_FORMATS[number];
export type ControlType = typeof CONTROL_TYPES[number];
export type NormalizationType = typeof NORMALIZATION_TYPES[number];
export type FieldType = typeof FIELD_TYPES[number];
export type PlateSize = typeof PLATE_SIZES[number];
export type BarcodeLocation = typeof BARCODE_LOCATIONS[number];

export interface MetadataField {
  name: string;
  type: FieldType;
  required: boolean;
  defaultValue?: string | number | boolean;
  values?: string[]; // For PickList types
}

export interface ControlDefinition {
  type: ControlType;
  wells: string;
}

export interface DataProcessing {
  controls: ControlDefinition[];
  normalization: NormalizationType;
}

export interface ParseStrategy {
  format: ParseFormat;
  plateSize: PlateSize;
  rawData: string;
  xLabels?: string; // For Matrix format
  yLabels?: string; // For Matrix format
  wellIDs?: string; // For Table format
  plateBarcodeLocation: BarcodeLocation;
  plateBarcodeCell?: string; // Required when plateBarcodeLocation is 'cell'
}

export interface Protocol {
  id: number;
  name: string;
  description?: string;
  parseStrategy: ParseStrategy;
  metadataFields: MetadataField[];
  dataProcessing: DataProcessing;
  createdAt: Date;
  updatedAt: Date;
}