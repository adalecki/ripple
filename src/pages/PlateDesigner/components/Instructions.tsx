import React from 'react';
import { Card, Container, Row, Col } from 'react-bootstrap';
import '../../../css/EchoInstructions.css';
import { Plus } from 'lucide-react';

const Instructions: React.FC = () => {
  return (
    <div className="echo-instructions-wrapper">
      <Container fluid className="d-flex flex-column gap-3">
        <Row className="g-3">
          <Col md={6} className="d-flex echo-instructions">
            <Card className="shadow-sm flex-fill">
              <Card.Body>
                <Card.Title as="h4" className="mb-4 text-center">Quick Start</Card.Title>
                <p>
                  The Plate Designer lets you lay out your destination and source plates visually,
                  then export a ready-to-use template for the Echo Transfer Calculator. 
                </p>
                <ul className="template-card">
                  <li><strong>1. </strong>On the <b>Design - Destination</b> tab, create one or more patterns in the sidebar and set their type, dilution direction, replicates, and concentrations.</li>
                  <li><strong>2. </strong>Select wells on the plate (click, drag, or click row/column labels), then click <b>Apply to Wells</b> to stamp the active pattern onto the layout.</li>
                  <li><strong>3. </strong>On the <b>Design - Source</b> tab, select wells and assign the compounds, stock concentrations, and well volumes that feed your patterns.</li>
                  <li><strong>4. </strong>Click <b>Generate Template</b> (on either design tab) to download a complete Echo template <code>.xlsx</code>.</li>
                  <li><strong>5. </strong>Open the <b>Echo Transfer Calculator</b>, upload the template, and run the calculation.</li>
                </ul>
                <Card.Title as="h4" className="mb-4 text-center">Core Concept</Card.Title>
                <p>
                  "Patterns" are the fundamental work unit: a statement of concentrations, dilution direction,
                  replicates, and type. Each pattern is blocked out on the destination layout, and each source
                  compound is associated with one or more patterns. This way many compounds can be mapped quickly
                  to common, consistent plate layouts.
                </p>
                <p>Pattern types are:</p>
                <ul className="template-card">
                  <li><strong>Treatment:</strong> Each treatment compound is stamped once to an available slot for its pattern, creating new destination plates until all compounds are accounted for. May leave empty blocks on some destination plates if not all blocks are needed.</li>
                  <li><strong>Control:</strong> Present equally on all destination plates. Always fills its slots. If multiple compounds are assigned to one control pattern, the tool rotates between them when assigning.</li>
                  <li><strong>Unused:</strong> Marks wells that should remain empty and receive no transfers, including DMSO normalization. Useful for empty borders or specific unused-well patterns.</li>
                  <li><strong>Combination-N:</strong> Combines member compounds N at a time (N is the fold), covering every N-way combination of compounds sharing the pattern. For Combination-2 only, giving Direction as two perpendicular directions (<i>e.g.,</i> "LR-TB") lays the pair out as a perpendicular matrix, with each compound walking its own axis. Any other case (Combination-2 with a single direction, or Combination-3 and higher) is collinear, with every member compound sharing one dilution direction.</li>
                </ul>
              </Card.Body>
            </Card>
          </Col>
          <Col md={6} className="d-flex echo-instructions">
            <Card className="shadow-sm flex-fill">
              <Card.Body>
                <Card.Title as="h4" className="mb-4 text-center">Designing the Destination</Card.Title>
                <p>The destination layout defines a single representative destination plate. The Calculator replicates it across as many plates as your treatments require.</p>
                <ul className="template-card">
                  <li><strong>Create a pattern:</strong> Use the <Plus size={16}/> in the Patterns sidebar, then edit its type, direction, replicates, and concentrations. Names must be unique.</li>
                  <li><strong>Direction:</strong> Choose dose response direction. Valid options are "LR" (left to right), "RL", "TB" (top to bottom), and "BT" (bottom to top). Not used for Unused patterns.</li>
                  <li><strong>Concentrations:</strong> Enter the desired concentrations for the dose-response curve. Arbitrary concentrations are allowed, not just 1:2 or 1:3 dilutions. A concentration of 0 is allowed.</li>
                  <li><strong>Apply to Wells:</strong> Enabled only when the number of selected wells is a multiple of <i>replicates x concentrations</i>. The Designer splits the selection into blocks and maps concentrations along the chosen direction.</li>
                  <li><strong>Clear from Wells / Clear from All Wells:</strong> Remove a pattern from the current selection or wipe the whole plate.</li>
                </ul>
                <Card.Title as="h4" className="mb-4 text-center">Designing the Source</Card.Title>
                <ul className="template-card">
                  <li><strong>Barcode &amp; size:</strong> Name each source plate and choose its size. Multiple source plates are supported to, <i>e.g.</i>, separate treatment and controls.</li>
                  <li><strong>Basic entry:</strong> Assign a single compound ID, stock concentration, well volume, and linked pattern(s) to the selected wells.</li>
                  <li><strong>Advanced entry:</strong> Paste a list of compounds and step through them; concentrations are mapped across the selection in the chosen direction, advancing to the next compound after each apply. Can use <kbd>Enter</kbd> to apply and <kbd>ArrowKey</kbd> to move entire selection.</li>
                  <li><strong>DMSO wells:</strong> Marks selected wells as DMSO solvent wells. If DMSO normalization is requested and solvent wells are present on the source plate, Ripple will draw from them; otherwise, Ripple will assume creation of a separate intermediate plate filled with DMSO for the normalization backfill.</li>
                </ul>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
    </div>
  );
};

export default Instructions;
