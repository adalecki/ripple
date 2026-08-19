import React, { useState } from 'react';
import { Button, Card, Col, Container, Form, Row } from 'react-bootstrap';

import { Plate } from '../../../classes/PlateClass';
import { Pattern } from '../../../classes/PatternClass';
import ApplyTooltip from '../../../components/ApplyTooltip';
import { Combination, nextCombinationId } from '../types/combinatorTypes';
import { inventoryContents, recipeSlotCount } from '../utils/combinatorUtils';
import CombinationsTable from './CombinationsTable';

import '../../../css/Combinator.css';

interface CombinationsTabProps {
  combinations: Combination[];
  setCombinations: React.Dispatch<React.SetStateAction<Combination[]>>;
  recipes: Pattern[];
  srcPlates: Plate[];
}

const CombinationsTab: React.FC<CombinationsTabProps> = ({
  combinations,
  setCombinations,
  recipes,
  srcPlates
}) => {
  const [baseId, setBaseId] = useState<number | null>(null);
  const [slotIndex, setSlotIndex] = useState(0);
  const [selectedContents, setSelectedContents] = useState<string[]>([]);
  const [applyPopup, setApplyPopup] = useState<{ event: React.MouseEvent | null, msgArr: string[] }>({ event: null, msgArr: [] });

  const contents = inventoryContents(srcPlates);

  const base = combinations.find(c => c.id === baseId) ?? null;
  const baseRecipe = base ? recipes.find(r => r.name === base.patternName) ?? null : null;
  const slotCount = baseRecipe ? recipeSlotCount(baseRecipe) : 0;

  function getGenerateDisabledReasons(): string[] {
    const reasons: string[] = [];
    if (!base) reasons.push('Pick a base combination');
    if (!baseRecipe) reasons.push('The base combination references an unknown recipe');
    else if (slotIndex >= slotCount) reasons.push(`That recipe only has ${slotCount} slot${slotCount === 1 ? '' : 's'}`);
    if (selectedContents.length === 0) reasons.push('Select at least one content to substitute in');
    return reasons;
  }

  const disabledReasons = getGenerateDisabledReasons();
  const canGenerate = disabledReasons.length === 0;

  const handleGenerate = () => {
    if (!base || !canGenerate) return;
    const existing = new Set(combinations.map(c => `${c.patternName}|${c.slots.join('|')}`));
    const added: Combination[] = [];
    for (const content of selectedContents) {
      const slots = [...base.slots];
      slots[slotIndex] = content;
      const key = `${base.patternName}|${slots.join('|')}`;
      if (existing.has(key)) continue;
      existing.add(key);
      added.push({ id: nextCombinationId(), patternName: base.patternName, slots });
    }
    setCombinations([...combinations, ...added]);
    setSelectedContents([]);
  };

  const handleMouseEnter = (e: React.MouseEvent) => {
    setApplyPopup({ event: disabledReasons.length > 0 ? e : null, msgArr: disabledReasons });
  };

  const handleMouseLeave = () => {
    setApplyPopup({ event: null, msgArr: [] });
  };

  const toggleContent = (content: string) => {
    setSelectedContents(prev =>
      prev.includes(content) ? prev.filter(c => c !== content) : [...prev, content]
    );
  };

  return (
    <Container fluid className="h-100 pb-2 d-flex flex-column" style={{ minHeight: 0 }}>
      <Row className="flex-shrink-0">
        <Col md={12}>
          <Card className="page-card mb-2">
            <Card.Header>Substitution Generator</Card.Header>
            <Card.Body>
              <Row className="g-2 align-items-start">
                <Col md={3}>
                  <Form.Label className="small mb-1">Base combination</Form.Label>
                  <select
                    className="form-select form-select-sm"
                    value={baseId ?? ''}
                    onChange={e => { setBaseId(e.target.value ? Number(e.target.value) : null); setSlotIndex(0); }}
                  >
                    <option value="">—</option>
                    {combinations.map((c, i) => (
                      <option key={c.id} value={c.id}>
                        {i + 1}. {c.patternName}: {c.slots.filter(Boolean).join(', ') || '(empty)'}
                      </option>
                    ))}
                  </select>
                </Col>
                <Col md={2}>
                  <Form.Label className="small mb-1">Vary slot</Form.Label>
                  <select
                    className="form-select form-select-sm"
                    value={slotIndex}
                    onChange={e => setSlotIndex(Number(e.target.value))}
                    disabled={!baseRecipe}
                  >
                    {Array.from({ length: Math.max(slotCount, 1) }, (_, i) => (
                      <option key={i} value={i}>
                        Comp{i + 1}{baseRecipe?.volumes[i] != null ? ` · ${baseRecipe.volumes[i]} nL` : ''}
                      </option>
                    ))}
                  </select>
                </Col>
                <Col md={5}>
                  <Form.Label className="small mb-1">Substitute in</Form.Label>
                  <div className="substitution-content-grid">
                    {contents.length === 0 && <small className="text-muted">No inventory declared yet</small>}
                    {contents.map(content => (
                      <label key={content} className="substitution-content-item">
                        <input
                          type="checkbox"
                          checked={selectedContents.includes(content)}
                          onChange={e => { toggleContent(content); e.currentTarget.blur(); }}
                        />
                        <span>{content}</span>
                      </label>
                    ))}
                  </div>
                </Col>
                <Col md={2} className="d-flex align-items-end">
                  <div className="w-100" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
                    <Button size="sm" className="w-100" onClick={handleGenerate} disabled={!canGenerate}>
                      Generate {selectedContents.length > 0 ? `(${selectedContents.length})` : ''}
                    </Button>
                  </div>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Col>
      </Row>
      <Row className="flex-grow-1" style={{ minHeight: 0 }}>
        <Col md={12} className="h-100 d-flex flex-column" style={{ minHeight: 0 }}>
          <CombinationsTable
            combinations={combinations}
            onChange={setCombinations}
            recipes={recipes}
            inventoryContents={contents}
          />
        </Col>
      </Row>
      {applyPopup.msgArr.length > 0 ? <ApplyTooltip data={applyPopup} /> : ''}
    </Container>
  );
};

export default CombinationsTab;