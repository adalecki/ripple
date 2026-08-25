import React, { useState } from 'react';
import { Alert, Badge, Button, Card, Table } from 'react-bootstrap';
import type { InputDataType } from '../utils/cocktailUtils';
import ApplyTooltip from '../../../components/ApplyTooltip';
import { TransferStepExport } from '../../../utils/plateUtils';

interface FileResultsCardProps {
  inputData: InputDataType | null;
  errors?: string[];
  transferSteps: TransferStepExport[];
  buildDisabledReasons: string[];
  onBuild: () => void;
  onClear: () => void;
}

const FileResultsCard: React.FC<FileResultsCardProps> = ({
  inputData,
  errors,
  transferSteps,
  buildDisabledReasons,
  onBuild,
  onClear
}) => {
  const [applyPopup, setApplyPopup] = useState<{ event: React.MouseEvent | null, msgArr: string[] }>({ event: null, msgArr: [] });

  if (!inputData && (!errors || errors.length === 0)) return null;

  const uniqueSrcBarcodes = inputData
    ? [...new Set(inputData.SourceLayout.map(r => r['Source Barcode']).filter(Boolean))]
    : [];
  const uniqueContents = inputData
    ? [...new Set(inputData.SourceLayout.map(r => r.Content).filter(Boolean))]
    : [];
  const distinctRecipes = inputData
    ? [...new Set(inputData.Cocktails.map(c => c.Recipe))].length
    : 0;

  const hasErrors = !!errors && errors.length > 0;
  const canBuild = buildDisabledReasons.length === 0;

  const handleMouseEnter = (e: React.MouseEvent) => {
    setApplyPopup({ event: buildDisabledReasons.length > 0 ? e : null, msgArr: buildDisabledReasons });
  };

  const handleMouseLeave = () => {
    setApplyPopup({ event: null, msgArr: [] });
  };

  return (
    <Card className="page-card mt-3">
      <Card.Header>Design Summary</Card.Header>
      <Card.Body>
        {hasErrors && (
          <Alert variant="danger" className="mb-2">
            <strong>Problems found:</strong>
            <ul className="mb-0 mt-1">
              {errors.map((err, i) => <li key={i}>{err}</li>)}
            </ul>
          </Alert>
        )}

        {inputData && (
          <Table size="sm" borderless className="mb-2">
            <tbody>
              <tr>
                <td className="text-muted">Recipes</td>
                <td><Badge bg="secondary">{inputData.Recipes.length}</Badge></td>
                <td className="text-muted small">{inputData.Recipes.map(p => p.Name).join(', ')}</td>
              </tr>
              <tr>
                <td className="text-muted">Inventory</td>
                <td><Badge bg="secondary">{inputData.SourceLayout.length}</Badge></td>
                <td className="text-muted small">
                  {uniqueSrcBarcodes.length} plate{uniqueSrcBarcodes.length !== 1 ? 's' : ''},{' '}
                  {uniqueContents.length} unique content{uniqueContents.length !== 1 ? 's' : ''}
                </td>
              </tr>
              <tr>
                <td className="text-muted">Cocktails</td>
                <td><Badge bg="secondary">{inputData.Cocktails.length}</Badge></td>
                <td className="text-muted small">
                  {distinctRecipes} distinct recipe{distinctRecipes !== 1 ? 's' : ''} used
                </td>
              </tr>
              {transferSteps.length > 0 && (
                <tr>
                  <td className="text-muted">Transfers</td>
                  <td><Badge bg="success">{transferSteps.length}</Badge></td>
                  <td className="text-muted small">ready to export</td>
                </tr>
              )}
            </tbody>
          </Table>
        )}

        <div className="d-flex gap-2">
          <div onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
            <Button onClick={onBuild} disabled={!canBuild}>Build Plates</Button>
          </div>
          <Button onClick={onClear} variant="outline-secondary">Clear</Button>
        </div>
      </Card.Body>
      {applyPopup.msgArr.length > 0 ? <ApplyTooltip data={applyPopup} /> : ''}
    </Card>
  );
};

export default FileResultsCard;
