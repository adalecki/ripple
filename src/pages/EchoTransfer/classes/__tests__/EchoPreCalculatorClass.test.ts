import { EchoPreCalculator } from '../EchoPreCalculatorClass';
import { CheckpointTracker } from '../CheckpointTrackerClass';
import { InputDataType } from '../../utils/echoUtils';
import { PreferencesState } from '../../../../hooks/usePreferences';
import { PlateSize } from '../PlateClass';

// Minimal mock for PreferencesState
const mockPreferences: PreferencesState = {
  maxTransferVolume: 500,
  dropletSize: 2.5,
  sourcePlateSize: '384',
  destinationPlateSize: '384',
  splitOutputCSVs: true,
  // Add other calculator-defaults as needed, though not directly used for dead volume calc
  defaultDMSOTolerance: 0.005,
  defaultAssayVolume: 25,
  defaultBackfill: 10,
  defaultAllowedError: 0.1,
  defaultDestinationReplicates: 1,
  useIntermediatePlates: true,
  dmsoNormalization: true,
};

// Helper to create minimal InputDataType
const createMockInputData = (compounds: InputDataType['Compounds']): InputDataType => ({
  Compounds: compounds,
  Patterns: [], // Keep empty for these tests as they are not directly relevant
  Layout: [],   // Keep empty
  Barcodes: [], // Keep empty
  CommonData: { // These will be overridden by form values in real scenario, but provide defaults
    maxDMSOFraction: 0.005,
    finalAssayVolume: 25000, // nL
    intermediateBackfillVolume: 10000, // nL
    allowableError: 0.1,
    destReplicates: 1,
    createIntConcs: true,
    dmsoNormalization: true,
  },
});

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
      };

      const preCalc = new EchoPreCalculator(mockInput, new CheckpointTracker(), mockPreferences);
      
      // Override plateDeadVolumes if provided, otherwise they are set by constructor
      if (initialPlateDeadVolumes) {
        preCalc.plateDeadVolumes = new Map(initialPlateDeadVolumes);
      }

      // Manually build srcCompoundInventory and dilutionPatterns as calculateNeeds() is complex to fully mock/run
      // For these tests, we primarily care that checkSourceVolumes uses the dead volumes correctly.
      preCalc.srcCompoundInventory = preCalc.buildSrcCompoundInventory();
      
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

    it('should use dropletSize as dead volume if plate barcode is unexpectedly missing from plateDeadVolumes', () => {
      const compounds: InputDataType['Compounds'] = [
        // P1's dead volume will be missing from plateDeadVolumes map
        { 'Source Barcode': 'P1', 'Well ID': 'A1', 'Volume (µL)': 2, 'Concentration (µM)': 10, 'Compound ID': 'C1', 'Pattern': 'TestPattern' },
      ];
      // Droplet size is 2.5nL. Available: 2000 - 2.5 = 1997.5nL. Required: 1000nL. Should pass.
      const preCalc = setupPreCalcForVolumeChecks(compounds, new Map()); // Empty map means P1 is missing
      preCalc.dropletSize = 2.5; // Explicitly set for clarity
      
      preCalc.checkSourceVolumes('volumeCheck');
      const checkpoint = preCalc.checkpointTracker.getCheckpoint('volumeCheck');
      expect(checkpoint?.status).toBe('Passed');

      // Now test insufficiency with dropletSize
       const compoundsInsufficient: InputDataType['Compounds'] = [
        { 'Source Barcode': 'P2', 'Well ID': 'A1', 'Volume (µL)': 0.5, 'Concentration (µM)': 10, 'Compound ID': 'C2', 'Pattern': 'TestPattern' },
      ];
      const preCalcInsufficient = setupPreCalcForVolumeChecks(compoundsInsufficient, new Map()); // P2's dead vol is missing
      preCalcInsufficient.dropletSize = 2.5; // Explicitly set for clarity
      // Available: 500 - 2.5 = 497.5 nL.
      // Set required volume to be greater than available.
      preCalcInsufficient.totalVolumes.get('C2')?.get('TestPattern')?.set(10, 500); // Require 500, have 497.5
      
      preCalcInsufficient.checkSourceVolumes('volumeCheckInsufficient');
      const checkpointInsufficient = preCalcInsufficient.checkpointTracker.getCheckpoint('volumeCheckInsufficient');
      expect(checkpointInsufficient?.status).toBe('Warning');
      expect(checkpointInsufficient?.message[0]).toContain('Insufficient source volume of C2');
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
      preCalc.srcCompoundInventory = preCalc.buildSrcCompoundInventory(); // Ensure inventory is built
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
