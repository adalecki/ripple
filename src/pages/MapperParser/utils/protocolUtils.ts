import { Protocol } from '../../../types/mapperTypes';

const STORAGE_KEY = 'ripple-protocols';

// Default protocols based on the provided JSON
export const defaultProtocols: Protocol[] = [
  {
    id: 1,
    name: 'Table Based',
    description: 'Standard table-based data format',
    parseStrategy: {
      format: 'Table',
      plateSize: '384',
      xLabels: 'F01:DA01',
      wellIDs: 'E02:E385',
      rawData: 'F02:DA385',
      plateBarcodeLocation: 'filename',
      autoParse: false
    },
    metadataFields: [
      {
        name: 'Protocol Version',
        type: 'PickList',
        required: false,
        defaultValue: 'v2.1',
        values: ['v2.0', 'v2.1']
      },
      {
        name: 'Operator',
        type: 'PickList',
        required: true,
        defaultValue: '',
        values: []
      },
      {
        name: 'Cell Line',
        type: 'PickList',
        required: true,
        defaultValue: '',
        values: ['CHO', 'HEK-293T', 'A549', 'MCF7']
      }
    ],
    dataProcessing: {
      controls: [],
      normalization: 'PctOfCtrl'
    },
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 2,
    name: 'Biochemical Assay',
    description: 'Matrix format for biochemical assays',
    parseStrategy: {
      format: 'Matrix',
      plateSize: '384',
      xLabels: 'A09:X09',
      yLabels: 'A10:A25',
      rawData: 'B10:Y25',
      plateBarcodeLocation: 'cell',
      plateBarcodeCell: 'A01',
      autoParse: true
    },
    metadataFields: [
      {
        name: 'Protocol Version',
        type: 'PickList',
        required: false,
        defaultValue: 'v2.1',
        values: ['v2.0', 'v2.1']
      },
      {
        name: 'Operator',
        type: 'PickList',
        required: true,
        defaultValue: '',
        values: []
      },
      {
        name: 'Species',
        type: 'PickList',
        required: false,
        defaultValue: 'Human',
        values: ['Human', 'Mouse', 'Rat', 'Dog', 'Monkey']
      },
      {
        name: 'Substrate',
        type: 'Free Text',
        required: true
      }
    ],
    dataProcessing: {
      controls: [
        { type: 'MaxCtrl', wells: 'A1:A24' },
        { type: 'MinCtrl', wells: 'P1:P24' }
      ],
      normalization: 'PctOfCtrl'
    },
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

export function loadProtocols(): Protocol[] {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      // Convert date strings back to Date objects
      return parsed.map((p: any) => ({
        ...p,
        createdAt: new Date(p.createdAt),
        updatedAt: new Date(p.updatedAt)
      }));
    } catch (e) {
      console.error('Failed to parse stored protocols:', e);
      return defaultProtocols;
    }
  }
  return defaultProtocols;
}

export function saveProtocols(protocols: Protocol[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(protocols));
}

export function createNewProtocol(existingProtocols: Protocol[]): Protocol {
  const existingIds = existingProtocols.map(p => p.id)
  let newId = Date.now()
  while (existingIds.includes(newId)) {
    newId += 1
  }
  return {
    id: newId,
    name: `New Protocol ${existingProtocols.length + 1}`,
    description: '',
    parseStrategy: {
      format: 'Matrix',
      plateSize: '384',
      rawData: '',
      plateBarcodeLocation: 'filename',
      autoParse: false
    },
    metadataFields: [],
    dataProcessing: {
      controls: [],
      normalization: 'None'
    },
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

export function duplicateProtocol(protocol: Protocol): Protocol {
  const newId = Date.now();
  
  return {
    ...JSON.parse(JSON.stringify(protocol)), // Deep clone
    id: newId,
    name: `${protocol.name} (Copy)`,
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

export function updateProtocol(protocols: Protocol[], protocolId: number, updates: Partial<Protocol>): Protocol[] {
  return protocols.map(p => 
    p.id === protocolId 
      ? { ...p, ...updates, updatedAt: new Date() }
      : p
  );
}

export function deleteProtocol(protocols: Protocol[], protocolId: number): Protocol[] {
  return protocols.filter(p => p.id !== protocolId);
}

export function getCurrentProtocol(protocols: Protocol[], selectedId: number | null): Protocol | null {
  if (!selectedId) return null;
  return protocols.find(p => p.id === selectedId) || null;
}