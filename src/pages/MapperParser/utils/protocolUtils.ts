import { Protocol } from '../../../types/mapperTypes';

const STORAGE_KEY = 'ripple-protocols';

export const defaultProtocols: Protocol[] = [
  {
    id: 2,
    name: 'Example Matrix Assay',
    description: 'Matrix format for biochemical assays',
    parseStrategy: {
      format: 'Matrix',
      plateSize: '384',
      xLabels: 'A09:X09',
      yLabels: 'A10:A25',
      rawData: 'B10:Y25',
      plateBarcodeLocation: 'filename',
      plateBarcodeCell: 'A01',
      useFullFilename: true,
      barcodeDelimiter: '_',
      barcodeChunk: 1,
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
    }
  }
];

export function loadProtocols(): Protocol[] {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (parsed.length == 0) return defaultProtocols
      
      const migrated = parsed.map((p: any) => {
        const protocol = {
          ...p
        };
        
        if (protocol.parseStrategy.useFullFilename === undefined) {
          const wasFullFilename = protocol.parseStrategy.barcodeDelimiter == null || 
                                 protocol.parseStrategy.barcodeDelimiter === '';
          protocol.parseStrategy.useFullFilename = wasFullFilename;
          
          if (!protocol.parseStrategy.barcodeDelimiter || protocol.parseStrategy.barcodeDelimiter === null) {
            protocol.parseStrategy.barcodeDelimiter = '_';
          }
          if (protocol.parseStrategy.barcodeChunk == null) {
            protocol.parseStrategy.barcodeChunk = 1;
          }
        }
        
        return protocol;
      });
      
      return migrated;
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
      useFullFilename: true,
      barcodeDelimiter: '_',
      barcodeChunk: 1,
      autoParse: false
    },
    metadataFields: [],
    dataProcessing: {
      controls: [],
      normalization: 'None'
    }
  };
}

export function duplicateProtocol(protocol: Protocol): Protocol {
  const newId = Date.now();
  
  return {
    ...JSON.parse(JSON.stringify(protocol)),
    id: newId,
    name: `${protocol.name} (Copy)`
  };
}

export function updateProtocol(protocols: Protocol[], protocolId: number, updates: Partial<Protocol>): Protocol[] {
  return protocols.map(p => 
    p.id === protocolId 
      ? { ...p, ...updates }
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