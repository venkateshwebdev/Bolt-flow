# Using the playground

The playground is a working editor built on Bolt Flow's public packages. Explore it at `/playground`, then use the adjacent documentation to build the same capabilities into your application.

## The workspace layout

The top navigation switches between **Playground** and **Documentation**. Client-side navigation keeps the runtime alive, so visiting a guide and returning retains the current canvas. A browser refresh starts a new application session; save or export first if you want to retain edits.

The document bar contains the canvas title, save state, Save, save preferences, Import, PNG, and Export JSON. The central toolbar controls Flow/Draw/Code, undo/redo, layout, the grid, plugins, and Properties. The canvas occupies the remaining workspace.

The left panel has three views:

| View | What it does |
| --- | --- |
| Insert | Add an Idea, Task, Note, or Review card, open drawing tools, or choose a template |
| Layers | Search objects, select multiple items, group, duplicate, hide, and lock |
| Notes | Browse local comment conversations and jump to their canvas objects |

The right Properties panel edits the selected node, annotation, or edge. With no object selected, it edits the canvas name and default appearance. Toggle it from the central toolbar. On smaller screens it opens as a dismissible overlay; the left navigation becomes a compact rail.

## Create and connect a workflow

1. Choose a card from Insert or use the floating **Add idea node** tool.
2. Select the card and edit its title, description, icon, and appearance in Properties.
3. Drag from a source handle to another card's target handle to create an edge.
4. Select the edge to change its label, route, color, arrowhead, width, or animation.
5. Use **Auto layout** to arrange the workflow. Free annotations stay in place; attached annotations follow their owners.

Choose **Editable waypoints** in edge routing to add manual bends. Double-click the path to add a waypoint. Select the edge to reveal the handles, drag a handle to move it, or double-click/Delete it to remove it.

## See the live integration code

Choose **Code** beside Flow and Draw to see a complete React integration generated from the current playground. Canvas edits, colors, node and edge styles, drawing options, enabled plugins, theme, grid, snapping, viewport, and save preferences update the source automatically. The Properties panel remains available while you read the code.

`App.tsx` shows the component and current visual settings, `features.ts` declares optional plugins and saving policy, and `canvas.json` contains the complete live data. This keeps large JSON snapshots out of the component.

Use the **File** selector to inspect the React setup, canvas JSON, custom node renderer, drawing configuration, styles, dependencies, and startup files. **Copy file** copies the selected source; **Download file** saves it. Save all listed files in the same folder and follow the included README to run the example. The Bolt Flow packages are an unpublished alpha; use locally packed packages if they are unavailable from your registry.

The generated integration uses `BoltFlow` with its optional editor shell and the playground's card renderer and drawing configuration. The surrounding playground navigation and documentation site are separate host UI. Code is read only and follows playground state; use JSON studio to apply document JSON. Switching back to Flow or Draw preserves the canvas, viewport, and undo history.

## Draw and annotate

Switch to **Draw**. The mode opens in Select, so changing modes does not immediately mark the canvas. Choose Pen, a shape, text, a comment, an arrow, or the eraser from the floating toolbar.

A completed drawing normally returns to Select. Enable **Keep tool** in drawing settings to keep drawing shapes repeatedly. Text, comments, and arrows that become graph edges still return to Select. Pan is explicit: use the hand tool or H to move the view.

Open drawing settings to choose font, size, fill, opacity, color, attachment owner, and text. Text and comments expose an initial text field. Double-click existing text to edit it inline; select a range for bold, italic, underline, strikethrough, color, or highlight.

Unfilled shape interiors let you select workflow cards beneath them. Drag the painted outline to move the shape. The eraser removes entire annotations rather than segments of a stroke.

## Connect annotations to objects

Use **Attach to** before drawing, or hold Shift while drawing to preview a nearby attachment target. Select an existing annotation and choose its owner in Properties to attach it later.

Attachments can form chains: a workflow step can own an arrow, and that arrow can own a note. Moving the step moves the chain. Deleting an owner detaches its direct annotations at their current positions. Cycles are rejected.

Enable attachment links in drawing settings to inspect these relationships. Drawing an arrow near two distinct workflow cards with smart connections enabled creates a real edge instead of a drawing object.

## Organize with layers

Open Layers and search by label. Select two or more unlocked objects and choose Group. A logical group is selected and moved together; it is not a resizable frame or a nested workflow.

Hide removes an object from the rendered canvas while retaining its JSON. Lock prevents normal canvas editing. The Layers panel can show and unlock it again. Duplicate remaps copied IDs and preserves attachments between copied owners and annotations. Use shared Undo to reverse these changes.

## Save and open

**Save** stores the current document in this browser. The playground has one current saved-canvas slot, not a document library. Its key is `bolt-flow:playground:v1`; the stored document itself uses schema 2.

Open the arrow beside Save for preferences:

- **Open saved** restores the browser copy. If current document edits are unsaved, the playground asks before replacing them.
- **Autosave** explicitly enables debounced saving. The preference is remembered separately from the document.
- **Save view** includes the current pan and zoom when you click Save or use the save shortcut. Turning it off removes the saved viewport on the next explicit Save.

The status reports unsaved changes, saving, saved, or an error. A successful earlier save does not mark newer edits as saved. Export JSON downloads a file and does not update browser-storage save status.

Browser data belongs to this browser profile and origin. Clearing site data removes it. Use Export JSON for a portable copy or build your own backend adapter using [the storage guide](persistence.md).

## Customize the workspace

Open **Customize** from the left navigation. Change theme, accent, density, grid, snap, and minimap. Choose visible drawing tools, enter a comma-separated tool order, and define a hex color palette.

Save a named preset to the document. Apply it later to restore its workspace, appearance, and drawing settings. Saving a preset changes the live JSON; click Save to persist it to browser storage. Reset restores workspace defaults while leaving the actual canvas objects intact.

Use Properties for default node/edge appearance or selected-object overrides. Per-object overrides take precedence over defaults. Existing code-defined renderers can interpret styles differently; inspect their component CSS if a field appears ineffective.

## Work with JSON and plugins

**JSON studio** displays the current document and accepts pasted/generated JSON. Preview validates the candidate. Insert creates fresh node, edge, and group IDs; Replace swaps the entire document. Both actions can be undone with history enabled. Neither implicitly runs a workflow or invokes an AI service.

**Plugins** lets you enable or disable drawing, layout, history, persistence, and JSON exchange. Loading a plugin is independent from saving its data. Disabling drawing retains annotations and shows placeholders until the renderer returns. Disabling the new manual persistence plugin does not flush unsaved edits.

## Keyboard and navigation

| Shortcut | Action |
| --- | --- |
| V / H | Select / Pan |
| N | Add a workflow step |
| Mod+Z / Mod+Shift+Z | Undo / Redo when history is enabled |
| Mod+S | Save with the current Save view choice |
| Mod+K | Search actions |
| Escape | Cancel a draft, return to Select, or close the active dialog |
| P / T / C / A in drawing mode | Pen / Text / Ellipse / Arrow |

Mod means Command on macOS or Control on other platforms. Text fields and inline editors retain their normal typing behavior. Dialogs trap focus, close with Escape, and restore focus when dismissed. On touch-sized layouts some secondary controls move into panels; desktop automation does not substitute for physical-device testing.

## Export and next steps

Export JSON includes graph, drawings, discussions, styles, and portable extensions. PNG captures full visible content without changing your viewport. Hidden objects are omitted. The SDK additionally exposes selection, scale, padding, background, and grid options for PNG.

Try a template, customize it, export it, and inspect its JSON. Then follow [the quickstart](quickstart.md) to embed the same packages in your own product.
