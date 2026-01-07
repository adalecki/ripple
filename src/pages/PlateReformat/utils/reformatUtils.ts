import { Plate, PlateSize } from '../../../classes/PlateClass';
import { TransferBlock, TransferStepInternal } from '../../../utils/plateUtils';
import { getTileScheme, tileTransfers } from '../../../utils/designUtils';

const STORAGE_KEY = 'ripple-reformat-schemes';

export interface SavedTransferBlock {
  sourcePlateIndex: number;
  sourceBlock: string;
  destinationPlateIndex: number;
  destinationBlock: string;
  destinationTiles?: string[];
  volume: number;
}

export interface ReformatScheme {
  id: number;
  name: string;
  description?: string;
  srcPlateCount: number;
  srcPlateSize: PlateSize;
  dstPlateCount: number;
  dstPlateSize: PlateSize;
  transfers: SavedTransferBlock[];
}

export function loadSchemes(): ReformatScheme[] {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.error('Failed to parse stored reformat schemes:', e);
      return [];
    }
  }
  return [];
}

export function saveSchemes(schemes: ReformatScheme[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(schemes));
}

export function createSchemeFromCurrentState(
  name: string,
  description: string,
  srcPlates: Plate[],
  srcPlateSize: PlateSize,
  dstPlates: Plate[],
  dstPlateSize: PlateSize,
  transferBlocks: TransferBlock[]
): ReformatScheme {
  const srcPlateIdToIndex = new Map<number, number>();
  const dstPlateIdToIndex = new Map<number, number>();

  srcPlates.forEach((plate, idx) => srcPlateIdToIndex.set(plate.id, idx + 1));
  dstPlates.forEach((plate, idx) => dstPlateIdToIndex.set(plate.id, idx + 1));

  const savedTransfers: SavedTransferBlock[] = transferBlocks.map(block => ({
    sourcePlateIndex: srcPlateIdToIndex.get(block.sourcePlateId) ?? 1,
    sourceBlock: block.sourceBlock,
    destinationPlateIndex: dstPlateIdToIndex.get(block.destinationPlateId) ?? 1,
    destinationBlock: block.destinationBlock,
    destinationTiles: block.destinationTiles?.length ? block.destinationTiles : undefined,
    volume: block.volume
  }));

  return {
    id: Date.now(),
    name,
    description: description || undefined,
    srcPlateCount: srcPlates.length,
    srcPlateSize: srcPlateSize as PlateSize,
    dstPlateCount: dstPlates.length,
    dstPlateSize: dstPlateSize as PlateSize,
    transfers: savedTransfers
  };
}

interface AppliedSchemeResult {
  srcPlates: Plate[];
  dstPlates: Plate[];
  transferBlocks: TransferBlock[];
}

export function applyScheme(scheme: ReformatScheme): AppliedSchemeResult {
  const srcPlates: Plate[] = [];
  const dstPlates: Plate[] = [];

  for (let i = 0; i < scheme.srcPlateCount; i++) {
    const plate = new Plate({ id: i+1, plateSize: scheme.srcPlateSize });
    plate.barcode = `src${i + 1}`;
    srcPlates.push(plate);
  }

  for (let i = 0; i < scheme.dstPlateCount; i++) {
    const plate = new Plate({ id: i+1+scheme.srcPlateCount, plateSize: scheme.dstPlateSize });
    plate.barcode = `dst${i + 1}`;
    dstPlates.push(plate);
  }

  const transferBlocks: TransferBlock[] = scheme.transfers.map(saved => {
    const sourcePlate = srcPlates[saved.sourcePlateIndex - 1];
    const destPlate = dstPlates[saved.destinationPlateIndex - 1];

    const transferSteps = regenerateTransferSteps(
      sourcePlate,
      destPlate,
      saved.sourceBlock,
      saved.destinationBlock,
      saved.destinationTiles,
      saved.volume
    );

    return {
      sourcePlateId: sourcePlate.id,
      sourceBlock: saved.sourceBlock,
      destinationPlateId: destPlate.id,
      destinationBlock: saved.destinationBlock,
      destinationTiles: saved.destinationTiles ?? [],
      volume: saved.volume,
      transferSteps
    };
  });

  return { srcPlates, dstPlates, transferBlocks };
}

function regenerateTransferSteps(
  sourcePlate: Plate,
  destPlate: Plate,
  sourceBlock: string,
  destinationBlock: string,
  destinationTiles: string[] | undefined,
  volume: number
): TransferStepInternal[] {
  const srcWellIds = sourcePlate.getSomeWells(sourceBlock).map(w => w.id);
  const transferSteps: TransferStepInternal[] = [];

  if (destinationTiles && destinationTiles.length > 0) {
    const tileScheme = getTileScheme(sourceBlock, destinationBlock);
    if (tileScheme.canTile) {
      const tileTsfrs = tileTransfers(srcWellIds, tileScheme);
      for (const tsfr of tileTsfrs.pairs) {
        transferSteps.push({
          sourcePlateId: sourcePlate.id,
          sourceWellId: tsfr[0],
          destinationPlateId: destPlate.id,
          destinationWellId: tsfr[1],
          volume
        });
      }
    }
  } else {
    const dstWells = destPlate.getSomeWells(destinationBlock).map(w => w.id);
    for (let i = 0; i < srcWellIds.length && i < dstWells.length; i++) {
      transferSteps.push({
        sourcePlateId: sourcePlate.id,
        sourceWellId: srcWellIds[i],
        destinationPlateId: destPlate.id,
        destinationWellId: dstWells[i],
        volume
      });
    }
  }

  return transferSteps;
}

export function deleteScheme(schemes: ReformatScheme[], schemeId: number): ReformatScheme[] {
  return schemes.filter(s => s.id !== schemeId);
}