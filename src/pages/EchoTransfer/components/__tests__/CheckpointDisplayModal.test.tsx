import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { DilutionPattern } from '../../../../classes/PatternClass';
import { Plate } from '../../../../classes/PlateClass';
import { PreferencesState } from '../../../../hooks/usePreferences';
import { CheckpointTracker } from '../../classes/CheckpointTrackerClass';
import { EchoPreCalculator } from '../../classes/EchoPreCalculatorClass';
import { CompoundInventory } from '../../types/echoTypes';
import { InputDataType } from '../../utils/echoUtils';
import CheckpointDisplayModal from '../CheckpointDisplayModal';


type ModalProps = React.ComponentProps<typeof CheckpointDisplayModal>;

//EchoPreCalculator reads only these four off preferences, so the rest of the state is left out
const preferences = {
  maxTransferVolume: 500,
  dropletSize: 2.5,
  sourcePlateSize: '384',
  destinationPlateSize: '384'
} as unknown as PreferencesState;

function buildInputData(): InputDataType {
  return {
    Layout: [{ Pattern: 'Treatment1', 'Well Block': 'A1:B12' }],
    Patterns: [
      { Pattern: 'Treatment1', Type: 'Treatment', Direction: ['LR'], Replicates: 1, Conc1: 10, Conc2: 1 },
      { Pattern: 'Solvent1', Type: 'Solvent', Direction: [], Replicates: 1 }
    ],
    Compounds: [
      { 'Source Barcode': 'SRC1', 'Well ID': 'A1', 'Compound ID': 'CPD1', 'Concentration (µM)': 10000, 'Volume (µL)': 20, Pattern: 'Treatment1' },
      { 'Source Barcode': 'SRC2', 'Well ID': 'A1', 'Compound ID': 'CPD2', 'Concentration (µM)': 10000, 'Volume (µL)': 10, Pattern: 'Treatment1' }
    ],
    Barcodes: [{ 'Intermediate Plate Barcodes': 'INT1', 'Destination Plate Barcodes': 'DEST1' }],
    CommonData: {
      maxDMSOFraction: 0.01,
      intermediateBackfillVolume: 8,
      finalAssayVolume: 0.025,
      allowableError: 0.1,
      destReplicates: 1,
      createIntConcs: true,
      dmsoNormalization: true,
      evenDepletion: false,
      updateFromSurveyVolumes: false,
      skipUnusedBlocks: true,
      fillIntColumnwise: false
    }
  };
}

function buildInventory(): CompoundInventory {
  const inventory: CompoundInventory = new Map();
  inventory.set('CPD1', new Map([
    ['Treatment1', { locations: [{ barcode: 'SRC1', wellId: 'A1', volume: 20000, concentration: 10000 }] }]
  ]));
  inventory.set('CPD2', new Map([
    ['Treatment1', { locations: [{ barcode: 'SRC2', wellId: 'A1', volume: 10000, concentration: 10000 }] }]
  ]));
  //zero-concentration entries are solvent, and CheckpointSummary excludes them from the compound count
  inventory.set('DMSO', new Map([
    ['Solvent1', { locations: [{ barcode: 'SRC2', wellId: 'P24', volume: 10000, concentration: 0 }] }]
  ]));
  return inventory;
}

function buildDilutionPatterns(): Map<string, DilutionPattern> {
  return new Map<string, DilutionPattern>([
    ['Treatment1', { patternName: 'Treatment1', type: 'Treatment', concentrations: [10, 1], replicates: 1, direction: ['LR'], fold: 1 }],
    ['Solvent1', { patternName: 'Solvent1', type: 'Solvent', concentrations: [], replicates: 1, direction: [], fold: 1 }]
  ]);
}

function buildTracker(): CheckpointTracker {
  const tracker = new CheckpointTracker();
  tracker.updateCheckpoint('Valid Dilution Patterns', 'Passed');
  tracker.updateCheckpoint('Build Source Inventory', 'Warning', ["Pattern 'Solvent1' has no compounds associated with it"]);
  tracker.updateCheckpoint('Calculated Transfer Volumes', 'Passed');
  return tracker;
}

