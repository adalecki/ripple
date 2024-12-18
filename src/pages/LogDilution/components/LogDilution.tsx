import React, { useState, useEffect } from 'react';
import { Col, Row, Container } from 'react-bootstrap';
import LogForm from './LogForm';
import { ConcentrationsTable } from './ConcentrationsTable';

type LogFormData = {
  'High concentration': number;
  'Low concentration': number;
  'Points in series': number;
};

const LogDilution: React.FC = () => {
  const [formData, setFormData] = useState<LogFormData | null>(null);
  const [concentrations, setConcentrations] = useState<number[]>([]);

  useEffect(() => {
    if (formData) {
      const concSeries = calculateLogDistribution(formData);
      if (concSeries.length === formData['Points in series']) {
        setConcentrations(concSeries);
      }
    }
  }, [formData]);

  function calculateLogDistribution(formData: LogFormData): number[] {
    const concentrations: number[] = [];
    if (formData['High concentration'] > formData['Low concentration'] && formData['Points in series'] > 2) {
      const points = Math.ceil(formData['Points in series']);
      const hiLog = Math.log10(formData['High concentration']);
      const loLog = Math.log10(formData['Low concentration']);
      const diff = hiLog - loLog;
      const step = diff / (points - 1);
      
      for (let i = 0; i < points; i++) {
        concentrations.push(10 ** (hiLog - i * step));
      }
    }
    return concentrations;
  }

  return (
    <Container>
      <Row>
        <Col md="5">
          <LogForm setFormData={setFormData} />
        </Col>
        <Col md="7">
          {concentrations.length > 0 && <ConcentrationsTable concentrations={concentrations} />}
        </Col>
      </Row>
    </Container>
  );
};

export default LogDilution;