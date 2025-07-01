// src/pages/EchoTransfer/utils/__tests__/validationUtils.test.ts
import { WorkBook, WorkSheet } from 'xlsx';
import { echoInputValidation, fileHeaders } from '../validationUtils';
import { PreferencesState } from '../../../../hooks/usePreferences';

// Mock data structures
const mockPreferences: PreferencesState = {
  maxTransferVolume: 500,
  dropletSize: 2.5,
  sourcePlateSize: '384',
  destinationPlateSize: '384',
  splitOutputCSVs: true,
  defaultDMSOTolerance: 0.005,
  defaultAssayVolume: 25,
  defaultBackfill: 10,
  defaultAllowedError: 0.1,
  defaultDestinationReplicates: 1,
  useIntermediatePlates: true,
  dmsoNormalization: true,
  evenDepletion: false,
  useSurveyVols: false
};

const mockFormValues = {
  'DMSO Tolerance': 0.005,
  'Well Volume (µL)': 25,
  'Backfill (µL)': 10,
  'Allowed Error': 0.1,
  'Destination Replicates': 1,
  'Use Intermediate Plates': true,
  'DMSO Normalization': true,
  'Evenly Deplete Source Wells': false,
  'Use Source Survey Volumes': false
};

// Create mock worksheet with headers and data
function createMockWorksheet(headers: string[], data: any[]): WorkSheet {
  const ws: WorkSheet = {};

  // Add headers
  headers.forEach((header, idx) => {
    const col = String.fromCharCode(65 + idx); // A, B, C, etc.
    ws[`${col}1`] = { v: header, t: 's' };
  });

  // Add data
  data.forEach((row, rowIdx) => {
    Object.keys(row).forEach((key, colIdx) => {
      const col = String.fromCharCode(65 + colIdx);
      const cellRef = `${col}${rowIdx + 2}`;
      const value = row[key];
      ws[cellRef] = {
        v: value,
        t: typeof value === 'number' ? 'n' : 's'
      };
    });
  });

  ws['!ref'] = "A1:" + String.fromCharCode(65 + headers.length - 1) + (data.length + 1).toString()

  return ws;
}

const validHeaders = {
  Patterns: ['Pattern', 'Type', 'Direction', 'Replicates', 'Conc1', 'Conc2', 'Conc3', 'Conc4', 'Conc5', 'Conc6', 'Conc7', 'Conc8', 'Conc9', 'Conc10', 'Conc11', 'Conc12', 'Conc13', 'Conc14', 'Conc15', 'Conc16', 'Conc17', 'Conc18', 'Conc19', 'Conc20'],
  Layout: ['Pattern', 'Well Block'],
  Compounds: ['Source Barcode', 'Well ID', 'Concentration (µM)', 'Compound ID', 'Volume (µL)', 'Pattern'],
  Barcodes: ['Intermediate Plate Barcodes', 'Destination Plate Barcodes']
}

// Base valid data structures
const validPatternsData = [
  {
    Pattern: 'Treatment1',
    Type: 'Treatment',
    Direction: 'LR',
    Replicates: 2,
    Conc1: 100,
    Conc2: 50,
    Conc3: 25,
    Conc4: 12.5,
    Conc5: 6.25
  },
  {
    Pattern: 'Control1',
    Type: 'Control',
    Direction: 'TB',
    Replicates: 3,
    Conc1: 10,
    Conc2: 5,
    Conc3: 2.5
  },
  {
    Pattern: 'DMSO',
    Type: 'Solvent',
    Direction: '',
    Replicates: ''
  },
  {
    Pattern: 'Empty',
    Type: 'Unused',
    Direction: '',
    Replicates: ''
  }
];

const validLayoutData = [
  { Pattern: 'Treatment1', 'Well Block': 'A01:B05' },
  { Pattern: 'Control1', 'Well Block': 'C01:E03' },
  { Pattern: 'Empty', 'Well Block': 'P01:P24' }
];