//calculateNeeds is deliberately not run: the modal only reads these fields, and fixing them keeps the summary assertions stable
//plate dead volumes are set to values the constructor would never derive, so displayed values can only have come off the plates
function buildPreCalc(tracker: CheckpointTracker): EchoPreCalculator {
  const preCalc = new EchoPreCalculator(buildInputData(), tracker, preferences);
  preCalc.srcCompoundInventory = buildInventory();
  preCalc.dilutionPatterns = buildDilutionPatterns();
  preCalc.sourcePlates = [
    new Plate({ barcode: 'SRC1', plateSize: '384', plateRole: 'source', deadVolume: 12000 }),
    new Plate({ barcode: 'SRC2', plateSize: '384', plateRole: 'source', deadVolume: 4000 })
  ];
  preCalc.destinationPlatesCount = 3;
  preCalc.maxDMSOVol = 62.5;
  preCalc.totalDMSOBackfillVol = 1234567;
  preCalc.dmsoSourceWells = 2;
  preCalc.dmsoUsableVolume = 45000;
  return preCalc;
}

function renderModal(overrides: Partial<ModalProps> = {}) {
  const handleClose = jest.fn();
  const handleCancel = jest.fn();
  const handleContinue = jest.fn();
  const setEchoPreCalc = jest.fn();
  const setCheckpointTracker = jest.fn();
  const tracker = overrides.checkpointTracker ?? buildTracker();
  const echoPreCalc = overrides.echoPreCalc !== undefined ? overrides.echoPreCalc : buildPreCalc(tracker);

  const props: ModalProps = {
    showModal: true,
    checkpointTracker: tracker,
    echoPreCalc,
    handleClose,
    handleCancel,
    handleContinue,
    setEchoPreCalc,
    setCheckpointTracker,
    ...overrides
  };

  const view = render(<CheckpointDisplayModal {...props} />);

  const rerenderWith = (next: Partial<ModalProps>) => {
    view.rerender(<CheckpointDisplayModal {...props} {...next} />);
  };

  return { tracker, echoPreCalc, handleClose, handleCancel, handleContinue, setEchoPreCalc, setCheckpointTracker, rerenderWith };
}

