import React, { createContext } from 'react';
import { Plate } from '../classes/PlateClass';
import { Pattern } from '../classes/PatternClass';

export type PlatesContextType = {
  plates: Plate[];
  setPlates: React.Dispatch<React.SetStateAction<Plate[]>>;
  curPlateId: number | null;
  setCurPlateId: React.Dispatch<React.SetStateAction<number | null>>;
};

// Create the context with the correct type
export const PlatesContext = createContext<PlatesContextType>({
  plates: [],
  setPlates: () => {},
  curPlateId: null,
  setCurPlateId: () => {},
});

export type PatternsContextType = {
  patterns: Pattern[];
  setPatterns: React.Dispatch<React.SetStateAction<Pattern[]>>;
  selectedPatternId: number | null;
  setSelectedPatternId: React.Dispatch<React.SetStateAction<number | null>>;
};

export const PatternsContext = createContext<PatternsContextType>({
  patterns: [],
  setPatterns: () => {},
  selectedPatternId: null,
  setSelectedPatternId: () => {},
});