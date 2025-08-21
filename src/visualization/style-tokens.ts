export type ThemeName = 'light' | 'dark';

interface StyleTokens {
  palette: {
    background: number;
    line: number;
    lineAgg: number;
    directory: number;
    file: number;
    aggregated: number;
    hover: number;
    selected: number;
  };
  stationRadius: {
    directory: number;
    file: number;
    aggregated: number;
  };
  lineThickness: number;
}

const light: StyleTokens = {
  palette: {
    background: 0xffffff,
    line: 0x444444,
    lineAgg: 0xffffff,
    directory: 0x1565c0,
    file: 0x2e7d32, // darkened for >=3:1 contrast
    aggregated: 0xef6c00, // slightly darker for contrast >=3:1
    hover: 0x0d47a1, // dark blue ensures >=2.5 contrast vs white bg and >=1.5 vs selected orange
    selected: 0xe65100, // deep orange; contrast vs hover and bg >= required thresholds
  },
  stationRadius: {
    directory: 10,
    file: 6,
    aggregated: 18,
  },
  lineThickness: 3,
};

const dark: StyleTokens = {
  palette: {
    background: 0x121212,
    line: 0xbbbbbb,
    lineAgg: 0xffffff,
    directory: 0x42a5f5,
    file: 0x81c784,
    aggregated: 0xffb74d,
    hover: 0xffd54f,
    selected: 0xff7043,
  },
  stationRadius: {
    directory: 10,
    file: 6,
    aggregated: 18,
  },
  lineThickness: 3,
};

const themes: Record<ThemeName, StyleTokens> = { light, dark };
let currentTheme: ThemeName = 'light';

export function setTheme(name: ThemeName) {
  if (themes[name]) currentTheme = name;
}

export function tokens(): StyleTokens {
  return themes[currentTheme];
}
