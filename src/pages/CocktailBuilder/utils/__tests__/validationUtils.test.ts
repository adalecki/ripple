import { readFileSync } from 'fs';
import { join } from 'path';
import { read } from 'xlsx';
import { echoInputValidation, validateInputData, isDropletMultiple } from '../validationUtils';
import { InputDataType, COCKTAIL_HEADERS } from '../cocktailUtils';

function loadExampleWorkbook() {
  const path = join(__dirname, '../../../../../public/data/RippleTemplate_Cocktail.xlsx');
  return read(readFileSync(path), { type: 'buffer' });
}

const example = echoInputValidation(loadExampleWorkbook(),"384","384",2.5).inputData;

function cloneExample(): InputDataType {
  return JSON.parse(JSON.stringify(example));
}

describe('isDropletMultiple', () => {
  test('accepts exact multiples and rejects partial droplets', () => {
    expect(isDropletMultiple(62.5, 2.5)).toBe(true);
    expect(isDropletMultiple(500, 2.5)).toBe(true);
    expect(isDropletMultiple(62.5, 25)).toBe(false);
    expect(isDropletMultiple(63, 2.5)).toBe(false);
  });

  test('is not defeated by floating point', () => {
    expect(isDropletMultiple(0.1 + 0.2, 0.1)).toBe(true);
  });
});

describe('validateInputData on the example workbook', () => {
  test('passes with no preferences', () => {
    expect(validateInputData(cloneExample(),"384","384",2.5)).toEqual([]);
  });

  test('passes at the 2.5 nL droplet size', () => {
    expect(validateInputData(cloneExample(),"384","384",2.5)).toEqual([]);
  });

  test('flags every sub-droplet volume at 25 nL', () => {
    const errors = validateInputData(cloneExample(),"384","384",25);
    // Main uses 62.5 nL x4 and Main2 uses 50/200/350 (all clean at 25) - so only the 62.5s fail
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.every(e => e.includes('droplet size'))).toBe(true);
    expect(errors[0]).toContain('62.5');
  });
});

describe('validateInputData catches design errors', () => {
  test('duplicate recipe name', () => {
    const data = cloneExample();
    data.Recipes.push({ ...data.Recipes[0] });
    expect(validateInputData(data,"384","384",2.5).some(e => e.includes('already present'))).toBe(true);
  });

  test('well block that does not fit the destination plate', () => {
    const data = cloneExample();
    data.Recipes[0]['Well Block'] = 'A01:Z99';
    expect(validateInputData(data,"384","384",2.5).some(e => e.includes('does not fit on a plate'))).toBe(true);
  });

  test('cocktail referencing an unknown recipe', () => {
    const data = cloneExample();
    data.Cocktails[0].Recipe = 'NoSuchRecipe';
    expect(validateInputData(data,"384","384",2.5).some(e => e.includes('is not present on the Recipes tab'))).toBe(true);
  });

  test('cocktail referencing content absent from inventory', () => {
    const data = cloneExample();
    data.Cocktails[0].Comp1 = 'NotAnInventoryItem';
    expect(validateInputData(data,"384","384",2.5).some(e => e.includes('is not present on SourceLayout'))).toBe(true);
  });

  test('destination plate size is respected', () => {
    const data = cloneExample();
    // A01:P04 needs 16 rows; a 96-well plate has 8
    const errors = validateInputData(data,"384","96",2.5);
    expect(errors.some(e => e.includes('does not fit on a plate'))).toBe(true);
  });
});

describe('COCKTAIL_HEADERS', () => {
  test('matches the sheet shape the validator enforces', () => {
    expect(COCKTAIL_HEADERS.Recipes).toHaveLength(13);
    expect(COCKTAIL_HEADERS.Recipes.slice(0, 3)).toEqual(['Name', 'Replicates', 'Well Block']);
    expect(COCKTAIL_HEADERS.SourceLayout).toHaveLength(5);
    expect(COCKTAIL_HEADERS.Cocktails).toHaveLength(11);
    expect(COCKTAIL_HEADERS.Cocktails[10]).toBe('Comp10');
  });
});
