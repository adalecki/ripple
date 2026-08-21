import { readFileSync } from 'fs';
import { join } from 'path';
import { read } from 'xlsx';
import { Pattern } from '../../../../classes/PatternClass';
import {
  buildDesignFromInputData,
  buildInputData,
  MAX_COMBINATION_SLOTS,
  processInputData,
  recipeSlotCount
} from '../combinatorUtils';
import { echoInputValidation, validateInputData } from '../validationUtils';

function loadExampleWorkbook() {
  const path = join(__dirname, '../../../../../public/data/RippleTemplate_Combinator.xlsx');
  return read(readFileSync(path), { type: 'buffer' });
}

const example = echoInputValidation(loadExampleWorkbook(),"384","384",2.5).inputData;

function roundTrip() {
  const { recipes, srcPlates, combinations } = buildDesignFromInputData(example, '384', '384');
  return buildInputData(recipes, srcPlates, combinations)!;
}

describe('recipeSlotCount', () => {
  function makeRecipe(volumes: (number | null)[]): Pattern {
    return new Pattern({
      name: 'R1', type: 'Recipe', replicates: 1,
      direction: ['LR'], concentrations: [], volumes, locations: []
    });
  }

  test('counts the volumes a recipe actually declares', () => {
    expect(recipeSlotCount(makeRecipe([100, 200, 300]))).toBe(3);
  });

  test('a freshly added row with no volume yet does not count', () => {
    expect(recipeSlotCount(makeRecipe([null]))).toBe(0);
    expect(recipeSlotCount(makeRecipe([100, null]))).toBe(1);
  });

  test('zero is a declared volume', () => {
    expect(recipeSlotCount(makeRecipe([0, 100]))).toBe(2);
  });
});

