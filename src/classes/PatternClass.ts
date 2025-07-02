import convert from 'color-convert';

export type HslStringType = `hsl(${number},${number}%,${number}%)`

export interface DilutionPattern {
  patternName: string;
  type: 'Control' | 'Treatment' | 'Combination' | 'Solvent' | 'Unused';
  concentrations: number[];
  replicates: number;
  //direction: 'LR' | 'RL' | 'TB' | 'BT';
  direction: ('LR' | 'RL' | 'TB' | 'BT')[]
  secondaryDirection?: 'LR' | 'RL' | 'TB' | 'BT';
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
  secondaryDirection?: DilutionPattern['secondaryDirection'];
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
    secondaryDirection?: DilutionPattern['secondaryDirection'];
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
    this.secondaryDirection = data.secondaryDirection;
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