const validCompoundsData = [
  {
    'Source Barcode': 'SRC001',
    'Well ID': 'A01',
    'Concentration (µM)': 10000,
    'Compound ID': 'CPD001',
    'Volume (µL)': 50,
    'Pattern': 'Treatment1'
  },
  {
    'Source Barcode': 'SRC001',
    'Well ID': 'B01',
    'Concentration (µM)': 10000,
    'Compound ID': 'CPD002',
    'Volume (µL)': 50,
    'Pattern': 'Control1'
  },
  {
    'Source Barcode': 'SRC002',
    'Well ID': 'A01:A02',
    'Concentration (µM)': 0,
    'Compound ID': 'DMSO',
    'Volume (µL)': 100,
    'Pattern': 'DMSO'
  }
];

const validBarcodesData = [
  { 'Intermediate Plate Barcodes': 'INT001', 'Destination Plate Barcodes': 'DEST001' },
  { 'Intermediate Plate Barcodes': 'INT002', 'Destination Plate Barcodes': 'DEST002' }
];

function createValidWorkbook(): WorkBook {
  return {
    SheetNames: ['Patterns', 'Layout', 'Compounds', 'Barcodes'],
    Sheets: {
      Patterns: createMockWorksheet(
        validHeaders.Patterns,
        validPatternsData
      ),
      Layout: createMockWorksheet(
        validHeaders.Layout,
        validLayoutData
      ),
      Compounds: createMockWorksheet(
        validHeaders.Compounds,
        validCompoundsData
      ),
      Barcodes: createMockWorksheet(
        validHeaders.Barcodes,
        validBarcodesData
      )
    }
  };
}

describe('fileHeaders', () => {
  test('validates correct headers', () => {
    const ws = createMockWorksheet(validHeaders.Layout, []);
    expect(fileHeaders(ws, validHeaders.Layout)).toBe(true);
  });

  test('rejects incorrect headers', () => {
    const ws = createMockWorksheet(['Wrong', 'Headers'], []);
    expect(fileHeaders(ws, validHeaders.Layout)).toBe(false);
  });

  test('rejects missing headers', () => {
    const ws = createMockWorksheet(['Pattern'], []);
    expect(fileHeaders(ws, validHeaders.Layout)).toBe(false);
  });
});

describe('echoInputValidation - Valid Input', () => {
  test('accepts valid complete workbook', () => {
    const wb = createValidWorkbook();
    const result = echoInputValidation(wb, mockFormValues, mockPreferences);
    console.log(result)

    expect(result.errors).toHaveLength(0);
    expect(result.inputData).toBeDefined();
    expect(result.inputData.Patterns).toHaveLength(4);
    expect(result.inputData.Layout).toHaveLength(3);
    expect(result.inputData.Compounds).toHaveLength(3);
    expect(result.inputData.Barcodes).toHaveLength(2);
    expect(result.inputData.CommonData).toBeDefined();
  });
});

describe('echoInputValidation - Header Errors', () => {
  test('detects invalid Patterns headers', () => {
    const wb = createValidWorkbook();
    wb.Sheets.Patterns = createMockWorksheet(['Wrong', 'Headers'], []);

    const result = echoInputValidation(wb, mockFormValues, mockPreferences);
    expect(result.errors).toContain('Error in Patterns headers');
  });

  test('detects invalid Layout headers', () => {
    const wb = createValidWorkbook();
    wb.Sheets.Layout = createMockWorksheet(['Invalid'], []);

    const result = echoInputValidation(wb, mockFormValues, mockPreferences);
    expect(result.errors).toContain('Error in Layout headers');
  });

  test('detects invalid Compounds headers', () => {
    const wb = createValidWorkbook();
    wb.Sheets.Compounds = createMockWorksheet(['Bad', 'Headers'], []);

    const result = echoInputValidation(wb, mockFormValues, mockPreferences);
    expect(result.errors).toContain('Error in Compounds headers');
  });

  test('detects invalid Barcodes headers', () => {
    const wb = createValidWorkbook();
    wb.Sheets.Barcodes = createMockWorksheet(['Nope'], []);

    const result = echoInputValidation(wb, mockFormValues, mockPreferences);
    expect(result.errors).toContain('Error in Barcodes headers');
  });
});

