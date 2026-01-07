import { Link } from 'react-router-dom';
import { Container, Row, Col, Card } from 'react-bootstrap';
import { Calculator, ChartColumnIncreasing, MapIcon, LayoutTemplate } from 'lucide-react';
import '../css/Home.css'

const Home = () => {
  return (
    <Container className="mt-5">
      <Row className="justify-content-center mb-4">
        <Col md={8} className="text-center">
          <h1 className="mb-4">Ripple</h1>
          <p className="lead text-muted">
            Acoustic liquid handling transfer calculation
          </p>
        </Col>
      </Row>

      <Row md={2} className="justify-content-center g-4">
        <Col md="12" className="d-flex flex-wrap justify-content-center gap-4">
          <Link to="/echotsfr" className="tool-link">
            <Card className="h-100 shadow-sm tool-card">
              <Card.Body className="d-flex flex-column align-items-center text-center p-4">
                <Calculator size={48} className="mb-3 tool-icon text-muted" />
                <Card.Title className="mb-3">Echo Transfer Calculator</Card.Title>
                <Card.Text className="text-muted">
                  Calculate and optimize liquid transfers for your Echo acoustic liquid handler.
                  Upload your plate layouts and source information to generate optimized transfer lists.
                </Card.Text>
              </Card.Body>
            </Card>
          </Link>
          <Link to="/platereformat" className="tool-link">
            <Card className="h-100 shadow-sm tool-card">
              <Card.Body className="d-flex flex-column align-items-center text-center p-4">
                <LayoutTemplate size={48} className="mb-3 tool-icon text-muted" />
                <Card.Title className="mb-3">Plate Reformat</Card.Title>
                <Card.Text className="text-muted">
                  Bulk transfer between plates.
                  Include plate barcodes to generate automation-ready transfer lists.
                </Card.Text>
              </Card.Body>
            </Card>
          </Link>
          <Link to="/mapperparser" className="tool-link">
            <Card className="h-100 shadow-sm tool-card">
              <Card.Body className="d-flex flex-column align-items-center text-center p-4">
                <MapIcon size={48} className="mb-3 tool-icon text-muted" />
                <Card.Title className="mb-3">Plate Mapper/Data Parser</Card.Title>
                <Card.Text className="text-muted">
                  Map plates from Echo transfer logs, showing only what actually transfered.
                  Then, upload raw data files to parse and analyze your results.
                </Card.Text>
              </Card.Body>
            </Card>
          </Link>
          <Link to="/dilutiondesigner" className="tool-link">
            <Card className="h-100 shadow-sm tool-card">
              <Card.Body className="d-flex flex-column align-items-center text-center p-4">
                <ChartColumnIncreasing size={48} className="mb-3 tool-icon text-muted" />
                <Card.Title className="mb-3">Dilution Designer</Card.Title>
                <Card.Text className="text-muted">
                  Design and visualize dilution series within Echo transfer constraints.
                  Analyze achievable concentration ranges and optimize your dilution strategy.
                </Card.Text>
              </Card.Body>
            </Card>
          </Link>
        </Col>
      </Row>
    </Container>
  );
};

export default Home;