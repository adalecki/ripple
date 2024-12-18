import { useState, useEffect } from 'react';
import { Container, Row, Col, Alert } from 'react-bootstrap';

const MobileCheck = ({ children }: {children: React.ReactNode}) => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const userAgent = typeof window.navigator === 'undefined' ? '' : navigator.userAgent;
    const mobile = Boolean(userAgent.match(/Android|BlackBerry|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i));
    setIsMobile(mobile);
  }, []);

  return isMobile ? (
    <Container className="mt-5">
      <Row className="justify-content-center">
        <Col xs={12} sm={10} md={8} lg={6}>
          <Alert variant="info">
            <Alert.Heading>Mobile Detected</Alert.Heading>
            <p>
              This app is optimized for use on a desktop computer. For the best experience, please visit this site using a laptop or desktop web browser.
            </p>
          </Alert>
        </Col>
      </Row>
    </Container>
  ) : children; 
};

export default MobileCheck;