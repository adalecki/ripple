import { Plate } from "../classes/PlateClass";
import { Well } from "../classes/WellClass";
import { HslStringType, Pattern } from "../classes/PatternClass";

export interface HslType {
  h: number;
  s: number;
  l: number;
}

export interface ColorConfig {
  scheme: 'compound' | 'pattern' | 'response';
  colorMap: Map<string, HslStringType>;
  maxConcentration?: number;
  responseRange?: { min: number; max: number };
}

export function generateCompoundColors(compounds: string[]): Map<string, HslStringType> {
  const saturation = '100'
  const lightness = '80'
  const colorMap = new Map<string, HslStringType>();
  const n = compounds.length;
  const hues = buildHues(n)
  compounds.forEach((compound, index) => {
    let color = `hsl(${hues[index]},${saturation}%,${lightness}%)` as HslStringType
    colorMap.set(compound, color)
  });

  return colorMap;
}

export function generatePatternColors(patterns: Pattern[]) {
  const colorMap = new Map<string, HslStringType>();
  patterns.forEach((Pattern,_) => {
    colorMap.set(Pattern.name,Pattern.color)
  })
  return colorMap;
}

export function wellColors(plate: Plate, config: ColorConfig) {
  const wellColors = [];

  for (const well of plate) {
    if (!well) continue;

    let colors: HslStringType[] = []; //default white for empty wells

    switch (config.scheme) {
      case 'compound':
        colors = getCompoundColor(well, config);
        break;
      case 'pattern':
        colors = getPatternColor(well, config);
        break;
      case 'response':
        //color = getResponseColor(well, config.responseRange);
        break;
    }

    wellColors.push({
      wellId: well.id,
      colors: colors
    });
  }

  return wellColors;
}

function getCompoundColor(well: Well, config: ColorConfig): HslStringType[] {
  const regex = /(\d+\.?\d*)%?/g;
  const contents = well.getContents().filter(content => content.compoundId)
  let colors = ['hsl(0,0%,100%)' as HslStringType]
  if (contents.length > 0) {
    colors = contents.map(content => {
      const baseColor = config.colorMap.get(content.compoundId!) || 'hsl(0,0%,80%)';
      let nums = baseColor.match(regex)
      let lightness = wellLightness(well, content.concentration, config.maxConcentration || 0)
      return (nums ? `hsl(${nums[0]},${nums[1]},${lightness}%)` as HslStringType : 'hsl(0,0%,100%)' as HslStringType)
    });
  }
  else if (well.getTotalVolume() > 0 && well.getSolventFraction('Assay Buffer') > 0) {
    colors = ['hsl(0,0%,90%)' as HslStringType]
  }
  return colors
}

function getPatternColor(well: Well, config: ColorConfig): HslStringType[] {
  const regex = /(\d+\.?\d*)%?/g;
  const contents = well.getContents().filter(content => !(content.compoundId))
  const colors = contents.map(content => {
    const baseColor = config.colorMap.get(content.patternName) || 'hsl(0,0%,80%)';
    let nums = baseColor.match(regex)
    let lightness = wellLightness(well, content.concentration, config.maxConcentration || 0)
    return (nums ? `hsl(${nums[0]},${nums[1]},${lightness}%)` as HslStringType : 'hsl(0,0%,100%)' as HslStringType)
  });
  return colors
}

export function wellColorsOld(plate: Plate, colorMap: Map<string, string>, maxConcentration: number): { wellId: string; colors: string[]; }[] {
  const wellColors = [];
  const regex = /(\d+\.?\d*)%?/g;

  for (const well of plate) {
    if (well) {
      const contents = well.getContents().filter(content => content.compoundId)
      const colors = contents.map(content => {
        const baseColor = colorMap.get(content.compoundId!) || '#cccccc';
        let nums = baseColor.match(regex)
        let lightness = wellLightness(well, content.concentration!, maxConcentration)
        return (nums ? `hsl(${nums[0]},${nums[1]},${lightness}%)` : '#ffffff')
      });
      wellColors.push({
        wellId: well.id,
        colors: colors
      });
    }
  }
  return wellColors;
}

function wellLightness(well: Well, concentration: number, maxValue: number) {
  let start = 40
  let end = 95
  let lightness = end
  if (maxValue === 0) { maxValue = 1 }
  if (well.getContents()) {
    lightness = end - (Math.floor(concentration / maxValue * (end - start)))
  }

  return lightness
}

function buildHues(count: number): number[] {
  const goldenRatioConjugate = 0.618033988749895;
  let h = Math.random();
  const hues = [];

  for (let i = 0; i < count; i++) {
    h += goldenRatioConjugate;
    h %= 1;
    hues.push(h * 360);
  }

  return hues;
}
//@ts-ignore
function buildHuesOld(count: number): number[] {
  let stepSize = 251 //arbitrary, seems to generate a nice spectrum
  //let stepSize = 70 + (360 / count)
  let hues = []
  for (let i = 0; i < count; i++) {

    let hue = (stepSize * i) % 360
    hues.push(hue)
  }
  return hues
}
//@ts-ignore
function parseHSL(color: `hsl(${number},${number}%,${number}%)`): { h: number, s: number, l: number } | null {
  const match = color.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
  if (!match) return null;

  return {
    h: parseInt(match[1]),
    s: parseInt(match[2]),
    l: parseInt(match[3])
  };
}

export function hslToString(hsl: HslType): `hsl(${number},${number}%,${number}%)` {
  return `hsl(${hsl.h},${hsl.s}%,${hsl.l}%)`
}