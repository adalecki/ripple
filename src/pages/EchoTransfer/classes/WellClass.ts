interface WellContent {
  compoundId?: string;
  concentration: number;
  patternName: string;
}

export interface Solvent {
  name: string;
  volume: number;
}

export class Well {
  id: string;
  contents: WellContent[];
  solvents: Solvent[];
  totalVolume: number;
  isUnused: boolean;

  constructor(config: {
    id: string;
    contents?: WellContent[];
    solvents?: Solvent[];
    totalVolume?: number;
    isUnused?: boolean;
  }) {
    this.id = config.id;
    this.contents = config.contents || [];
    this.solvents = config.solvents || [];
    this.totalVolume = config.totalVolume || 0;
    this.isUnused = config.isUnused || false;
  }

  markAsUnused(): void {
    this.isUnused = true;
    this.clearContents();
  }

  getIsUnused(): boolean {
    return this.isUnused;
  }

  markAsUsed(): void {
    this.isUnused = false;
  }

  // Update existing methods to respect unused status
  addContent(newContent: WellContent, volumeToAdd: number, solventInfo: { name: string, fraction: number }): void {
    if (this.isUnused) {
      console.warn(`Attempting to add content to unused well ${this.id}`);
      return;
    }
    const newTotalVolume = this.totalVolume + volumeToAdd;
    const solventVolume = volumeToAdd * solventInfo.fraction;
    // Step 1: Update existing contents
    this.contents = this.contents.map(content => {
      if (content.compoundId !== newContent.compoundId) {
        return {
          ...content,
          concentration: (content.concentration * this.totalVolume) / newTotalVolume
        };
      }
      return content;
    });

    // Step 2: Add new content
    const existingContentIndex = this.contents.findIndex(c => c.compoundId === newContent.compoundId);
    if (existingContentIndex !== -1) {
      const existingContent = this.contents[existingContentIndex];
      const updatedConcentration =
        ((existingContent.concentration * this.totalVolume) + (newContent.concentration * volumeToAdd)) / newTotalVolume;
      this.contents[existingContentIndex] = {
        ...existingContent,
        concentration: updatedConcentration,
        patternName: newContent.patternName
      };
    } else {
      this.contents.push({
        ...newContent,
        concentration: (newContent.concentration * volumeToAdd) / newTotalVolume
      });
    }
    this.updateSolvent({name: solventInfo.name, volume: solventVolume})
    this.totalVolume = newTotalVolume;
  }

  // updates solvents ONLY, does not touch totalVolume or content concentrations
  updateSolvent(solvent: Solvent): void {
    const existingSolventIndex = this.solvents.findIndex(s => s.name === solvent.name);
    if (existingSolventIndex !== -1) {
      this.solvents[existingSolventIndex].volume += solvent.volume;
    } else {
      this.solvents.push({ ...solvent });
    }
  }

  addSolvent(newSolvent: Solvent): void {
    if (this.isUnused) {
      console.warn(`Attempting to add solvent to unused well ${this.id}`);
      return;
    }
    // ... rest of existing implementation
    const newTotalVolume = this.totalVolume + newSolvent.volume;
    this.contents = this.contents.map(content => ({
      ...content,
      concentration: (content.concentration * this.totalVolume) / newTotalVolume
    }));
    this.updateSolvent(newSolvent)
    this.totalVolume = newTotalVolume;
  }

  bulkFill(volume: number, solventName: string = 'DMSO'): void {
    if (this.isUnused) {
      console.warn(`Attempting to bulk fill unused well ${this.id}`);
      return;
    }
    this.addSolvent({ name: solventName, volume });
  }

  removeVolume(volumeToRemove: number): void {
    if (volumeToRemove > this.totalVolume) {
      throw new Error('Cannot remove more volume than present in the well');
    }
    const removalFraction = volumeToRemove / this.totalVolume;
    this.solvents = this.solvents.map(solvent => ({
      ...solvent,
      volume: solvent.volume * (1 - removalFraction)
    })).filter(solvent => solvent.volume > 0);
    this.totalVolume -= volumeToRemove;
  }

  clearContents(): void {
    this.contents = [];
    this.solvents = [];
    this.totalVolume = 0;
  }

  getPatterns(): string[] {
    return [...new Set(this.contents.map(content => content.patternName))]
  }

  applyPattern(patternName: string, concentration: number): void {
    if (this.isUnused) {
      console.warn(`Attempting to apply pattern to unused well ${this.id}`);
      return;
    }
    const content = this.contents.find(c => c.patternName == patternName)
    if (!content) {
      this.contents.push({concentration: concentration, patternName: patternName})
    }
  }

  removePattern(patternName: string): void {
    this.contents = this.contents.filter( c => !(c.patternName == patternName))
  }

  getConcentrationFromCompound(compoundName: string): number {
    const content = this.contents.find(c => c.compoundId === compoundName);
    return content ? content?.concentration : 0

  }

  getSolventVolume(solventName: string): number {
    const solvent = this.solvents.find(s => s.name === solventName);
    return solvent ? solvent.volume : 0;
  }

  getSolventFraction(solventName: string): number {
    return this.getSolventVolume(solventName) / this.totalVolume;
  }

  getTotalVolume(): number {
    return this.totalVolume;
  }

  getContents(): ReadonlyArray<WellContent> {
    return this.contents;
  }

  getSolvents(): ReadonlyArray<Solvent> {
    return this.solvents;
  }

  isSolventOnlyWell(solventName: string): boolean {
    const solvents = this.getSolvents()
    const solvent = solvents.find(s => s.name == solventName)
    //no contents, one solvent, and that solvent has correct name = true
    return (this.getContents().length === 0 && this.getSolvents().length === 1 && solvent != undefined)
  }

  toJSON(): object {
    return {
      id: this.id,
      contents: this.contents,
      solvents: this.solvents,
      totalVolume: this.totalVolume,
      isUnused: this.isUnused
    };
  }

  static fromJSON(json: any): Well {
    return new Well({
      id: json.id,
      contents: json.contents,
      solvents: json.solvents,
      totalVolume: json.totalVolume,
      isUnused: json.isUnused
    });
  }
}