describe('echoInputValidation - Patterns Tab Validation', () => {
  test('detects duplicate pattern names', () => {
    const wb = createValidWorkbook();
    const duplicatePatterns = [
      ...validPatternsData,
      { Pattern: 'Treatment1', Type: 'Treatment', Direction: 'LR', Replicates: 1, Conc1: 100 }
    ];
    wb.Sheets.Patterns = createMockWorksheet(
      validHeaders.Patterns,
      duplicatePatterns
    );

    const result = echoInputValidation(wb, mockFormValues, mockPreferences);
    expect(result.errors.some(e => e.includes('is already present earlier'))).toBe(true);
  });

  test('detects invalid pattern type', () => {
    const wb = createValidWorkbook();
    const invalidTypePattern = [
      { Pattern: 'Invalid1', Type: 'InvalidType', Direction: 'LR', Replicates: 1, Conc1: 100 }
    ];
    wb.Sheets.Patterns = createMockWorksheet(
      validHeaders.Patterns,
      invalidTypePattern
    );

    const result = echoInputValidation(wb, mockFormValues, mockPreferences);
    expect(result.errors.some(e => e.includes('is not valid (must be Control, Treatment, Solvent, Combination, or Unused)'))).toBe(true);
  });

  test('detects invalid direction', () => {
    const wb = createValidWorkbook();
    const invalidDirectionPattern = [
      { Pattern: 'Invalid1', Type: 'Treatment', Direction: 'XX', Replicates: 1, Conc1: 100 }
    ];
    wb.Sheets.Patterns = createMockWorksheet(
      validHeaders.Patterns,
      invalidDirectionPattern
    );

    const result = echoInputValidation(wb, mockFormValues, mockPreferences);
    expect(result.errors.some(e => e.includes('is not valid (must be LR, RL, TB, or BT)'))).toBe(true);
  });

  test('detects invalid replicates', () => {
    const wb = createValidWorkbook();
    const invalidReplicatesPattern = [
      { Pattern: 'Invalid1', Type: 'Treatment', Direction: 'LR', Replicates: 'abc', Conc1: 100 }
    ];
    wb.Sheets.Patterns = createMockWorksheet(
      validHeaders.Patterns,
      invalidReplicatesPattern
    );

    const result = echoInputValidation(wb, mockFormValues, mockPreferences);
    expect(result.errors.some(e => e.includes('is not a valid integer'))).toBe(true);
  });

  test('detects invalid concentration values', () => {
    const wb = createValidWorkbook();
    const invalidConcPattern = [
      { Pattern: 'Invalid1', Type: 'Treatment', Direction: 'LR', Replicates: 1, Conc1: 'bad' }
    ];
    wb.Sheets.Patterns = createMockWorksheet(
      validHeaders.Patterns,
      invalidConcPattern
    );

    const result = echoInputValidation(wb, mockFormValues, mockPreferences);
    expect(result.errors.some(e => e.includes('is not a valid number'))).toBe(true);
  });

  test('validates combination pattern directions', () => {
    const wb = createValidWorkbook();
    const combinationPattern = [
      { Pattern: 'Combo1', Type: 'Combination', Direction: 'LR-TB', Replicates: 4, Conc1: 100, Conc2: 50, Conc3: 25, Conc4: 12.5 }
    ];
    const combinationLayout = [
      { Pattern: 'Combo1', 'Well Block': 'A01:D04' },
      { Pattern: 'Combo1', 'Well Block': 'A05:D08' }
    ];
    const combinationCompounds = [
      {
        'Source Barcode': 'SRC001',
        'Well ID': 'A01',
        'Concentration (µM)': 10000,
        'Compound ID': 'CPD001',
        'Volume (µL)': 50,
        'Pattern': 'Combo1'
      },
      {
        'Source Barcode': 'SRC001',
        'Well ID': 'A02',
        'Concentration (µM)': 10000,
        'Compound ID': 'CPD002',
        'Volume (µL)': 50,
        'Pattern': 'Combo1'
      }
    ]
    wb.Sheets.Patterns = createMockWorksheet(
      validHeaders.Patterns,
      combinationPattern
    );
    wb.Sheets.Layout = createMockWorksheet(
      validHeaders.Layout,
      combinationLayout
    );
    wb.Sheets.Compounds = createMockWorksheet(
      validHeaders.Compounds,
      combinationCompounds
    );

    const result = echoInputValidation(wb, mockFormValues, mockPreferences);
    expect(result.errors).toHaveLength(0);
  });

  test('detects insufficient combination pattern directions', () => {
    const wb = createValidWorkbook();
    const badComboPattern = [
      { Pattern: 'Combo1', Type: 'Combination', Direction: 'LR', Replicates: 1, Conc1: 100 }
    ];
    wb.Sheets.Patterns = createMockWorksheet(
      validHeaders.Patterns,
      badComboPattern
    );

    const result = echoInputValidation(wb, mockFormValues, mockPreferences);
    expect(result.errors.some(e => e.includes('need at least two'))).toBe(true);
  });
});

