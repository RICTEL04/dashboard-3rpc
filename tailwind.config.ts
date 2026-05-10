import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          blue:   '#636EFA',
          red:    '#EF553B',
          orange: '#FFA15A',
          green:  '#00CC96',
          purple: '#AB63FA',
          cyan:   '#19D3F3',
          yellow: '#FECB52',
        },
        surface: {
          base:   '#0d1117',
          raised: '#161b22',
          overlay:'#21262d',
          border: '#30363d',
        },
        text: {
          primary:   '#e6edf3',
          secondary: '#8b949e',
          muted:     '#484f58',
        },
      },
    },
  },
  plugins: [],
};

export default config;
