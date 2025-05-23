import { utils, writeFile, WorkBook } from 'xlsx';
import { Pattern } from '../classes/PatternClass';

export function generateExcelTemplate(patterns: Pattern[]) {
  // Create a new workbook
  const wb: WorkBook = utils.book_new();

  // Create Patterns sheet
  const patternsData = patterns.map(pattern => {
    const baseData: any = {
      Pattern: pattern.name,
      Type: pattern.type,
      Direction: pattern.type === 'Unused' ? '' : pattern.direction[0],
      Replicates: pattern.type === 'Unused' ? '' : pattern.replicates,
    };

    // Add concentration columns up to Conc20
    for (let i = 1; i <= 20; i++) {
      baseData[`Conc${i}`] = pattern.type === 'Unused' ? null : (pattern.concentrations[i - 1] || null);
    }

    return baseData;
  });

  const patternsWs = utils.json_to_sheet(patternsData);
  
  // Ensure all headers are present
  const patternsHeaders = [
    "Pattern", "Type", "Direction", "Replicates",
    ...Array.from({length: 20}, (_, i) => `Conc${i + 1}`)
  ];
  utils.sheet_add_aoa(patternsWs, [patternsHeaders], { origin: "A1" });
  
  utils.book_append_sheet(wb, patternsWs, "Patterns");

  // Create Layout sheet
  const layoutData = patterns.flatMap(pattern => 
    pattern.locations.map(location => ({
      Pattern: pattern.name,
      "Well Block": location
    }))
  );
  const layoutWs = utils.json_to_sheet(layoutData);
  utils.book_append_sheet(wb, layoutWs, "Layout");

  // Create Compounds sheet (empty with headers)
  const compoundsHeaders = ["Source Barcode", "Well ID", "Concentration (µM)", "Compound ID", "Volume (µL)", "Pattern"];
  const compoundsWs = utils.aoa_to_sheet([compoundsHeaders]);
  utils.book_append_sheet(wb, compoundsWs, "Compounds");

  // Create Barcodes sheet (empty with headers)
  const barcodesHeaders = ["Intermediate Plate Barcodes", "Destination Plate Barcodes"];
  const barcodesWs = utils.aoa_to_sheet([barcodesHeaders]);
  utils.book_append_sheet(wb, barcodesWs, "Barcodes");

  // Generate and download the Excel file
  const fileName = `Echo_Template_${new Date().toISOString().split('T')[0]}.xlsx`;
  writeFile(wb, fileName);
}