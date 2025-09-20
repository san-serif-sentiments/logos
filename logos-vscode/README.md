# Logos VS Code Extension

Logos is an offline-first collaborator for code and writing workspaces. It combines three local personas powered by [Ollama](https://ollama.com):

- **Writer** – clear prose, docs, and release notes (`llama3.1:8b` by default)
- **Coder** – code review, refactor, and explain (`qwen2.5-coder:7b` by default)
- **Scratchpad** – brainstorm and plan (`phi3:3.8b` by default)

All requests stay local on your machine and route through the Ollama API at `http://localhost:11434`.

## Prerequisites

1. [Visual Studio Code](https://code.visualstudio.com/) 1.85 or newer
2. [Node.js](https://nodejs.org/) 18 or newer
3. [Ollama](https://ollama.com/) installed and running (`ollama serve`)
4. Pull the default models:
   ```bash
   ollama pull llama3.1:8b
   ollama pull qwen2.5-coder:7b
   ollama pull phi3:3.8b
   ```

## Install & Run

```bash
cd logos-vscode
npm install
npm run compile
```

1. Open the folder in VS Code.
2. Press <kbd>F5</kbd> to launch the Extension Development Host.

### Local Quickstart Checklist

1. **Clone & install** – grab this repository and install dependencies inside `logos-vscode/` with `npm install`.
2. **Start Ollama** – run `ollama serve` in a separate terminal and make sure `ollama list` shows the pulled models.
3. **Build once** – execute `npm run compile` to emit the TypeScript build into `out/`.
4. **Launch the extension** – open the folder in VS Code and press <kbd>F5</kbd> to spin up an Extension Development Host.
5. **Verify connectivity** – in the dev host, run **Logos: Open Chat**, send a short prompt (e.g., “summarize this file”), and confirm tokens stream in. If nothing appears, check the Output panel for connection guidance.
6. **Optional tests** – run `npm test` after installing [`@vscode/test-electron`](https://code.visualstudio.com/api/working-with-extensions/testing-extension) to execute the smoke suite.


## Configuration

Open **Settings → Extensions → Logos** or edit your `settings.json`.

| Setting | Description | Default |
| ------- | ----------- | ------- |
| `logos.defaultModel` | Fallback model when role is unspecified. | `qwen2.5-coder:7b` |
| `logos.writerModel` | Model for the Writer persona. | `llama3.1:8b` |
| `logos.coderModel` | Model for the Coder persona. | `qwen2.5-coder:7b` |
| `logos.scratchModel` | Model for the Scratchpad persona. | `phi3:3.8b` |
| `logos.apiBaseUrl` | Ollama base URL. | `http://localhost:11434` |
| `logos.maxInputChars` | Maximum characters sent per request. | `20000` |
| `logos.severityGate` | Review severity focus (`S1`, `S1S2`, `off`). | `S1` |
| `logos.enableStreaming` | Stream chat responses into the panel. | `true` |

You can override the model per chat turn from the sidebar input.

## Usage

### Logos Sidebar Chat

1. Open the **Logos** view from the activity bar or run **Logos: Open Chat**.
2. Pick a role (Coder, Writer, Scratchpad) and optionally supply a model override.
3. Type a prompt, press <kbd>Ctrl</kbd>/<kbd>Cmd</kbd> + <kbd>Enter</kbd>, or click **Send**.
4. Use **Insert into Editor** to drop the latest assistant reply inline, or **Copy** to clipboard.
5. Use **Clear** to reset the conversation (persisted per workspace).

Streaming tokens appear live when `logos.enableStreaming` is true.

### Editor Commands

Right-click a selection (or use the Command Palette) to access:

- **Logos: Review Selection** – choose selection, file, or git diff; returns structured findings with severity and optional patches.
- **Logos: Refactor Selection** – suggests targeted improvements with apply-ready patches.
- **Logos: Explain Selection** – summarizes behavior, risks, and test ideas.
- **Logos: Generate Docs for Selection** – drafts docstrings or Markdown sections.

Review and refactor results surface in the **Logos** output channel. If patches are provided, pick one to apply directly in the editor.

### Apply Patch Flow

When Logos proposes a diff:

1. Choose the patch from the quick pick.
2. Logos applies the unified diff to the active file, highlights the changed range, and reveals it in the editor.
3. If the patch cannot be applied automatically, a diff document opens for manual review.

### Privacy & Local-Only Processing

Logos never calls external services. All data is redacted for obvious secrets and sent solely to the Ollama instance at `http://localhost:11434`.

### Known Limits

- Large files are trimmed at `logos.maxInputChars`; prefer focused selections or git diffs.
- Ollama serves one request per model at a time—queue longer tasks for responsiveness.
- Running 7B–8B models locally typically needs 8 GB of RAM or more.

### Roadmap

- Inline PR review via `gh` and multi-file context
- CI severity gating for automated checks
- Coordinated multi-file refactors and dependency analysis

## Development

Developer notes live in [`scripts/dev.md`](scripts/dev.md).
