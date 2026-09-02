export interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.1.1',
    date: '2026-09-01',
    changes: [
      'Refactor precalculator class to pull functions into utils file instead of living on class',
      'Implemented saving dead volumes on plate object instead of precalculator object',
      'Added changelog plus alert'
    ]
  },
  {
    version: '1.0.0',
    date: '2026-08-25',
    changes: [
      'Added combinations editable from designer interface, changed to Combination-N notation',
      'Added Cocktail Builder tool for volume-based arbitrary combinations',
      'Added endpoint test suite checking final transfer list files against known good copies',
      'Fixed bug in intermediate conc generation when solvent limit is very high'
    ]
  },
  {
    version: '0.9.0',
    date: '2026-07-01',
    changes: [
      'Changed to use HTML Canvas for plate view everywhere',
      'Updated README',
      'Added transfer settings to form in Transfer Calculator',
      'Import/Export reformat schemes in Plate Reformat'
    ]
  },
  {
    version: '0.8.9',
    date: '2026-04-21',
    changes: [
      'Added destination map download in Transfer Calculator'
    ]
  }
];