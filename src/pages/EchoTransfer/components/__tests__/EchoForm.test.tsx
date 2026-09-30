import { render, screen, fireEvent } from '@testing-library/react';
import EchoForm from '../EchoForm';
import { usePreferences } from '../../../../hooks/usePreferences';
import { PREFERENCES_CONFIG } from '../../../../config/preferencesConfig';
import { act } from 'react';
import { read, utils as xlsxUtils } from 'xlsx';
import { fileHeaders } from '../../utils/validationUtils';
import '@testing-library/jest-dom';

jest.mock('../../../../hooks/usePreferences', () => ({
  usePreferences: jest.fn(),
}));

jest.mock('xlsx', () => ({
  read: jest.fn(),
  utils: {
    sheet_to_json: jest.fn(),
  }
}));

jest.mock('../../utils/validationUtils', () => {
  const originalModule = jest.requireActual('../../utils/validationUtils');
  return {
    __esModule: true,
    ...originalModule,
    fileHeaders: jest.fn().mockReturnValue(true),
  };
});
interface MockPreferences {
  defaultDMSOTolerance: number;
  defaultAssayVolume: number;
  defaultBackfill: number;
  defaultAllowedError: number;
  someSwitchPreference: boolean;
  [key: string]: any;
}

const mockDefaultPreferences: MockPreferences = {
  defaultDMSOTolerance: 0.5,
  defaultAssayVolume: 100,
  defaultBackfill: 50,
  defaultAllowedError: 0.1,
  someSwitchPreference: false,
};

const calculatorDefaultsGroup = PREFERENCES_CONFIG.find(p => p.id === 'calculator-defaults');
const mockFields = calculatorDefaultsGroup?.settings || [];
const mockPreferences = mockFields.reduce((acc, field) => {
  acc[field.prefId] = mockDefaultPreferences[field.prefId] !== undefined
    ? mockDefaultPreferences[field.prefId]
    : (field.defaultValue !== undefined
      ? field.defaultValue
      : (field.type === 'switch' ? false : (field.type === 'number' ? 0 : '')));
  return acc;
}, { ...mockDefaultPreferences });


const originalCheckValidity = HTMLFormElement.prototype.checkValidity;