describe('echoInputValidation - Layout Tab Validation', () => {
  test('detects pattern not in Patterns tab', () => {
    const wb = createValidWorkbook();
    const invalidLayout = [
      { Pattern: 'NonExistent', 'Well Block': 'A01:A02' }
    ];
    wb.Sheets.Layout = createMockWorksheet(validHeaders.Layout, invalidLayout);

    const result = echoInputValidation(wb, mockFormValues, mockPreferences);
    expect(result.errors.some(e => e.includes('not present on Patterns tab'))).toBe(true);
  });

  test('detects well block size mismatch', () => {
    const wb = createValidWorkbook();
    // Treatment1 has 5 concs * 2 reps = 10 wells needed
    const mismatchLayout = [
      { Pattern: 'Treatment1', 'Well Block': 'A01:A05' } // Only 5 wells
    ];
    wb.Sheets.Layout = createMockWorksheet(validHeaders.Layout, mismatchLayout);

    const result = echoInputValidation(wb, mockFormValues, mockPreferences);
    expect(result.errors.some(e => e.includes('does not match with number of concentrations and replicates'))).toBe(true);
  });

  test('detects invalid well block format', () => {
    const wb = createValidWorkbook();
    const invalidWellBlock = [
      { Pattern: 'Treatment1', 'Well Block': 'InvalidWellBlock' }
    ];
    wb.Sheets.Layout = createMockWorksheet(validHeaders.Layout, invalidWellBlock);

    const result = echoInputValidation(wb, mockFormValues, mockPreferences);
    expect(result.errors.some(e => e.includes('is not valid'))).toBe(true);
  });

  test('detects well block outside plate bounds', () => {
    const wb = createValidWorkbook();
    const outOfBoundsLayout = [
      { Pattern: 'Treatment1', 'Well Block': 'A01:ZZ99' } // Beyond 384-well plate
    ];
    wb.Sheets.Layout = createMockWorksheet(validHeaders.Layout, outOfBoundsLayout);

    const result = echoInputValidation(wb, mockFormValues, mockPreferences);
    expect(result.errors.some(e => e.includes('does not fit on destination plate'))).toBe(true);
  });

  test('accepts valid unused pattern blocks', () => {
    const wb = createValidWorkbook();
    // Unused patterns don't need to match concentration/replicate counts
    const result = echoInputValidation(wb, mockFormValues, mockPreferences);
    expect(result.errors).toHaveLength(0);
  });
});

