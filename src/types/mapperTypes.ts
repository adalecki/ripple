export type ParseFormat = 'Matrix' | 'Table';
export type ControlType = 'MaxCtrl' | 'MinCtrl' | 'PosCtrl' | 'NegCtrl' | 'Reference';
export type NormalizationType = 'PctOfCtrl' | 'None';
export type FieldType = 'Free Text' | 'PickList';

export interface MetadataField {
  name: string;
  type: FieldType;
  required: boolean;
  defaultValue?: string | boolean;
  values?: string[]; // For PickList type
  description?: string;
}

export interface ParseStrategy {
  format: ParseFormat;
  plateSize: number;
  xLabels?: string; // Cell range like "A9:X9"
  yLabels?: string; // Cell range like "A10:A25"
  wellIDs?: string; // Cell range for well IDs in table format
  rawData: string; // Cell range for actual data
  plateBarcodeLocation?: 'filename' | 'cell'; // Where to find barcode
  plateBarcodeCell?: string; // If in cell, which cell
}

export interface ControlDefinition {
  type: ControlType;
  wells: string; // Well range like "A1:A24"
}

export interface DataProcessing {
  controls: ControlDefinition[];
  normalization: NormalizationType;
  outlierRemoval?: boolean;
  outlierThreshold?: number; // Standard deviations
  replicateHandling?: 'average' | 'median' | 'individual';
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