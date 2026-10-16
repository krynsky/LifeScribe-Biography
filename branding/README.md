# LifeScribe Biography branding

The generated assets use the published LifeScribe wordmark in
`source-lifescribe-logo.png`, recolored to this app's own brand teal
(`--color-primary` in `src/styles/globals.css`). Unlike LifeScribe Vault, no
app-specific badge is added — Biography uses the plain official mark.

Regenerate the in-app wordmark, favicon, and app-icon source from this directory:

```powershell
python -m pip install -r requirements.txt
python generate_brand_assets.py
```

Then regenerate the native shortcut and application icon set from the repository
root:

```powershell
npm run tauri -- icon branding/lifescribe-biography-app-icon.png
```

The Tauri icon command also creates mobile and Windows Store assets. This
desktop project ignores the generated `android/`, `ios/`, and `64x64.png`
outputs (see `.gitignore`) while keeping the desktop and Windows Store icon set.
