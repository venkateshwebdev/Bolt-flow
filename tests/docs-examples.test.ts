import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { expect, test } from 'vitest';

test('complete quickstart and custom layout examples compile against public package types', () => {
  const examples = [
    ['quickstart', 'export default function App'],
    ['react-flow', 'export default function ControlledFlow'],
    ['react-flow', 'export default function DrawingFlow'],
    ['react-flow', 'export default function SaveFlow'],
    ['react-editor', 'export function CustomWorkspace'],
  ];
  const files = new Map(examples.map(([guide, marker]) => {
    const markdown = readFileSync(resolve(`docs/guide/${guide}.md`), 'utf8');
    const code = [...markdown.matchAll(/```tsx\n([\s\S]*?)\n```/g)].find(match => match[1].includes(marker))?.[1];
    if (!code) throw new Error(`Missing complete example in ${guide}`);
    return [resolve(`tests/documented-${guide}-${marker.split(' ').pop()}.tsx`), code];
  }));
  const config = ts.readConfigFile(resolve('tsconfig.json'), ts.sys.readFile);
  const { options } = ts.parseJsonConfigFileContent(config.config, ts.sys, process.cwd());
  const host = ts.createCompilerHost(options), original = host.getSourceFile.bind(host);
  host.getSourceFile = (name, languageVersion, onError, shouldCreateNewSourceFile) => files.has(name)
    ? ts.createSourceFile(name, files.get(name)!, languageVersion, true, ts.ScriptKind.TSX)
    : original(name, languageVersion, onError, shouldCreateNewSourceFile);
  const program = ts.createProgram([...files.keys()], options, host);
  const diagnostics = ts.getPreEmitDiagnostics(program);
  expect(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: name => name, getCurrentDirectory: () => process.cwd(), getNewLine: () => '\n',
  })).toBe('');
}, 30_000);

import { playgroundFiles } from '../apps/playground/src/playground-code';
import { createDocument } from '../packages/core/src/index';

test('live playground exports compile with full and minimal plugin configurations', () => {
  const document = createDocument({ nodes: [{ id: 'task', type: 'bolt', position: { x: 0, y: 0 }, data: { label: 'Current task' } }] });
  for (const plugins of [[], ['history', 'draw', 'layout', 'storage', 'export']]) {
    const generated = playgroundFiles(document, { theme: 'dark', grid: true, minimap: false, snap: true, tool: 'select', drawing: { color: '#123456', hiddenTools: ['eraser'] }, viewport: { x: 20, y: 30, zoom: .8 }, inspector: true, showDraw: true, rememberView: true }, plugins, 'autosave');
    expect(JSON.parse(generated['canvas.json'])).toEqual(document);
    expect(generated['App.tsx']).toContain('#123456');
    const folder = resolve('tests/generated-editor');
    const files = new Map(Object.entries(generated).map(([file, source]) => [resolve(folder, file), source]));
    const config = ts.readConfigFile(resolve('tsconfig.json'), ts.sys.readFile);
    const { options } = ts.parseJsonConfigFileContent(config.config, ts.sys, process.cwd());
    options.types = ['vite/client'];
    const host = ts.createCompilerHost(options), originalSource = host.getSourceFile.bind(host), originalExists = host.fileExists.bind(host), originalDirectory = host.directoryExists!.bind(host), originalRead = host.readFile.bind(host);
    host.fileExists = file => files.has(file) || originalExists(file);
    host.directoryExists = dir => dir === folder || originalDirectory(dir);
    host.readFile = file => files.get(file) ?? originalRead(file);
    host.getSourceFile = (name, version, onError, create) => files.has(name)
      ? ts.createSourceFile(name, files.get(name)!, version, true, name.endsWith('.tsx') ? ts.ScriptKind.TSX : name.endsWith('.json') ? ts.ScriptKind.JSON : ts.ScriptKind.TS)
      : originalSource(name, version, onError, create);
    const program = ts.createProgram([...files.keys()].filter(file => /\.tsx?$/.test(file)), options, host);
    expect(ts.formatDiagnosticsWithColorAndContext(ts.getPreEmitDiagnostics(program), { getCanonicalFileName: name => name, getCurrentDirectory: () => process.cwd(), getNewLine: () => '\n' })).toBe('');
  }
}, 30_000);
