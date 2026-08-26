import React from 'react';
import { Link } from 'react-router-dom';
import { Card, Container, Row, Col } from 'react-bootstrap';
import '../../../css/EchoInstructions.css';

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
                  The Cocktail Builder builds destination plates from <b>hand-listed cocktails</b> of
                  components, dispensed <b>by volume</b>. Unlike the rest of Ripple, nothing here is
                  driven by concentration, and cocktails are listed one by one rather than generated
                  by combining everything with everything. If you want to declare concentrations and
                  have dilutions calculated for you, use the <Link to="/echotsfr">Echo Transfer Calculator</Link> instead:
                  its <code>Combination-N</code> pattern type is the one that auto-enumerates every
                  N-way combination of your compounds.
                </p>
                <ul className="template-card">
                  <li><strong>1. </strong>On the <b>Recipes</b> tab, create a recipe in the sidebar, set its replicates and component volumes, then select destination wells and click <b>Apply to Wells</b>. The readout shows how many cocktail slots that region provides and how many plates you will need.</li>
                  <li><strong>2. </strong>On the <b>Inventory</b> tab, select source wells and assign a content name and volume. Use the Advanced list to stamp many contents in a row: select wells, press <kbd>Enter</kbd>, and it applies and advances.</li>
                  <li><strong>3. </strong>On the <b>Cocktails</b> tab, add rows assigning inventory to each recipe slot, or set a base cocktail and use the <b>Substitution Generator</b> to vary one slot across several contents at once.</li>
                  <li><strong>4. </strong>On the <b>Build</b> tab, click <b>Build Plates</b> to generate source and destination plates. Hover a well to see each component and the volume delivered.</li>
                  <li><strong>5. </strong>Export the transfer list as CSV, and the design itself as a workbook you can re-import later.</li>
                </ul>
                <p className="mb-0">
                  You can also skip authoring entirely and <b>import an existing workbook</b> on the Build tab; it loads straight into the designer, so an uploaded file and a hand-built design are the same thing from there on.
                </p>
                <Card.Title as="h4" className="mb-4 text-center">Core Concept</Card.Title>
                <p>
                  A <b>recipe</b> (a row on the Recipes sheet) declares how much of each component slot goes into a well, along with how many replicate wells each cocktail occupies and which region of the plate it lives in. A <b>cocktail</b> then names the specific inventory item that fills each slot of that recipe. Each cocktail is placed into the next free replicate block, spilling onto additional destination plates as needed.
                </p>
                <p>
                  <a href="/ripple/data/RippleTemplate_Cocktail.xlsx" download>
                    Download an example workbook
                  </a>
                </p>
              </Card.Body>
            </Card>
          </Col>
          <Col md={6} className="d-flex echo-instructions">
            <Card className="shadow-sm flex-fill">
              <Card.Body>
                <Card.Title as="h4" className="mb-4 text-center">Workbook Format</Card.Title>
                <p>Three sheets are required, with exactly these headers:</p>
                <ul className="template-card">
                  <li>
                    <strong>Recipes</strong>: <code>Name</code>, <code>Replicates</code>,
                    <code> Well Block</code>, <code>CompVol1</code>…<code>CompVol10</code>.
                    One row per recipe. <b>CompVol values are in nL</b> and should be a multiple of the
                    Echo droplet size. <code>Well Block</code> is the destination region the recipe
                    occupies, <i>e.g.</i> <code>A01:P04</code>.
                  </li>
                  <li>
                    <strong>SourceLayout</strong>: <code>Source Barcode</code>, <code>Well ID</code>,
                    <code> Content</code>, <code>Volume (µL)</code>, <code>Plate Type</code>.
                    Your inventory. <b>Volume here is in µL</b>.
                    <code> Plate Type</code> is the Echo labware string, <i>e.g.</i> <code>384PP_AQ_CP</code>.
                  </li>
                  <li>
                    <strong>Cocktails</strong>: <code>Recipe</code>, <code>Comp1</code>…<code>Comp10</code>.
                    One row per cocktail. <code>Recipe</code> must match a <code>Name</code> from the
                    Recipes sheet, and each
                    <code> CompN</code> must match a <code>Content</code> from SourceLayout. <code>CompN</code>
                    lines up with <code>CompVolN</code> on the recipe, so <code>Comp3</code> is dispensed
                    at the recipe's <code>CompVol3</code>.
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

export default Instructions;
