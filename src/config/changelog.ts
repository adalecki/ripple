export interface ChangelogEntry {
  version: string;
  date: string;
  changes: ChangeEntry[];
}

export interface ChangeEntry {
  type: 'UI' | 'Backend';
  text: string;
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.0.1',
    date: '2026-09-02',
    changes: [
      {type: 'Backend', text: 'Refactor precalculator class to pull functions into utils file instead of living on class'},
      {type: 'Backend', text: 'Implemented saving dead volumes on plate object instead of precalculator object'},
      {type: 'UI', text: 'Added changelog plus alert'}
    ]
  },
  {
    version: '1.0.0',
    date: '2026-08-25',
    changes: [
      {type: 'UI', text: 'Added combinations editable from designer interface, changed to Combination-N notation'},
      {type: 'UI', text: 'Added Cocktail Builder tool for volume-based arbitrary combinations'},
      {type: 'Backend', text: 'Added endpoint test suite checking final transfer list files against known good copies'},
      {type: 'Backend', text: 'Fixed bug in intermediate conc generation when solvent limit is very high'}
    ]
  },
  {
    version: '0.9.0',
    date: '2026-07-01',
    changes: [
      {type: 'Backend', text: 'Changed to use HTML Canvas for plate view everywhere'},
      {type: 'Backend', text: 'Updated README'},
      {type: 'UI', text: 'Added transfer settings to form in Transfer Calculator'},
      {type: 'UI', text: 'Import/Export reformat schemes in Plate Reformat'}
    ]
  },
  {
    version: '0.8.9',
    date: '2026-04-21',
    changes: [
      {type: 'UI', text: 'Added destination map download in Transfer Calculator'}
    ]
  }
];