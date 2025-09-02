import { render, screen, fireEvent } from '@testing-library/react';
import EchoForm from '../EchoForm';
import { usePreferences } from '../../../../hooks/usePreferences';
import { PREFERENCES_CONFIG } from '../../../../config/preferencesConfig';
import { act } from 'react'; 
import { read, utils as xlsxUtils } from 'xlsx'; 
import { fileHeaders } from '../../utils/validationUtils'
import '@testing-library/jest-dom'

// Mock dependencies
jest.mock('../../../../hooks/usePreferences', () => ({
  usePreferences: jest.fn(),
}));

// Mock the xlsx library
jest.mock('xlsx', () => ({
  read: jest.fn(),
  utils: {
    sheet_to_json: jest.fn(),
  }
}));

// Mock validationUtils to control fileHeaders behavior
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
    mockFields.forEach(field => {
      if (field.prefId != 'useSurveyVols') expect(screen.getByLabelText(field.name)).toBeInTheDocument();
    });
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
    await act(async () => { fireEvent.change(excelInput, { target: { files: [testFile] } }); })
    expect(mockSetExcelFile).toHaveBeenCalledWith(testFile);
  });

  it('calls setTransferFile when Transfer Log file input changes', async () => {
    const propsWithTransfer = { ...defaultProps, setTransferFile: mockSetTransferFile };
    render(<EchoForm {...propsWithTransfer} />);
    const transferInput = screen.getByLabelText(/Transfer Log/i);
    const testFile = new File(['csv content'], 'test.csv', { type: 'text/csv' });
    await act(async () => { fireEvent.change(transferInput, { target: { files: [testFile] } }); })
    expect(mockSetTransferFile).toHaveBeenCalledWith(testFile);
  });


  it('calls onSubmit when form is submitted with required files', async () => {
    HTMLFormElement.prototype.checkValidity = jest.fn().mockReturnValue(true)
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

    await act(async () => { fireEvent.click(submitButton); })

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
    for (let [key, value] of formData.entries()) {
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
  console.log(capturedValues)

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
    await act(async () => { fireEvent.click(submitButton); })
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
    await act(async () => { fireEvent.click(submitButton); })
    expect(mockOnSubmit).toHaveBeenCalledTimes(1);
  });

  it('updates formValues when a preference field (number input) changes', async () => {
    render(<EchoForm {...defaultProps} />);
    const numberFieldInfo = mockFields.find(f => f.type === 'number' && f.name === 'DMSO Tolerance');
    if (!numberFieldInfo) {
      console.warn("Skipping formValues update test for number input: 'DMSO Tolerance' field not found or not a number input in mockFields.");
      return;
    }
    const numberInput = screen.getByLabelText(new RegExp(numberFieldInfo.name, "i"));
    expect(numberInput).toHaveValue(mockPreferences[numberFieldInfo.prefId]); 
    await act(async () => { fireEvent.change(numberInput, { target: { value: '0.8' } }); })
    expect(numberInput).toHaveValue(0.8); 
  });

  it('updates formValues when a switch field changes', () => {
    render(<EchoForm {...defaultProps} />);
    const switchFieldInfo = mockFields.find(f => f.type === 'switch');
    if (!switchFieldInfo) {
        console.warn("Skipping switch field test: No switch field found in mockFields.");
        return;
    }
    const switchInput = screen.getByLabelText(new RegExp(switchFieldInfo.name, "i")) as HTMLInputElement;
    const initialSwitchValue = !!mockPreferences[switchFieldInfo.prefId]; 
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

      const dmsoField = mockFields.find(f => f.prefId === 'defaultDMSOTolerance');
      const assayVolField = mockFields.find(f => f.prefId === 'defaultAssayVolume');
      const allowedErrorField = mockFields.find(f => f.prefId === 'defaultAllowedError');

      if(dmsoField) expect(screen.getByLabelText(dmsoField.name)).toHaveValue(0.99);
      if(assayVolField) expect(screen.getByLabelText(assayVolField.name)).toHaveValue(150);
      if(allowedErrorField) expect(screen.getByLabelText(allowedErrorField.name)).toHaveValue(mockPreferences.defaultAllowedError);

      const alert = screen.getByRole('alert'); 
      expect(alert).toBeVisible();
      if(dmsoField) expect(alert).toHaveTextContent(dmsoField.name);
      if(assayVolField) expect(alert).toHaveTextContent(assayVolField.name);
      expect(alert).not.toHaveTextContent(/NonExistentField/i);
      if(allowedErrorField) expect(alert).not.toHaveTextContent(allowedErrorField.name);
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
        (read as jest.Mock).mockReturnValue({ SheetNames: ['Assay'], Sheets: { 'Assay': mockAssaySheet }});
        (xlsxUtils.sheet_to_json as jest.Mock).mockReturnValue([{ NotASetting: 'SomeVal', NotAValue: 'AnotherVal' }]);
        //const excelInput = screen.getByLabelText(/Input File \(Excel\)/i);
        const excelInput = screen.getByLabelText(/Ripple Input/i);
        await act(async () => { fireEvent.change(excelInput, { target: { files: [excelFile] } }); });
        const alert = screen.queryByRole('alert');
        if (alert) expect(alert).not.toBeVisible();
    });
  });
});
