import React, { useState } from 'react';
import { Container, Button, Col, Form, Row } from 'react-bootstrap';

interface LogFormProps {
  setFormData: (formData: LogFormData) => void;
}

type LogFormData = {
  'High concentration': number;
  'Low concentration': number;
  'Points in series': number;
};

interface LogFormProps {
  setFormData: (formData: LogFormData) => void;
}

const LogForm: React.FC<LogFormProps> = ({ setFormData }) => {
  const [validated, setValidated] = useState(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;

    if (form.checkValidity() === false) {
      e.stopPropagation();
    } else {
      const formData = new FormData(form);
      const logFormValues: LogFormData = {
        'High concentration': parseFloat(formData.get('High concentration') as string),
        'Low concentration': parseFloat(formData.get('Low concentration') as string),
        'Points in series': parseInt(formData.get('Points in series') as string, 10)
      };
      setFormData(logFormValues);
    }

    setValidated(true);
  };

  return (
    <Container>
      <Form noValidate validated={validated} onSubmit={handleSubmit}>
        <Row className="mb-3">
          <Form.Group as={Col} controlId='logformrow1'>
            <Form.Label>High concentration</Form.Label>
            <Form.Control
              name='High concentration'
              type='number'
              step='any'
              required
            />
          </Form.Group>
        </Row>
        <Row className="mb-3">
          <Form.Group as={Col} controlId='logformrow2'>
            <Form.Label>Low concentration</Form.Label>
            <Form.Control
              name='Low concentration'
              type='number'
              step='any'
              required
            />
          </Form.Group>
        </Row>
        <Row className="mb-3">
          <Form.Group as={Col} controlId='logformrow3'>
            <Form.Label>Points in series</Form.Label>
            <Form.Control
              name='Points in series'
              type='number'
              required
            />
          </Form.Group>
        </Row>
        <Button type="submit">Submit form</Button>
      </Form>
    </Container>
  );
};

export default LogForm;