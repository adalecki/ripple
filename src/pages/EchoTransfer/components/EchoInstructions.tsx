import React from 'react';
import { Card, Button, Container, Row, Col } from 'react-bootstrap';
import '../../../css/EchoInstructions.css'

const EchoInstructions: React.FC = () => {
  return (
    <div className="echo-instructions-wrapper">
      <Container fluid>
        <Row>
          <Col md={6}>
          <Card className="shadow-sm echo-instructions mb-4">
              <Card.Body>
                <Card.Title as="h4" className="mb-4 text-center">Quick Start</Card.Title>
                <ul className="template-card">
                  <li><strong>1. </strong>Edit template (provided to the right) with desired layout and compounds.</li>
                  <li><strong>2. </strong>Specify assay constraints such as final DMSO limit and allowable error.</li>
                  <li><strong>3. </strong>Upload template and review preliminary calculations, including warnings (if any).</li>
                  <li><strong>4. </strong>Execute transfer calculation and review final plates.</li>
                  <li><strong>5. </strong>Download presorted transfer list CSV.</li>
                </ul>
                <Card.Title as="h4" className="mb-4 text-center">Core Concept</Card.Title>
                <p>
                  "Patterns" are the fundamental work unit, which are a statement of concentrations, dilution direction, replicates, and so on. Each pattern is blocked out on a plate layout, and then each compound is associated with one or more patterns. 
                  This way, many compounds can be quickly mapped to common and consistent plate layouts.
                </p>
                <p>Pattern types are:</p>
                <ul className="template-card">
                  
                <li><strong>Treatment:</strong> Each treatment compound is stamped once to an available slot for its pattern, creating new destination plates until all compounds are accounted for. May produce empty blocks on some destination plates if not all blocks are needed.</li>
                <li><strong>Control:</strong> Present equally on all destination plates. Will always fill slots. If multiple different compounds are assigned to one control pattern, the tool will rotate between them when assigning.</li>
                <li><strong>Solvent:</strong> Used to signal DMSO wells on source plates. Currently limited to DMSO only as a solvent. Pattern name must be "DMSO", type must be "Solvent".</li>
                <li><strong>Combination:</strong> Not currently implemented.</li>
                  
                </ul>
              </Card.Body>
            </Card>
          </Col>
          <Col md={6}>
            <Card className="shadow-sm echo-instructions mb-4">
              <Card.Body>
                <Card.Title as="h4" className="mb-4 text-center">Template Format</Card.Title>

                <Button
                  variant="outline-primary"
                  href="/data/RippleTemplate_Basic.xlsx"
                  className="download-button mb-3"
                >Download Template</Button>
                <p>This template is ready to use as-is, no changes necessary. Feel free to upload it using the default settings to get a feel for how the tool works. It consists of four sheets; sheet names and individual sheet headers must exactly match the provided template.</p>
                <ul className="template-card">
                  <li><strong>Patterns:</strong> Specify dilution series and replicates.
                    <ul>
                      <li><b>Pattern:</b> Name your patterns here. Names must be unique.</li>
                      <li><b>Type:</b> Must be either "Treatment", "Control", "Solvent", or "Combination".</li>
                      <li><b>Direction:</b> Choose dose response direction. Valid options are "LR" (left to right), "RL", "TB" (top to bottom), and "BT" (bottom to top).</li>
                      <li><b>Replicates:</b> The number of replicates for each concentration.</li>
                      <li><b>Conc[1|2|3|...]:</b> Individual desired concentrations for a dose response curve. Arbitrary concentrations are supported, not just 1:2 or 1:3 dilutions. Twenty columns are provided; leave columns blank if using fewer than twenty concentrations.</li>
                    </ul>
                  </li>
                  <li><strong>Layout:</strong> The specific plate layout. This represents one destination plate; multiple destination plates will be created, if needed, to accommodate all treatments.
                    <ul>
                      <li><b>Pattern:</b> Name of the pattern. This must match an available pattern on the Patterns sheet.</li>
                      <li><b>Well Block:</b> Where that pattern will be stamped on the destination plate. The notation uses a colon (:) to separate start and end wells in a rectangle, and a semicolon (;) to separate disjointed rectangles, <i>e.g.,</i> "A01:P01;A24:P24" for the two outside columns.</li>
                    </ul>
                  </li>
                  <li><strong>Compounds:</strong> List your source compounds and their details.
                    <ul>
                      <li><b>Source Barcode:</b> Barcode of the source plate. Multiple source plates are supported, allowing for <i>e.g.,</i> treatments on one plate and controls on a separate plate.</li>
                      <li><b>Well ID:</b> Well location of the compound in the source plate. Supports well block format as in the Layout tab, <i>e.g.,</i> "A01:D04".</li>
                      <li><b>Concentration (µM):</b> Stock concentration in micromolar.</li>
                      <li><b>Compound ID</b> Compound identifier. Repeating compounds is supported, if combined volume of multiple wells is needed for a run.</li>
                      <li><b>Volume (µL)</b> Volume of liquid in well in microliters. Critical for calculating when a well is depleted for larger transfers.</li>
                      <li><b>Pattern:</b> The pattern the compound is associated with. It must be present on the Patterns sheet. Compounds can have multiple patterns, separated by a semicolon (;).</li>
                    </ul>
                  </li>
                  <li><strong>Barcodes:</strong> Provide barcodes for intermediate and destination plates. The tool will use barcodes sequentially as provided. If not enough are provided, it will autogenerate barcodes.
                    <ul>
                      <li><b>Intermediate Plate Barcodes:</b> Available barcodes for intermediate plates.</li>
                      <li><b>Destination Plate Barcodes:</b> Available barcodes for destination plates.</li>
                    </ul>
                  </li>
                </ul>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
    </div>
  );
};

export default EchoInstructions;