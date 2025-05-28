/**
 * @jest-environment node
 */
import { 
  formatWellBlock, 
  mapWellsToConcentrations,
  numberToLetters,
  lettersToNumber,
  getWellIdFromCoords,
  getCoordsFromWellId,
  currentPlate,
  clonePlate,
  modifyPlate,
  calculateBlockBorders,
  splitIntoBlocks
} from "../plateUtils";
import { Plate } from "../../classes/PlateClass";
import { Pattern } from "../../classes/PatternClass";

describe('numberToLetters', () => {
  test('converts numbers to single letters', () => {
    expect(numberToLetters(0)).toBe('A');
    expect(numberToLetters(1)).toBe('B');
    expect(numberToLetters(25)).toBe('Z');
  });

  test('converts numbers to double letters', () => {
    expect(numberToLetters(26)).toBe('AA');
    expect(numberToLetters(27)).toBe('AB');
    expect(numberToLetters(51)).toBe('AZ');
    expect(numberToLetters(52)).toBe('BA');
  });

  test('handles 1536 well plate rows', () => {
    expect(numberToLetters(31)).toBe('AF'); // Last row of 1536
  });
});

describe('lettersToNumber', () => {
  test('converts single letters to numbers', () => {
    expect(lettersToNumber('A')).toBe(0);
    expect(lettersToNumber('B')).toBe(1);
    expect(lettersToNumber('Z')).toBe(25);
  });

  test('converts double letters to numbers', () => {
    expect(lettersToNumber('AA')).toBe(26);
    expect(lettersToNumber('AB')).toBe(27);
    expect(lettersToNumber('AZ')).toBe(51);
    expect(lettersToNumber('BA')).toBe(52);
    expect(lettersToNumber('AF')).toBe(31);
  });

  test('round trip conversion works correctly', () => {
    for (let i = 0; i < 100; i++) {
      expect(lettersToNumber(numberToLetters(i))).toBe(i);
    }
  });
});

describe('getWellIdFromCoords', () => {
  test('converts coordinates to well IDs', () => {
    expect(getWellIdFromCoords(0, 0)).toBe('A01');
    expect(getWellIdFromCoords(0, 9)).toBe('A10');
    expect(getWellIdFromCoords(1, 0)).toBe('B01');
    expect(getWellIdFromCoords(7, 11)).toBe('H12');
  });

  test('handles double letter rows', () => {
    expect(getWellIdFromCoords(26, 0)).toBe('AA01');
    expect(getWellIdFromCoords(31, 47)).toBe('AF48');
  });
});

describe('getCoordsFromWellId', () => {
  test('converts well IDs to coordinates', () => {
    expect(getCoordsFromWellId('A01')).toEqual({ row: 0, col: 0 });
    expect(getCoordsFromWellId('A10')).toEqual({ row: 0, col: 9 });
    expect(getCoordsFromWellId('B01')).toEqual({ row: 1, col: 0 });
    expect(getCoordsFromWellId('H12')).toEqual({ row: 7, col: 11 });
  });

  test('handles double letter rows', () => {
    expect(getCoordsFromWellId('AA01')).toEqual({ row: 26, col: 0 });
    expect(getCoordsFromWellId('AF48')).toEqual({ row: 31, col: 47 });
  });

  test('throws error for invalid well ID format', () => {
    expect(() => getCoordsFromWellId('123')).toThrow('Invalid well ID format');
    expect(() => getCoordsFromWellId('1A1')).toThrow('Invalid well ID format');
    expect(() => getCoordsFromWellId('')).toThrow('Invalid well ID format');
  });

  test('round trip conversion works correctly', () => {
    const testCases = [
      { row: 0, col: 0 },
      { row: 15, col: 23 },
      { row: 31, col: 47 },
    ];
    
    testCases.forEach(({ row, col }) => {
      const wellId = getWellIdFromCoords(row, col);
      expect(getCoordsFromWellId(wellId)).toEqual({ row, col });
    });
  });
});

