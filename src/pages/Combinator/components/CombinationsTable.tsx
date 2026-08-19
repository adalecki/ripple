import React from 'react';
import { Button, Table } from 'react-bootstrap';
import { Copy, X } from 'lucide-react';

import { Pattern } from '../../../classes/PatternClass';
import { Combination, emptySlots, nextCombinationId } from '../types/combinatorTypes';
import { recipeSlotCount } from '../utils/combinatorUtils';

interface CombinationRowProps {
  combination: Combination;
  rowNumber: number;
  activeSlots: number;
  slotIndices: number[];
  recipeOptions: React.ReactNode;
  contentOptions: React.ReactNode;
  onRecipeChange: (id: number, patternName: string) => void;
  onSlotChange: (id: number, slotIndex: number, value: string) => void;
  onDuplicate: (id: number) => void;
  onDelete: (id: number) => void;
}

const CombinationRow: React.FC<CombinationRowProps> = ({
  combination,
  rowNumber,
  activeSlots,
  slotIndices,
  recipeOptions,
  contentOptions,
  onRecipeChange,
  onSlotChange,
  onDuplicate,
  onDelete
}) => (
  <tr>
    <td className="text-muted small">{rowNumber}</td>
    <td>
      <select
        className="form-select form-select-sm"
        value={combination.patternName}
        onChange={e => onRecipeChange(combination.id, e.target.value)}
      >
        {recipeOptions}
      </select>
    </td>
    {slotIndices.map(slotIndex => {
      const inUse = slotIndex < activeSlots;
      return (
        <td key={slotIndex} className={inUse ? '' : 'table-secondary'}>
          {inUse ? (
            <>
              <select
                className="form-select form-select-sm"
                id={combination.id + slotIndex.toString()}
                value={combination.slots[slotIndex] ?? ''}
                onChange={e => onSlotChange(combination.id, slotIndex, e.target.value)}
              >
                {contentOptions}
              </select>
            </>
          ) : null}
        </td>
      );
    })}
    <td>
      <div className="d-flex gap-1">
        <button type="button" className="item-list-btn" title="Duplicate" onClick={() => onDuplicate(combination.id)}>
          <Copy size={14} />
        </button>
        <button
          type="button"
          className="item-list-btn item-list-btn-delete"
          title="Delete"
          onClick={() => onDelete(combination.id)}
        >
          <X size={14} />
        </button>
      </div>
    </td>
  </tr>
);

interface CombinationsTableProps {
  combinations: Combination[];
  onChange: React.Dispatch<React.SetStateAction<Combination[]>>;
  recipes: Pattern[];
  inventoryContents: string[];
}

const CombinationsTable: React.FC<CombinationsTableProps> = ({
  combinations,
  onChange,
  recipes,
  inventoryContents
}) => {
  const slotCountsByName = new Map(recipes.map(recipe => [recipe.name, recipeSlotCount(recipe)]));
  const slotCount = Math.max(1, ...slotCountsByName.values());
  const slotIndices = Array.from({ length: slotCount }, (_, index) => index);

  const recipeOptions = recipes.map(recipe => <option key={recipe.id} value={recipe.name}>{recipe.name}</option>);
  const contentOptions = [
    <option key="" value="">—</option>,
    ...inventoryContents.map(content => <option key={content} value={content}>{content}</option>)
  ];

  const handleRecipeChange = (id: number, patternName: string) => {
    onChange(prev => prev.map(c => (c.id === id ? { ...c, patternName } : c)));
  };

  const handleSlotChange = (id: number, slotIndex: number, value: string) => {
    onChange(prev => prev.map(c => {
      if (c.id !== id) return c;
      const slots = [...c.slots];
      slots[slotIndex] = value;
      return { ...c, slots };
    }));
  };

  const handleDuplicate = (id: number) => {
    onChange(prev => {
      const index = prev.findIndex(c => c.id === id);
      if (index === -1) return prev;
      const copy: Combination = { ...prev[index], id: nextCombinationId(), slots: [...prev[index].slots] };
      const next = [...prev];
      next.splice(index + 1, 0, copy);
      return next;
    });
  };

  const handleDelete = (id: number) => {
    onChange(prev => prev.filter(c => c.id !== id));
  };

  const handleAddCombination = () => {
    onChange(prev => [...prev, {
      id: nextCombinationId(),
      patternName: recipes[0].name,
      slots: emptySlots()
    }]);
  };

  if (recipes.length === 0) {
    return <p className="text-muted">Define a recipe before adding combinations.</p>;
  }

  return (
    <div className="combinations-table-panel">
      <div className="combinations-table-scroll">
        <Table size="sm" bordered hover className="combinations-table mb-0">
          <thead>
            <tr>
              <th style={{ width: '3rem' }}>#</th>
              <th style={{ minWidth: '9rem' }}>Recipe</th>
              {slotIndices.map(slotIndex => (
                <th key={slotIndex} style={{ minWidth: '9rem' }}>Comp{slotIndex + 1}</th>
              ))}
              <th style={{ width: '5rem' }} />
            </tr>
          </thead>
          <tbody>
            {combinations.map((combination, rowIndex) => (
              <CombinationRow
                key={combination.id}
                combination={combination}
                rowNumber={rowIndex + 1}
                activeSlots={slotCountsByName.get(combination.patternName) ?? 0}
                slotIndices={slotIndices}
                recipeOptions={recipeOptions}
                contentOptions={contentOptions}
                onRecipeChange={handleRecipeChange}
                onSlotChange={handleSlotChange}
                onDuplicate={handleDuplicate}
                onDelete={handleDelete}
              />
            ))}
          </tbody>
        </Table>
        {combinations.length === 0 && (
          <p className="text-muted p-2 mb-0">No combinations yet. Add one below, or generate a substitution set.</p>
        )}
      </div>
      <div className="pt-2 flex-shrink-0">
        <Button size="sm" variant="outline-primary" onClick={handleAddCombination}>
          Add Combination
        </Button>
      </div>
    </div>
  );
};

export default CombinationsTable;
