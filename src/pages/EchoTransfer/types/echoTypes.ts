import { PlateSize } from "../../../classes/PlateClass";

export interface CompoundLocation {
  barcode: string;
  wellId: string;
  volume: number;
  concentration: number;
}

export interface CompoundGroup {
  locations: CompoundLocation[];
}

export type CompoundInventory = Map<string, Map<string, CompoundGroup>>;

export interface ConcentrationObj {
  sourceConc: number;
  sourceType: string;
  volToTsfr: number;
}

export type ConcentrationCache = Map<string, {
  intermediateConcentrations: Map<number, ConcentrationObj>,
  destinationConcentrations: Map<number, ConcentrationObj>
}>;

export interface CommonSettings {
  srcPltSize: PlateSize,
  dstPltSize: PlateSize,
  finalAssayVolume: number,
  maxDMSOFraction: number,
  maxTransferVolume: number,
  dropletSize: number,
  intermediateBackfillVolume: number,
  allowableError: number
}

export interface TransferVolumeResult {
  totalVolumes: Map<number, number>;
  destinationWellsCount: number;
  totalDMSOBackfillVol: number;
}