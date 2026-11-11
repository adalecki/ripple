import { Plate } from '../../classes/PlateClass';
import { Pattern } from '../../classes/PatternClass';
import { sensibleRecipeSelection, sensibleWellSelection } from '../designUtils';

function makeRecipe(replicates: number): Pattern {
  return new Pattern({
    name: 'R1', type: 'Recipe', replicates,
    direction: ['LR'], concentrations: [], volumes: [100, 200], locations: []
  });
}

function makeMatrix(concentrations: number[], replicates: number): Pattern {
  return new Pattern({
    name: 'M1', type: 'Combination-2', replicates,
    direction: ['LR', 'TB'], concentrations, locations: []
  });
}

describe('sensibleWellSelection', () => {
  const plate = new Plate({ plateSize: '384' });
  const tenConcs = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];

  test('rejects a matrix selection whose well count is not a multiple of concentrations squared', () => {
    const wells = plate.getSomeWells('A01:J09').map(w => w.id);
    const reasons = sensibleWellSelection(wells, makeMatrix(tenConcs, 1), plate);
    expect(reasons).toHaveLength(1);
    expect(reasons[0]).toContain('multiple of 100 wells');
  });

  test('accepts a square matrix selection', () => {
    const wells = plate.getSomeWells('A01:J10').map(w => w.id);
    expect(sensibleWellSelection(wells, makeMatrix(tenConcs, 1), plate)).toEqual([]);
  });

  test('accepts a 5x20 matrix selection because its width is a multiple of the concentration count', () => {
    const wells = plate.getSomeWells('A01:E20').map(w => w.id);
    expect(sensibleWellSelection(wells, makeMatrix(tenConcs, 1), plate)).toEqual([]);
  });

  test('rejects a matrix selection with the right well count but neither side a multiple of the concentration count', () => {
    //6 concs need 36 wells; 4 rows x 9 columns has them but cannot carry 6 values on either axis
    const wells = plate.getSomeWells('A01:D09').map(w => w.id);
    const reasons = sensibleWellSelection(wells, makeMatrix([32, 16, 8, 4, 2, 1], 1), plate);
    expect(reasons).toHaveLength(1);
    expect(reasons[0]).toContain('width or height that is a multiple of 6');
  });
});

describe('sensibleRecipeSelection', () => {
  const plate = new Plate({ plateSize: '384' });

  test('rejects an empty selection', () => {
    expect(sensibleRecipeSelection([], makeRecipe(2), plate)).toEqual(['No wells selected']);
  });

  test('rejects a selection that is not a multiple of replicates', () => {
    const wells = ['A01', 'A02', 'A03'];
    const reasons = sensibleRecipeSelection(wells, makeRecipe(2), plate);
    expect(reasons).toHaveLength(1);
    expect(reasons[0]).toContain('multiple of 2 replicates');
  });

  test('accepts a clean contiguous region', () => {
    const wells = plate.getSomeWells('A01:P04').map(w => w.id);
    expect(wells).toHaveLength(64);
    expect(sensibleRecipeSelection(wells, makeRecipe(2), plate)).toEqual([]);
  });

  test('accepts a split region - a recipe has no dilution axis to walk', () => {
    const wells = [...plate.getSomeWells('A01:B02'), ...plate.getSomeWells('A10:B11')].map(w => w.id);
    expect(sensibleRecipeSelection(wells, makeRecipe(2), plate)).toEqual([]);
  });

  test('flags a replicate slot that straddles non-adjacent wells', () => {
    // A01 and A24 land in the same replicate pair but cannot form one rectangle
    const reasons = sensibleRecipeSelection(['A01', 'A24'], makeRecipe(2), plate);
    expect(reasons.some(r => r.includes('not contiguous'))).toBe(true);
  });

  test('a single-replicate recipe accepts any well count', () => {
    expect(sensibleRecipeSelection(['A01', 'C07', 'P24'], makeRecipe(1), plate)).toEqual([]);
  });
});
