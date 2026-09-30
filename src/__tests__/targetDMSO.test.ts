/**
 * @jest-environment node
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { read } from 'xlsx';

import { getDefaultPreferences, PreferencesState, PreferenceValue } from '../hooks/usePreferences';
import { CheckpointTracker } from '../pages/EchoTransfer/classes/CheckpointTrackerClass';
import { EchoPreCalculator } from '../pages/EchoTransfer/classes/EchoPreCalculatorClass';
import { EchoCalculator } from '../pages/EchoTransfer/classes/EchoCalculatorClass';
import { echoInputValidation } from '../pages/EchoTransfer/utils/validationUtils';
import { buildFormValues } from './echoPipeline';

const fileDir = join(__dirname, 'comprehensiveTestFiles');

function makePreferences(overrides: { [key: string]: PreferenceValue } = {}): PreferencesState {
  return { ...getDefaultPreferences(), ...overrides };
}

function loadPreCalc(fileName: string, preferences: PreferencesState): EchoPreCalculator {
  const wb = read(new Uint8Array(readFileSync(join(fileDir, fileName))), { type: 'array' });
  const input = echoInputValidation(wb, buildFormValues(wb, preferences), preferences);
  expect(input.errors).toEqual([]);
  const preCalc = new EchoPreCalculator(input.inputData, new CheckpointTracker(), preferences);
  preCalc.calculateNeeds();
  return preCalc;
}

function getUsedDestinationDMSO(calc: EchoCalculator): number[] {
  const volumes: number[] = [];
  for (const plate of calc.destinationPlates) {
    for (const well of plate) {
      if (well && !well.getIsUnused()) { volumes.push(well.getTotalVolume() - calc.finalAssayVolume); }
    }
  }
  return volumes;
}

function getMessages(preCalc: EchoPreCalculator, name: string): string[] {
  return preCalc.checkpointTracker.getCheckpoint(name)!.message;
}

describe('target DMSO volume', () => {
  test('a fixed target brings every used destination well on every plate to exactly the target', () => {
    //with skipUnusedBlocks on, empty treatment blocks are deliberately left without DMSO
    const preCalc = loadPreCalc('compBasic.xlsx', makePreferences({ targetDMSOVol: 150, skipUnusedBlocks: false }));
    expect(getMessages(preCalc, 'Calculated Transfer Volumes')).toEqual([]);
    expect(preCalc.maxDMSOVol).toBe(150);

    const calc = new EchoCalculator(preCalc, preCalc.checkpointTracker);
    expect(calc.errors).toEqual([]);
    const volumes = getUsedDestinationDMSO(calc);
    expect(volumes.length).toBeGreaterThan(0);
    expect(volumes.every(v => v === 150)).toBe(true);
  });

  test('the target caps each compound transfer, replacing DMSO Tolerance as the per-transfer limit', () => {
    //250 nL into 25 µL used to allow a 252.5 nL transfer because the fraction ignored the added volume
    const preCalc = loadPreCalc('compBasic.xlsx', makePreferences({ targetDMSOVol: 250 }));
    expect(preCalc.maxDMSOFraction).toBeCloseTo(250 / 25250, 12);
    for (const cache of preCalc.concentrationCache.values()) {
      for (const concInfo of cache.destinationConcentrations.values()) {
        expect(concInfo.volToTsfr).toBeLessThanOrEqual(250);
      }
    }
  });

  test('a target above the max transfer volume warns and splits backfills into chunks no larger than the max', () => {
    const preCalc = loadPreCalc('compBasic.xlsx', makePreferences({ targetDMSOVol: 1200, maxTransferVolume: 500, skipUnusedBlocks: false }));
    const step3 = preCalc.checkpointTracker.getCheckpoint('Calculated Transfer Volumes')!;
    expect(step3.status).toBe('Warning');
    expect(step3.message.some(m => m.includes('split into multiple transfers'))).toBe(true);

    const calc = new EchoCalculator(preCalc, preCalc.checkpointTracker);
    expect(calc.errors).toEqual([]);
    expect(calc.transferSteps.every(step => step.volume <= 500)).toBe(true);
    expect(getUsedDestinationDMSO(calc).every(v => v === 1200)).toBe(true);
  });

  test('a target is ignored when DMSO normalization is off, so the tolerance still caps transfers', () => {
    //compDeadVol's Assay tab turns normalization off
    const preCalc = loadPreCalc('compDeadVol.xlsx', makePreferences({ targetDMSOVol: 250 }));
    expect(preCalc.targetDMSOVolume).toBeNull();
    expect(preCalc.maxDMSOFraction).toBe(0.01);
  });

  test('a target below the DMSO a well already receives warns and normalizes that plate to the higher volume', () => {
    const preferences = makePreferences({ targetDMSOVol: 150 });
    const wb = read(new Uint8Array(readFileSync(join(fileDir, 'compBasic.xlsx'))), { type: 'array' });
    const input = echoInputValidation(wb, buildFormValues(wb, preferences), preferences);
    //a repeated layout block stacks two transfers in the same wells, as a combination pattern would
    const treatmentBlock = input.inputData.Layout.find(block => block.Pattern === 'Treatment 1')!;
    input.inputData.Layout.push({ ...treatmentBlock });
    const preCalc = new EchoPreCalculator(input.inputData, new CheckpointTracker(), preferences);
    preCalc.calculateNeeds();

    expect(preCalc.maxDMSOVol).toBeGreaterThan(150);
    const step3 = preCalc.checkpointTracker.getCheckpoint('Calculated Transfer Volumes')!;
    expect(step3.status).toBe('Warning');
    expect(step3.message.some(m => m.includes('below the'))).toBe(true);
  });
});

describe('EchoPreCalculator reruns', () => {
  test('updateDeadVolume reruns calculateNeeds without duplicating checkpoint messages or backfill totals', () => {
    const preCalc = loadPreCalc('compWarning.xlsx', makePreferences());
    const before = Array.from(preCalc.checkpointTracker.getCheckpoints()).map(([name, result]) => [name, result.status, result.message.length]);
    const backfillBefore = preCalc.totalDMSOBackfillVol;
    const wellsBefore = preCalc.destinationWellsCount;
    expect(getMessages(preCalc, 'Calculated Transfer Volumes').length).toBeGreaterThan(0);

    const srcPlate = preCalc.sourcePlates[0];
    preCalc.updateDeadVolume(srcPlate.barcode, srcPlate.getDeadVolume());
    preCalc.updateDeadVolume(srcPlate.barcode, srcPlate.getDeadVolume());

    const after = Array.from(preCalc.checkpointTracker.getCheckpoints()).map(([name, result]) => [name, result.status, result.message.length]);
    expect(after).toEqual(before);
    expect(preCalc.totalDMSOBackfillVol).toBe(backfillBefore);
    expect(preCalc.destinationWellsCount).toBe(wellsBefore);
  });

  test('a source volume shortfall fixed by lowering the dead volume clears its stale warning', () => {
    const preCalc = loadPreCalc('compBasic.xlsx', makePreferences());
    const barcode = preCalc.sourcePlates[0].barcode;
    const originalDeadVolume = preCalc.sourcePlates[0].getDeadVolume();

    preCalc.updateDeadVolume(barcode, 1000000);
    expect(preCalc.checkpointTracker.getCheckpoint('Sufficient Source Volumes')!.status).toBe('Warning');

    preCalc.updateDeadVolume(barcode, originalDeadVolume);
    expect(preCalc.checkpointTracker.getCheckpoint('Sufficient Source Volumes')).toEqual({ status: 'Passed', message: [] });
  });
});