describe('currentPlate', () => {
  const plates: Plate[] = [
    new Plate({ id: 1, barcode: 'P1', plateSize: '384' }),
    new Plate({ id: 2, barcode: 'P2', plateSize: '384' }),
    new Plate({ id: 3, barcode: 'P3', plateSize: '1536' }),
  ];

  test('returns correct plate when valid ID provided', () => {
    expect(currentPlate(plates, 1)?.id).toBe(1);
    expect(currentPlate(plates, 2)?.barcode).toBe('P2');
    expect(currentPlate(plates, 3)?.rows).toBe(32);
  });

  test('returns null when ID not found', () => {
    expect(currentPlate(plates, 999)).toBeNull();
  });

  test('returns null when curPlateId is null', () => {
    expect(currentPlate(plates, null)).toBeNull();
  });
});

describe('clonePlate', () => {
  test('creates a deep clone of a plate', () => {
    const original = new Plate({ id: 1, barcode: 'P1', plateSize: '96' });
    const well = original.getWell('A01');
    if (well) {
      well.addContent(
        { compoundId: 'C1', concentration: 100, patternName: 'P1' },
        1000,
        { name: 'DMSO', fraction: 1 }
      );
    }

    const cloned = clonePlate(original);

    // Check that basic properties are copied
    expect(cloned.id).toBe(original.id);
    expect(cloned.barcode).toBe(original.barcode);
    expect(cloned.rows).toBe(original.rows);

    // Check that it's a deep clone (modifying clone doesn't affect original)
    cloned.barcode = 'P2';
    expect(original.barcode).toBe('P1');

    // Check that well contents are cloned
    const clonedWell = cloned.getWell('A01');
    expect(clonedWell?.getContents()).toHaveLength(1);
    expect(clonedWell?.getContents()[0].compoundId).toBe('C1');
  });
});

describe('modifyPlate', () => {
  test('replaces plate in array with modified version', () => {
    const plates: Plate[] = [
      new Plate({ id: 1, barcode: 'P1' }),
      new Plate({ id: 2, barcode: 'P2' }),
      new Plate({ id: 3, barcode: 'P3' }),
    ];
    
    const mockSetPlates = jest.fn();
    const modifiedPlate = new Plate({ id: 2, barcode: 'P2-Modified' });

    modifyPlate(modifiedPlate, plates, mockSetPlates, 2);

    expect(mockSetPlates).toHaveBeenCalledTimes(1);
    const newPlates = mockSetPlates.mock.calls[0][0];
    expect(newPlates).toHaveLength(3);
    expect(newPlates[1].barcode).toBe('P2-Modified');
    expect(newPlates[0].barcode).toBe('P1'); // Other plates unchanged
    expect(newPlates[2].barcode).toBe('P3');
  });

  test('handles case when plate ID not found', () => {
    const plates: Plate[] = [new Plate({ id: 1 })];
    const mockSetPlates = jest.fn();
    const modifiedPlate = new Plate({ id: 999 });

    modifyPlate(modifiedPlate, plates, mockSetPlates, 999);

    // Since findIndex returns -1, this will try to set plates[-1] = modifiedPlate
    // JavaScript allows this but it doesn't add to array properly
    expect(mockSetPlates).toHaveBeenCalled();
  });
});

