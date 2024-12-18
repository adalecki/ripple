import { Outlet, Link } from "react-router-dom";
import { Container, Nav, Navbar, NavDropdown } from 'react-bootstrap';
import { LinkContainer } from 'react-router-bootstrap';
import { useState } from 'react';
import { PreferencesButton, PreferencesModal } from "./PreferencesModal";
import Logo from "./Logo";

function Navigation() {
  const [showPreferences, setShowPreferences] = useState(false);

  return (
    <>
      <Navbar bg="light" expand="lg" style={{ padding: 2 }}>
        <Container fluid>
          <Navbar.Brand style={{ display: 'flex', alignItems: 'center', padding: 0 }}>
            <Logo />
            <span>Ripple</span>
          </Navbar.Brand>
          <Navbar.Toggle aria-controls="basic-navbar-nav" />
          <Navbar.Collapse id="basic-navbar-nav">
            <Nav className="me-auto">
              <Link to="/" className="nav-link">Home</Link>
              <NavDropdown title="Utilities" id="utils">
                <LinkContainer to="echotsfr"><NavDropdown.Item>Echo Transfers</NavDropdown.Item></LinkContainer>
                <LinkContainer to="dilutiondesigner"><NavDropdown.Item>Dilution Designer</NavDropdown.Item></LinkContainer>
                <LinkContainer to="logdilution"><NavDropdown.Item>Log Dilution Series</NavDropdown.Item></LinkContainer>
              </NavDropdown>
            </Nav>
            <Nav>
              <PreferencesButton onClick={() => setShowPreferences(true)} />
            </Nav>
          </Navbar.Collapse>
        </Container>
      </Navbar>
      <Container fluid><Outlet /></Container>

      <PreferencesModal
        show={showPreferences}
        onHide={() => setShowPreferences(false)}
      />
    </>
  );
}

export default Navigation;