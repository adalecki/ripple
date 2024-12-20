export interface Point {
  concentration: number;
  index: number;
}

export interface DilutionSettings {
  stockConcentrations: number[];
  maxTransferVolume: number;
  dropletSize: number;
  dmsoLimit: number;
  backfillVolume: number;
  assayVolume: number;
  allowableError: number;
  useIntConcs: boolean;
  numIntConcs: number
}

export interface DilutionRange {
  min: number;
  max: number;
}

export interface RangeAnalysis {
  ranges: DilutionRange[];
  hasGaps: boolean;
}

export interface DilutionSettingsErrors {
  maxTransferVolume?: string;
  dropletSize?: string;
  dmsoLimit?: string;
  backfillVolume?: string;
  assayVolume?: string;
  allowableError?: string;
  useIntConcs?: string;
  numIntConcs?: string;
}