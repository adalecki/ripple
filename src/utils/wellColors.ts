import { Plate } from "../classes/PlateClass";
import { Well } from "../classes/WellClass";
import { HslStringType, Pattern } from "../classes/PatternClass";
import * as d3 from 'd3'

export interface HslType {
  h: number;
  s: number;
  l: number;
}

export interface ColorConfig {
  scheme: 'compound' | 'pattern' | 'rawResponse' | 'normalizedResponse' | 'custom';
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

export function wellColors(plate: Plate, config: ColorConfig): { wellId: string; colors: HslStringType[] }[] {
  if (config.scheme === 'rawResponse') {
    return wellColorsResponse(plate, false);
  }
  else if (config.scheme === 'normalizedResponse') {
    return wellColorsResponse(plate, true)
  }
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
      case 'custom':
        colors = config.colorMap.get(well.id) ? [config.colorMap.get(well.id)!] : []
    }

    wellColors.push({
      wellId: well.id,
      colors: colors
    });
  }

  return wellColors;
}

function getCompoundColor(well: Well, config: ColorConfig): HslStringType[] {
  if (well.getIsUnused()) {
    return ['hsl(0,0%,95%)' as HslStringType];
  }
  
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
  if (well.getIsUnused()) {
    return ['hsl(0,0%,95%)' as HslStringType];
  }
  
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

export function wellColorsResponse(plate: Plate, normalized: Boolean): { wellId: string; colors: HslStringType[] }[] {
  const wellColorArr: { wellId: string; colors: HslStringType[] }[] = [];
  
  const minResponse = (normalized ? 0 : plate.metadata.globalMinResponse);
  const maxResponse = (normalized ? 100 : plate.metadata.globalMaxResponse);
  
  const colorScale = d3
    .scaleSequential()
    .interpolator(d3.interpolateViridis)
    .domain([minResponse, maxResponse]);
  
  for (const well of plate) {
    if (!well) continue;
    
    let colors: HslStringType[] = [];
    
    if (well.getIsUnused()) {
      colors = ['hsl(0,0%,95%)' as HslStringType];
    } else if (!normalized && well.rawResponse !== null) {
      const color = colorScale(well.rawResponse);
      colors = [d3.color(color)?.formatHsl() as HslStringType]
    } else if (normalized && well.normalizedResponse !== null) {
      const color = colorScale(well.normalizedResponse)
      colors = [d3.color(color)?.formatHsl() as HslStringType]
    } 
    else {
      colors = ['hsl(0,0%,100%)'];
    }
    
    wellColorArr.push({ wellId: well.id, colors });
  }
  
  return wellColorArr;
}