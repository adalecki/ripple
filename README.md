# Ripple

Ripple is a browser-based toolkit for planning and calculating acoustic liquid transfers on Beckman Coulter (Labcyte) Echo dispensers. It turns a plate layout description into an Echo-ready transfer list, and provides supporting tools for designing dilution series, laying out plates, reformatting between plate densities, and mapping/parsing assay results back against what was actually dispensed.

Live instance: https://adalecki.github.io/ripple/

## What it does

The app is split into five independent tools:

- **Dilution Designer** - Visualize which destination concentrations are actually achievable given Echo transfer constraints (droplet size, max transfer volume, source stock concentrations, well volume).
- **Plate Designer** - Build destination and source plate layouts using reusable concentration/replicate patterns, then export a template workbook that feeds the calculator.
- **Echo Transfer Calculator** - The core engine. Takes a layout workbook (see below) and produces the transfer list. Handles multi-step dilutions, automatic intermediate-plate generation, DMSO backfill/normalization, dead-volume accounting, and source-survey-volume input.
- **Plate Reformat** - Bulk well-to-well transfers between plates (compress, decompress, interleave, or custom schemes). With plate barcodes it emits automation-ready transfer lists.
- **Plate Mapper / Data Parser** - Reconstruct destination plate maps from Echo transfer logs (showing only wells that actually received transfer), then upload raw readout files, parse them against named protocols, fit dose-response curves, and view results.

Concentrations are handled in µM, volumes in µL, and transfers are quantized to the Echo droplet resolution. The calculator inserts intermediate plates automatically when a target concentration cannot be reached in a single transfer within the DMSO and droplet constraints.

## Input format (Echo Transfer Calculator)

The calculator consumes an `.xlsx` workbook with four sheets. Required headers per sheet:

- **`Patterns`** - `Pattern`, `Type`, `Direction`, `Replicates`, `Conc1`…`Conc20`. Defines a named dilution pattern (up to 20 concentration points).
- **`Layout`** - `Pattern`, `Well Block`. Assigns patterns to regions of the destination plate (well blocks, semicolon-separated for multiple ranges).
- **`Compounds`** - `Source Barcode`, `Well ID`, `Concentration (µM)`, `Compound ID`, `Volume (µL)`, `Pattern`. Describes source wells and their contents.
- **`Barcodes`** - `Intermediate Plate Barcodes`, `Destination Plate Barcodes`. Supplies barcodes for the generated plates.

## Architecture

Ripple is a pure client-side single-page application. There is no backend and no server-side computation; every calculation, file parse, and export runs in the browser. This means workbooks and raw data never leave the user's machine.

- Built using **React 19**.
- Routing uses **`createHashRouter`** (hash-based URLs) for route bookmarking even with a SPA.
- The domain model lives in `src/classes/` — `Plate`, `Well`, and `Pattern`. Plates support standard SBS densities (`12`, `24`, `48`, `96`, `384`, `1536`). The Echo-specific calculation classes (`EchoPreCalculator`, `EchoCalculator`, `CheckpointTracker`) live under `src/pages/EchoTransfer/classes/`.
- Each tool is a self-contained module under `src/pages/<Tool>/` with its own components and utils. Shared UI, hooks, and config sit in `src/components/`, `src/hooks/`, and `src/config/`.

## Requirements

- **Node.js 20.19+ or 22.12+** (required by Vite 7).
- npm (or a compatible package manager).

## Setup

```bash
git clone https://github.com/adalecki/ripple.git
cd ripple
npm install
npm run dev
```

## License

MIT — see [LICENSE](LICENSE).
