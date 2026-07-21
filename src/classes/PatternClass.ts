import convert from 'color-convert';

export type HslStringType = `hsl(${number},${number}%,${number}%)`

export type CombinationType = `Combination-${number}`;

export function isCombinationType(type: string): boolean {
  return /^Combination-\d+$/.test(type);
}

export function getCombinationFold(type: CombinationType): number {
  return parseInt(type.substring('Combination-'.length), 10);
}

export interface DilutionPattern {
  patternName: string;
  type: 'Control' | 'Treatment' | 'Solvent' | 'Unused' | CombinationType;
  concentrations: number[];
  replicates: number;
  //direction: 'LR' | 'RL' | 'TB' | 'BT';
  direction: ('LR' | 'RL' | 'TB' | 'BT')[]
  fold: number;
}

export class Pattern {
  id: number;
  name: string;
  type: DilutionPattern['type'];
  replicates: number;
  direction: DilutionPattern['direction'];
  concentrations: (number | null)[];
  color: HslStringType;
  locations: string[];
  fold?: number;
  constructor(data: {
    id?: number;
    name: string;
    type: DilutionPattern['type'];
    replicates: number;
    direction: DilutionPattern['direction']
    concentrations: (number | null)[];
    color?: HslStringType;
    locations: string[];
    fold?: number;
  }) {
    this.id = data.id || Date.now()
    this.name = data.name;
    this.type = data.type;
    this.replicates = data.replicates;
    this.direction = data.direction;
    this.concentrations = data.type === 'Unused' ? [] : data.concentrations;
    this.color = data.color || this.generateRandomColor();
    this.locations = data.locations || []
    this.fold = data.fold || 1;
  }

  generateRandomColor(): HslStringType {
    const hex = '#' + Math.floor(Math.random() * 16777215).toString(16);
    const hsl = convert.hex.hsl(hex)
    return `hsl(${hsl[0]},${hsl[1]}%,${hsl[2]}%)`
  }

  clone(): Pattern {
    const clonedData = structuredClone(this);
    const clonedPattern = Object.create(Pattern.prototype);
    Object.assign(clonedPattern, clonedData);

    return clonedPattern;
  }

  toJSON(): object {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      replicates: this.replicates,
      direction: this.direction,
      concentrations: this.concentrations,
      color: this.color,
      locations: this.locations
    };
  }

  static fromJSON(json: any): Pattern {
    return new Pattern(json);
  }
}