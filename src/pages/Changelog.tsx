import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Container, Row, Col, Card, Badge } from 'react-bootstrap';
import { ChangeEntry, CHANGELOG } from '../config/changelog';
import { hasUnseenChanges, markChangelogSeen } from '../utils/storageUtils';

import '../css/Changelog.css';

const CHANGELOG_PATH = '/changelog';

function badgeVariant(entry: ChangeEntry): string {
  switch (entry.type) {
    case 'UI': return 'success'
    case 'Backend': return 'secondary';
  }
}


export const ChangelogButton: React.FC = () => {
  const location = useLocation();
  const showBadge = location.pathname !== CHANGELOG_PATH && hasUnseenChanges();

  return (
    <Link to={CHANGELOG_PATH} className="nav-link changelog-link" title="Changelog">
      Changelog
      {showBadge && <span className="changelog-badge" />}
    </Link>
  );
};

const Changelog: React.FC = () => {
  useEffect(() => {
    markChangelogSeen();
  }, []);

  return (
    <div className='changelog-page'>
      <Container className="mt-5 d-flex flex-column" style={{ scrollbarGutter: 'stable', minHeight: 0 }}>
        <Row className="justify-content-center d-flex">
          <Col md={8}>
            <h1 className="mb-4">Changelog</h1>
            {CHANGELOG.map(entry => (
              <Card key={entry.version} className="mb-3 shadow-sm">
                <Card.Header className="d-flex align-items-baseline justify-content-between">
                  <span className="fw-bold">{entry.version}</span>
                  <small className="text-muted">{entry.date}</small>
                </Card.Header>
                <Card.Body>
                  <ul className="mb-0">
                    {[...entry.changes].sort((a,b) => b.type.localeCompare(a.type)).map((change, idx) => (
                      <li key={idx} className="changelog-item">
                        <Badge bg={badgeVariant(change)} className="changelog-tag">
                          {change.type}
                        </Badge>
                        <span>{change.text}</span>
                      </li>
                    ))}
                  </ul>
                </Card.Body>
              </Card>
            ))}
          </Col>
        </Row>
      </Container>
    </div>
  );
};

export default Changelog;