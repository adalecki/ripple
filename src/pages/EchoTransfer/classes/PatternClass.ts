import convert from 'color-convert';

export type HslStringType = `hsl(${number},${number}%,${number}%)`

export interface DilutionPattern {
  patternName: string;
  type: 'Control' | 'Treatment' | 'Combination' | 'Solvent';
  concentrations: number[];
  replicates: number;
  direction: 'LR' | 'RL' | 'TB' | 'BT';
  secondaryDirection?: 'LR' | 'RL' | 'TB' | 'BT';
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
  secondaryDirection?: DilutionPattern['secondaryDirection'];
  constructor(data: {
    id?: number;
    name: string;
    type: DilutionPattern['type'];
    replicates: number;
    direction: 'LR' | 'RL' | 'TB' | 'BT';
    concentrations: (number | null)[];
    color?: HslStringType;
    locations: string[];
    secondaryDirection?: DilutionPattern['secondaryDirection'];
  }) {
    this.id = data.id || Date.now()
    this.name = data.name;
    this.type = data.type;
    this.replicates = data.replicates;
    this.direction = data.direction;
    this.concentrations = data.concentrations;
    this.color = data.color || this.generateRandomColor();
    this.locations = data.locations || []
    this.secondaryDirection = data.secondaryDirection;
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