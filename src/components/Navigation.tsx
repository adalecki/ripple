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
                <LinkContainer to="echotsfr"><NavDropdown.Item>Echo Calculator</NavDropdown.Item></LinkContainer>
                <LinkContainer to="mapperparser"><NavDropdown.Item>Mapper/Parser</NavDropdown.Item></LinkContainer>
                <LinkContainer to="platereformat"><NavDropdown.Item>Plate Reformat</NavDropdown.Item></LinkContainer>
                <LinkContainer to="dilutiondesigner"><NavDropdown.Item>Dilution Designer</NavDropdown.Item></LinkContainer>
              </NavDropdown>
            </Nav>
            <Nav>
              <PreferencesButton onClick={() => setShowPreferences(true)} />
            </Nav>
            <Nav>
              <div >
                <a
                  href="https://github.com/adalecki/ripple"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <svg role="img" width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>GitHub</title><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" /></svg>
                </a>
              </div>
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