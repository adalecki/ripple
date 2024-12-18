import React from 'react';
import { Table } from 'react-bootstrap';

interface ConcentrationsTableProps {
  concentrations: number[];
}

export const ConcentrationsTable: React.FC<ConcentrationsTableProps> = ({ concentrations }) => {
  return (
    <div>
      <Table striped bordered hover>
        <thead>
          <tr>
            <th>Point</th>
            <th>Concentration</th>
          </tr>
        </thead>
        <tbody>
          {concentrations.map((concentration, index) => (
            <tr key={index}>
              <td>{index + 1}</td>
              <td>{concentration.toFixed(4)}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
};