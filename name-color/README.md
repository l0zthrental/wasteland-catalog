# Name Painter

A minimal static Wasteland Story display-name color editor. Select letters in the name field to open a floating palette, or right-click an existing selection. Choose a palette color, custom hex color, opacity, or gradient. A compact preview shows the result. **Copy name** copies the generated `<color=#RRGGBBAA>…</color>` markup for **Item display name / CurrentName** in your save editor. Keep the exact item ID unchanged.

Existing six- and eight-digit hex color tags can be pasted directly into the name field, including nested tags. Editing preserves colors on surrounding characters. Undo, redo, and browser-local draft storage are included. Escape or clicking outside closes the palette. The preview approximates colors; it does not run the game or verify game-side restrictions. No saves, accounts, or credentials are read or uploaded. There are no external dependencies or network requests from the editor.

## Run locally

From this directory:

```powershell
python -m http.server 8765 --bind 127.0.0.1
```

Open http://127.0.0.1:8765. No build or package installation is required. Google Fonts is optional; system fonts are used when unavailable.

## GitHub Pages

This folder is published as `/name-color/` by the catalog repository's existing GitHub Pages deployment. All asset paths are relative. To host separately, put this folder's contents in a repository root, add `.nojekyll`, and configure Pages to deploy `main` from `/ (root)`.
