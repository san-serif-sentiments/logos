'use strict';

(function () {
  const vscode = acquireVsCodeApi();

  const savedState = vscode.getState() || {};
  const app = document.getElementById('app');

  const state = {
    history: [],
    config: {
      models: { writer: '', coder: '', scratchpad: '', default: '' },
      streaming: true,
    },
    role: savedState.role || 'coder',
    overrideModel: savedState.overrideModel || '',
    draft: savedState.draft || '',
    pending: false,
  };

  let streamingBuffer = '';
  let streamingElement = null;
  let latestAssistantText = '';

  const container = document.createElement('div');
  container.className = 'logos-container';
  app.appendChild(container);

  const header = document.createElement('div');
  header.className = 'logos-header';

  const roleSelect = document.createElement('select');
  addRoleOption(roleSelect, 'coder', 'Coder');
  addRoleOption(roleSelect, 'writer', 'Writer');
  addRoleOption(roleSelect, 'scratchpad', 'Scratchpad');
  roleSelect.value = state.role;

  const modelInput = document.createElement('input');
  modelInput.type = 'text';
  modelInput.placeholder = 'Model override (optional)';
  modelInput.value = state.overrideModel;

  const streamingIndicator = document.createElement('span');
  streamingIndicator.className = 'helper-text';

  header.appendChild(roleSelect);
  header.appendChild(modelInput);
  header.appendChild(streamingIndicator);

  container.appendChild(header);

  const chat = document.createElement('div');
  chat.className = 'logos-chat';
  container.appendChild(chat);

  const footer = document.createElement('div');
  footer.className = 'logos-footer';

  const textarea = document.createElement('textarea');
  textarea.className = 'logos-input';
  textarea.value = state.draft;
  footer.appendChild(textarea);

  const helper = document.createElement('div');
  helper.className = 'helper-text';
  helper.textContent = 'Ctrl+Enter (or Cmd+Enter) to send.';
  footer.appendChild(helper);

  const controls = document.createElement('div');
  controls.className = 'logos-controls';

  const clearButton = createButton('Clear', true);
  const insertButton = createButton('Insert into Editor', true);
  const copyButton = createButton('Copy', true);
  const spacer = document.createElement('div');
  spacer.className = 'spacer';
  const sendButton = createButton('Send');

  controls.appendChild(clearButton);
  controls.appendChild(insertButton);
  controls.appendChild(copyButton);
  controls.appendChild(spacer);
  controls.appendChild(sendButton);

  footer.appendChild(controls);

  const status = document.createElement('div');
  status.className = 'helper-text';
  footer.appendChild(status);

  container.appendChild(footer);

  updateModelPlaceholder();
  updateStreamingIndicator();
  updateStatus('');

  roleSelect.addEventListener('change', () => {
    state.role = roleSelect.value;
    updateModelPlaceholder();
    persistState();
  });

  modelInput.addEventListener('input', (event) => {
    state.overrideModel = event.target.value;
    persistState();
  });

  textarea.addEventListener('input', () => {
    state.draft = textarea.value;
    persistState();
  });

  textarea.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      sendMessage();
    }
  });

  sendButton.addEventListener('click', () => sendMessage());

  clearButton.addEventListener('click', () => {
    if (state.pending) {
      return;
    }
    vscode.postMessage({ type: 'clear' });
    updateStatus('History cleared.');
  });

  insertButton.addEventListener('click', () => {
    if (state.pending) {
      return;
    }
    const latest = getLatestAssistant();
    if (!latest) {
      updateStatus('Nothing to insert yet.');
      return;
    }
    vscode.postMessage({ type: 'insert', text: latest });
    updateStatus('Inserted into the editor.');
  });

  copyButton.addEventListener('click', async () => {
    if (state.pending) {
      return;
    }
    const latest = getLatestAssistant();
    if (!latest) {
      updateStatus('Nothing to copy yet.');
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(latest);
        updateStatus('Copied to clipboard.');
        return;
      } catch (error) {
        console.warn('Clipboard copy failed, falling back to extension API', error);
      }
    }
    vscode.postMessage({ type: 'copy', text: latest });
    updateStatus('Copy requested.');
  });

  window.addEventListener('message', (event) => {
    const message = event.data || {};
    switch (message.type) {
      case 'state':
        state.history = Array.isArray(message.history) ? message.history : [];
        if (message.config) {
          state.config = message.config;
          updateModelPlaceholder();
          updateStreamingIndicator();
        }
        resetStreaming();
        renderHistory();
        break;
      case 'config':
        if (message.config) {
          state.config = message.config;
          updateModelPlaceholder();
          updateStreamingIndicator();
        }
        break;
      case 'chatStream':
        if (typeof message.token === 'string') {
          appendStreamingToken(message.token);
        }
        break;
      case 'chatComplete':
        finishStreaming();
        setPending(false);
        updateStatus('Response received.');
        break;
      case 'chatError':
        resetStreaming();
        setPending(false);
        updateStatus(message.message ? `Error: ${message.message}` : 'Error from Logos.');
        break;
      default:
        break;
    }
    updateControls();
  });

  renderHistory();
  updateControls();
  vscode.postMessage({ type: 'ready' });

  function sendMessage() {
    const text = textarea.value.trim();
    if (!text || state.pending) {
      return;
    }
    setPending(true);
    updateStatus('Sending to Logos…');
    vscode.postMessage({
      type: 'chat',
      text,
      role: state.role,
      overrideModel: state.overrideModel.trim(),
    });
    textarea.value = '';
    state.draft = '';
    persistState();
  }

  function renderHistory() {
    streamingElement = null;
    streamingBuffer = '';
    chat.innerHTML = '';
    latestAssistantText = '';
    for (const entry of state.history) {
      const bubble = document.createElement('div');
      bubble.className = `message ${entry.role}`;
      bubble.textContent = entry.content;
      chat.appendChild(bubble);
      if (entry.role === 'assistant') {
        latestAssistantText = entry.content;
      }
    }
    scrollToBottom();
  }

  function appendStreamingToken(token) {
    if (!streamingElement) {
      streamingElement = document.createElement('div');
      streamingElement.className = 'message assistant streaming';
      streamingElement.textContent = '';
      chat.appendChild(streamingElement);
    }
    streamingBuffer += token;
    streamingElement.textContent = streamingBuffer;
    scrollToBottom();
  }

  function finishStreaming() {
    if (streamingElement) {
      streamingElement.classList.remove('streaming');
    }
  }

  function resetStreaming() {
    streamingBuffer = '';
    if (streamingElement) {
      streamingElement.remove();
      streamingElement = null;
    }
  }

  function updateControls() {
    const hasAssistant = !!getLatestAssistant();
    insertButton.disabled = !hasAssistant || state.pending;
    copyButton.disabled = !hasAssistant || state.pending;
    clearButton.disabled = state.pending || state.history.length === 0;
    sendButton.disabled = state.pending;
  }

  function setPending(value) {
    state.pending = value;
    sendButton.disabled = value;
  }

  function getLatestAssistant() {
    if (streamingBuffer) {
      return streamingBuffer;
    }
    if (latestAssistantText) {
      return latestAssistantText;
    }
    if (!state.history || state.history.length === 0) {
      return '';
    }
    for (let i = state.history.length - 1; i >= 0; i -= 1) {
      const entry = state.history[i];
      if (entry.role === 'assistant') {
        return entry.content;
      }
    }
    return '';
  }

  function updateModelPlaceholder() {
    const models = state.config.models || {};
    const fallback = models.default || '';
    let roleModel = fallback;
    if (state.role === 'writer' && models.writer) {
      roleModel = models.writer;
    } else if (state.role === 'scratchpad' && models.scratchpad) {
      roleModel = models.scratchpad;
    } else if (state.role === 'coder' && models.coder) {
      roleModel = models.coder;
    }
    if (roleModel) {
      modelInput.placeholder = `Model override (default: ${roleModel})`;
    } else {
      modelInput.placeholder = 'Model override (optional)';
    }
  }

  function updateStreamingIndicator() {
    const enabled = !!(state.config && state.config.streaming);
    streamingIndicator.textContent = enabled ? 'Streaming enabled' : 'Streaming disabled';
  }

  function updateStatus(message) {
    status.textContent = message;
  }

  function persistState() {
    vscode.setState({
      role: state.role,
      overrideModel: state.overrideModel,
      draft: state.draft,
    });
  }

  function scrollToBottom() {
    chat.scrollTop = chat.scrollHeight;
  }

  function addRoleOption(select, value, label) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    select.appendChild(option);
  }

  function createButton(label, secondary) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    if (secondary) {
      button.classList.add('secondary');
    }
    return button;
  }
})();