describe('formatWellBlock', () => {
  // Basic functionality tests
  test('handles empty array', () => {
    expect(formatWellBlock([])).toBe('');
  });

  test('handles single well', () => {
    expect(formatWellBlock(['A01'])).toBe('A01');
  });

  // Row-based tests
  test('formats continuous row ranges', () => {
    expect(formatWellBlock(['A01', 'A02', 'A03'])).toBe('A01:A03');
    expect(formatWellBlock(['A01', 'A02', 'A03', 'A05'])).toBe('A01:A03;A05');
  });

  // Column-based tests
  test('formats continuous column ranges', () => {
    expect(formatWellBlock(['A01', 'B01', 'C01'])).toBe('A01:C01');
    expect(formatWellBlock(['A01', 'B01', 'C01', 'E01'])).toBe('A01:C01;E01');
  });

  // Mixed patterns tests
  test('formats mixed patterns correctly', () => {
    expect(formatWellBlock(['A01', 'B01', 'A02', 'B02'])).toBe('A01:B02');
    expect(formatWellBlock(['A01', 'B01', 'A03', 'B03'])).toBe('A01:B01;A03:B03');
  });

  // 384-well plate corner tests
  test('handles 384-well plate corners', () => {
    expect(formatWellBlock(['A01', 'A24', 'P01', 'P24'])).toBe('A01;A24;P01;P24');
    expect(formatWellBlock(['A01', 'A02', 'P01', 'P02'])).toBe('A01:A02;P01:P02');
  });

  // 1536-well plate tests
  test('handles 1536-well plate format', () => {
    // Corners
    expect(formatWellBlock(['A01', 'A48', 'AF01', 'AF48'])).toBe('A01;A48;AF01;AF48');
    
    // Top row
    expect(formatWellBlock(['A01', 'A02', 'A03', 'A48'])).toBe('A01:A03;A48');
    
    // First column
    expect(formatWellBlock(['A01', 'B01', 'AE01', 'AF01'])).toBe('A01:B01;AE01:AF01');
    
    // Mixed corners with gaps
    expect(formatWellBlock(['A01', 'A02', 'A03', 'A48', 'B48', 'C48', 'AF48', 'AF47', 'AF46', 'AF01', 'AE01', 'AD01', 'P25', 'Q24', 'P24', 'Q25'])).toBe('A01:A03;A48:C48;P24:Q25;AD01:AF01;AF46:AF48');

    // Cross into double row letters
    expect(formatWellBlock(['Y27', 'Y28', 'Y29', 'Y30', 'Y31', 'Z27', 'Z28', 'Z29', 'Z30', 'Z31', 'AA27', 'AA28', 'AA29', 'AA30', 'AA31', 'AB27', 'AB28', 'AB29', 'AB30', 'AB31', ])).toBe('Y27:AB31')
  });

  // Edge cases
  test('handles unsorted input', () => {
    expect(formatWellBlock(['B01', 'A01', 'C01'])).toBe('A01:C01');
    expect(formatWellBlock(['A02', 'A01', 'A03'])).toBe('A01:A03');
  });

  test('handles duplicate wells', () => {
    expect(formatWellBlock(['A01', 'A01', 'B01'])).toBe('A01:B01');
  });

  // Complex patterns
  test('handles complex patterns', () => {
    expect(formatWellBlock([
      'A01', 'B01', 'C01',  // Column 1
      'A12', 'B12', 'C12',  // Column 12
      'H06', 'H07', 'H08'   // Row H
    ])).toBe('A01:C01;A12:C12;H06:H08');
  });

  // 1536-well complex patterns
  test('handles complex 1536-well patterns', () => {
    const corner1 = ['A01', 'B01', 'C01'];  // Top-left
    const corner2 = ['A48', 'B48', 'C48'];  // Top-right
    const corner3 = ['AD01', 'AE01', 'AF01'];  // Bottom-left
    const corner4 = ['AD48', 'AE48', 'AF48'];  // Bottom-right
    const middle = ['M24', 'N24', 'O24'];  // Middle section
    
    const wells = [...corner1, ...corner2, ...corner3, ...corner4, ...middle];
    expect(formatWellBlock(wells)).toBe('A01:C01;A48:C48;M24:O24;AD01:AF01;AD48:AF48');
  });

  // Zigzag patterns
  test('handles zigzag patterns', () => {
    expect(formatWellBlock([
      'A01', 'B02', 'C03', 'D04'
    ])).toBe('A01;B02;C03;D04');
  });

  // Checkerboard patterns
  test('handles checkerboard patterns', () => {
    expect(formatWellBlock([
      'A01', 'A03', 'B02', 'B04',
      'C01', 'C03', 'D02', 'D04'
    ])).toBe('A01;A03;B02;B04;C01;C03;D02;D04');
  });
});