describe('echoInputValidation - Compounds Tab Validation', () => {
  test('detects missing compound ID', () => {
    const wb = createValidWorkbook();
    const missingIdCompound = [
      { 'Source Barcode': 'SRC001', 'Well ID': 'A01', 'Concentration (µM)': 10000, 'Compound ID': '', 'Volume (µL)': 50, 'Pattern': 'Treatment1' }
    ];
    wb.Sheets.Compounds = createMockWorksheet(
      validHeaders.Compounds,
      missingIdCompound
    );

    const result = echoInputValidation(wb, mockFormValues, mockPreferences);
    expect(result.errors.some(e => e.includes('lacks a compound ID'))).toBe(true);
  });

  test('detects missing source barcode', () => {
    const wb = createValidWorkbook();
    const missingBarcodeCompound = [
      { 'Source Barcode': '', 'Well ID': 'A01', 'Concentration (µM)': 10000, 'Compound ID': 'CPD001', 'Volume (µL)': 50, 'Pattern': 'Treatment1' }
    ];
    wb.Sheets.Compounds = createMockWorksheet(
      validHeaders.Compounds,
      missingBarcodeCompound
    );

    const result = echoInputValidation(wb, mockFormValues, mockPreferences);
    expect(result.errors.some(e => e.includes('lacks a source plate barcode'))).toBe(true);
  });

  test('detects duplicate well usage', () => {
    const wb = createValidWorkbook();
    const duplicateWellCompounds = [
      { 'Source Barcode': 'SRC001', 'Well ID': 'A01', 'Concentration (µM)': 10000, 'Compound ID': 'CPD001', 'Volume (µL)': 50, 'Pattern': 'Treatment1' },
      { 'Source Barcode': 'SRC001', 'Well ID': 'A01', 'Concentration (µM)': 10000, 'Compound ID': 'CPD002', 'Volume (µL)': 50, 'Pattern': 'Control1' }
    ];
    wb.Sheets.Compounds = createMockWorksheet(
      validHeaders.Compounds,
      duplicateWellCompounds
    );

    const result = echoInputValidation(wb, mockFormValues, mockPreferences);
    expect(result.errors.some(e => e.includes('which already has contents'))).toBe(true);
  });

  test('detects invalid volume', () => {
    const wb = createValidWorkbook();
    const invalidVolumeCompounds = [
      { 'Source Barcode': 'SRC001', 'Well ID': 'A01', 'Concentration (µM)': 10000, 'Compound ID': 'CPD001', 'Volume (µL)': -10, 'Pattern': 'Treatment1' }
    ];
    wb.Sheets.Compounds = createMockWorksheet(
      validHeaders.Compounds,
      invalidVolumeCompounds
    );

    const result = echoInputValidation(wb, mockFormValues, mockPreferences);
    expect(result.errors.some(e => e.includes('has a negative Volume'))).toBe(true);
  });

  test('detects non-numeric concentration', () => {
    const wb = createValidWorkbook();
    const invalidConcCompounds = [
      { 'Source Barcode': 'SRC001', 'Well ID': 'A01', 'Concentration (µM)': 'abc', 'Compound ID': 'CPD001', 'Volume (µL)': 50, 'Pattern': 'Treatment1' }
    ];
    wb.Sheets.Compounds = createMockWorksheet(
      validHeaders.Compounds,
      invalidConcCompounds
    );

    const result = echoInputValidation(wb, mockFormValues, mockPreferences);
    expect(result.errors.some(e => e.includes('has a non-number Concentration'))).toBe(true);
  });

  test('detects well block outside source plate bounds', () => {
    const wb = createValidWorkbook();
    const outOfBoundsCompound = [
      { 'Source Barcode': 'SRC001', 'Well ID': 'ZZ99', 'Concentration (µM)': 10000, 'Compound ID': 'CPD001', 'Volume (µL)': 50, 'Pattern': 'Treatment1' }
    ];
    wb.Sheets.Compounds = createMockWorksheet(
      validHeaders.Compounds,
      outOfBoundsCompound
    );

    const result = echoInputValidation(wb, mockFormValues, mockPreferences);
    expect(result.errors.some(e => e.includes('does not fit on source plate'))).toBe(true);
  });

  test('accepts DMSO without concentration requirement', () => {
    const wb = createValidWorkbook();
    // DMSO entries don't need concentration values
    const result = echoInputValidation(wb, mockFormValues, mockPreferences);
    expect(result.errors).toHaveLength(0);
  });
});

