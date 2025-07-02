import { CompoundGroup, ConcentrationObj, EchoPreCalculator } from '../EchoPreCalculatorClass';
import { CheckpointTracker } from '../CheckpointTrackerClass';
import { buildSrcCompoundInventory, InputDataType } from '../../utils/echoUtils';
import { PreferencesState } from '../../../../hooks/usePreferences';
import { PlateSize } from '../../../../classes/PlateClass';
import { DilutionPattern } from '../../../../classes/PatternClass';

// Minimal mock for PreferencesState
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
  updateFromSurveyVolumes: false
};

// Helper to create minimal InputDataType
function createMockInputData(compounds?: InputDataType['Compounds'], patterns?: InputDataType['Patterns'], layout?: InputDataType['Layout'], barcodes?: InputDataType['Barcodes']): InputDataType {
  return {
    Compounds: compounds || [],
    Patterns: patterns || [],
    Layout: layout || [],
    Barcodes: barcodes || [],
    CommonData: {
      maxDMSOFraction: 0.005,
      finalAssayVolume: 25,
      intermediateBackfillVolume: 10,
      allowableError: 0.1,
      destReplicates: 1,
      createIntConcs: true,
      dmsoNormalization: true,
      evenDepletion: false,
      updateFromSurveyVolumes: false
    }
  }
};