describe('mapWellsToConcentrations', () => {
  const plate = new Plate({plateSize: '1536'})
  
  test('LR direction: concentrations distributed across rows, not stacked in columns', () => {
    // Select A01:D04 (4 rows, 4 columns) with 2 concentrations, 2 replicates each
    const wellBlock = 'A01:D04';
    const concentrations = [10, 5];
    const direction = 'LR';
    
    // Expected: each concentration gets 8 wells (4 rows * 2 wells per row)
    // Within each row, alternate between concentrations: conc1, conc2, conc1, conc2
    const expectation = [
      ['A01', 'B01', 'C01', 'D01', 'A03', 'B03', 'C03', 'D03'], // First concentration (columns 1&3 from each row)
      ['A02', 'B02', 'C02', 'D02', 'A04', 'B04', 'C04', 'D04']  // Second concentration (columns 2&4 from each row)
    ];
    
    expect(mapWellsToConcentrations(plate,wellBlock,concentrations,direction)).toStrictEqual(expectation);
  });

  test('TB direction: concentrations distributed across columns, not stacked in rows', () => {
    // Select A01:D04 (4 rows, 4 columns) with 2 concentrations, 2 replicates each  
    const wellBlock = 'A01:D04';
    const concentrations = [10, 5];
    const direction = 'TB';
    
    // Expected: each concentration gets 8 wells (4 columns * 2 replicates)
    const expectation = [
      ['A01', 'A02', 'A03', 'A04', 'C01', 'C02', 'C03', 'C04'], // First concentration
      ['B01', 'B02', 'B03', 'B04', 'D01', 'D02', 'D03', 'D04']  // Second concentration
    ];
    
    expect(mapWellsToConcentrations(plate,wellBlock,concentrations,direction)).toStrictEqual(expectation);
  });

  test('LR direction with 4 concentrations across 8 columns', () => {
    // Select A01:B08 (2 rows, 8 columns) with 4 concentrations, 1 replicate each
    const wellBlock = 'A01:B08';
    const concentrations = [10, 8, 6, 4];
    const direction = 'LR';
    
    // Expected: each concentration gets 4 wells (2 rows * 2 columns)
    const expectation = [
      ['A01','B01','A05','B05'], // Concentration 1 (columns 1,5)
      ['A02','B02','A06','B06'], // Concentration 2 (columns 2,6)
      ['A03','B03','A07','B07'], // Concentration 3 (columns 3,7)  
      ['A04','B04','A08','B08']  // Concentration 4 (columns 4,8)
    ];
    
    expect(mapWellsToConcentrations(plate,wellBlock,concentrations,direction)).toStrictEqual(expectation);
  });

  test('TB direction with 4 concentrations across 8 rows', () => {
    // Select A01:H02 (8 rows, 2 columns) with 4 concentrations, 1 replicate each
    const wellBlock = 'A01:H02';  
    const concentrations = [10, 8, 6, 4];
    const direction = 'TB';
    
    // Expected: each concentration gets 4 wells (2 columns * 2 rows)
    const expectation = [
      ['A01','A02','E01','E02'], // Concentration 1 (rows A,E)
      ['B01','B02','F01','F02'], // Concentration 2 (rows B,F)
      ['C01','C02','G01','G02'], // Concentration 3 (rows C,G)  
      ['D01','D02','H01','H02']  // Concentration 4 (rows D,H)
    ];
    
    expect(mapWellsToConcentrations(plate,wellBlock,concentrations,direction)).toStrictEqual(expectation);
  });

  test('RL direction: reverse column order within each row group', () => {
    const wellBlock = 'A01:B04';
    const concentrations = [10, 5];
    const direction = 'RL';
    
    // Expected: same row distribution as LR, but columns reversed
    const expectation = [
      ['A04','B04','A02','B02'], // First concentration (columns 4,2)
      ['A03','B03','A01','B01']  // Second concentration (columns 3,1)  
    ];
    
    expect(mapWellsToConcentrations(plate,wellBlock,concentrations,direction)).toStrictEqual(expectation);
  });

  test('BT direction: reverse row order within each column group', () => {
    const wellBlock = 'A01:D02';
    const concentrations = [10, 5];
    const direction = 'BT';
    
    // Expected: same column distribution as TB, but rows reversed
    const expectation = [
      ['D01','D02','B01','B02'], // First concentration (rows D,B)
      ['C01','C02','A01','A02']  // Second concentration (rows C,A)
    ];
    
    expect(mapWellsToConcentrations(plate,wellBlock,concentrations,direction)).toStrictEqual(expectation);
  });

  test('left-to-right two replicates', () => {
    const wellBlock = 'A01:B10';
    const concentrations = [10,9,8,7,6,5,4,3,2,1];
    const direction = 'LR';
    const expectation = [['A01','B01'],['A02','B02'],['A03','B03'],['A04','B04'],['A05','B05'],['A06','B06'],['A07','B07'],['A08','B08'],['A09','B09'],['A10','B10']]
    expect(mapWellsToConcentrations(plate,wellBlock,concentrations,direction)).toStrictEqual(expectation);
  });

  test('top-to-bottom two replicates', () => {
    const wellBlock = 'A01:J02';
    const concentrations = [10,9,8,7,6,5,4,3,2,1];
    const direction = 'TB';
    const expectation = [['A01','A02'],['B01','B02'],['C01','C02'],['D01','D02'],['E01','E02'],['F01','F02'],['G01','G02'],['H01','H02'],['I01','I02'],['J01','J02']]
    expect(mapWellsToConcentrations(plate,wellBlock,concentrations,direction)).toStrictEqual(expectation);
  });
});

