import { Plate, PlateSize } from '../../../classes/PlateClass';
import { TransferBlock, TransferStepInternal } from '../../../utils/plateUtils';
import { calculateTransferBorders, getTileScheme, tileTransfers } from '../../../utils/designUtils';
import { HslStringType } from '../../../classes/PatternClass';
import { generateSingleColor } from '../../../utils/wellColors';

const STORAGE_KEY = 'ripple-reformat-schemes';

export interface SavedTransferBlock {
  sourcePlateIndex: number;
  sourceBlock: string;
  destinationPlateIndex: number;
  destinationBlock: string;
  volume: number;
  color?: HslStringType;
  treatIdentical?: boolean;
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
    volume: block.volume,
    color: block.color ? block.color : undefined,
    treatIdentical: block.treatIdentical ? block.treatIdentical : false
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
    const srcPlate = srcPlates[saved.sourcePlateIndex - 1];
    const dstPlate = dstPlates[saved.destinationPlateIndex - 1];
    const treatIdentical = saved.treatIdentical ? saved.treatIdentical : false
    const transferBlock = calculateTransferBlock(srcPlate,dstPlate,saved.sourceBlock,saved.destinationBlock,saved.volume,treatIdentical,undefined,undefined,saved.color)
    return transferBlock
  });

  return { srcPlates, dstPlates, transferBlocks };
}

export function deleteScheme(schemes: ReformatScheme[], schemeId: number): ReformatScheme[] {
  return schemes.filter(s => s.id !== schemeId);
}

export function getPlateColorAndBorders(plate: Plate, transferBlocks: TransferBlock[], type: 'source' | 'destination') {
  const colorMap = new Map<string, HslStringType>();
  const borderMap = new Map<string, { top: boolean, right: boolean, bottom: boolean, left: boolean }>();

  transferBlocks.forEach((transfer, idx) => {
    const plateId = (type == 'source' ? transfer.sourcePlateId : transfer.destinationPlateId)
    const block = (type == 'source' ? transfer.sourceBlock : transfer.destinationBlock)
    let colorHsl = (type == 'source' ? 'hsl(210, 44%, 56%)' : 'hsl(30, 70%, 85%)') as HslStringType
    if (transfer.color) {colorHsl = transfer.color}
    else {colorHsl = generateSingleColor(0.75638, idx+1)}
    if (plateId === plate.id) {
      const wells = plate.getSomeWells(block);

      wells.forEach(well => {
        colorMap.set(well.id, colorHsl);
      });

      if (transfer.destinationTiles && transfer.destinationTiles.length > 0 && type === 'destination') {
        transfer.destinationTiles.forEach((block) => {
          const blockBorders = calculateTransferBorders(plate, block)
          blockBorders.forEach((borders, wellId) => {
            const existingMap = borderMap.get(wellId) || { top: false, right: false, bottom: false, left: false }
            existingMap.top = existingMap.top || borders.top
            existingMap.right = existingMap.right || borders.right
            existingMap.bottom = existingMap.bottom || borders.bottom
            existingMap.left = existingMap.left || borders.left
            borderMap.set(wellId, existingMap)
          });
        })
      }
      else {
        const blockBorders = calculateTransferBorders(plate, block);
        blockBorders.forEach((borders, wellId) => {
          const existingMap = borderMap.get(wellId) || { top: false, right: false, bottom: false, left: false }
          existingMap.top = existingMap.top || borders.top
          existingMap.right = existingMap.right || borders.right
          existingMap.bottom = existingMap.bottom || borders.bottom
          existingMap.left = existingMap.left || borders.left
          borderMap.set(wellId, existingMap)
        });
      }
    }
  });

  return {
    colorConfig: {
      scheme: 'custom' as const,
      colorMap
    },
    borderMap: borderMap
  };
}

export function calculateTransferBlock(srcPlate: Plate, dstPlate: Plate, srcBlock: string, dstBlock: string, volume: number, treatIdentical: boolean, selectedSrcWells: string[] = [], selectedDstWells: string[] = [], color?: HslStringType): TransferBlock {
    const tileScheme = getTileScheme(srcBlock,dstBlock)
    if (selectedSrcWells.length === 0) {selectedSrcWells = srcPlate.getSomeWells(srcBlock).map(w => w.id)}
    if (selectedDstWells.length === 0) {selectedDstWells = dstPlate.getSomeWells(dstBlock).map(w => w.id)}

    const transferSteps: TransferStepInternal[] = [];
    const transferBlock: TransferBlock = {
      sourcePlateId: srcPlate.id,
      sourceBlock: srcBlock,
      destinationPlateId: dstPlate.id,
      destinationBlock: dstBlock,
      destinationTiles: [],
      volume,
      transferSteps: [],
      treatIdentical: treatIdentical
    };
    
    if (!treatIdentical && tileScheme.canTile) {
      const tileTsfrs = tileTransfers(selectedSrcWells, tileScheme)
      for (const tsfr of tileTsfrs.pairs) {
        transferSteps.push({
          sourcePlateId: srcPlate.id,
          sourceWellId: tsfr[0],
          destinationPlateId: dstPlate.id,
          destinationWellId: tsfr[1],
          volume
        })
      }
      transferBlock.destinationTiles = tileTsfrs.tiles
    }
    else {
      if (treatIdentical) {
        for (let i = 0; i < selectedDstWells.length; i++) {
          const srcIndex = i % selectedSrcWells.length;
          transferSteps.push({
            sourcePlateId: srcPlate.id,
            sourceWellId: selectedSrcWells[srcIndex],
            destinationPlateId: dstPlate.id,
            destinationWellId: selectedDstWells[i],
            volume
          })
        }
       }
      else {
        for (let i = 0; i < selectedSrcWells.length; i++) {
          transferSteps.push({
            sourcePlateId: srcPlate.id,
            sourceWellId: selectedSrcWells[i],
            destinationPlateId: dstPlate.id,
            destinationWellId: selectedDstWells[i],
            volume
          });
        }
      }
    }

    transferBlock.transferSteps = transferSteps
    if (color) {transferBlock.color = color}
    return transferBlock
}