function updateButton() {
  return screen.getByRole('button', { name: 'Update Dead Volumes' });
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('CheckpointDisplayModal', () => {
  describe('checkpoint results', () => {
    it('renders one accordion entry per checkpoint with its status icon', () => {
      renderModal();

      expect(screen.getByRole('button', { name: /Valid Dilution Patterns/ })).toHaveTextContent('✅');
      expect(screen.getByRole('button', { name: /Build Source Inventory/ })).toHaveTextContent('⚠️');
      expect(screen.getByRole('button', { name: /Calculated Transfer Volumes/ })).toHaveTextContent('✅');
    });

    it('renders checkpoint messages when present', () => {
      renderModal();

      expect(screen.getByText("Pattern 'Solvent1' has no compounds associated with it")).toBeInTheDocument();
    });

    it('allows continuing when no checkpoint has failed', () => {
      const { handleContinue } = renderModal();
      const button = screen.getByRole('button', { name: 'Continue' });

      expect(button).toBeEnabled();
      fireEvent.click(button);
      expect(handleContinue).toHaveBeenCalledTimes(1);
    });

    it('blocks continuing when a checkpoint has failed', () => {
      const tracker = buildTracker();
      tracker.updateCheckpoint('Sufficient Source Volumes', 'Failed', ['Insufficient source volume of CPD1']);
      renderModal({ checkpointTracker: tracker });

      expect(screen.getByRole('button', { name: 'Cannot Continue' })).toBeDisabled();
      expect(screen.queryByRole('button', { name: 'Continue' })).not.toBeInTheDocument();
    });

    it('fires the cancel and close handlers', () => {
      const { handleCancel, handleClose } = renderModal();

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(handleCancel).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByRole('button', { name: 'Close' }));
      expect(handleClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('calculation summary', () => {
    it('renders the precalculator totals', () => {
      renderModal();

      expect(screen.getByText('Destination Plates:').closest('p')!).toHaveTextContent('Destination Plates: 3');
      expect(screen.getByText('Total Compounds:').closest('p')!).toHaveTextContent('Total Compounds: 2');
      expect(screen.getByText('Total Patterns:').closest('p')!).toHaveTextContent('Total Patterns: 2');
    });

    it('converts DMSO volumes for display', () => {
      renderModal();

      expect(screen.getByText('DMSO Required (estimated):').closest('p')!).toHaveTextContent('1234.57 µL');
      expect(screen.getByText('DMSO Max Per Well (estimated):').closest('p')!).toHaveTextContent('62.50 nL');
      expect(screen.getByText('DMSO on Source (usable):').closest('p')!).toHaveTextContent('45.0 µL (2 wells)');
    });

    it('is omitted when there is no precalculator', () => {
      renderModal({ echoPreCalc: null });

      expect(screen.queryByText('Calculation Summary')).not.toBeInTheDocument();
    });
  });

  describe('dead volume editing', () => {
    it('renders an input per source plate showing that plate dead volume in µL', () => {
      renderModal();

      expect(screen.getByLabelText('SRC1')).toHaveValue(12);
      expect(screen.getByLabelText('SRC2')).toHaveValue(4);
    });

    it('pushes an edited volume back in nL and hands up a new precalculator and tracker', () => {
      const tracker = buildTracker();
      const preCalc = buildPreCalc(tracker);
      const updateSpy = jest.spyOn(preCalc, 'updateDeadVolume').mockImplementation(() => { });
      const { setEchoPreCalc, setCheckpointTracker } = renderModal({ checkpointTracker: tracker, echoPreCalc: preCalc });

      fireEvent.change(screen.getByLabelText('SRC1'), { target: { value: '20' } });
      fireEvent.click(updateButton());

      expect(updateSpy).toHaveBeenCalledTimes(1);
      expect(updateSpy).toHaveBeenCalledWith('SRC1', 20000);

      const nextPreCalc = setEchoPreCalc.mock.calls[0][0];
      expect(nextPreCalc).toBeInstanceOf(EchoPreCalculator);
      expect(nextPreCalc).not.toBe(preCalc);

      const nextTracker = setCheckpointTracker.mock.calls[0][0];
      expect(nextTracker).toBeInstanceOf(CheckpointTracker);
      expect(nextTracker).not.toBe(tracker);
    });

    it('leaves untouched plates alone', () => {
      const tracker = buildTracker();
      const preCalc = buildPreCalc(tracker);
      const updateSpy = jest.spyOn(preCalc, 'updateDeadVolume').mockImplementation(() => { });
      renderModal({ checkpointTracker: tracker, echoPreCalc: preCalc });

      fireEvent.change(screen.getByLabelText('SRC2'), { target: { value: '6' } });
      fireEvent.click(updateButton());

      expect(updateSpy).toHaveBeenCalledTimes(1);
      expect(updateSpy).toHaveBeenCalledWith('SRC2', 6000);
    });

    it('does nothing when nothing has been edited', () => {
      const tracker = buildTracker();
      const preCalc = buildPreCalc(tracker);
      const updateSpy = jest.spyOn(preCalc, 'updateDeadVolume').mockImplementation(() => { });
      const { setEchoPreCalc, setCheckpointTracker } = renderModal({ checkpointTracker: tracker, echoPreCalc: preCalc });

      fireEvent.click(updateButton());

      expect(updateSpy).not.toHaveBeenCalled();
      expect(setEchoPreCalc).not.toHaveBeenCalled();
      expect(setCheckpointTracker).not.toHaveBeenCalled();
    });

    it('does nothing when an edit matches the plate value', () => {
      const tracker = buildTracker();
      const preCalc = buildPreCalc(tracker);
      const updateSpy = jest.spyOn(preCalc, 'updateDeadVolume').mockImplementation(() => { });
      const { setEchoPreCalc } = renderModal({ checkpointTracker: tracker, echoPreCalc: preCalc });

      fireEvent.change(screen.getByLabelText('SRC1'), { target: { value: '12' } });
      fireEvent.click(updateButton());

      expect(updateSpy).not.toHaveBeenCalled();
      expect(setEchoPreCalc).not.toHaveBeenCalled();
    });

    it('rejects negative and non-numeric entries', () => {
      renderModal();
      const input = screen.getByLabelText('SRC1');

      fireEvent.change(input, { target: { value: '-1' } });
      expect(input).toHaveValue(12);

      fireEvent.change(input, { target: { value: 'abc' } });
      expect(input).toHaveValue(12);
    });

    it('discards pending edits when a different precalculator arrives', () => {
      const { rerenderWith } = renderModal();

      fireEvent.change(screen.getByLabelText('SRC1'), { target: { value: '20' } });
      expect(screen.getByLabelText('SRC1')).toHaveValue(20);

      const nextTracker = buildTracker();
      rerenderWith({ checkpointTracker: nextTracker, echoPreCalc: buildPreCalc(nextTracker) });

      expect(screen.getByLabelText('SRC1')).toHaveValue(12);
    });

    it('is omitted when there are no source plates', () => {
      const tracker = buildTracker();
      const preCalc = buildPreCalc(tracker);
      preCalc.sourcePlates = [];
      renderModal({ checkpointTracker: tracker, echoPreCalc: preCalc });

      expect(screen.queryByText('Source Plate Dead Volumes (µL)')).not.toBeInTheDocument();
    });

    it('is omitted and the update button disabled when there is no precalculator', () => {
      renderModal({ echoPreCalc: null });

      expect(screen.queryByText('Source Plate Dead Volumes (µL)')).not.toBeInTheDocument();
      expect(updateButton()).toBeDisabled();
    });
  });
});