describe('calculateBlockBorders', () => {
  test('returns empty borders for plate with no patterns', () => {
    const plate = new Plate({ plateSize: '96' });
    const borders = calculateBlockBorders(plate);
    
    // All wells should have no borders
    for (const well of plate) {
      if (well) {
        expect(borders.get(well.id)).toEqual({
          top: false,
          right: false,
          bottom: false,
          left: false
        });
      }
    }
  });

  test('calculates borders for single block pattern', () => {
    const plate = new Plate({ plateSize: '96' });
    const pattern = new Pattern({
      name: 'TestPattern',
      type: 'Treatment',
      replicates: 1,
      direction: ['LR'],
      concentrations: [100],
      locations: []
    });
    
    plate.applyPattern('A01:B02', pattern);
    const borders = calculateBlockBorders(plate);

    // Corner wells should have 2 borders each
    expect(borders.get('A01')).toEqual({
      top: true,
      right: false,
      bottom: false,
      left: true
    });
    
    expect(borders.get('B02')).toEqual({
      top: false,
      right: true,
      bottom: true,
      left: false
    });

    // Edge wells should have 3 borders
    expect(borders.get('A02')).toEqual({
      top: true,
      right: true,
      bottom: false,
      left: false
    });
  });

  test('calculates borders for multiple separate blocks', () => {
    const plate = new Plate({ plateSize: '96' });
    const pattern = new Pattern({
      name: 'TestPattern',
      type: 'Treatment',
      replicates: 1,
      direction: ['LR'],
      concentrations: [100],
      locations: []
    });
    
    plate.applyPattern('A01:B02', pattern);
    plate.applyPattern('D04:E05', pattern);
    
    const borders = calculateBlockBorders(plate);

    // Each block should have its own borders
    expect(borders.get('A01')).toEqual({
      top: true,
      right: false,
      bottom: false,
      left: true
    });

    expect(borders.get('D04')).toEqual({
      top: true,
      right: false,
      bottom: false,
      left: true
    });
  });

  test('handles edge cases at plate boundaries', () => {
    const plate = new Plate({ plateSize: '96' });
    const pattern = new Pattern({
      name: 'TestPattern',
      type: 'Treatment',
      replicates: 1,
      direction: ['LR'],
      concentrations: [100],
      locations: []
    });
    
    // Apply pattern to bottom-right corner
    plate.applyPattern('H12', pattern);
    const borders = calculateBlockBorders(plate);

    // Single well at corner should have all borders
    expect(borders.get('H12')).toEqual({
      top: true,
      right: true,
      bottom: true,
      left: true
    });
  });
});

