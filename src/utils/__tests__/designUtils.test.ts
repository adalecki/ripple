import { Plate } from '../../classes/PlateClass';
import { Pattern } from '../../classes/PatternClass';
import { sensibleRecipeSelection } from '../designUtils';

function makeRecipe(replicates: number): Pattern {
  return new Pattern({
    name: 'R1', type: 'Recipe', replicates,
    direction: ['LR'], concentrations: [], volumes: [100, 200], locations: []
  });
}

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
