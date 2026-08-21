/**
 * @jest-environment node
 */
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { runEchoPipeline } from './echoPipeline';

const fileDir = join(__dirname, 'comprehensiveTestFiles');
const inputFiles = readdirSync(fileDir).filter(f => f.endsWith('.xlsx') && !f.startsWith('~$'));

function normalize(csv: string): string[] {
  return csv
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .trimEnd()
    .split('\n')
    .map(line => line.trimEnd());
}

export function compareToGolden(fileName: string): string[] {
  const inputPath = join(fileDir, fileName);
  const expectedPath = inputPath.replace(/\.xlsx$/, '_output.csv');
  const messages: string[] = [];

  if (!existsSync(expectedPath)) {
    return [`No expected CSV alongside ${fileName}`];
  }

  const result = runEchoPipeline(inputPath);
  if (result.csv === '') {
    return [`Pipeline produced no transfers: ${result.errors.join('; ') || 'no reported errors'}`];
  }

  const actual = normalize(result.csv);
  const expected = normalize(readFileSync(expectedPath, 'utf8'));
  console.log(fileName,actual[3],expected[3])

  if (actual.length !== expected.length) {
    messages.push(`Line count ${actual.length}, expected ${expected.length}`);
  }

  const limit = Math.min(actual.length, expected.length);
  let shown = 0;
  for (let i = 0; i < limit && shown < 5; i++) {
    if (actual[i] !== expected[i]) {
      messages.push(`Line ${i + 1}: got "${actual[i]}", expected "${expected[i]}"`);
      shown++;
    }
  }

  if (messages.length > 0 && result.errors.length > 0) {
    messages.push(`Calculator errors: ${result.errors.join('; ')}`);
  }

  return messages;
}

describe('Echo transfer list golden files', () => {
  test('Comparison directory contains input files', () => {
    expect(inputFiles.length).toBeGreaterThan(0);
  });

  test.each(inputFiles)('%s', (fileName) => {
    expect(compareToGolden(fileName)).toEqual([]);
  });
});