describe('echoInputValidation - Barcodes Tab Validation', () => {
  test('detects destination barcode used as source', () => {
    const wb = createValidWorkbook();
    const conflictingBarcodes = [
      { 'Intermediate Plate Barcodes': 'INT001', 'Destination Plate Barcodes': 'SRC001' } // SRC001 is used in compounds
    ];
    wb.Sheets.Barcodes = createMockWorksheet(
      validHeaders.Barcodes,
      conflictingBarcodes
    );

    const result = echoInputValidation(wb, mockFormValues, mockPreferences);
    expect(result.errors.some(e => e.includes('Destination barcode listed as a Source'))).toBe(true);
  });

  test('detects intermediate barcode used as source', () => {
    const wb = createValidWorkbook();
    const conflictingBarcodes = [
      { 'Intermediate Plate Barcodes': 'SRC001', 'Destination Plate Barcodes': 'DEST001' }
    ];
    wb.Sheets.Barcodes = createMockWorksheet(
      validHeaders.Barcodes,
      conflictingBarcodes
    );

    const result = echoInputValidation(wb, mockFormValues, mockPreferences);
    expect(result.errors.some(e => e.includes('Intermediate barcode listed as a Source'))).toBe(true);
  });

  test('detects duplicate destination barcodes', () => {
    const wb = createValidWorkbook();
    const duplicateBarcodes = [
      { 'Intermediate Plate Barcodes': 'INT001', 'Destination Plate Barcodes': 'DEST001' },
      { 'Intermediate Plate Barcodes': 'INT002', 'Destination Plate Barcodes': 'DEST001' }
    ];
    wb.Sheets.Barcodes = createMockWorksheet(
      validHeaders.Barcodes,
      duplicateBarcodes
    );

    const result = echoInputValidation(wb, mockFormValues, mockPreferences);
    expect(result.errors.some(e => e.includes('repeated Destination barcode'))).toBe(true);
  });

  test('detects duplicate intermediate barcodes', () => {
    const wb = createValidWorkbook();
    const duplicateBarcodes = [
      { 'Intermediate Plate Barcodes': 'INT001', 'Destination Plate Barcodes': 'DEST001' },
      { 'Intermediate Plate Barcodes': 'INT001', 'Destination Plate Barcodes': 'DEST002' }
    ];
    wb.Sheets.Barcodes = createMockWorksheet(
      validHeaders.Barcodes,
      duplicateBarcodes
    );

    const result = echoInputValidation(wb, mockFormValues, mockPreferences);
    expect(result.errors.some(e => e.includes('repeated Intermediate barcode'))).toBe(true);
  });
});

describe('echoInputValidation - Form Values Validation', () => {
  test('detects invalid form values', () => {
    const wb = createValidWorkbook();
    const invalidFormValues = {
      ...mockFormValues,
      'DMSO Tolerance': 'invalid'
    };

    const result = echoInputValidation(wb, invalidFormValues, mockPreferences);
    expect(result.errors.some(e => e.includes('Error in input form'))).toBe(true);
  });

  test('populates CommonData correctly with valid form values', () => {
    const wb = createValidWorkbook();
    const result = echoInputValidation(wb, mockFormValues, mockPreferences);

    expect(result.inputData.CommonData).toEqual({
      maxDMSOFraction: 0.005,
      finalAssayVolume: 25,
      intermediateBackfillVolume: 10,
      allowableError: 0.1,
      destReplicates: 1,
      createIntConcs: true,
      dmsoNormalization: true,
      evenDepletion: false,
      updateFromSurveyVolumes: false
    });
  });
});