describe('Combinator end-to-end against the example workbook', () => {
  const { inputData, errors } = echoInputValidation(loadExampleWorkbook(),"384","384",2.5);

  test('the example workbook validates cleanly', () => {
    expect(errors).toEqual([]);
  });

  test('parses the expected recipes, inventory and combinations', () => {
    expect(inputData.Patterns).toHaveLength(2);
    expect(inputData.SourceLayout).toHaveLength(19);
    expect(inputData.Combinations).toHaveLength(64);
  });

  describe('processed result', () => {
    const result = processInputData(inputData, '384');

    test('produces no warnings', () => {
      expect(result.warnings).toEqual([]);
    });

    test('builds the source plates declared in the inventory', () => {
      expect(result.srcPlates.map(p => p.barcode).sort()).toEqual(['SrcPlt1', 'SrcPlt2']);
    });

    test('assigns every plate a unique id', () => {
      const ids = [...result.srcPlates, ...result.dstPlates].map(p => p.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    test('emits one transfer per component per replicate well', () => {
      // 64 combinations x 6 components x 2 replicates
      expect(result.transferSteps).toHaveLength(64 * 6 * 2);
    });

    test('destination contents are volume-driven, with no invented concentration', () => {
      const dstPlate = result.dstPlates[0];
      const filled = Object.values(dstPlate.getWells()).filter(w => w.getContents().length > 0);
      expect(filled.length).toBeGreaterThan(0);

      for (const content of filled[0].getContents()) {
        expect(content.concentration).toBeNull();
        expect(content.volume).toBeGreaterThan(0);
      }
    });

    test('a destination well holds the full recipe volume', () => {
      const dstPlate = result.dstPlates[0];
      const well = Object.values(dstPlate.getWells()).find(w => w.getContents().length > 0)!;
      // "Main" recipe: 62.5 x4 + 250 + 500
      expect(well.getTotalVolume()).toBeCloseTo(1000);
    });

    test('source wells are depleted by exactly what was transferred', () => {
      const srcPlate = result.srcPlates.find(p => p.barcode === 'SrcPlt1')!;
      const well = srcPlate.getWell('A01')!;
      const dispensed = result.transferSteps
        .filter(s => s.sourceBarcode === 'SrcPlt1' && s.sourceWellId === 'A01')
        .reduce((sum, s) => sum + s.volume, 0);

      expect(well.getTotalVolume()).toBeCloseTo(50000 - dispensed);
    });
  });
});

describe('buildDesignFromInputData', () => {
  const { recipes, previewPlate, srcPlates, combinations } = buildDesignFromInputData(example, '384', '384');

  test('builds one Recipe pattern per Patterns row', () => {
    expect(recipes).toHaveLength(2);
    expect(recipes.map(r => r.name)).toEqual(['Main', 'Main2']);
    expect(recipes.every(r => r.type === 'Recipe')).toBe(true);
    expect(recipes.every(r => r.concentrations.length === 0)).toBe(true);
  });

  test('recipe volumes are positional and in nL', () => {
    expect(recipes[0].volumes).toEqual([62.5, 62.5, 62.5, 62.5, 250, 500]);
    expect(recipeSlotCount(recipes[0])).toBe(6);
  });

  test('unused trailing slots are not padded up to the cap', () => {
    expect(recipes.every(r => r.volumes.length === recipeSlotCount(r))).toBe(true);
    expect(recipes.every(r => r.volumes.length < MAX_COMBINATION_SLOTS)).toBe(true);
  });

  test('recipes are stamped onto the preview plate', () => {
    const well = previewPlate.getWell('A01')!;
    expect(well.getContents()).toHaveLength(6);
    expect(well.getContents().every(c => c.concentration === null)).toBe(true);
    // planned volume only - nothing has actually been dispensed yet
    expect(well.getTotalVolume()).toBe(0);
    expect(previewPlate.getWell('A06')!.getPatterns()).toEqual(['Main2']);
  });

  test('inventory volumes convert µL to nL', () => {
    const plate = srcPlates.find(p => p.barcode === 'SrcPlt1')!;
    expect(plate.getWell('A01')!.getTotalVolume()).toBe(50000);
    expect(plate.plateRole).toBe('source');
  });

  test('inventory contents are volume-driven', () => {
    const content = srcPlates[0].getWell('A01')!.getContents()[0];
    expect(content.compoundId).toBe('Comp1v1');
    expect(content.concentration).toBeNull();
  });

  test('combinations get stable ids and padded slots', () => {
    expect(combinations).toHaveLength(64);
    expect(combinations[0].patternName).toBe('Main');
    expect(combinations[0].slots).toHaveLength(10);
    expect(combinations[0].slots.slice(0, 6)).toEqual(['Comp1v1', 'Comp2v1', 'Comp3v1', 'Comp4v1', 'Comp5v1', 'Neut']);
    expect(combinations[0].slots.slice(6)).toEqual(['', '', '', '']);
    expect(new Set(combinations.map(c => c.id)).size).toBe(64);
  });

  test('a block that overflows a smaller destination is clipped, not crashed', () => {
    const clipped = buildDesignFromInputData(example, '96', '384');
    // A01:P04 needs 16 rows; a 96-well plate has 8, so the recipe keeps only what fits
    expect(clipped.previewPlate.rows).toBe(8);
    expect(clipped.recipes[0].locations[0]).toBe('A01:H04');
  });
});

describe('workbook round trip', () => {
  const rebuilt = roundTrip();

  test('Patterns survive unchanged', () => {
    expect(rebuilt.Patterns).toEqual(example.Patterns);
  });

  test('SourceLayout survives unchanged, including collapsed well ranges', () => {
    expect(rebuilt.SourceLayout).toEqual(example.SourceLayout);
    // the example expresses 24 Neut wells as a single F01:F24 row - that must not explode into 24 rows
    expect(rebuilt.SourceLayout.find(r => r.Content === 'Neut')!['Well ID']).toBe('F01:F24');
  });

  test('Combinations survive unchanged', () => {
    expect(rebuilt.Combinations).toEqual(example.Combinations);
  });

  test('the whole InputDataType is deep-equal', () => {
    expect(rebuilt).toEqual(example);
  });

  test('the round-tripped design still validates cleanly', () => {
    expect(validateInputData(rebuilt,"384","384",2.5)).toEqual([]);
  });
});

describe('round trip preserves what Build produces', () => {
  const fromFile = processInputData(example, '384');
  const fromDesigner = processInputData(roundTrip(), '384');

  test('same plate counts', () => {
    expect(fromDesigner.srcPlates).toHaveLength(fromFile.srcPlates.length);
    expect(fromDesigner.dstPlates).toHaveLength(fromFile.dstPlates.length);
  });

  test('same warnings', () => {
    expect(fromDesigner.warnings).toEqual(fromFile.warnings);
  });
});
