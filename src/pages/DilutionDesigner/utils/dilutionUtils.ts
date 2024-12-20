export interface TransferMap {
  sourceType: string;
  sourceConc: number;
  possibleConcs: number[];
}

function getIntermediateConcs({
  sourceConc,
  dropletSize,
  maxTransferVolume,
  backfillVolume,
  volNumber
}: {
  sourceConc: number;
  dropletSize: number;
  maxTransferVolume: number;
  backfillVolume: number;
  volNumber: number;
}): number[] {
  if (dropletSize <= 0 || maxTransferVolume <= 0 || volNumber <= 0) {
        return []; // Handle invalid input
  }
  if (dropletSize >= maxTransferVolume) {
        return [dropletSize];
  }
  const result: number[] = [];
  result.push(dropletSize);

  let adjustedMaxTransferVolume = Math.floor(maxTransferVolume / dropletSize) * dropletSize;
  if (adjustedMaxTransferVolume < dropletSize) {
        return [dropletSize];
  }
  if (volNumber === 1) {
    return [dropletSize];
  }
  if (volNumber === 2) {
      result.push(adjustedMaxTransferVolume);
    return result;
  }
  const numInternalVolumes = Math.min(volNumber - 2, Math.floor((adjustedMaxTransferVolume - dropletSize) / dropletSize) -1);
  if (numInternalVolumes <=0 ) {
      result.push(adjustedMaxTransferVolume);
      return result;
  }
  const increment = (adjustedMaxTransferVolume - dropletSize) / (numInternalVolumes + 1);
    for (let i = 1; i <= numInternalVolumes; i++) {
       const nextValue = dropletSize + (Math.round(increment * i/dropletSize)*dropletSize);
            result.push(nextValue);
    }
  result.push(adjustedMaxTransferVolume);
  return result.map(volume => (sourceConc * volume) / (volume + backfillVolume));
}

function getAllPossibleConcs({
  sourceConc,
  dropletSize,
  maxTransferVolume,
  assayVolume,
  dmsoLimit
}: {
  sourceConc: number;
  dropletSize: number;
  maxTransferVolume: number;
  assayVolume: number;
  dmsoLimit: number;
}): number[] {
  const maxDmsoTransfer = Math.min(
    maxTransferVolume,
    (assayVolume * dmsoLimit) / (1 - dmsoLimit)
  );

  const possibleConcs: number[] = [];
  const maxDroplets = Math.floor(maxDmsoTransfer / dropletSize);

  for (let droplets = 1; droplets <= maxDroplets; droplets++) {
    const volume = droplets * dropletSize;
    const conc = (sourceConc * volume) / (volume + assayVolume);
    possibleConcs.push(conc);
  }

  return possibleConcs;
}

export function buildConcentrationMap({
  stockConcentrations,
  dropletSize,
  maxTransferVolume,
  backfillVolume,
  assayVolume,
  dmsoLimit,
  useIntConcs,
  numIntConcs
}: {
  stockConcentrations: number[];
  dropletSize: number;
  maxTransferVolume: number;
  backfillVolume: number;
  assayVolume: number;
  dmsoLimit: number;
  useIntConcs: boolean;
  numIntConcs: number;
}): Map<string, Map<number, number[]>> {
  const concMap = new Map<string, Map<number, number[]>>();

  // Initialize maps for each source type
  concMap.set('stock', new Map<number, number[]>());
  if (useIntConcs) {
    concMap.set('int1', new Map<number, number[]>());
    concMap.set('int2', new Map<number, number[]>());
  }


  // Process stock concentrations
  for (const stockConc of stockConcentrations) {
    const stockMap = concMap.get('stock')!;
    stockMap.set(
      stockConc,
      getAllPossibleConcs({
        sourceConc: stockConc,
        dropletSize,
        maxTransferVolume,
        assayVolume,
        dmsoLimit
      })
    );
    if (useIntConcs) {
      // Get int1 concentrations from this stock
      const int1Concs = getIntermediateConcs({
        sourceConc: stockConc,
        dropletSize,
        maxTransferVolume,
        backfillVolume,
        volNumber: numIntConcs
      });

      // Process int1 concentrations
      const int1Map = concMap.get('int1')!;
      for (const int1Conc of int1Concs) {
        if (!int1Map.has(int1Conc)) {  // Avoid duplicate processing
          int1Map.set(
            int1Conc,
            getAllPossibleConcs({
              sourceConc: int1Conc,
              dropletSize,
              maxTransferVolume,
              assayVolume,
              dmsoLimit
            })
          );
        }
      }

      // Get int2 concentrations from lowest int1
      const lowestInt1Conc = int1Concs[0]; // This is from minimum transfer volume
      const int2Concs = getIntermediateConcs({
        sourceConc: lowestInt1Conc,
        dropletSize,
        maxTransferVolume,
        backfillVolume,
        volNumber: numIntConcs
      });

      // Process int2 concentrations
      const int2Map = concMap.get('int2')!;
      for (const int2Conc of int2Concs) {
        if (!int2Map.has(int2Conc)) {  // Avoid duplicate processing
          int2Map.set(
            int2Conc,
            getAllPossibleConcs({
              sourceConc: int2Conc,
              dropletSize,
              maxTransferVolume,
              assayVolume,
              dmsoLimit
            })
          );
        }
      }
    }
  }

  return concMap;
}

export function findTransfersForConcentration(
  targetConc: number,
  allowableError: number,
  concMap: Map<string, Map<number, number[]>>
): TransferMap[] {
  const minAcceptable = targetConc * (1 - allowableError);
  const maxAcceptable = targetConc * (1 + allowableError);
  const validTransfers: TransferMap[] = [];

  concMap.forEach((sourceMap, sourceType) => {
    sourceMap.forEach((possibleConcs, sourceConc) => {
      const validConcs = possibleConcs.filter(
        conc => conc >= minAcceptable && conc <= maxAcceptable
      );

      if (validConcs.length > 0) {
        validTransfers.push({
          sourceType,
          sourceConc,
          possibleConcs: validConcs
        });
      }
    });
  });

  return validTransfers;
}

export function analyzeDilutionPoints({
  points,
  stockConcentrations,
  constraints,
  useIntConcs,
  numIntConcs
}: {
  points: number[];
  stockConcentrations: number[];
  constraints: {
    dropletSize: number;
    maxTransferVolume: number;
    assayVolume: number;
    allowableError: number;
    dmsoLimit: number;
    backfillVolume: number;
  },
  useIntConcs: boolean;
  numIntConcs: number;
}): Map<number, TransferMap[]> {
  // First build complete concentration map
  const concMap = buildConcentrationMap({
    stockConcentrations,
    dropletSize: constraints.dropletSize,
    maxTransferVolume: constraints.maxTransferVolume,
    backfillVolume: constraints.backfillVolume,
    assayVolume: constraints.assayVolume,
    dmsoLimit: constraints.dmsoLimit,
    useIntConcs: useIntConcs,
    numIntConcs: numIntConcs
  });

  // Then find valid transfers for each point
  const results = new Map<number, TransferMap[]>();

  for (const point of points) {
    const transfers = findTransfersForConcentration(
      point,
      constraints.allowableError,
      concMap
    );
    results.set(point, transfers);
  }

  return results;
}