describe('echoInputValidation - String Conversion', () => {
  test('converts numeric values to strings where needed', () => {
    const wb = createValidWorkbook();
    // Add numeric pattern names and compound IDs
    const numericPatterns = [
      { Pattern: 123, Type: 'Treatment', Direction: 'LR', Replicates: 1, Conc1: 100 }
    ];
    wb.Sheets.Patterns = createMockWorksheet(
      ['Pattern', 'Type', 'Direction', 'Replicates', 'Conc1', 'Conc2', 'Conc3', 'Conc4', 'Conc5', 'Conc6', 'Conc7', 'Conc8', 'Conc9', 'Conc10', 'Conc11', 'Conc12', 'Conc13', 'Conc14', 'Conc15', 'Conc16', 'Conc17', 'Conc18', 'Conc19', 'Conc20'],
      numericPatterns
    );

    const numericCompounds = [
      { 'Source Barcode': 12345, 'Well ID': 'A01', 'Concentration (µM)': 10000, 'Compound ID': 67890, 'Volume (µL)': 50, 'Pattern': 123 }
    ];
    wb.Sheets.Compounds = createMockWorksheet(
      validHeaders.Compounds,
      numericCompounds
    );

    const result = echoInputValidation(wb, mockFormValues, mockPreferences);

    expect(typeof result.inputData.Patterns[0].Pattern).toBe('string');
    expect(result.inputData.Patterns[0].Pattern).toBe('123');
    expect(typeof result.inputData.Compounds[0]['Compound ID']).toBe('string');
    expect(result.inputData.Compounds[0]['Compound ID']).toBe('67890');
    expect(typeof result.inputData.Compounds[0]['Source Barcode']).toBe('string');
    expect(result.inputData.Compounds[0]['Source Barcode']).toBe('12345');
  });
});

describe('echoInputValidation - Edge Cases', () => {
  test('handles empty data arrays', () => {
    const wb = createValidWorkbook();
    wb.Sheets.Patterns = createMockWorksheet(
      ['Pattern', 'Type', 'Direction', 'Replicates', 'Conc1', 'Conc2', 'Conc3', 'Conc4', 'Conc5', 'Conc6', 'Conc7', 'Conc8', 'Conc9', 'Conc10', 'Conc11', 'Conc12', 'Conc13', 'Conc14', 'Conc15', 'Conc16', 'Conc17', 'Conc18', 'Conc19', 'Conc20'],
      []
    );
    wb.Sheets.Layout = createMockWorksheet(validHeaders.Layout, []);
    wb.Sheets.Compounds = createMockWorksheet(
      validHeaders.Compounds,
      []
    );
    wb.Sheets.Barcodes = createMockWorksheet(
      validHeaders.Barcodes,
      []
    );

    const result = echoInputValidation(wb, mockFormValues, mockPreferences);
    expect(result.errors).toHaveLength(0);
    expect(result.inputData.Patterns).toHaveLength(0);
  });

  test('handles multi-block well specifications', () => {
    const wb = createValidWorkbook();
    const multiBlockLayout = [
      { Pattern: 'Treatment1', 'Well Block': 'A01:A05;C01:C05' } // 10 wells total
    ];
    wb.Sheets.Layout = createMockWorksheet(validHeaders.Layout, multiBlockLayout);

    const result = echoInputValidation(wb, mockFormValues, mockPreferences);
    expect(result.errors).toHaveLength(0);
  });

  test('handles different plate sizes', () => {
    // Test with 96-well plate preference
    const smallPlatePrefs = { ...mockPreferences, sourcePlateSize: '96', destinationPlateSize: '96' };
    const wb = createValidWorkbook();

    // This well is valid for 384 but not for 96
    const outOfBoundsFor96 = [
      { Pattern: 'Treatment1', 'Well Block': 'I13:I14' } // Row I, Col 13-14 - outside 96-well
    ];
    wb.Sheets.Layout = createMockWorksheet(validHeaders.Layout, outOfBoundsFor96);

    const result = echoInputValidation(wb, mockFormValues, smallPlatePrefs);
    expect(result.errors.some(e => e.includes('does not fit on destination plate'))).toBe(true);
  });
});