describe('EchoForm', () => {
  const mockOnSubmit = jest.fn();
  const mockSetExcelFile = jest.fn();
  const mockSetTransferFile = jest.fn();
  const mockHandleClear = jest.fn();

  beforeEach(() => {
    (usePreferences as jest.Mock).mockReturnValue({ preferences: mockPreferences });
    mockOnSubmit.mockClear();
    mockSetExcelFile.mockClear();
    mockSetTransferFile.mockClear();
    mockHandleClear.mockClear();
    (read as jest.Mock).mockReset();
    (xlsxUtils.sheet_to_json as jest.Mock).mockReset();
    (fileHeaders as jest.Mock).mockClear().mockReturnValue(true);
  });

  afterEach(() => {
    HTMLFormElement.prototype.checkValidity = originalCheckValidity;
  });

  const defaultProps = {
    onSubmit: mockOnSubmit,
    excelFile: null,
    setExcelFile: mockSetExcelFile,
    transferFile: null,
    setTransferFile: undefined,
    submitText: 'Test Submit',
    handleClear: mockHandleClear,
  };

  it('renders correctly with default props', () => {
    render(<EchoForm {...defaultProps} />);
    expect(screen.getByLabelText(/Ripple Input/i)).toBeInTheDocument();
    //labels are the config names so they can be copied straight into a workbook Assay tab
    for (const field of mockFields) {
      if (['useSurveyVols', 'dmsoNormalization', 'targetDMSOVol'].includes(field.prefId)) continue;
      expect(screen.getByLabelText(field.name)).toBeInTheDocument();
    }
    expect(screen.queryByLabelText('Target DMSO Volume (nL)')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Use Source Survey Volumes')).not.toBeInTheDocument();
  });

  it('renders correctly without optional transfer file props', () => {
    render(<EchoForm {...defaultProps} />);
    expect(screen.getByLabelText(/Ripple Input/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Transfer Log \(CSV\)/i)).not.toBeInTheDocument();
  });

  it('calls setExcelFile when Excel file input changes', async () => {
    render(<EchoForm {...defaultProps} />);
    const excelInput = screen.getByLabelText(/Ripple Input/i);
    const testFile = new File(['excel content'], 'test.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    await act(async () => { fireEvent.change(excelInput, { target: { files: [testFile] } }); });
    expect(mockSetExcelFile).toHaveBeenCalledWith(testFile);
  });

  it('calls setTransferFile when Transfer Log file input changes', async () => {
    const propsWithTransfer = { ...defaultProps, setTransferFile: mockSetTransferFile };
    render(<EchoForm {...propsWithTransfer} />);
    const transferInput = screen.getByLabelText(/Transfer Log/i);
    const testFile = new File(['csv content'], 'test.csv', { type: 'text/csv' });
    await act(async () => { fireEvent.change(transferInput, { target: { files: [testFile] } }); });
    expect(mockSetTransferFile).toHaveBeenCalledWith(testFile);
  });


  it('calls onSubmit when form is submitted with required files', async () => {
    HTMLFormElement.prototype.checkValidity = jest.fn().mockReturnValue(true);
    const excelFile = new File(['excel'], 'excel.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const transferFile = new File(['csv'], 'transfer.csv', { type: 'text/csv' });
    render(<EchoForm
      {...defaultProps}
      excelFile={excelFile}
      transferFile={transferFile}
      setTransferFile={mockSetTransferFile}
    />);

    const excelFileInput = screen.getByLabelText(/Ripple Input/i);
    const transferFileInput = screen.getByLabelText(/Transfer Log/i);

    await act(async () => {
      fireEvent.change(excelFileInput, { target: { files: [excelFile] } });
      fireEvent.change(transferFileInput, { target: { files: [transferFile] } });
    });


    const submitButton = screen.getByText('Test Submit');
    expect(submitButton).not.toBeDisabled();

    await act(async () => { fireEvent.click(submitButton); });

    expect(mockOnSubmit).toHaveBeenCalledTimes(1);
    expect(mockOnSubmit).toHaveBeenCalledWith(expect.any(FormData));
    jest.restoreAllMocks();
  });

  it('onSubmit sees files in formData submitted with both files', async () => {
    HTMLFormElement.prototype.checkValidity = jest.fn().mockReturnValue(true);

    const excelFile = new File(['excel content'], 'test.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const transferFile = new File(['csv content'], 'transfer.csv', { type: 'text/csv' });

    const capturedValues: { [key: string]: any } = {};

    const handleSubmit = jest.fn(async (formData: FormData) => {
      for (const [key, value] of formData.entries()) {
        capturedValues[key] = value;
      }
    });

    render(<EchoForm
      {...defaultProps}
      excelFile={excelFile}
      transferFile={transferFile}
      setTransferFile={mockSetTransferFile}
      onSubmit={handleSubmit}
    />);

    const excelInput = screen.getByLabelText(/Ripple Input/i);
    const transferInput = screen.getByLabelText(/Transfer Log/i);
    const submitButton = screen.getByText('Test Submit');

    await act(async () => {
      fireEvent.change(excelInput, { target: { files: [excelFile] } });
      fireEvent.change(transferInput, { target: { files: [transferFile] } });
    });

    await act(async () => {
      fireEvent.click(submitButton);
    });

    expect(handleSubmit).toHaveBeenCalledTimes(1);

    expect(capturedValues['excelFile']).toBeInstanceOf(File);
    expect(capturedValues['transferFile']).toBeInstanceOf(File);
  });

  it('does not call onSubmit and submit button is disabled if excelFile is missing', async () => {
    const propsWithoutExcel = {
      ...defaultProps,
      excelFile: null,
      transferFile: new File(['csv'], 'transfer.csv', { type: 'text/csv' }),
    };
    render(<EchoForm {...propsWithoutExcel} />);
    const submitButton = screen.getByText('Test Submit');
    expect(submitButton).toBeDisabled();
    await act(async () => { fireEvent.click(submitButton); });
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('does not call onSubmit and submit button is disabled if transferFile is missing (when required)', () => {
    const propsWithoutTransfer = {
      ...defaultProps,
      excelFile: new File(['excel'], 'excel.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      transferFile: null,
      setTransferFile: mockSetTransferFile
    };
    render(<EchoForm {...propsWithoutTransfer} />);
    const submitButton = screen.getByText('Test Submit');
    expect(submitButton).toBeDisabled();
    fireEvent.click(submitButton);
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('submit button is enabled if excelFile is present and transferFile is not required', async () => {
    const propsWithoutTransferRequirement = {
      ...defaultProps,
      excelFile: new File(['excel'], 'excel.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      transferFile: undefined,
      setTransferFile: undefined,
    };
    render(<EchoForm {...propsWithoutTransferRequirement} />);
    const submitButton = screen.getByText('Test Submit');
    expect(submitButton).not.toBeDisabled();
    await act(async () => { fireEvent.click(submitButton); });
    expect(mockOnSubmit).toHaveBeenCalledTimes(1);
  });

  it('updates formValues when a preference field (number input) changes', async () => {
    render(<EchoForm {...defaultProps} />);
    const numberInput = screen.getByLabelText('Well Volume (µL)');
    expect(numberInput).toHaveValue(mockPreferences.defaultAssayVolume);
    await act(async () => { fireEvent.change(numberInput, { target: { value: '0.8' } }); });
    expect(numberInput).toHaveValue(0.8);
  });

  it('updates formValues when a switch field changes', () => {
    render(<EchoForm {...defaultProps} />);
    const switchInput = screen.getByLabelText('Use Intermediate Plates') as HTMLInputElement;
    const initialSwitchValue = !!mockPreferences.useIntermediatePlates;
    expect(switchInput.checked).toBe(initialSwitchValue);
    fireEvent.click(switchInput);
    expect(switchInput.checked).toBe(!initialSwitchValue);
  });

  it('calls handleClear when Clear Plates button is clicked initially', () => {
    render(<EchoForm {...defaultProps} />);
    const clearButton = screen.getByText('Clear Plates');
    fireEvent.click(clearButton);
    expect(mockHandleClear).toHaveBeenCalledTimes(1);
  });


  describe('Excel file "Assay" tab processing', () => {
    const excelFile = new File(['excel content'], 'test.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    it('updates form values and shows alert when "Assay" tab provides valid data', async () => {
      render(<EchoForm {...defaultProps} />);
      const mockAssayData = [
        { Setting: 'DMSO Tolerance', Value: 0.99 },
        { Setting: 'Well Volume (µL)', Value: 150 },
        { Setting: 'NonExistentField', Value: 100 },
        { Setting: 'Allowed Error', Value: 'not-a-number' },
      ];
      const mockAssaySheet = { '!ref': 'A1:B4' };
      (read as jest.Mock).mockReturnValue({
        SheetNames: ['Sheet1', 'Assay'], Sheets: { 'Sheet1': {}, 'Assay': mockAssaySheet }
      });
      (xlsxUtils.sheet_to_json as jest.Mock).mockImplementation((sheet) => sheet === mockAssaySheet ? mockAssayData : []);

      const excelInput = screen.getByLabelText(/Ripple Input/i);
      await act(async () => { fireEvent.change(excelInput, { target: { files: [excelFile] } }); });

      expect(mockSetExcelFile).toHaveBeenCalledWith(excelFile);
      expect(xlsxUtils.sheet_to_json).toHaveBeenCalledWith(mockAssaySheet);

      expect(screen.getByLabelText('DMSO Tolerance')).toHaveValue(0.99);
      expect(screen.getByLabelText('Well Volume (µL)')).toHaveValue(150);
      expect(screen.getByLabelText('Allowed Error')).toHaveValue(mockPreferences.defaultAllowedError);

      const alert = screen.getByRole('alert');
      expect(alert).toBeVisible();
      expect(alert).toHaveTextContent('DMSO Tolerance');
      expect(alert).toHaveTextContent('Well Volume (µL)');
      expect(alert).not.toHaveTextContent(/NonExistentField/i);
      expect(alert).not.toHaveTextContent('Allowed Error');
      expect(isPlatesOpen()).toBe(true);
    });

    it('does not update form values or show alert if "Assay" tab is missing', async () => {
      render(<EchoForm {...defaultProps} />);
      (read as jest.Mock).mockReturnValue({ SheetNames: ['Sheet1'], Sheets: { 'Sheet1': {} } });
      const excelInput = screen.getByLabelText(/Ripple Input/i);
      await act(async () => { fireEvent.change(excelInput, { target: { files: [excelFile] } }); });
      expect(xlsxUtils.sheet_to_json).not.toHaveBeenCalled();
      const alert = screen.queryByRole('alert');
      if (alert) expect(alert).not.toBeVisible();
    });

    it('does not update values or show alert if "Assay" tab has no valid "Setting" or "Value" columns', async () => {
      render(<EchoForm {...defaultProps} />);
      (fileHeaders as jest.Mock).mockReturnValue(false);
      const mockAssaySheet = { A1: { t: 's', v: 'WrongHeader1' }, B1: { t: 's', v: 'WrongHeader2' } };
      (read as jest.Mock).mockReturnValue({ SheetNames: ['Assay'], Sheets: { 'Assay': mockAssaySheet } });
      (xlsxUtils.sheet_to_json as jest.Mock).mockReturnValue([{ NotASetting: 'SomeVal', NotAValue: 'AnotherVal' }]);
      const excelInput = screen.getByLabelText(/Ripple Input/i);
      await act(async () => { fireEvent.change(excelInput, { target: { files: [excelFile] } }); });
      const alert = screen.queryByRole('alert');
      if (alert) expect(alert).not.toBeVisible();
    });

    test('importing a Plates & Echo field opens that section so the change is visible', async () => {
      render(<EchoForm {...defaultProps} />);
      const mockAssaySheet = { '!ref': 'A1:B2' };
      (read as jest.Mock).mockReturnValue({ SheetNames: ['Assay'], Sheets: { 'Assay': mockAssaySheet } });
      (xlsxUtils.sheet_to_json as jest.Mock).mockReturnValue([{ Setting: 'Backfill (µL)', Value: 20 }]);
      expect(isPlatesOpen()).toBe(true);
      await act(async () => { fireEvent.change(screen.getByLabelText(/Ripple Input/i), { target: { files: [excelFile] } }); });
      expect(isPlatesOpen()).toBe(true);
      expect(screen.getByLabelText('Backfill (µL)')).toHaveValue(20);
    });
    test('a switch already on is not flagged when the file stores it as 1', async () => {
      render(<EchoForm {...defaultProps} />);
      await uploadAssay([{ Setting: 'Use Intermediate Plates', Value: 1 }, { Setting: 'DMSO Normalization', Value: 1 }]);
      const alert = screen.queryByRole('alert');
      if (alert) expect(alert).not.toBeVisible();
    });

    describe('DMSO mode from the Normalization and Target rows', () => {
      test('Normalization 0 turns normalization off even when a target is given', async () => {
        render(<EchoForm {...defaultProps} />);
        await uploadAssay([{ Setting: 'DMSO Normalization', Value: 0 }, { Setting: 'Target DMSO Volume (nL)', Value: 500 }]);
        expect(dmsoModeButton('Off')).toHaveClass('btn-primary');
        expect(screen.queryByLabelText('Target DMSO Volume (nL)')).not.toBeInTheDocument();
        expect(screen.getByRole('alert')).toHaveTextContent('DMSO Normalization');
      });

      test('Normalization 1 with a target selects Fixed Volume at that target', async () => {
        render(<EchoForm {...defaultProps} />);
        await uploadAssay([{ Setting: 'DMSO Normalization', Value: 1 }, { Setting: 'Target DMSO Volume (nL)', Value: 500 }]);
        expect(dmsoModeButton('Fixed Volume')).toHaveClass('btn-primary');
        expect(screen.getByLabelText('Target DMSO Volume (nL)')).toHaveValue(500);
        expect(screen.getByRole('alert')).toHaveTextContent('Target DMSO Volume (nL)');
      });

      test('Normalization 1 without a target switches Fixed Volume back to Match Highest', async () => {
        render(<EchoForm {...defaultProps} />);
        fireEvent.click(dmsoModeButton('Fixed Volume'));
        await uploadAssay([{ Setting: 'DMSO Normalization', Value: 1 }]);
        expect(dmsoModeButton('Match Highest')).toHaveClass('btn-primary');
        expect(screen.getByRole('alert')).toHaveTextContent('DMSO Normalization');
      });

      test('a target without a Normalization row turns normalization on at Fixed Volume', async () => {
        render(<EchoForm {...defaultProps} />);
        fireEvent.click(dmsoModeButton('Off'));
        await uploadAssay([{ Setting: 'Target DMSO Volume (nL)', Value: 500 }]);
        expect(dmsoModeButton('Fixed Volume')).toHaveClass('btn-primary');
        expect(screen.getByLabelText('Target DMSO Volume (nL)')).toHaveValue(500);
      });

      test('neither row leaves the current mode alone', async () => {
        render(<EchoForm {...defaultProps} />);
        fireEvent.click(dmsoModeButton('Fixed Volume'));
        await uploadAssay([{ Setting: 'Well Volume (µL)', Value: 150 }]);
        expect(dmsoModeButton('Fixed Volume')).toHaveClass('btn-primary');
        expect(screen.getByRole('alert')).not.toHaveTextContent('DMSO Normalization');
      });
    });
  });

  describe('submitted FormData', () => {
    const excelFile = new File(['excel'], 'excel.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const defaultSubmission = {
      'Well Volume (µL)': '100',
      'DMSO Tolerance': '0.5',
      'Allowed Error': '0.1',
      'Destination Replicates': '1',
      'DMSO Normalization': 'on',
      'Skip Unused Treatment Blocks': 'on',
      'Source Plate Size': '384',
      'Destination Plate Size': '384',
      'Echo Droplet Size': '2.5',
      'Max Transfer Volume': '500',
      'Use Intermediate Plates': 'on',
      'Backfill (µL)': '50'
    };

    test('default submission carries the same keys and values the calculator has always parsed', async () => {
      render(<EchoForm {...defaultProps} excelFile={excelFile} />);
      const captured = await submitAndCapture();
      expect(captured.excelFile).toBeInstanceOf(File);
      delete captured.excelFile;
      expect(captured).toEqual(defaultSubmission);
    });

    test('Off mode drops normalization and skip-unused, matching an unchecked normalization switch', async () => {
      render(<EchoForm {...defaultProps} excelFile={excelFile} />);
      fireEvent.click(screen.getByRole('button', { name: 'Off' }));
      const captured = await submitAndCapture();
      expect(captured).not.toHaveProperty('DMSO Normalization');
      expect(captured).not.toHaveProperty('Skip Unused Treatment Blocks');
      expect(captured).not.toHaveProperty('Target DMSO Volume (nL)');
    });

    test('Fixed mode submits the target volume and still submits the tolerance the calculator requires', async () => {
      render(<EchoForm {...defaultProps} excelFile={excelFile} />);
      fireEvent.click(screen.getByRole('button', { name: 'Fixed Volume' }));
      expect(screen.getByLabelText('DMSO Tolerance')).toBeDisabled();
      fireEvent.change(screen.getByLabelText('Target DMSO Volume (nL)'), { target: { value: '1000' } });
      const captured = await submitAndCapture();
      expect(captured['Target DMSO Volume (nL)']).toBe('1000');
      expect(captured['DMSO Normalization']).toBe('on');
      expect(captured['DMSO Tolerance']).toBe('0.5');
    });

    test('switching from Fixed back to Match Highest omits the target so the calculator auto-targets', async () => {
      render(<EchoForm {...defaultProps} excelFile={excelFile} />);
      fireEvent.click(screen.getByRole('button', { name: 'Fixed Volume' }));
      fireEvent.change(screen.getByLabelText('Target DMSO Volume (nL)'), { target: { value: '1000' } });
      fireEvent.click(screen.getByRole('button', { name: 'Match Highest' }));
      const captured = await submitAndCapture();
      expect(captured).not.toHaveProperty('Target DMSO Volume (nL)');
      expect(captured['DMSO Normalization']).toBe('on');
    });
  });
});

function dmsoModeButton(label: string) {
  return screen.getByRole('button', { name: label });
}

async function uploadAssay(rows: { Setting: string, Value: number }[]) {
  const mockAssaySheet = { '!ref': 'A1:B2' };
  (read as jest.Mock).mockReturnValue({ SheetNames: ['Assay'], Sheets: { 'Assay': mockAssaySheet } });
  (xlsxUtils.sheet_to_json as jest.Mock).mockReturnValue(rows);
  const excelFile = new File(['excel content'], 'test.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  await act(async () => { fireEvent.change(screen.getByLabelText(/Ripple Input/i), { target: { files: [excelFile] } }); });
}

function isPlatesOpen() {
  return screen.getByLabelText('Source Plate Size').closest('.d-none') === null;
}

async function submitAndCapture() {
  const captured: { [key: string]: any } = {};
  const form = screen.getByText('Test Submit').closest('form')!;
  const formData = new FormData(form);
  expect(form.checkValidity()).toBe(true);
  for (const [key, value] of formData.entries()) {
    captured[key] = value;
  }
  return captured;
}