describe('splitIntoBlocks', () => {
  test('handles unused pattern - returns single block', () => {
    const plate = new Plate({ plateSize: '96' });
    const unusedPattern = new Pattern({
      name: 'Unused',
      type: 'Unused',
      replicates: 1,
      direction: ['LR'],
      concentrations: [],
      locations: []
    });

    const wells = ['A01', 'A02', 'B01', 'B02', 'C01'];
    const blocks = splitIntoBlocks(wells, unusedPattern, plate);
    
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toBe('A01:B02;C01');
  });

  test('splits wells into blocks based on pattern', () => {
    const plate = new Plate({ plateSize: '96' });
    const pattern = new Pattern({
      name: 'TestPattern',
      type: 'Treatment',
      replicates: 2,
      direction: ['LR'],
      concentrations: [100, 50],
      locations: []
    });

    // 8 wells total: 2 concentrations × 2 replicates = 4 wells per block
    const wells = ['A01', 'A02', 'A03', 'A04', 'B01', 'B02', 'B03', 'B04'];
    const blocks = splitIntoBlocks(wells, pattern, plate);
    
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toBe('A01:B02');
    expect(blocks[1]).toBe('A03:B04');
  });

  test('throws error when wells not divisible by concentrations', () => {
    const plate = new Plate({ plateSize: '96' });
    const pattern = new Pattern({
      name: 'TestPattern',
      type: 'Treatment',
      replicates: 2,
      direction: ['LR'],
      concentrations: [100, 50, 25], // 3 concentrations
      locations: []
    });

    const wells = ['A01', 'A02', 'A03', 'A04']; // 4 wells, not divisible by 3
    
    expect(() => splitIntoBlocks(wells, pattern, plate)).toThrow(
      'The number of wells must be divisible by the number of concentrations.'
    );
  });

  test('throws error when wells per concentration not divisible by replicates', () => {
    const plate = new Plate({ plateSize: '96' });
    const pattern = new Pattern({
      name: 'TestPattern',
      type: 'Treatment',
      replicates: 3,
      direction: ['LR'],
      concentrations: [100, 50], // 2 concentrations
      locations: []
    });

    const wells = ['A01', 'A02', 'A03', 'A04']; // 4 wells / 2 conc = 2 wells per conc, not divisible by 3 replicates
    
    expect(() => splitIntoBlocks(wells, pattern, plate)).toThrow(
      'The number of wells per concentration must be divisible by the original number of replicates.'
    );
  });

  test('handles complex splitting with multiple blocks', () => {
    const plate = new Plate({ plateSize: '384' });
    const pattern = new Pattern({
      name: 'TestPattern',
      type: 'Treatment',
      replicates: 3,
      direction: ['TB'],
      concentrations: [100, 50, 25],
      locations: []
    });

    // 18 wells: 3 conc × 3 rep = 9 wells per block, 2 blocks total
    const wells = [];
    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 3; col++) {
        wells.push(getWellIdFromCoords(row, col));
      }
    }

    const blocks = splitIntoBlocks(wells, pattern, plate);
    
    expect(blocks).toHaveLength(2);
    // First block should contain first 9 wells arranged properly
    expect(blocks[0]).toBe('A01:C03');
    // Second block should contain remaining 9 wells
    expect(blocks[1]).toBe('D01:F03');
  });

  test('filters out null concentrations', () => {
    const plate = new Plate({ plateSize: '96' });
    const pattern = new Pattern({
      name: 'TestPattern',
      type: 'Treatment',
      replicates: 2,
      direction: ['LR'],
      concentrations: [100, null, 50, null], // Only 2 valid concentrations
      locations: []
    });

    // 4 wells: 2 valid conc × 2 rep = 4 wells per block
    const wells = ['A01', 'A02', 'B01', 'B02'];
    const blocks = splitIntoBlocks(wells, pattern, plate);
    
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toBe('A01:B02');
  });
});