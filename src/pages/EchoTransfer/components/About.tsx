import React from 'react';
import { Card, Button, Container, Row, Col } from 'react-bootstrap';
import '../../../css/EchoInstructions.css'

const exampleData = [
  {
    name: 'Basic',
    description: 'This is the basic example, with two control dilution patterns, two control single point patterns, and two treatment dilution patterns. Two columns on each plate are empty as DMSO controls.',
    filename: 'RippleTemplate_Basic.xlsx'
  },
  {
    name: 'Multi-Source Concentration',
    description: 'Uses multiple source concentrations to avoid intermediate plates. DMSO wells are included on the source plate for normalization.',
    filename: 'RippleTemplate_MultiSrcConc.xlsx'
  },
  {
    name: 'Interleaved Patterns',
    description: 'Destination plate patterns are interleaved, demonstrating concatenated well block notation.',
    filename: 'RippleTemplate_Interleaved.xlsx'
  },
  {
    name: 'Warning Example',
    description: 'Illustrates what happens when a solution cannot be calculated. The precalculator will display a warning, and if the user proceeds, the problematic wells will not have compound transfered to them.',
    filename: 'RippleTemplate_ConcentrationWarning.xlsx'
  },
  {
    name: 'Combinations',
    description: 'Shows the Combination pattern type, which will test each member compound against each other compound in the pattern in perpendicular curves. Also has DMSO solvent wells to avoid intermediate plate creation.',
    filename: 'RippleTemplate_Combination.xlsx'
  }
];

const About: React.FC = () => {
  return (
    <div className="echo-instructions-wrapper">
      <Container fluid>
        <Row>
          <Col md={6}>
            <Card className="shadow-sm echo-instructions mb-4">
              <Card.Body>
                <Card.Title as="h4" className="mb-4 text-center">About</Card.Title>
                <p>
                  This tool is intended to supplement use of the official Echo Dose Response software, allowing rapid changes to established protocols, such as different numbers of test compounds or plate layouts.
                  It takes user-provided assay constraints and attempts to calculate a viable transfer scheme using up to two levels of intermediate plates. It tracks combined required volumes, moving between wells once they are depleted.
                  Intermediate plates are assumed to be completely filled with a set DMSO volume, and wells without intermediate compound are then used for DMSO normalization. The final transfer list is sorted by source plate to intermediate plate,
                  then intermediate to intermediate, source to destination, and finally intermediate to destination.
                </p>
                <p>
                  Due to the fundamental constraint of 2.5nL droplets, the tool uses a series of heuristics to find a viable transfer scheme. However, it is not guaranteed to be the most efficient, nor to always find one successfully, and will alert the user in such a case.
                </p>
              </Card.Body>
            </Card>
          </Col>
          <Col md={6}>
            <Card className="shadow-sm echo-instructions mb-4">
              <Card.Body className="p-0">
                <Card.Title as="h4" className="my-4 text-center">Examples</Card.Title>
                <div className="example-grid">
                  {exampleData.map((example, index) => (
                    <div key={index} className="border-bottom py-3">
                      <div className="example-content">
                      <h5>{example.name}</h5>
                      <p>{example.description}</p>
                      <Button
                        variant="outline-primary"
                        href={`/ripple/data/${example.filename}`}
                        className="mt-2"
                      >
                        Download {example.name} Example
                      </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
    </div>
  );
};

export default About;