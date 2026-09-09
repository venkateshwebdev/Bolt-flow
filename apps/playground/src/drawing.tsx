import { Database, Triangle } from 'lucide-react';
import type { DrawPluginOptions } from '@bolt-flow/plugin-draw';

// Loaded with the optional drawing plugin, not with the initial playground.
export const drawOptions = {
  // Custom shapes append to the built-ins. Their SVG paths are saved in the document.
  shapes: [
    {
      id: 'triangle',
      label: 'Triangle',
      icon: <Triangle size={18} />,
      path: ({ width, height, size }) => {
        const inset = Math.max(8, size * 2);
        return `M ${width / 2} ${inset} L ${width - inset} ${height - inset} L ${inset} ${height - inset} Z`;
      },
    },
    {
      id: 'database',
      label: 'Database',
      icon: <Database size={18} />,
      path: ({ width, height, size }) => {
        const inset = Math.max(8, size * 2);
        const left = inset, right = width - inset;
        const radiusX = (right - left) / 2;
        const radiusY = (height - inset * 2) / 8;
        const top = inset + radiusY, bottom = height - inset - radiusY;
        return [
          `M ${left} ${top}`,
          `A ${radiusX} ${radiusY} 0 0 1 ${right} ${top}`,
          `L ${right} ${bottom}`,
          `A ${radiusX} ${radiusY} 0 0 1 ${left} ${bottom} Z`,
          `M ${left} ${top} A ${radiusX} ${radiusY} 0 0 0 ${right} ${top}`,
        ].join(' ');
      },
    },
  ],
  // Fonts append to Normal, Handwritten, and Code. This system font needs no download.
  fonts: [{ id: 'editorial', label: 'Editorial', family: 'Georgia, "Times New Roman", serif' }],
  colors: ['#252936', '#7963d2', '#2563eb', '#059669', '#e08a22', '#e0526e'],
  defaults: { fontFamily: '"Gochi Hand", cursive', keepTool: false },
  // Omit tools to include all built-ins and custom shapes; set it for an explicit subset/order.
} satisfies DrawPluginOptions;