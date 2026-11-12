# Themes & customization

Customize the editor at the layer that owns the behavior: host components for product UI, CSS tokens for presentation, drawing configuration for tools, and document fields for portable object styles.

## Customization map

| What you want to change | Public surface | Portable JSON? |
| --- | --- | --- |
| Entire editor layout | Compose `BoltCanvas`, `BoltTools`, `BoltLayers`, `BoltInspector` | No |
| Built-in shell areas | `BoltEditor.panels` replacements or `false` | No |
| Plugin panels and menus | `editorUIPlugin`, `BoltSlot.overrides` | No |
| Buttons and host actions | `BoltAction`, `BoltToolbar.actions/hidden` | Callbacks stay in code |
| Keyboard shortcuts | `useBoltShortcuts`, action `shortcut` | Host decides preference format |
| Workflow cards and connections | `nodeTypes`, `edgeTypes`, canvas contribution slots | Renderer IDs/data only |
| Default node/edge visuals | `nodeDefaults`, `edgeDefaults` | Only if host persists the settings |
| Per-object visuals | `style`, `className`, drawing `data` | Yes |
| Drawing capability set | `drawPlugin({ tools })` | Host configuration |
| Drawing toolbar visibility/order | interaction `hiddenTools`, `toolOrder` | If host stores options |
| Custom shapes and fonts | drawing `shapes`, `fonts`, `colors` | Saved paths/families/colors only |
| Save/run/generate actions | Host callbacks and persistence adapters | Documents only |

There is no single configuration switch that makes arbitrary behavior customizable. The supported boundaries let you replace code-facing surfaces while exposing selected preferences to your users.

## Editor tokens

The public React primitives use these tokens:

```css
.my-editor {
  --bolt-accent: #0f766e;
  --bolt-surface: #ffffff;
  --bolt-text: #182230;
  --bolt-border: #dce3ec;
  --bolt-radius: 8px;
  --bolt-space: 12px;
  --bolt-font: Inter, system-ui, sans-serif;
}
```

Apply the class or style to `BoltEditor`, or to the common parent of your composed primitives. Tokens affect the default components that consume them; custom renderer CSS remains yours to define. The playground has its own product stylesheet built on a consistent neutral/blue theme and is an example application, not the SDK's only allowed visual design.

Use `BoltCanvas theme="dark"` for React Flow's color mode and canvas theme. Resolve your own card colors and shell tokens for dark mode. A canvas theme does not rewrite per-node colors already saved in JSON.

## Object styling and precedence

```tsx
<BoltCanvas
  nodeDefaults={{ style: { backgroundColor: '#fff', color: '#182230', borderRadius: 10 } }}
  edgeDefaults={{ type: 'smoothstep', style: { stroke: '#94a3b8', strokeWidth: 2 } }}
/>
```

```ts
runtime.updateDocument(draft => {
  const node = draft.nodes.find(item => item.id === selectedId);
  if (node) {
    node.style = { ...node.style, backgroundColor: '#ecfdf5', borderColor: '#10b981' };
    node.className = 'approved-task';
  }
}, { source: 'app.appearance' });
```

The second example assumes an existing runtime and selected node ID. Defaults resolve first and per-node values override them. `className` selects CSS provided by your application; exporting JSON does not embed that CSS. Use direct portable styles for visuals that must remain independent from a host stylesheet.

Drawing nodes interpret `data.color`, `data.fill`, `data.size`, `data.fontSize`, and `data.fontFamily`; their opacity is a node style. Do not expect a workflow card's background default to recolor drawing strokes.

## Tool defaults and toolbar preferences

Drawing plugin defaults establish initial values. Host-controlled interaction options override them. Creation commands can supply explicit settings for the new object. Saved objects retain their own values and do not change automatically when the next-drawing defaults change.

```tsx
const interaction = {
  tool: 'select',
  options: {
    color: '#0f766e', textColor: '#182230', opacity: 0.9,
    hiddenTools: ['eraser'],
    toolOrder: ['text', 'comment', 'pen', 'arrow'],
    palette: ['#0f766e', '#2563eb', '#dc2626', '#182230'],
    showAttachments: true,
  },
  onToolChange: setTool,
  onOptionsChange: setOptions,
};
```

This is the shape of the controlled object; in a component use the actual `tool` and `options` state variables instead of constants, as in [the custom layout example](react-editor.md#build-a-custom-layout).

`hiddenTools` changes toolbar presentation. `toolOrder` sorts allowed tools and leaves remaining allowed tools available. `palette` changes swatches, not every color an imported document may contain. `drawPlugin({ tools })` is the creation allowlist. Configure capability restrictions in host code, not only through a hidden button.

## Theme-following drawing color

Use `color: 'auto'` for ink that follows the drawing stylesheet's theme color. Customize its CSS variable when your application uses a different foreground:

```css
.my-editor { --bolt-ink-auto: #182230; }
.my-editor[data-theme='dark'] { --bolt-ink-auto: #e2e8f0; }
```

Store a literal color when it should look identical across themes. Separate `textColor` lets new text/comments use a different color from pen and shapes; an empty text color falls back to ink color. Explicit rich-text color marks can override the annotation's base color for individual runs.

## Custom fonts

```ts
runtime.use(drawPlugin({
  fonts: [{ id: 'editorial', label: 'Editorial', family: 'Georgia, serif' }],
  colors: ['#182230', '#0f766e', '#2563eb'],
}));
```

`fonts` appends to Normal, Handwritten, and Code. IDs must be unique, including reserved preset IDs `normal`, `handwritten`, and `code`. `colors` replaces the default toolbar palette.

Registering a font family does not load its files. For a custom face, serve it through your application:

```css
@font-face {
  font-family: 'Acme Sans';
  src: url('/fonts/acme-sans.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
```

Then use family `"Acme Sans", sans-serif`. Preserve font licenses, make asset paths work in production, and ensure image export can access the font. Gochi Hand is already self-hosted by the drawing package's public CSS.

## Portable presets

The playground stores settings in `extensions.workspace`, drawing preferences in `extensions.drawing`, appearance defaults in `extensions.appearance`, and named presets in `extensions.workspacePresets`. Those names describe its application contract, not an automatic core configuration engine.

A host can define its own versioned preset format:

```ts
runtime.updateDocument(draft => {
  draft.extensions['acme.editor-preset'] = {
    version: 1,
    theme: 'light', accent: '#0f766e',
    drawing: { color: '#0f766e', hiddenTools: ['eraser'] },
  };
}, { source: 'acme.preset.save' });
```

On load, validate and resolve these values before feeding them into UI props. Keep personal preferences in browser/user storage if they should not be shared with a document. Keep application-required capability limits in code so a document preset cannot enable disallowed actions.

## Build a coherent product UI

Use one spacing scale, a small typography hierarchy, consistent icon sizing, visible focus states, and clearly separated document actions versus canvas tools. Keep frequent actions visible and put secondary preferences in labeled panels. On narrow layouts, collapse navigation and show Properties as an overlay instead of shrinking the canvas to zero width.

Your replacement toolbars should preserve accessible names, disabled states, keyboard behavior, and read-only handling. Do not trigger viewport fitting just because a panel opens. Keep the canvas mounted when switching modes so selection, pan, and zoom remain predictable.
