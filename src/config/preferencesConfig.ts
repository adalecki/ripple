export type SettingType = 'number' | 'select' | 'switch';

export interface SettingOption {
  value: string | number;
  label: string;
}

export interface Setting {
  prefId: string;
  name: string;
  type: SettingType;
  defaultValue: any;
  unit?: string;
  step?: number;
  options?: SettingOption[];  // For select types
}

export interface SettingCategory {
  id: string;
  label: string;
  settings: Setting[];
}

export const PREFERENCES_CONFIG: SettingCategory[] = [
  {
    id: 'transfer-settings',
    label: 'Transfer Settings',
    settings: [
      {
        prefId: 'maxTransferVolume',
        name: 'Max Transfer Volume',
        type: 'number',
        defaultValue: 500,
        unit: 'nL'
      },
      {
        prefId: 'dropletSize',
        name: 'Echo Droplet Size',
        type: 'select',
        defaultValue: 2.5,
        unit: 'nL',
        options: [
          { value: 2.5, label: '2.5' },
          { value: 25, label: '25' }
        ]
      },
      {
        prefId: 'sourcePlateSize',
        name: 'Source Plate Size',
        type: 'select',
        defaultValue: '384',
        options: [
          { value: '384', label: '384'},
          { value: '1536', label: '1536'}
        ]
      },
      {
        prefId: 'destinationPlateSize',
        name: 'Destination Plate Size',
        type: 'select',
        defaultValue: '384',
        options: [
          { value: '96', label: '96'},
          { value: '384', label: '384'},
          { value: '1536', label: '1536'}
        ]
      },
      {
        prefId: 'splitOutputCSVs',
        name: 'Split Output CSVs',
        type: 'switch',
        defaultValue: true
      }
    ]
  },
  {
    id: 'calculator-defaults',
    label: 'Default Calculator Values',
    settings: [
      {
        prefId: 'defaultDMSOTolerance',
        name: 'DMSO Tolerance',
        type: 'number',
        defaultValue: 0.005,
        step: 0.001
      },
      {
        prefId: 'defaultAssayVolume',
        name: 'Well Volume (µL)',
        type: 'number',
        defaultValue: 25,
        unit: 'µL'
      },
      {
        prefId: 'defaultBackfill',
        name: 'Backfill (µL)',
        type: 'number',
        defaultValue: 10,
        unit: 'µL'
      },
      {
        prefId: 'defaultEchoDeadVolume',
        name: 'Echo Dead Volume (µL)',
        type: 'number',
        defaultValue: 2.5,
        unit: 'µL'
      },
      {
        prefId: 'defaultAllowedError',
        name: 'Allowed Error',
        type: 'number',
        defaultValue: 0.1,
        step: 0.01
      },
      {
        prefId: 'defaultDestinationReplicates',
        name: 'Destination Replicates',
        type: 'number',
        defaultValue: 1
      },
      {
        prefId: 'useIntermediatePlates',
        name: 'Use Intermediate Plates',
        type: 'switch',
        defaultValue: true
      },
      {
        prefId: 'dmsoNormalization',
        name: 'DMSO Normalization',
        type: 'switch',
        defaultValue: true
      }
    ]
  }
];