describe('EchoPreCalculatorClass - Dead Volume Logic', () => {
  describe('Initial Dead Volume Calculation', () => {
    it('should set dead volume to 2500 nL if all compound volumes are <= 15 µL for a plate', () => {
      const mockInput: InputDataType = createMockInputData([
        { 'Source Barcode': 'P1', 'Well ID': 'A1', 'Volume (µL)': 10, 'Concentration (µM)': 100, 'Compound ID': 'C1', 'Pattern': 'Pattern1' },
        { 'Source Barcode': 'P1', 'Well ID': 'B1', 'Volume (µL)': 15, 'Concentration (µM)': 100, 'Compound ID': 'C2', 'Pattern': 'Pattern1' },
      ]);
      const preCalc = new EchoPreCalculator(mockInput, new CheckpointTracker(), mockPreferences);
      expect(preCalc.plateDeadVolumes.get('P1')).toBe(2500);
    });

    it('should set dead volume to 15000 nL if any compound volume is > 15 µL for a plate', () => {
      const mockInput: InputDataType = createMockInputData([
        { 'Source Barcode': 'P1', 'Well ID': 'A1', 'Volume (µL)': 10, 'Concentration (µM)': 100, 'Compound ID': 'C1', 'Pattern': 'Pattern1' },
        { 'Source Barcode': 'P1', 'Well ID': 'B1', 'Volume (µL)': 20, 'Concentration (µM)': 100, 'Compound ID': 'C2', 'Pattern': 'Pattern1' }, // > 15 µL
      ]);
      const preCalc = new EchoPreCalculator(mockInput, new CheckpointTracker(), mockPreferences);
      expect(preCalc.plateDeadVolumes.get('P1')).toBe(15000);
    });

    it('should correctly set dead volumes for multiple plates with different conditions', () => {
      const mockInput: InputDataType = createMockInputData([
        { 'Source Barcode': 'P1', 'Well ID': 'A1', 'Volume (µL)': 10, 'Concentration (µM)': 100, 'Compound ID': 'C1', 'Pattern': 'Pattern1' }, // P1 <= 15 µL
        { 'Source Barcode': 'P2', 'Well ID': 'A1', 'Volume (µL)': 20, 'Concentration (µM)': 100, 'Compound ID': 'C3', 'Pattern': 'Pattern2' }, // P2 > 15 µL
        { 'Source Barcode': 'P1', 'Well ID': 'B1', 'Volume (µL)': 5, 'Concentration (µM)': 100, 'Compound ID': 'C2', 'Pattern': 'Pattern1' },  // P1 <= 15 µL
        { 'Source Barcode': 'P3', 'Well ID': 'C1', 'Volume (µL)': 15, 'Concentration (µM)': 100, 'Compound ID': 'C4', 'Pattern': 'Pattern3' }, // P3 <= 15 µL
      ]);
      const preCalc = new EchoPreCalculator(mockInput, new CheckpointTracker(), mockPreferences);
      expect(preCalc.plateDeadVolumes.get('P1')).toBe(2500);
      expect(preCalc.plateDeadVolumes.get('P2')).toBe(15000);
      expect(preCalc.plateDeadVolumes.get('P3')).toBe(2500);
    });

    it('should handle a source plate with no compounds (empty plateDeadVolumes for it)', () => {
      const mockInput: InputDataType = createMockInputData([]); // No compounds
      const preCalc = new EchoPreCalculator(mockInput, new CheckpointTracker(), mockPreferences);
      // Expect plateDeadVolumes to be empty or not contain entries for plates not in Compounds
      expect(preCalc.plateDeadVolumes.size).toBe(0);

      const mockInputWithOtherPlate: InputDataType = createMockInputData([
        { 'Source Barcode': 'P1', 'Well ID': 'A1', 'Volume (µL)': 10, 'Concentration (µM)': 100, 'Compound ID': 'C1', 'Pattern': 'Pattern1' },
      ]);
      // Add an empty 'Compounds' entry for P2 to simulate it being mentioned but having no listed compounds,
      // though the current logic derives plates from Compounds array.
      // If P2 is not in Compounds, it won't have an entry in plateDeadVolumes.
      const preCalc2 = new EchoPreCalculator(mockInputWithOtherPlate, new CheckpointTracker(), mockPreferences);
      expect(preCalc2.plateDeadVolumes.get('P1')).toBe(2500);
      expect(preCalc2.plateDeadVolumes.has('P2')).toBe(false);
    });

    it('should default to 2500nL if compound volume is exactly 15µL', () => {
      const mockInput: InputDataType = createMockInputData([
        { 'Source Barcode': 'P1', 'Well ID': 'A1', 'Volume (µL)': 15, 'Concentration (µM)': 100, 'Compound ID': 'C1', 'Pattern': 'Pattern1' },
      ]);
      const preCalc = new EchoPreCalculator(mockInput, new CheckpointTracker(), mockPreferences);
      expect(preCalc.plateDeadVolumes.get('P1')).toBe(2500);
    });
  });

  describe('checkSourceVolumes with Per-Plate Dead Volumes', () => {
    // Minimal setup for checkSourceVolumes tests
    const setupPreCalcForVolumeChecks = (
      compounds: InputDataType['Compounds'],
      initialPlateDeadVolumes?: Map<string, number>,
      patterns?: InputDataType['Patterns']
    ): EchoPreCalculator => {
      const mockInput = createMockInputData(compounds);
      if (patterns) {
        mockInput.Patterns = patterns;
      }
      // Mock common data to simplify, actual values might need adjustment per test
      mockInput.CommonData = {
        maxDMSOFraction: 0.01,
        finalAssayVolume: 10000, //nL
        intermediateBackfillVolume: 5000, //nL
        allowableError: 0.1,
        destReplicates: 1,
        createIntConcs: false, // Simplify by not creating intermediate concs for these tests
        dmsoNormalization: false,
        evenDepletion: false,
        updateFromSurveyVolumes: false
      };

      const preCalc = new EchoPreCalculator(mockInput, new CheckpointTracker(), mockPreferences);

      // Override plateDeadVolumes if provided, otherwise they are set by constructor
      if (initialPlateDeadVolumes) {
        preCalc.plateDeadVolumes = new Map(initialPlateDeadVolumes);
      }

      // Manually build srcCompoundInventory and dilutionPatterns as calculateNeeds() is complex to fully mock/run
      // For these tests, we primarily care that checkSourceVolumes uses the dead volumes correctly.
      preCalc.srcCompoundInventory = buildSrcCompoundInventory(mockInput, preCalc.srcPltSize)

      // Ensure dilutionPatterns are created for patterns present in the compounds
      preCalc.dilutionPatterns = new Map();
      compounds.forEach(c => {
        const patternNames = c.Pattern.split(';').map(p => p.trim());
        patternNames.forEach(patternName => {
          if (!preCalc.dilutionPatterns.has(patternName)) {
            preCalc.dilutionPatterns.set(patternName, {
              patternName: patternName,
              type: 'Treatment', // Default mock type
              direction: ['LR'],
              replicates: 1,
              concentrations: [c['Concentration (µM)']], // Use actual conc from compound
              fold: 0,
            });
          }
        });
      });

      // Mock totalVolumes to simulate that calculateTransferVolumes has run
      // This needs to reflect volumes *required* for transfers
      preCalc.totalVolumes = new Map();
      compounds.forEach(c => {
        if (!preCalc.totalVolumes.has(c['Compound ID'])) {
          preCalc.totalVolumes.set(c['Compound ID'], new Map());
        }
        const compoundPatterns = c.Pattern.split(';').map(p => p.trim());
        compoundPatterns.forEach(patternName => {
          const patternMap = preCalc.totalVolumes.get(c['Compound ID'])!;
          if (!patternMap.has(patternName)) {
            patternMap.set(patternName, new Map());
          }
          const concMap = patternMap.get(patternName)!;
          // Required volume: Default to 1000 nL, can be overridden in specific tests
          concMap.set(c['Concentration (µM)'], 1000);
        });
      });

      return preCalc;
    };

    it('should pass if available volume (after per-plate dead volume) is sufficient', () => {
      const compounds: InputDataType['Compounds'] = [
        { 'Source Barcode': 'P1', 'Well ID': 'A1', 'Volume (µL)': 5, 'Concentration (µM)': 10, 'Compound ID': 'C1', 'Pattern': 'TestPattern' },
      ];
      // Dead volume for P1 is 2500nL (2.5uL). Available: 5000 - 2500 = 2500nL. Required: 1000nL.
      const preCalc = setupPreCalcForVolumeChecks(compounds, new Map([['P1', 2500]]));
      preCalc.checkSourceVolumes('volumeCheck');
      const checkpoint = preCalc.checkpointTracker.getCheckpoint('volumeCheck');
      expect(checkpoint?.status).toBe('Passed');
    });

    it('should issue a warning if available volume (after per-plate dead volume) is insufficient', () => {
      const compounds: InputDataType['Compounds'] = [
        { 'Source Barcode': 'P1', 'Well ID': 'A1', 'Volume (µL)': 3, 'Concentration (µM)': 10, 'Compound ID': 'C1', 'Pattern': 'TestPattern' },
      ];
      const preCalc = setupPreCalcForVolumeChecks(compounds, new Map([['P1', 2500]]));
      // Dead volume for P1 is 2500nL (2.5uL). Available: 3000 - 2500 = 500nL.
      // Set required volume to be greater than available.
      preCalc.totalVolumes.get('C1')?.get('TestPattern')?.set(10, 600); // Require 600, have 500.

      preCalc.checkSourceVolumes('volumeCheck');
      const checkpoint = preCalc.checkpointTracker.getCheckpoint('volumeCheck');
      expect(checkpoint?.status).toBe('Warning');
      expect(checkpoint?.message[0]).toContain('Insufficient source volume of C1 for TestPattern at 10µM');
    });

    it('should find dead volume even if plate barcode is unexpectedly missing from plateDeadVolumes', () => {
      const compounds: InputDataType['Compounds'] = [
        // P1's dead volume will be missing from plateDeadVolumes map
        { 'Source Barcode': 'P1', 'Well ID': 'A1', 'Volume (µL)': 5, 'Concentration (µM)': 10, 'Compound ID': 'C1', 'Pattern': 'TestPattern' },
      ];
      const preCalc = setupPreCalcForVolumeChecks(compounds, new Map()); // Empty map means P1 is missing

      preCalc.checkSourceVolumes('volumeCheck');
      const checkpoint = preCalc.checkpointTracker.getCheckpoint('volumeCheck');
      expect(checkpoint?.status).toBe('Passed');

      const compoundsInsufficient: InputDataType['Compounds'] = [
        { 'Source Barcode': 'P2', 'Well ID': 'A1', 'Volume (µL)': 0.5, 'Concentration (µM)': 10, 'Compound ID': 'C2', 'Pattern': 'TestPattern' },
      ];
      const preCalcInsufficient = setupPreCalcForVolumeChecks(compoundsInsufficient, new Map()); // P2's dead vol is missing
      preCalcInsufficient.totalVolumes.get('C2')?.get('TestPattern')?.set(10, 500);

      preCalcInsufficient.checkSourceVolumes('volumeCheckInsufficient');
      const checkpointInsufficient = preCalcInsufficient.checkpointTracker.getCheckpoint('volumeCheckInsufficient');
      expect(checkpointInsufficient?.status).toBe('Warning');
      expect(checkpointInsufficient?.message[0]).toContain('Insufficient uncommitted volume of C2');
    });

    it('should correctly use different dead volumes for different plates in checkSourceVolumes', () => {
      const compounds: InputDataType['Compounds'] = [
        { 'Source Barcode': 'P1', 'Well ID': 'A1', 'Volume (µL)': 5, 'Concentration (µM)': 10, 'Compound ID': 'C1', 'Pattern': 'TestPattern1' },
        { 'Source Barcode': 'P2', 'Well ID': 'B1', 'Volume (µL)': 16, 'Concentration (µM)': 10, 'Compound ID': 'C2', 'Pattern': 'TestPattern2' },
        { 'Source Barcode': 'P3', 'Well ID': 'C1', 'Volume (µL)': 2, 'Concentration (µM)': 10, 'Compound ID': 'C3', 'Pattern': 'TestPattern3' },
      ];
      const preCalc = setupPreCalcForVolumeChecks(
        compounds,
        new Map([['P1', 2500], ['P2', 15000], ['P3', 2500]]) // P3 dead vol = 2500
      );
      // P1: dead=2500, vol=5000, avail=2500. Required by default setup is 1000 -> OK
      // P2: dead=15000, vol=16000, avail=1000. Required by default setup is 1000 -> OK
      // P3: dead=2500, vol=2000, avail=-500. Required by default setup is 1000 -> Warn
      // No need to adjust totalVolumes here as the default 1000nL requirement for P3 will make it fail.

      preCalc.checkSourceVolumes('volumeCheckMulti');
      const checkpoint = preCalc.checkpointTracker.getCheckpoint('volumeCheckMulti');
      expect(checkpoint?.status).toBe('Warning'); // Because P3 is insufficient
      expect(checkpoint?.message.length).toBe(1);
      expect(checkpoint?.message[0]).toContain('Insufficient uncommitted volume of C3'); // Corrected message check
    });
  });

  describe('updateDeadVolume Method', () => {
    it('should update plateDeadVolumes for the specified barcode', () => {
      const mockInput = createMockInputData([
        { 'Source Barcode': 'P1', 'Well ID': 'A1', 'Volume (µL)': 10, 'Concentration (µM)': 100, 'Compound ID': 'C1', 'Pattern': 'P1' },
      ]);
      const preCalc = new EchoPreCalculator(mockInput, new CheckpointTracker(), mockPreferences);
      expect(preCalc.plateDeadVolumes.get('P1')).toBe(2500); // Initial

      preCalc.updateDeadVolume('P1', 5000); // Update to 5000 nL
      expect(preCalc.plateDeadVolumes.get('P1')).toBe(5000);
    });

    it('should re-run calculateNeeds (implicitly checking source volumes again)', () => {
      const mockInput = createMockInputData([
        { 'Source Barcode': 'P1', 'Well ID': 'A1', 'Volume (µL)': 6, 'Concentration (µM)': 10, 'Compound ID': 'C1', 'Pattern': 'TestPattern' },
      ]);
      const preCalc = new EchoPreCalculator(mockInput, new CheckpointTracker(), mockPreferences);
      // Initial dead volume for P1 is 2500 nL. Volume is 6000 nL.
      // Available: 6000 - 2500 = 3500 nL.
      // Assuming totalVolumes will require 3000 nL for C1 TestPattern @ 10uM.
      preCalc.totalVolumes = new Map([['C1', new Map([['TestPattern', new Map([[10, 3000]])]])]]);
      preCalc.srcCompoundInventory = buildSrcCompoundInventory(mockInput, preCalc.srcPltSize); // Ensure inventory is built
      // Ensure mock dilutionPatterns are set up before checkSourceVolumes is called or calculateNeeds is mocked/run
      if (!preCalc.dilutionPatterns.has('TestPattern') && preCalc.srcCompoundInventory.has('C1') && preCalc.srcCompoundInventory.get('C1')!.has('TestPattern')) {
        preCalc.dilutionPatterns.set('TestPattern', {
          patternName: 'TestPattern',
          type: 'Treatment',
          direction: ['LR'],
          replicates: 1,
          concentrations: [10],
          fold: 0
        });
      }

      // Add checkpoint *before* first check
      preCalc.checkpointTracker.addCheckpoint("Sufficient Source Volumes");
      preCalc.checkSourceVolumes("Sufficient Source Volumes");
      expect(preCalc.checkpointTracker.getCheckpoint("Sufficient Source Volumes")?.status).toBe("Passed");

      // Mock calculateNeeds to isolate the test to checkSourceVolumes being called
      // with the new dead volume, without fully re-calculating totalVolumes.
      const originalCalculateNeeds = preCalc.calculateNeeds;
      preCalc.calculateNeeds = jest.fn(() => {
        // We want to ensure checkSourceVolumes is called within calculateNeeds' flow
        // using the existing totalVolumes but the new dead volume.
        // The actual calculateNeeds would re-evaluate totalVolumes, which makes this test too complex.
        // For this test, we assume totalVolumes requirement (3000nL) remains constant.
        preCalc.checkSourceVolumes("Sufficient Source Volumes");
      });

      // Update dead volume to 4000 nL. Available: 6000 - 4000 = 2000 nL. Required: 3000 nL. -> Should warn
      preCalc.updateDeadVolume('P1', 4000);

      expect(preCalc.calculateNeeds).toHaveBeenCalled(); // Verify our mock was called
      const updatedCheckpoint = preCalc.checkpointTracker.getCheckpoint("Sufficient Source Volumes");
      expect(updatedCheckpoint?.status).toBe('Warning');
      preCalc.calculateNeeds = originalCalculateNeeds; // Restore original method
      expect(updatedCheckpoint?.message[0]).toContain('Insufficient source volume of C1');
    });

    it('should handle updating dead volume for a plate not initially present (should not error, effectively adds it)', () => {
      const mockInput = createMockInputData([]);
      const preCalc = new EchoPreCalculator(mockInput, new CheckpointTracker(), mockPreferences);
      expect(preCalc.plateDeadVolumes.has('P_NEW')).toBe(false);

      // Mock calculateNeeds or parts of it if it would fail due to P_NEW not being in srcInventory etc.
      // For this test, we primarily care that plateDeadVolumes is updated.
      // The subsequent calculateNeeds might produce warnings/errors if P_NEW isn't fully accounted for in inputData,
      // but updateDeadVolume itself shouldn't crash.
      const mockCalculateNeeds = jest.fn();
      preCalc.calculateNeeds = mockCalculateNeeds;

      preCalc.updateDeadVolume('P_NEW', 7000);
      expect(preCalc.plateDeadVolumes.get('P_NEW')).toBe(7000);
      expect(mockCalculateNeeds).toHaveBeenCalled();
    });
  });
});
describe('buildSrcCompoundInventory', () => {
  describe('Basic Functionality', () => {
    it('should create empty inventory for empty input', () => {
      const inputData = createMockInputData([]); // Empty compounds array
      const inventory = buildSrcCompoundInventory(inputData, '384');

      expect(inventory.size).toBe(0);
    });

    it('should create inventory for single compound with single pattern', () => {
      const compounds: InputDataType['Compounds'] = [
        {
          'Source Barcode': 'SRC001',
          'Well ID': 'A01',
          'Compound ID': 'Compound1',
          'Concentration (µM)': 1000,
          'Volume (µL)': 50,
          'Pattern': 'Treatment1'
        }
      ];
      const inputData = createMockInputData(compounds);
      const inventory = buildSrcCompoundInventory(inputData, '384');

      expect(inventory.size).toBe(1);
      expect(inventory.has('Compound1')).toBe(true);

      const compound1Patterns = inventory.get('Compound1')!;
      expect(compound1Patterns.size).toBe(1);
      expect(compound1Patterns.has('Treatment1')).toBe(true);

      const treatment1Group = compound1Patterns.get('Treatment1')!;
      expect(treatment1Group.locations).toHaveLength(1);

      const location = treatment1Group.locations[0];
      expect(location.barcode).toBe('SRC001');
      expect(location.wellId).toBe('A01');
      expect(location.volume).toBe(50000); // 50 µL converted to nL
      expect(location.concentration).toBe(1000);
    });

    it('should handle multiple compounds', () => {
      const compounds: InputDataType['Compounds'] = [
        {
          'Source Barcode': 'SRC001',
          'Well ID': 'A01',
          'Compound ID': 'Compound1',
          'Concentration (µM)': 1000,
          'Volume (µL)': 50,
          'Pattern': 'Treatment1'
        },
        {
          'Source Barcode': 'SRC001',
          'Well ID': 'B01',
          'Compound ID': 'Compound2',
          'Concentration (µM)': 500,
          'Volume (µL)': 25,
          'Pattern': 'Treatment2'
        }
      ];
      const inputData = createMockInputData(compounds);
      const inventory = buildSrcCompoundInventory(inputData, '384');

      expect(inventory.size).toBe(2);
      expect(inventory.has('Compound1')).toBe(true);
      expect(inventory.has('Compound2')).toBe(true);

      // Verify Compound1
      const compound1 = inventory.get('Compound1')!.get('Treatment1')!;
      expect(compound1.locations[0].concentration).toBe(1000);
      expect(compound1.locations[0].volume).toBe(50000);

      // Verify Compound2
      const compound2 = inventory.get('Compound2')!.get('Treatment2')!;
      expect(compound2.locations[0].concentration).toBe(500);
      expect(compound2.locations[0].volume).toBe(25000);
    });
  });

  describe('Pattern Handling', () => {
    it('should handle single compound with multiple patterns (semicolon-separated)', () => {
      const compounds: InputDataType['Compounds'] = [
        {
          'Source Barcode': 'SRC001',
          'Well ID': 'A01',
          'Compound ID': 'Compound1',
          'Concentration (µM)': 1000,
          'Volume (µL)': 50,
          'Pattern': 'Treatment1;Control1'
        }
      ];
      const inputData = createMockInputData(compounds);
      const inventory = buildSrcCompoundInventory(inputData, '384');

      expect(inventory.size).toBe(1);
      const compound1Patterns = inventory.get('Compound1')!;
      expect(compound1Patterns.size).toBe(2);
      expect(compound1Patterns.has('Treatment1')).toBe(true);
      expect(compound1Patterns.has('Control1')).toBe(true);

      // Both patterns should have the same location data
      const treatment1 = compound1Patterns.get('Treatment1')!;
      const control1 = compound1Patterns.get('Control1')!;

      expect(treatment1.locations).toHaveLength(1);
      expect(control1.locations).toHaveLength(1);
      expect(treatment1.locations[0]).toEqual(control1.locations[0]);
    });

    it('should handle patterns with whitespace around semicolons', () => {
      const compounds: InputDataType['Compounds'] = [
        {
          'Source Barcode': 'SRC001',
          'Well ID': 'A01',
          'Compound ID': 'Compound1',
          'Concentration (µM)': 1000,
          'Volume (µL)': 50,
          'Pattern': 'Treatment1 ; Control1 ; Treatment2'
        }
      ];
      const inputData = createMockInputData(compounds);
      const inventory = buildSrcCompoundInventory(inputData, '384');

      const compound1Patterns = inventory.get('Compound1')!;
      expect(compound1Patterns.size).toBe(3);
      expect(compound1Patterns.has('Treatment1')).toBe(true);
      expect(compound1Patterns.has('Control1')).toBe(true);
      expect(compound1Patterns.has('Treatment2')).toBe(true);
    });

    it('should handle same compound appearing in different rows with different patterns', () => {
      const compounds: InputDataType['Compounds'] = [
        {
          'Source Barcode': 'SRC001',
          'Well ID': 'A01',
          'Compound ID': 'Compound1',
          'Concentration (µM)': 1000,
          'Volume (µL)': 50,
          'Pattern': 'Treatment1'
        },
        {
          'Source Barcode': 'SRC001',
          'Well ID': 'B01',
          'Compound ID': 'Compound1',
          'Concentration (µM)': 500,
          'Volume (µL)': 25,
          'Pattern': 'Control1'
        }
      ];
      const inputData = createMockInputData(compounds);
      const inventory = buildSrcCompoundInventory(inputData, '384');

      expect(inventory.size).toBe(1);
      const compound1Patterns = inventory.get('Compound1')!;
      expect(compound1Patterns.size).toBe(2);

      const treatment1 = compound1Patterns.get('Treatment1')!;
      const control1 = compound1Patterns.get('Control1')!;

      expect(treatment1.locations).toHaveLength(1);
      expect(control1.locations).toHaveLength(1);

      expect(treatment1.locations[0].wellId).toBe('A01');
      expect(treatment1.locations[0].concentration).toBe(1000);
      expect(treatment1.locations[0].volume).toBe(50000);

      expect(control1.locations[0].wellId).toBe('B01');
      expect(control1.locations[0].concentration).toBe(500);
      expect(control1.locations[0].volume).toBe(25000);
    });

    it('should add to existing pattern when same compound-pattern combination appears multiple times', () => {
      const compounds: InputDataType['Compounds'] = [
        {
          'Source Barcode': 'SRC001',
          'Well ID': 'A01',
          'Compound ID': 'Compound1',
          'Concentration (µM)': 1000,
          'Volume (µL)': 50,
          'Pattern': 'Treatment1'
        },
        {
          'Source Barcode': 'SRC001',
          'Well ID': 'B01',
          'Compound ID': 'Compound1',
          'Concentration (µM)': 1000,
          'Volume (µL)': 50,
          'Pattern': 'Treatment1'
        }
      ];
      const inputData = createMockInputData(compounds);
      const inventory = buildSrcCompoundInventory(inputData, '384');

      expect(inventory.size).toBe(1);
      const compound1Patterns = inventory.get('Compound1')!;
      expect(compound1Patterns.size).toBe(1);

      const treatment1 = compound1Patterns.get('Treatment1')!;
      expect(treatment1.locations).toHaveLength(2);

      expect(treatment1.locations[0].wellId).toBe('A01');
      expect(treatment1.locations[1].wellId).toBe('B01');
    });
  });

  describe('Well Block Parsing', () => {
    it('should handle single well notation', () => {
      const compounds: InputDataType['Compounds'] = [
        {
          'Source Barcode': 'SRC001',
          'Well ID': 'A01',
          'Compound ID': 'Compound1',
          'Concentration (µM)': 1000,
          'Volume (µL)': 50,
          'Pattern': 'Treatment1'
        }
      ];
      const inputData = createMockInputData(compounds);
      const inventory = buildSrcCompoundInventory(inputData, '384');

      const locations = inventory.get('Compound1')!.get('Treatment1')!.locations;
      expect(locations).toHaveLength(1);
      expect(locations[0].wellId).toBe('A01');
    });

    it('should handle well range notation (A01:A03)', () => {
      const compounds: InputDataType['Compounds'] = [
        {
          'Source Barcode': 'SRC001',
          'Well ID': 'A01:A03',
          'Compound ID': 'Compound1',
          'Concentration (µM)': 1000,
          'Volume (µL)': 50,
          'Pattern': 'Treatment1'
        }
      ];
      const inputData = createMockInputData(compounds);
      const inventory = buildSrcCompoundInventory(inputData, '384');

      const locations = inventory.get('Compound1')!.get('Treatment1')!.locations;
      expect(locations).toHaveLength(3);

      const wellIds = locations.map(loc => loc.wellId).sort();
      expect(wellIds).toEqual(['A01', 'A02', 'A03']);

      // All should have same properties except wellId
      locations.forEach(location => {
        expect(location.barcode).toBe('SRC001');
        expect(location.concentration).toBe(1000);
        expect(location.volume).toBe(50000);
      });
    });

    it('should handle rectangular well block notation (A01:B02)', () => {
      const compounds: InputDataType['Compounds'] = [
        {
          'Source Barcode': 'SRC001',
          'Well ID': 'A01:B02',
          'Compound ID': 'Compound1',
          'Concentration (µM)': 1000,
          'Volume (µL)': 50,
          'Pattern': 'Treatment1'
        }
      ];
      const inputData = createMockInputData(compounds);
      const inventory = buildSrcCompoundInventory(inputData, '384');

      const locations = inventory.get('Compound1')!.get('Treatment1')!.locations;
      expect(locations).toHaveLength(4);

      const wellIds = locations.map(loc => loc.wellId).sort();
      expect(wellIds).toEqual(['A01', 'A02', 'B01', 'B02']);
    });

    it('should handle semicolon-separated well blocks (A01:A02;C01:C02)', () => {
      const compounds: InputDataType['Compounds'] = [
        {
          'Source Barcode': 'SRC001',
          'Well ID': 'A01:A02;C01:C02',
          'Compound ID': 'Compound1',
          'Concentration (µM)': 1000,
          'Volume (µL)': 50,
          'Pattern': 'Treatment1'
        }
      ];
      const inputData = createMockInputData(compounds);
      const inventory = buildSrcCompoundInventory(inputData, '384');

      const locations = inventory.get('Compound1')!.get('Treatment1')!.locations;
      expect(locations).toHaveLength(4);

      const wellIds = locations.map(loc => loc.wellId).sort();
      expect(wellIds).toEqual(['A01', 'A02', 'C01', 'C02']);
    });
  });

  describe('Volume and Concentration Handling', () => {
    it('should correctly convert volume from µL to nL', () => {
      const testCases = [
        { volumeUL: 1, expectedNL: 1000 },
        { volumeUL: 0.5, expectedNL: 500 },
        { volumeUL: 100, expectedNL: 100000 },
        { volumeUL: 0.001, expectedNL: 1 }
      ];

      testCases.forEach(({ volumeUL, expectedNL }) => {
        const compounds: InputDataType['Compounds'] = [
          {
            'Source Barcode': 'SRC001',
            'Well ID': 'A01',
            'Compound ID': 'TestCompound',
            'Concentration (µM)': 1000,
            'Volume (µL)': volumeUL,
            'Pattern': 'Treatment1'
          }
        ];
        const inputData = createMockInputData(compounds);
        const inventory = buildSrcCompoundInventory(inputData, '384');

        const location = inventory.get('TestCompound')!.get('Treatment1')!.locations[0];
        expect(location.volume).toBe(expectedNL);
      });
    });

    it('should preserve concentration values', () => {
      const testConcentrations = [1000, 500.5, 0.001, 10000];

      testConcentrations.forEach(concentration => {
        const compounds: InputDataType['Compounds'] = [
          {
            'Source Barcode': 'SRC001',
            'Well ID': 'A01',
            'Compound ID': 'TestCompound',
            'Concentration (µM)': concentration,
            'Volume (µL)': 50,
            'Pattern': 'Treatment1'
          }
        ];
        const inputData = createMockInputData(compounds);
        const inventory = buildSrcCompoundInventory(inputData, '384');

        const location = inventory.get('TestCompound')!.get('Treatment1')!.locations[0];
        expect(location.concentration).toBe(concentration);
      });
    });
  });

  describe('Plate Size Handling', () => {
    it('should work with different plate sizes', () => {
      const compounds: InputDataType['Compounds'] = [
        {
          'Source Barcode': 'SRC001',
          'Well ID': 'A01:A02',
          'Compound ID': 'Compound1',
          'Concentration (µM)': 1000,
          'Volume (µL)': 50,
          'Pattern': 'Treatment1'
        }
      ];

      // Test with different plate sizes
      const plateSizes: PlateSize[] = ['96', '384', '1536'];

      plateSizes.forEach(plateSize => {
        const inputData = createMockInputData(compounds);
        const inventory = buildSrcCompoundInventory(inputData, plateSize);

        // Should work the same regardless of plate size for basic well notation
        const locations = inventory.get('Compound1')!.get('Treatment1')!.locations;
        expect(locations).toHaveLength(2);
        expect(locations.map(loc => loc.wellId).sort()).toEqual(['A01', 'A02']);
      });
    });
  });

  describe('Source Barcode Handling', () => {
    it('should handle different source barcodes', () => {
      const compounds: InputDataType['Compounds'] = [
        {
          'Source Barcode': 'SRC001',
          'Well ID': 'A01',
          'Compound ID': 'Compound1',
          'Concentration (µM)': 1000,
          'Volume (µL)': 50,
          'Pattern': 'Treatment1'
        },
        {
          'Source Barcode': 'SRC002',
          'Well ID': 'A01',
          'Compound ID': 'Compound1',
          'Concentration (µM)': 500,
          'Volume (µL)': 25,
          'Pattern': 'Treatment1'
        }
      ];
      const inputData = createMockInputData(compounds);
      const inventory = buildSrcCompoundInventory(inputData, '384');

      const locations = inventory.get('Compound1')!.get('Treatment1')!.locations;
      expect(locations).toHaveLength(2);

      expect(locations[0].barcode).toBe('SRC001');
      expect(locations[0].concentration).toBe(1000);
      expect(locations[0].volume).toBe(50000);

      expect(locations[1].barcode).toBe('SRC002');
      expect(locations[1].concentration).toBe(500);
      expect(locations[1].volume).toBe(25000);
    });

    it('should preserve barcode strings exactly', () => {
      const testBarcodes = ['SRC001', 'Plate_001', '12345', 'BARCODE-WITH-DASHES', '$#@^&*(', '/////', '.'];

      testBarcodes.forEach(barcode => {
        const compounds: InputDataType['Compounds'] = [
          {
            'Source Barcode': barcode,
            'Well ID': 'A01',
            'Compound ID': 'TestCompound',
            'Concentration (µM)': 1000,
            'Volume (µL)': 50,
            'Pattern': 'Treatment1'
          }
        ];
        const inputData = createMockInputData(compounds);
        const inventory = buildSrcCompoundInventory(inputData, '384');

        const location = inventory.get('TestCompound')!.get('Treatment1')!.locations[0];
        expect(location.barcode).toBe(barcode);
      });
    });
  });

  describe('Complex Integration Scenarios', () => {
    it('should handle complex scenario with multiple compounds, patterns, and well blocks', () => {
      const compounds: InputDataType['Compounds'] = [
        {
          'Source Barcode': 'SRC001',
          'Well ID': 'A01:A03',
          'Compound ID': 'CompoundA',
          'Concentration (µM)': 1000,
          'Volume (µL)': 50,
          'Pattern': 'Treatment1;Control1'
        },
        {
          'Source Barcode': 'SRC001',
          'Well ID': 'B01:B02',
          'Compound ID': 'CompoundB',
          'Concentration (µM)': 500,
          'Volume (µL)': 25,
          'Pattern': 'Treatment2'
        },
        {
          'Source Barcode': 'SRC002',
          'Well ID': 'A01;C01',
          'Compound ID': 'CompoundA',
          'Concentration (µM)': 2000,
          'Volume (µL)': 75,
          'Pattern': 'Treatment1'
        }
      ];
      const inputData = createMockInputData(compounds);
      const inventory = buildSrcCompoundInventory(inputData, '384');

      // Should have 2 compounds
      expect(inventory.size).toBe(2);
      expect(inventory.has('CompoundA')).toBe(true);
      expect(inventory.has('CompoundB')).toBe(true);

      // CompoundA should have 2 patterns
      const compoundAPatterns = inventory.get('CompoundA')!;
      expect(compoundAPatterns.size).toBe(2);
      expect(compoundAPatterns.has('Treatment1')).toBe(true);
      expect(compoundAPatterns.has('Control1')).toBe(true);

      // CompoundA Treatment1 should have 5 locations (3 from first row + 2 from third row)
      const compoundATreatment1 = compoundAPatterns.get('Treatment1')!;
      expect(compoundATreatment1.locations).toHaveLength(5);

      // CompoundA Control1 should have 3 locations (only from first row)
      const compoundAControl1 = compoundAPatterns.get('Control1')!;
      expect(compoundAControl1.locations).toHaveLength(3);

      // CompoundB should have 1 pattern with 2 locations
      const compoundBPatterns = inventory.get('CompoundB')!;
      expect(compoundBPatterns.size).toBe(1);
      const compoundBTreatment2 = compoundBPatterns.get('Treatment2')!;
      expect(compoundBTreatment2.locations).toHaveLength(2);
    });
  });
});

