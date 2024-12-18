import { formatWellBlock, mapWellsToConcentrations } from "../pages/EchoTransfer/utils/plateUtils";
import { Plate } from "../pages/EchoTransfer/classes/PlateClass";

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
  test('left-to-right two replicates', () => {
    const wellBlock = 'A01:B10';
    const concentrations = [10,9,8,7,6,5,4,3,2,1];
    const replicates = 2;
    const direction = 'LR';
    const expectation = [['A01','B01'],['A02','B02'],['A03','B03'],['A04','B04'],['A05','B05'],['A06','B06'],['A07','B07'],['A08','B08'],['A09','B09'],['A10','B10']]
    expect(mapWellsToConcentrations(plate,wellBlock,concentrations,replicates,direction)).toStrictEqual(expectation);
  });
  test('right-to-left two replicates', () => {
    const wellBlock = 'A01:B10';
    const concentrations = [10,9,8,7,6,5,4,3,2,1];
    const replicates = 2;
    const direction = 'RL';
    const expectation = [['A10','B10'],['A09','B09'],['A08','B08'],['A07','B07'],['A06','B06'],['A05','B05'],['A04','B04'],['A03','B03'],['A02','B02'],['A01','B01']]
    expect(mapWellsToConcentrations(plate,wellBlock,concentrations,replicates,direction)).toStrictEqual(expectation);
  });
  test('top-to-bottom two replicates', () => {
    const wellBlock = 'A01:J02';
    const concentrations = [10,9,8,7,6,5,4,3,2,1];
    const replicates = 2;
    const direction = 'TB';
    const expectation = [['A01','A02'],['B01','B02'],['C01','C02'],['D01','D02'],['E01','E02'],['F01','F02'],['G01','G02'],['H01','H02'],['I01','I02'],['J01','J02']]
    expect(mapWellsToConcentrations(plate,wellBlock,concentrations,replicates,direction)).toStrictEqual(expectation);
  });
  test('bottom-to-top two replicates', () => {
    const wellBlock = 'A01:J02';
    const concentrations = [10,9,8,7,6,5,4,3,2,1];
    const replicates = 2;
    const direction = 'BT';
    const expectation = [['J01','J02'],['I01','I02'],['H01','H02'],['G01','G02'],['F01','F02'],['E01','E02'],['D01','D02'],['C01','C02'],['B01','B02'],['A01','A02']]
    expect(mapWellsToConcentrations(plate,wellBlock,concentrations,replicates,direction)).toStrictEqual(expectation);
  });
  test('bottom right corner of 1536 well plate', () => {
    const wellBlock = 'AC39:AF48';
    const concentrations = [10,9,8,7,6,5,4,3,2,1];
    const replicates = 4;
    const direction = 'LR';
    const expectation = [['AC39','AD39','AE39','AF39'],['AC40','AD40','AE40','AF40'],['AC41','AD41','AE41','AF41'],['AC42','AD42','AE42','AF42'],['AC43','AD43','AE43','AF43'],['AC44','AD44','AE44','AF44'],['AC45','AD45','AE45','AF45'],['AC46','AD46','AE46','AF46'],['AC47','AD47','AE47','AF47'],['AC48','AD48','AE48','AF48'],]
    expect(mapWellsToConcentrations(plate,wellBlock,concentrations,replicates,direction)).toStrictEqual(expectation);
  });
})