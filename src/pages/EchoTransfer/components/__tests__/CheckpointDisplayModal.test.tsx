import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import CheckpointDisplayModal from '../CheckpointDisplayModal';
import { CheckpointTracker } from '../../classes/CheckpointTrackerClass';
import { EchoPreCalculator } from '../../classes/EchoPreCalculatorClass';
import { InputDataType } from '../../utils/echoUtils';
import { PreferencesState } from '../../../../hooks/usePreferences';

// Mocks
jest.mock('../../classes/EchoPreCalculatorClass');
jest.mock('../../classes/CheckpointTrackerClass');

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
};

const createMockInputData = (): InputDataType => ({
  Compounds: [], Patterns: [], Layout: [], Barcodes: [],
  CommonData: {
    maxDMSOFraction: 0.005, finalAssayVolume: 25000, intermediateBackfillVolume: 10000,
    allowableError: 0.1, destReplicates: 1, createIntConcs: true, dmsoNormalization: true,
  },
});

describe('CheckpointDisplayModal - Dead Volume Functionality', () => {
  let mockEchoPreCalc: jest.Mocked<EchoPreCalculator>;
  let mockCheckpointTracker: jest.Mocked<CheckpointTracker>;
  let mockSetEchoPreCalc: jest.Mock;
  let mockSetCheckpointTracker: jest.Mock;
  let mockHandleClose: jest.Mock;
  let mockHandleCancel: jest.Mock;
  let mockHandleContinue: jest.Mock;

  beforeEach(() => {
    // Create fresh mocks for each test
    mockCheckpointTracker = new CheckpointTracker() as jest.Mocked<CheckpointTracker>;
    mockCheckpointTracker.checkpoints = new Map([['Test Checkpoint', { status: 'Passed', message: [] }]]);
    
    // Mock EchoPreCalculator instance
    // Note: The actual EchoPreCalculator constructor might do more.
    // We're mocking methods/properties used by the modal.
    mockEchoPreCalc = new EchoPreCalculator(createMockInputData(), mockCheckpointTracker, mockPreferences) as jest.Mocked<EchoPreCalculator>;
    mockEchoPreCalc.plateDeadVolumes = new Map([
      ['P1', 2500], // 2.5 µL
      ['P2', 15000], // 15 µL
    ]);
    // Mock the updateDeadVolume method specifically for a class instance
    mockEchoPreCalc.updateDeadVolume = jest.fn<void, [string, number]>();
    // Mock checkpointTracker property on the instance
    mockEchoPreCalc.checkpointTracker = mockCheckpointTracker;
    // Initialize properties accessed by CheckpointSummary
    mockEchoPreCalc.totalDMSOBackfillVol = 0;
    mockEchoPreCalc.maxDMSOVol = 0;
    mockEchoPreCalc.destinationPlatesCount = 0; // Assuming this is also needed by CheckpointSummary
    mockEchoPreCalc.srcCompoundInventory = new Map(); // Assuming this is also needed by CheckpointSummary
    mockEchoPreCalc.dilutionPatterns = new Map(); // Assuming this is also needed by CheckpointSummary


    mockSetEchoPreCalc = jest.fn();
    mockSetCheckpointTracker = jest.fn();
    mockHandleClose = jest.fn();
    mockHandleCancel = jest.fn();
    mockHandleContinue = jest.fn();
  });

  const renderModal = (overrideEchoPreCalc?: EchoPreCalculator | null) => {
    render(
      <CheckpointDisplayModal
        showModal={true}
        checkpointTracker={mockCheckpointTracker}
        echoPreCalc={overrideEchoPreCalc !== undefined ? overrideEchoPreCalc : mockEchoPreCalc}
        handleClose={mockHandleClose}
        handleCancel={mockHandleCancel}
        handleContinue={mockHandleContinue}
        setEchoPreCalc={mockSetEchoPreCalc}
        setCheckpointTracker={mockSetCheckpointTracker}
      />
    );
  };

  describe('Display of Dead Volumes', () => {
    it('should display the "Source Plate Dead Volumes" section if echoPreCalc has plateDeadVolumes', () => {
      renderModal();
      // The accordion header acts as the entry point to this section
      expect(screen.getByText('Edit Source Plate Dead Volumes')).toBeInTheDocument();
    });

    it('should not display the section if echoPreCalc is null or plateDeadVolumes is empty/null', () => {
      const customMockPreCalc = { ...mockEchoPreCalc, plateDeadVolumes: new Map() } as jest.Mocked<EchoPreCalculator>;
      renderModal(customMockPreCalc);
      expect(screen.queryByText('Edit Source Plate Dead Volumes')).not.toBeInTheDocument();
      
      renderModal(null); // Test with echoPreCalc as null
      expect(screen.queryByText('Edit Source Plate Dead Volumes')).not.toBeInTheDocument();
    });

    it('should render input fields for each plate barcode and display correct dead volume in µL', () => {
      renderModal();
      fireEvent.click(screen.getByText('Edit Source Plate Dead Volumes')); // Open accordion

      const inputP1 = screen.getByLabelText('P1') as HTMLInputElement;
      expect(inputP1).toBeInTheDocument();
      expect(inputP1.value).toBe('2.5'); // 2500 nL -> 2.5 µL

      const inputP2 = screen.getByLabelText('P2') as HTMLInputElement;
      expect(inputP2).toBeInTheDocument();
      expect(inputP2.value).toBe('15'); // 15000 nL -> 15 µL
    });
  });

  describe('Editing Dead Volumes', () => {
    it('should update internal state (editableDeadVolumes) on input change', async () => {
      renderModal();
      fireEvent.click(screen.getByText('Edit Source Plate Dead Volumes'));

      const inputP1 = screen.getByLabelText('P1') as HTMLInputElement;
      fireEvent.change(inputP1, { target: { value: '3.5' } });
      
      // editableDeadVolumes is internal state. We verify its effect by checking input value
      // and then by clicking "Update" and checking mock calls.
      expect(inputP1.value).toBe('3.5');
      
      // To further confirm, if we were to click "Update Dead Volumes" now,
      // updateDeadVolume on echoPreCalc should be called with 3500 for P1.
      fireEvent.click(screen.getByText('Update Dead Volumes'));
      await waitFor(() => {
        expect(mockEchoPreCalc.updateDeadVolume).toHaveBeenCalledWith('P1', 3500);
      });
    });

    it('should not allow negative values in dead volume input', async () => {
      renderModal();
      fireEvent.click(screen.getByText('Edit Source Plate Dead Volumes'));
      
      const inputP1 = screen.getByLabelText('P1') as HTMLInputElement;
      fireEvent.change(inputP1, { target: { value: '-1' } });
      // The browser might prevent this, or our handler might ignore it based on min="0"
      // For this test, we check if the change handler correctly handles it.
      // The `handleDeadVolumeChange` has `if (!isNaN(newVolumeNL) && newVolumeNL >= 0)`
      // So, a negative value should not propagate to an update call if "Update" is clicked.
      // The input value will revert because setEditableDeadVolumes isn't called with the invalid value.
      expect(inputP1.value).toBe('2.5'); 

      fireEvent.click(screen.getByText('Update Dead Volumes'));
      await waitFor(() => {
        // updateDeadVolume for P1 should NOT have been called with a negative value.
        // It also should not have been called with the original value IF no *valid* change was made for P1.
        // Since only an invalid change was attempted for P1, and no other fields were changed,
        // updateDeadVolume for P1 should not be called at all.
        const p1Call = (mockEchoPreCalc.updateDeadVolume as jest.Mock).mock.calls.find(call => call[0] === 'P1');
        expect(p1Call).toBeUndefined(); 
      });
    });
  });

  describe('"Update Dead Volumes" Button Click', () => {
    it('should call echoPreCalc.updateDeadVolume for changed volumes', async () => {
      renderModal();
      fireEvent.click(screen.getByText('Edit Source Plate Dead Volumes'));

      const inputP1 = screen.getByLabelText('P1') as HTMLInputElement;
      fireEvent.change(inputP1, { target: { value: '5' } }); // Original 2.5 µL (2500 nL)

      const inputP2 = screen.getByLabelText('P2') as HTMLInputElement;
      fireEvent.change(inputP2, { target: { value: '10' } }); // Original 15 µL (15000 nL)

      fireEvent.click(screen.getByText('Update Dead Volumes'));

      await waitFor(() => {
        expect(mockEchoPreCalc.updateDeadVolume).toHaveBeenCalledWith('P1', 5000); // 5 µL
        expect(mockEchoPreCalc.updateDeadVolume).toHaveBeenCalledWith('P2', 10000); // 10 µL
      });
    });

    it('should call setEchoPreCalc and setCheckpointTracker if changes were made', async () => {
      renderModal();
      fireEvent.click(screen.getByText('Edit Source Plate Dead Volumes'));
      
      const inputP1 = screen.getByLabelText('P1') as HTMLInputElement;
      fireEvent.change(inputP1, { target: { value: '5' } });

      fireEvent.click(screen.getByText('Update Dead Volumes'));

      await waitFor(() => {
        expect(mockSetEchoPreCalc).toHaveBeenCalledTimes(1);
        // Check that the argument to setEchoPreCalc is an EchoPreCalculator instance
        expect(mockSetEchoPreCalc.mock.calls[0][0]).toBeInstanceOf(EchoPreCalculator);
        
        expect(mockSetCheckpointTracker).toHaveBeenCalledTimes(1); // Corrected typo
        // Check that the argument to setCheckpointTracker is a CheckpointTracker instance
        expect(mockSetCheckpointTracker.mock.calls[0][0]).toBeInstanceOf(CheckpointTracker);
      });
    });

    it('should NOT call setEchoPreCalc or setCheckpointTracker if NO changes were made', async () => {
      renderModal();
      fireEvent.click(screen.getByText('Edit Source Plate Dead Volumes'));
      
      // No changes made to inputs
      fireEvent.click(screen.getByText('Update Dead Volumes'));

      await waitFor(() => { // Use waitFor to ensure any async operations complete
        expect(mockEchoPreCalc.updateDeadVolume).not.toHaveBeenCalled();
        expect(mockSetEchoPreCalc).not.toHaveBeenCalled();
        expect(mockSetCheckpointTracker).not.toHaveBeenCalled();
      });
    });

     it('should correctly use the updated checkpointTracker from the modified echoPreCalc instance', async () => {
      // Simulate that updateDeadVolume (and thus calculateNeeds) modified the checkpointTracker inside echoPreCalc
      const updatedMockTracker = new CheckpointTracker() as jest.Mocked<CheckpointTracker>;
      updatedMockTracker.checkpoints = new Map([['Test Checkpoint', { status: 'Warning', message: ["New warning!"] }]]);
      
      // Configure the mock implementation for updateDeadVolume for this specific test
      // This setup ensures that when updateDeadVolume is called, it modifies the
      // checkpointTracker on the mockEchoPreCalc instance, simulating the real behavior.
      (mockEchoPreCalc.updateDeadVolume as jest.Mock).mockImplementation(() => {
        (mockEchoPreCalc as any).checkpointTracker = updatedMockTracker;
      });
      
      renderModal();
      fireEvent.click(screen.getByText('Edit Source Plate Dead Volumes'));
      
      const inputP1 = screen.getByLabelText('P1') as HTMLInputElement;
      fireEvent.change(inputP1, { target: { value: '5' } }); // Make a change

      fireEvent.click(screen.getByText('Update Dead Volumes'));

      await waitFor(() => {
        expect(mockSetEchoPreCalc).toHaveBeenCalled();
        expect(mockSetCheckpointTracker).toHaveBeenCalledWith(updatedMockTracker); // Crucial check
      });
    });
  });
});
