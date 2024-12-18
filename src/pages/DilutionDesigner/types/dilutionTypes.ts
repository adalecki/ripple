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
}

export interface DilutionRange {
  min: number;
  max: number;
}

export interface RangeAnalysis {
  ranges: DilutionRange[];
  hasGaps: boolean;
}