describe('calculateTransferConcentrations', () => {
  // Helper function to create a minimal EchoPreCalculator instance for testing
  function createPreCalcForTransferTests(
    constraints: Partial<{
      maxTransferVolume: number;
      dropletSize: number;
      maxDMSOFraction: number;
      intermediateBackfillVolume: number;
      finalAssayVolume: number;
      allowableError: number;
      createIntConcs: boolean;
    }> = {}
  ): EchoPreCalculator {
    const defaultConstraints = {
      maxTransferVolume: 500,
      dropletSize: 2.5,
      maxDMSOFraction: 0.01,
      intermediateBackfillVolume: 10,
      finalAssayVolume: 25,
      allowableError: 0.1,
      createIntConcs: true,
      ...constraints
    };

    const mockInput = createMockInputData();
    mockInput.CommonData = {
      ...mockInput.CommonData,
      maxDMSOFraction: defaultConstraints.maxDMSOFraction,
      intermediateBackfillVolume: defaultConstraints.intermediateBackfillVolume,
      finalAssayVolume: defaultConstraints.finalAssayVolume,
      allowableError: defaultConstraints.allowableError,
      createIntConcs: defaultConstraints.createIntConcs
    };

    const customPreferences = {
      ...mockPreferences,
      maxTransferVolume: defaultConstraints.maxTransferVolume,
      dropletSize: defaultConstraints.dropletSize
    };

    return new EchoPreCalculator(mockInput, new CheckpointTracker(), customPreferences);
  }

  // Helper to create test patterns
  function createTestPattern(concentrations: number[], type: 'Treatment' | 'Control' = 'Treatment'): DilutionPattern {
    return {
      patternName: 'TestPattern',
      type,
      concentrations,
      replicates: 1,
      direction: ['LR'],
      fold: 1
    };
  }

  // Helper to create compound groups
  function createTestCompoundGroup(
    locations: Array<{ concentration: number; volume?: number; barcode?: string; wellId?: string }>
  ): CompoundGroup {
    return {
      locations: locations.map((loc, idx) => ({
        concentration: loc.concentration,
        volume: loc.volume || 100000, // 100 µL default
        barcode: loc.barcode || 'SRC001',
        wellId: loc.wellId || `A${(idx + 1).toString().padStart(2, '0')}`
      }))
    };
  }

  // Helper to verify concentration results
  function verifyConcentrationResult(
    actual: Map<number, ConcentrationObj>,
    expected: Array<{ conc: number; sourceConc: number; sourceType: string; volToTsfr: number }>
  ): void {
    expect(actual.size).toBe(expected.length);
    
    expected.forEach(exp => {
      const actualObj = actual.get(exp.conc);
      expect(actualObj).toBeDefined();
      if (actualObj) {
        expect(actualObj.sourceConc).toBeCloseTo(exp.sourceConc, 2);
        expect(actualObj.sourceType).toBe(exp.sourceType);
        expect(actualObj.volToTsfr).toBeCloseTo(exp.volToTsfr, 1);
        // Verify volume is multiple of droplet size
        expect(actualObj.volToTsfr % 2.5).toBeCloseTo(0, 10);
      }
    });
  }

  // Helper to verify constraints are satisfied
  function verifyConstraintsSatisfied(
    result: ConcentrationObj,
    targetConc: number,
    constraints: {
      maxTransferVolume: number;
      dropletSize: number;
      maxDMSOFraction: number;
      finalAssayVolume: number;
      allowableError: number;
    }
  ): void {
    // Check volume constraints
    expect(result.volToTsfr).toBeGreaterThanOrEqual(constraints.dropletSize);
    expect(result.volToTsfr).toBeLessThanOrEqual(constraints.maxTransferVolume);
    expect(result.volToTsfr % constraints.dropletSize).toBeCloseTo(0, 10);
    // Check DMSO fraction
    const dmsoFraction = result.volToTsfr / (constraints.finalAssayVolume*1000 + result.volToTsfr);
    expect(dmsoFraction).toBeLessThanOrEqual(constraints.maxDMSOFraction);

    // Check concentration accuracy
    const achievedConc = (result.sourceConc * result.volToTsfr) / (constraints.finalAssayVolume*1000 + result.volToTsfr);
    const error = Math.abs(achievedConc - targetConc) / targetConc;
    expect(error).toBeLessThanOrEqual(constraints.allowableError);
  }

  describe('1. Direct Transfer Cases (No Intermediates Needed)', () => {
    it('should handle single source, single target with direct transfer', () => {
      const preCalc = createPreCalcForTransferTests();
      const pattern = createTestPattern([10]); // 10 µM target
      const compoundGroup = createTestCompoundGroup([{ concentration: 1000 }]); // 1000 µM source

      const result = preCalc.calculateTransferConcentrations(pattern, compoundGroup);

      expect(result.intermediateConcentrations.size).toBe(0);
      verifyConcentrationResult(result.destinationConcentrations, [
        { conc: 10, sourceConc: 1000, sourceType: 'src', volToTsfr: 252.5 }
      ]);

      // Verify constraints
      const destResult = result.destinationConcentrations.get(10)!;
      verifyConstraintsSatisfied(destResult, 10, {
        maxTransferVolume: 500,
        dropletSize: 2.5,
        maxDMSOFraction: 0.01,
        finalAssayVolume: 25,
        allowableError: 0.1
      });
    });

    it('should choose highest conc that is still viable', () => {
      const preCalc = createPreCalcForTransferTests();
      const pattern = createTestPattern([50]); // 50 µM target
      const compoundGroup = createTestCompoundGroup([
        { concentration: 1000000 },
        { concentration: 10000 },
        { concentration: 5000 },
        { concentration: 100 }
      ]);

      const result = preCalc.calculateTransferConcentrations(pattern, compoundGroup);

      expect(result.intermediateConcentrations.size).toBe(0);
      const destConc = result.destinationConcentrations.get(50)!;
      expect(destConc.sourceConc).toBe(10000);
    });

    it('should handle multiple targets all achievable directly', () => {
      const preCalc = createPreCalcForTransferTests();
      const pattern = createTestPattern([100, 50, 25, 12.5]); // Dilution series
      const compoundGroup = createTestCompoundGroup([{ concentration: 10000 }]);

      const result = preCalc.calculateTransferConcentrations(pattern, compoundGroup);

      expect(result.intermediateConcentrations.size).toBe(0);
      expect(result.destinationConcentrations.size).toBe(4);
      
      // All should use direct transfer from source
      result.destinationConcentrations.forEach((concObj) => {
        expect(concObj.sourceType).toBe('src');
        expect(concObj.sourceConc).toBe(10000);
      });
    });

    it('should handle very dilute target near lower achievable limit', () => {
      const preCalc = createPreCalcForTransferTests({
        maxDMSOFraction: 0.01, // 1% DMSO limit
        finalAssayVolume: 25,
        dropletSize: 2.5
      });
      // With 1% DMSO and 25µL assay, max transfer is ~252.5nL
      // From 1000µM source, minimum achievable is ~10µM
      const pattern = createTestPattern([10.1]); // Just above minimum
      const compoundGroup = createTestCompoundGroup([{ concentration: 1000 }]);

      const result = preCalc.calculateTransferConcentrations(pattern, compoundGroup);

      expect(result.destinationConcentrations.size).toBe(1);
      const destConc = result.destinationConcentrations.get(10.1)!;
      expect(destConc.volToTsfr).toBeCloseTo(252.5, 2); // Should be at max allowed
    });
  });

  describe('2. Single Intermediate Required', () => {
    it('should create intermediate when target too dilute for direct transfer', () => {
      const preCalc = createPreCalcForTransferTests({
        createIntConcs: true,
        maxDMSOFraction: 0.01
      });
      const pattern = createTestPattern([1]); // 1 µM target - too dilute from 100mM
      const compoundGroup = createTestCompoundGroup([{ concentration: 100000 }]);

      const result = preCalc.calculateTransferConcentrations(pattern, compoundGroup);

      expect(result.intermediateConcentrations.size).toBe(1);
      expect(result.destinationConcentrations.size).toBe(1);
      
      const destConc = result.destinationConcentrations.get(1)!;
      expect(destConc.sourceType).toBe('int1');
      
      // Verify intermediate concentration is reasonable
      const intConc = Array.from(result.intermediateConcentrations.keys())[0];
      expect(intConc).toBeGreaterThan(1); // Must be higher than target
      expect(intConc).toBeLessThan(100000); // Must be lower than source
    });

    it('should reuse intermediate for multiple target concentrations', () => {
      const preCalc = createPreCalcForTransferTests({ createIntConcs: true });
      const pattern = createTestPattern([2, 1, 0.5]); // All need intermediate
      const compoundGroup = createTestCompoundGroup([{ concentration: 100000 }]);

      const result = preCalc.calculateTransferConcentrations(pattern, compoundGroup);

      // Should create one intermediate that serves all targets
      expect(result.intermediateConcentrations.size).toBe(1);
      expect(result.destinationConcentrations.size).toBe(3);
      
      // All should use the same intermediate
      const intConc = Array.from(result.intermediateConcentrations.keys())[0];
      result.destinationConcentrations.forEach((concObj) => {
        expect(concObj.sourceType).toBe('int1');
        expect(concObj.sourceConc).toBe(intConc);
      });
    });

    it('should handle intermediate at edge of volume constraints', () => {
      const preCalc = createPreCalcForTransferTests({
        maxTransferVolume: 100, // Very limited transfer volume
        intermediateBackfillVolume: 10
      });
      const pattern = createTestPattern([5]);
      const compoundGroup = createTestCompoundGroup([{ concentration: 1000 }]);

      const result = preCalc.calculateTransferConcentrations(pattern, compoundGroup);

      if (result.intermediateConcentrations.size > 0) {
        const intConcObj = Array.from(result.intermediateConcentrations.values())[0];
        expect(intConcObj.volToTsfr).toBeLessThanOrEqual(100);
      }
    });

    it('should optimize intermediate concentration selection', () => {
      const preCalc = createPreCalcForTransferTests({
        createIntConcs: true,
        maxDMSOFraction: 0.01,
        finalAssayVolume: 25
      });
      const pattern = createTestPattern([1, 0.5, 0.25]); // Multiple dilute targets
      const compoundGroup = createTestCompoundGroup([
        { concentration: 10000 },
        { concentration: 1000 },
        { concentration: 100 }
      ]);

      const result = preCalc.calculateTransferConcentrations(pattern, compoundGroup);

      // Should pick an intermediate concentration that works well for all targets
      if (result.intermediateConcentrations.size > 0) {
        const intConc = Array.from(result.intermediateConcentrations.keys())[0];
        // Intermediate should be in a reasonable range
        expect(intConc).toBeGreaterThan(0.25 * 10); // At least 10x lowest target
        expect(intConc).toBeLessThan(1 * 1000); // Much less than highest source
      }
    });
  });

  describe('3. Two-Level Intermediates Required', () => {
    it('should create two-level intermediate for very dilute targets', () => {
      const preCalc = createPreCalcForTransferTests({
        createIntConcs: true,
        maxTransferVolume: 500,
        maxDMSOFraction: 0.01
      });
      const pattern = createTestPattern([0.001]); // Very dilute target
      const compoundGroup = createTestCompoundGroup([{ concentration: 10000 }]); // High concentration source

      const result = preCalc.calculateTransferConcentrations(pattern, compoundGroup);

      // May need two intermediate steps
      const destConc = result.destinationConcentrations.get(0.001);
      if (destConc && destConc.sourceType === 'int2') {
        // Find the int2 concentration in intermediates
        const int2Conc = destConc.sourceConc;
        const int2Obj = result.intermediateConcentrations.get(int2Conc);
        expect(int2Obj).toBeDefined();
        expect(int2Obj!.sourceType).toBe('int1'); // int2 comes from int1
      }
    });

    it('should handle complex cascade with multiple int2 from different int1', () => {
      const preCalc = createPreCalcForTransferTests({ createIntConcs: true });
      const pattern = createTestPattern([0.1, 0.01, 0.001]); // Wide range needing different paths
      const compoundGroup = createTestCompoundGroup([{ concentration: 100000 }]); // Very high source

      const result = preCalc.calculateTransferConcentrations(pattern, compoundGroup);

      // Count how many use int2
      let int2Count = 0;
      result.destinationConcentrations.forEach((concObj) => {
        if (concObj.sourceType === 'int2') {
          int2Count++;
        }
      });

      // At least some should need int2 with such high source concentration
      expect(int2Count).toBeGreaterThan(0);
    });

    it('should efficiently reuse int1 concentrations for creating int2', () => {
      const preCalc = createPreCalcForTransferTests({ createIntConcs: true });
      const pattern = createTestPattern([0.01, 0.005, 0.001]); // All might need int2
      const compoundGroup = createTestCompoundGroup([{ concentration: 50000 }]);

      const result = preCalc.calculateTransferConcentrations(pattern, compoundGroup);

      // Count unique source types in intermediates
      const int1Sources = new Set<number>();
      const int2Sources = new Set<number>();
      
      result.intermediateConcentrations.forEach((concObj, conc) => {
        if (concObj.sourceType === 'src') {
          int1Sources.add(conc);
        } else if (concObj.sourceType === 'int1') {
          int2Sources.add(concObj.sourceConc);
        }
      });

      // If int2 exist, they should reuse int1 concentrations
      if (int2Sources.size > 0) {
        int2Sources.forEach(sourceConc => {
          expect(int1Sources.has(sourceConc)).toBe(true);
        });
      }
    });
  });

  describe('4. Constraint Boundary Testing', () => {
    it('should respect DMSO limit exactly', () => {
      const maxDMSO = 0.005;
      const assayVol = 50
      const preCalc = createPreCalcForTransferTests({
        maxDMSOFraction: maxDMSO,
        finalAssayVolume: assayVol
      });
      
      const pattern = createTestPattern([25]);
      const compoundGroup = createTestCompoundGroup([{ concentration: 5000 }]);

      const result = preCalc.calculateTransferConcentrations(pattern, compoundGroup);
      const destConc = result.destinationConcentrations.get(25)!;
      const actualDMSO = destConc.volToTsfr / (assayVol*1000 + destConc.volToTsfr);
      expect(actualDMSO).toBeLessThanOrEqual(maxDMSO);
      
      // Should be close to limit for optimal transfer
      expect(actualDMSO).toBeGreaterThan(maxDMSO * 0.9);
    });

    it('should handle maximum transfer volume constraint', () => {
      const preCalc = createPreCalcForTransferTests({
        maxTransferVolume: 100, // Very small max
        finalAssayVolume: 10
      });
      
      const pattern = createTestPattern([10]);
      const compoundGroup = createTestCompoundGroup([{ concentration: 200 }]);

      const result = preCalc.calculateTransferConcentrations(pattern, compoundGroup);
      
      result.destinationConcentrations.forEach((concObj) => {
        expect(concObj.volToTsfr).toBeLessThanOrEqual(100);
      });
    });

    it('should handle edge case with backfill volume constraints', () => {
      const preCalc = createPreCalcForTransferTests({
        intermediateBackfillVolume: 2, // Very small backfill
        maxTransferVolume: 100
      });
      
      const pattern = createTestPattern([1]);
      const compoundGroup = createTestCompoundGroup([{ concentration: 1000 }]);

      const result = preCalc.calculateTransferConcentrations(pattern, compoundGroup);
      
      // With small backfill, intermediate concentrations will be higher
      result.intermediateConcentrations.forEach((concObj) => {
        const dilutionFactor = concObj.volToTsfr / (concObj.volToTsfr + 2000);
        const intConc = concObj.sourceConc * dilutionFactor;
        expect(intConc).toBeGreaterThan(0);
        expect(concObj.volToTsfr).toBeLessThanOrEqual(100);
      });
    });
  });

  describe('5. Multiple Source Concentrations', () => {
    it('should select highest concentration source from multiple options', () => {
      const preCalc = createPreCalcForTransferTests();
      const pattern = createTestPattern([50, 5, 0.5]);
      const compoundGroup = createTestCompoundGroup([
        { concentration: 10000 },
        { concentration: 1000 },
        { concentration: 100 }
      ]);

      const result = preCalc.calculateTransferConcentrations(pattern, compoundGroup);
      
      // Should primarily use the 1000 µM source
      let counts = {
        10000: 0,
        1000: 0,
        100: 0
      }
      result.destinationConcentrations.forEach((concObj) => {
        counts[concObj.sourceConc as keyof typeof counts]++
      });
      expect(counts[10000]).toBe(2);
      expect(counts[1000]).toBe(1);
      expect(counts[100]).toBe(0);
    });

    it('should handle forced intermediate due to source constraints', () => {
      const preCalc = createPreCalcForTransferTests({
        createIntConcs: true
      });
      const pattern = createTestPattern([5]);
      const compoundGroup = createTestCompoundGroup([
        { concentration: 10000, volume: 100 }, // Limited volume
        { concentration: 50, volume: 50000 }   // Too dilute
      ]);

      const result = preCalc.calculateTransferConcentrations(pattern, compoundGroup);
      
      // Should create intermediate from high concentration source
      if (result.intermediateConcentrations.size > 0) {
        const intObj = Array.from(result.intermediateConcentrations.values())[0];
        expect(intObj.sourceConc).toBe(10000);
      }
    });

    it('should handle very different source concentrations', () => {
      const preCalc = createPreCalcForTransferTests();
      const pattern = createTestPattern([100, 10, 1, 0.1]);
      const compoundGroup = createTestCompoundGroup([
        { concentration: 100000 },
        { concentration: 1000 },
        { concentration: 10 },
        { concentration: 0.1 }
      ]);

      const result = preCalc.calculateTransferConcentrations(pattern, compoundGroup);
      
      // Each target should find an appropriate source
      expect(result.destinationConcentrations.size).toBeGreaterThan(0);
      
      // Higher targets should use higher concentration sources
      const dest100 = result.destinationConcentrations.get(100);
      const dest01 = result.destinationConcentrations.get(0.1);
      if (dest100 && dest01) {
        expect(dest100.sourceConc).toBeGreaterThan(dest01.sourceConc);
      }
    });
  });

  describe('6. Caching Behavior', () => {
    it('should return cached result for identical inputs', () => {
      const preCalc = createPreCalcForTransferTests();
      const pattern = createTestPattern([10, 5]);
      const compoundGroup = createTestCompoundGroup([{ concentration: 1000 }]);

      // First call
      const result1 = preCalc.calculateTransferConcentrations(pattern, compoundGroup);
      
      // Second call with same inputs
      const result2 = preCalc.calculateTransferConcentrations(pattern, compoundGroup);
      
      // Should return same object references (cached)
      expect(result1.destinationConcentrations).toBe(result2.destinationConcentrations);
      expect(result1.intermediateConcentrations).toBe(result2.intermediateConcentrations);
    });

    it('should not use cache for different concentration patterns', () => {
      const preCalc = createPreCalcForTransferTests();
      const pattern1 = createTestPattern([10, 5]);
      const pattern2 = createTestPattern([10, 6]); // Slightly different
      const compoundGroup = createTestCompoundGroup([{ concentration: 1000 }]);

      const result1 = preCalc.calculateTransferConcentrations(pattern1, compoundGroup);
      const result2 = preCalc.calculateTransferConcentrations(pattern2, compoundGroup);
      
      // Should be different results
      expect(result1.destinationConcentrations).not.toBe(result2.destinationConcentrations);
      expect(result1.destinationConcentrations.size).toBe(2);
      expect(result2.destinationConcentrations.size).toBe(2);
    });

    it('should not use cache for different source concentrations', () => {
      const preCalc = createPreCalcForTransferTests();
      const pattern = createTestPattern([10]);
      const compoundGroup1 = createTestCompoundGroup([{ concentration: 1000 }]);
      const compoundGroup2 = createTestCompoundGroup([{ concentration: 2000 }]);

      const result1 = preCalc.calculateTransferConcentrations(pattern, compoundGroup1);
      const result2 = preCalc.calculateTransferConcentrations(pattern, compoundGroup2);
      
      // Same target concentration but different source should give different volumes
      const dest1 = result1.destinationConcentrations.get(10)!;
      const dest2 = result2.destinationConcentrations.get(10)!;
      expect(dest1.volToTsfr).not.toBe(dest2.volToTsfr);
    });
  });

  describe('7. Error/Failure Cases', () => {
    it('should handle impossible concentration (too high)', () => {
      const preCalc = createPreCalcForTransferTests();
      const pattern = createTestPattern([2000]); // Higher than source
      const compoundGroup = createTestCompoundGroup([{ concentration: 1000 }]);

      const result = preCalc.calculateTransferConcentrations(pattern, compoundGroup);
      
      // Should not be able to achieve this concentration
      expect(result.destinationConcentrations.has(2000)).toBe(false);
    });

    it('should handle impossible concentration (too dilute) when intermediates disabled', () => {
      const preCalc = createPreCalcForTransferTests({
        createIntConcs: false // No intermediates allowed
      });
      const pattern = createTestPattern([0.1]); // Too dilute for direct
      const compoundGroup = createTestCompoundGroup([{ concentration: 10000 }]);

      const result = preCalc.calculateTransferConcentrations(pattern, compoundGroup);
      
      // Should not achieve this without intermediates
      expect(result.destinationConcentrations.has(0.1)).toBe(false);
      expect(result.intermediateConcentrations.size).toBe(0);
    });

    it('should handle partial success with multiple targets', () => {
      const preCalc = createPreCalcForTransferTests({
        maxDMSOFraction: 0.005,
        createIntConcs: false
      });
      const pattern = createTestPattern([100, 10, 1, 0.1]); // Mix of achievable and not
      const compoundGroup = createTestCompoundGroup([{ concentration: 10000 }]);

      const result = preCalc.calculateTransferConcentrations(pattern, compoundGroup);
      
      // Middle concs achievable
      expect(result.destinationConcentrations.has(100)).toBe(false);
      expect(result.destinationConcentrations.has(10)).toBe(true);
      expect(result.destinationConcentrations.has(1)).toBe(true);
      expect(result.destinationConcentrations.has(0.1)).toBe(false);
    });

    it('should handle no valid intermediate possible due to constraints', () => {
      const preCalc = createPreCalcForTransferTests({
        createIntConcs: true,
        maxTransferVolume: 10, // Very restrictive
        intermediateBackfillVolume: 100 // Very large backfill
      });
      const pattern = createTestPattern([0.001]);
      const compoundGroup = createTestCompoundGroup([{ concentration: 10000 }]);

      const result = preCalc.calculateTransferConcentrations(pattern, compoundGroup);
      
      // May not be able to create viable intermediate
      if (!result.destinationConcentrations.has(0.001)) {
        expect(result.destinationConcentrations.size).toBe(0);
      }
    });
  });

  describe('8. Rounding and Precision', () => {
    it('should round all volumes to droplet size', () => {
      const dropletSize = 5;
      const preCalc = createPreCalcForTransferTests({ dropletSize });
      const pattern = createTestPattern([33.33, 66.66, 99.99]);
      const compoundGroup = createTestCompoundGroup([{ concentration: 1000 }]);

      const result = preCalc.calculateTransferConcentrations(pattern, compoundGroup);
      
      // Check all volumes are multiples of droplet size
      result.destinationConcentrations.forEach((concObj) => {
        expect(concObj.volToTsfr % dropletSize).toBe(0);
      });
      result.intermediateConcentrations.forEach((concObj) => {
        expect(concObj.volToTsfr % dropletSize).toBe(0);
      });
    });

    it('should handle very precise target concentrations', () => {
      const preCalc = createPreCalcForTransferTests({
        dropletSize: 2.5,
        allowableError: 0.01 // 1% error allowed
      });
      const pattern = createTestPattern([12.3456789]);
      const compoundGroup = createTestCompoundGroup([{ concentration: 1000 }]);

      const result = preCalc.calculateTransferConcentrations(pattern, compoundGroup);
      
      if (result.destinationConcentrations.has(12.3456789)) {
        const destConc = result.destinationConcentrations.get(12.3456789)!;
        const achieved = (destConc.sourceConc * destConc.volToTsfr) / 
                        (25000 + destConc.volToTsfr);
        const error = Math.abs(achieved - 12.3456789) / 12.3456789;
        expect(error).toBeLessThan(0.01);
      }
    });

    it('should handle accumulation of rounding errors with multiple steps', () => {
      const preCalc = createPreCalcForTransferTests({
        createIntConcs: true,
        dropletSize: 25, // Large droplet
        allowableError: 0.1
      });
      const pattern = createTestPattern([0.123]); // Requires intermediates
      const compoundGroup = createTestCompoundGroup([{ concentration: 10000 }]);

      const result = preCalc.calculateTransferConcentrations(pattern, compoundGroup);
      
      // Even with multiple steps and rounding, should stay within error bounds
      if (result.destinationConcentrations.has(0.123)) {
        const destConc = result.destinationConcentrations.get(0.123)!;
        verifyConstraintsSatisfied(destConc, 0.123, {
          maxTransferVolume: 500,
          dropletSize: 25,
          maxDMSOFraction: 0.01,
          finalAssayVolume: 25,
          allowableError: 0.1
        });
      }
    });
  });
});