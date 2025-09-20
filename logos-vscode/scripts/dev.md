# Logos Developer Notes

## Setup

```bash
npm install
npm run compile
```

Launch the extension with <kbd>F5</kbd> from VS Code.

## Common Tasks

- **Watch TypeScript**: `npm run watch`
- **Run Tests**: `npm test`
- **Lint/Format**: Use VS Code's built-in TypeScript tooling.

## Project Layout

- `src/extension.ts` – activation entry point
- `src/commands.ts` – command handlers and output channel formatting
- `src/router.ts` – routes intents to prompts and models
- `src/services/` – Ollama client, context resolution, patch application, schema guards
- `src/panel/` – chat webview assets (HTML/JS/CSS)
- `test/` – smoke tests using `@vscode/test-electron`

## Ollama Tips

- Verify Ollama is running: `ollama list`
- Tail logs: `ollama serve --debug`
- Pull alternative models and override via the sidebar model field or `logos.*Model` settings.

## Troubleshooting

- **Connection refused**: ensure `ollama serve` is active and matches `logos.apiBaseUrl`.
- **Model not found**: run `ollama pull <model-name>`.
- **Large context truncated**: adjust `logos.maxInputChars` or narrow the selection.
