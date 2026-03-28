const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');

const CLI_PATH = '';

module.exports.workspaceActions = [
  {
    label: 'Translate to k6 Script',
    icon: 'fa-play',
    action: async (context, models) => {
      try {
        const config = await openTranslationDialog(context);

        if (!config) {
          return;
        }

        const result = await runTranslation(context, models, config);
        await showTranslationResultDialog(context, result);
      } catch (error) {
        await context.app.alert(
          'k6 Translator Error',
          error?.message || String(error)
        );
      }
    },
  },
];

/* =========================
   Main configuration dialog
   ========================= */

async function openTranslationDialog(context) {
  const defaultOutputDirectory =
    (await context.store.getItem('lastOutputDirectory')) || '';

  return new Promise(resolve => {
    let finished = false;

    const body = document.createElement('div');
    body.style.width = '100%';
    body.style.maxWidth = '680px';
    body.style.boxSizing = 'border-box';
    body.style.padding = '0';
    body.style.overflowX = 'hidden';

    body.innerHTML = `
      <div style="
        display:flex;
        flex-direction:column;
        gap:14px;
        font-size:13px;
        line-height:1.4;
        width:100%;
        box-sizing:border-box;
      ">
        <div>
          <div style="font-weight:600; margin-bottom:6px;">Output directory</div>
          <input
            id="k6-output-directory"
            type="text"
            style="
              width:100%;
              padding:8px 10px;
              border:1px solid var(--hl-sm, #555);
              border-radius:6px;
              background:var(--color-bg, #1e1e1e);
              color:var(--color-font, #fff);
              box-sizing:border-box;
            "
            placeholder="C:\\\\path\\\\to\\\\output-directory"
          />
        </div>

        <div>
          <div style="font-weight:600; margin-bottom:6px;">Load profile mode</div>
          <select
            id="k6-mode-select"
            style="
              width:100%;
              padding:8px 10px;
              border:1px solid var(--hl-sm, #555);
              border-radius:6px;
              background:var(--color-bg, #1e1e1e);
              color:var(--color-font, #fff);
              box-sizing:border-box;
            "
          >
            <option value="constant-vus" selected>constant-vus</option>
            <option value="shared-iterations">shared-iterations</option>
            <option value="stages">stages</option>
          </select>
        </div>

        <div
          id="k6-mode-fields"
          style="
            padding:12px;
            border:1px solid var(--hl-sm, #444);
            border-radius:8px;
            box-sizing:border-box;
            width:100%;
          "
        ></div>

        <div>
          <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-weight:600;">
            <input id="k6-add-thresholds" type="checkbox" />
            Add thresholds
          </label>

          <div
            id="k6-thresholds-block"
            style="
              display:none;
              margin-top:10px;
              padding:12px;
              border:1px solid var(--hl-sm, #444);
              border-radius:8px;
              box-sizing:border-box;
              width:100%;
            "
          >
            <div style="margin-bottom:6px; font-weight:600;">Thresholds</div>
            <textarea
              id="k6-thresholds-text"
              rows="4"
              style="
                width:100%;
                resize:vertical;
                padding:8px 10px;
                border:1px solid var(--hl-sm, #555);
                border-radius:6px;
                background:var(--color-bg, #1e1e1e);
                color:var(--color-font, #fff);
                box-sizing:border-box;
              "
              placeholder="http_req_duration=p(95)<500&#10;http_req_failed=rate<0.01"
            ></textarea>
          </div>
        </div>

        <div
          style="
            display:flex;
            justify-content:flex-end;
            gap:8px;
            padding-top:8px;
            border-top:1px solid var(--hl-sm, #333);
            width:100%;
            box-sizing:border-box;
          "
        >

          <button
            id="k6-submit-btn"
            type="button"
            style="
              padding:8px 14px;
              border:none;
              border-radius:6px;
              cursor:pointer;
              background:#8b5cf6;
              color:white;
              font-weight:600;
            "
          >
            Confirm
          </button>
        </div>
      </div>
    `;

    const outputDirectoryInput = body.querySelector('#k6-output-directory');
    const modeSelect = body.querySelector('#k6-mode-select');
    const modeFieldsContainer = body.querySelector('#k6-mode-fields');
    const addThresholdsCheckbox = body.querySelector('#k6-add-thresholds');
    const thresholdsBlock = body.querySelector('#k6-thresholds-block');
    const thresholdsTextarea = body.querySelector('#k6-thresholds-text');
    const submitButton = body.querySelector('#k6-submit-btn');

    outputDirectoryInput.value = defaultOutputDirectory;

    renderModeFields(modeFieldsContainer, modeSelect.value);

    modeSelect.addEventListener('change', () => {
      renderModeFields(modeFieldsContainer, modeSelect.value);
    });

    addThresholdsCheckbox.addEventListener('change', () => {
      const enabled = addThresholdsCheckbox.checked;
      thresholdsBlock.style.display = enabled ? 'block' : 'none';

      if (!enabled) {
        thresholdsTextarea.value = '';
      }
    });

    submitButton.addEventListener('click', async () => {
      const config = collectConfigFromDialog(body);

      await context.store.setItem(
        'lastOutputDirectory',
        config.outputDirectory || ''
      );

      finished = true;
      resolve(config);
      closeCurrentDialog(body);
    });

    context.app.dialog('k6 Translator', body, {
      wide: true,
      tall: false,
      onHide: () => {
        if (!finished) {
          finished = true;
          resolve(null);
        }
      },
    });
  });
}

/* =========================
   Dynamic mode block
   ========================= */

function renderModeFields(container, mode) {
  if (mode === 'constant-vus') {
    container.innerHTML = `
      <div style="font-weight:600; margin-bottom:10px;">constant-vus parameters</div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; width:100%;">
        <div style="min-width:0;">
          <div style="margin-bottom:6px;">VUs</div>
          <input
            id="k6-constant-vus"
            type="number"
            style="
              width:100%;
              padding:8px 10px;
              border:1px solid var(--hl-sm, #555);
              border-radius:6px;
              background:var(--color-bg, #1e1e1e);
              color:var(--color-font, #fff);
              box-sizing:border-box;
            "
            placeholder="10"
          />
        </div>

        <div style="min-width:0;">
          <div style="margin-bottom:6px;">Duration</div>
          <input
            id="k6-constant-duration"
            type="text"
            style="
              width:100%;
              padding:8px 10px;
              border:1px solid var(--hl-sm, #555);
              border-radius:6px;
              background:var(--color-bg, #1e1e1e);
              color:var(--color-font, #fff);
              box-sizing:border-box;
            "
            placeholder="30s"
          />
        </div>
      </div>
    `;
    return;
  }

  if (mode === 'shared-iterations') {
    container.innerHTML = `
      <div style="font-weight:600; margin-bottom:10px;">shared-iterations parameters</div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; width:100%;">
        <div style="min-width:0;">
          <div style="margin-bottom:6px;">VUs</div>
          <input
            id="k6-shared-vus"
            type="number"
            style="
              width:100%;
              padding:8px 10px;
              border:1px solid var(--hl-sm, #555);
              border-radius:6px;
              background:var(--color-bg, #1e1e1e);
              color:var(--color-font, #fff);
              box-sizing:border-box;
            "
            placeholder="10"
          />
        </div>

        <div style="min-width:0;">
          <div style="margin-bottom:6px;">Iterations</div>
          <input
            id="k6-shared-iterations"
            type="number"
            style="
              width:100%;
              padding:8px 10px;
              border:1px solid var(--hl-sm, #555);
              border-radius:6px;
              background:var(--color-bg, #1e1e1e);
              color:var(--color-font, #fff);
              box-sizing:border-box;
            "
            placeholder="100"
          />
        </div>
      </div>
    `;
    return;
  }

  if (mode === 'stages') {
    container.innerHTML = `
      <div style="font-weight:600; margin-bottom:10px;">stages parameters</div>

      <div style="width:100%;">
        <div style="margin-bottom:6px;">Stages</div>
        <textarea
          id="k6-stages-text"
          rows="5"
          style="
            width:100%;
            resize:vertical;
            padding:8px 10px;
            border:1px solid var(--hl-sm, #555);
            border-radius:6px;
            background:var(--color-bg, #1e1e1e);
            color:var(--color-font, #fff);
            box-sizing:border-box;
          "
          placeholder="10s:1&#10;30s:5&#10;10s:0"
        ></textarea>
      </div>
    `;
  }
}

/* =========================
   Data collection
   ========================= */

function collectConfigFromDialog(root) {
  const outputDirectory = root.querySelector('#k6-output-directory').value.trim();
  const mode = root.querySelector('#k6-mode-select').value;
  const addThresholds = root.querySelector('#k6-add-thresholds').checked;
  const thresholdsText = root.querySelector('#k6-thresholds-text').value;

  const config = {
    mode,
    outputDirectory,
    vus: '',
    duration: '',
    iterations: '',
    stages: [],
    thresholds: [],
  };

  if (mode === 'constant-vus') {
    config.vus = root.querySelector('#k6-constant-vus').value.trim();
    config.duration = root.querySelector('#k6-constant-duration').value.trim();
  }

  if (mode === 'shared-iterations') {
    config.vus = root.querySelector('#k6-shared-vus').value.trim();
    config.iterations = root.querySelector('#k6-shared-iterations').value.trim();
  }

  if (mode === 'stages') {
    config.stages = parseLines(root.querySelector('#k6-stages-text').value);
  }

  if (addThresholds) {
    config.thresholds = parseLines(thresholdsText);
  }

  return config;
}

function parseLines(text) {
  return String(text || '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
}

/* =========================
   Result dialog
   ========================= */

async function showTranslationResultDialog(context, result) {
  return new Promise(resolve => {
    let finished = false;

    const body = document.createElement('div');
    body.style.width = '100%';
    body.style.maxWidth = '700px';
    body.style.boxSizing = 'border-box';
    body.style.padding = '0';
    body.style.overflowX = 'hidden';

    const stdout = (result.stdout || '').trim();
    const stderr = (result.stderr || '').trim();

    body.innerHTML = `
      <div style="
        display:flex;
        flex-direction:column;
        gap:16px;
        font-size:13px;
        line-height:1.45;
        width:100%;
        box-sizing:border-box;
      ">
        <div style="
          padding:12px 14px;
          border:1px solid rgba(80, 180, 120, 0.35);
          border-radius:8px;
          background:rgba(80, 180, 120, 0.08);
          color:var(--color-font, #fff);
        ">
          <div style="font-weight:700; margin-bottom:4px;">
            Translation completed successfully
          </div>
          <div>
            The k6 script was created successfully.
          </div>
        </div>

        <div>
          <div style="font-weight:600; margin-bottom:6px;">Output file</div>
          <input
            type="text"
            readonly
            value="${escapeHtml(result.outputFilePath || '')}"
            style="
              width:100%;
              padding:8px 10px;
              border:1px solid var(--hl-sm, #555);
              border-radius:6px;
              background:var(--color-bg, #1e1e1e);
              color:var(--color-font, #fff);
              box-sizing:border-box;
            "
          />
        </div>

        ${
          stdout
            ? `
          <div>
            <div style="font-weight:600; margin-bottom:6px;">CLI output</div>
            <pre style="
              margin:0;
              padding:10px 12px;
              border:1px solid var(--hl-sm, #444);
              border-radius:8px;
              background:rgba(255,255,255,0.03);
              color:var(--color-font, #fff);
              white-space:pre-wrap;
              word-break:break-word;
              font-family:Consolas, monospace;
              font-size:12px;
            ">${escapeHtml(stdout)}</pre>
          </div>
        `
            : ''
        }

        ${
          stderr
            ? `
          <div>
            <div style="font-weight:600; margin-bottom:6px;">CLI warnings</div>
            <pre style="
              margin:0;
              padding:10px 12px;
              border:1px solid rgba(255, 180, 80, 0.35);
              border-radius:8px;
              background:rgba(255, 180, 80, 0.08);
              color:var(--color-font, #fff);
              white-space:pre-wrap;
              word-break:break-word;
              font-family:Consolas, monospace;
              font-size:12px;
            ">${escapeHtml(stderr)}</pre>
          </div>
        `
            : ''
        }
      </div>
    `;

    context.app.dialog('k6 Translator', body, {
      wide: true,
      tall: false,
      onHide: () => {
        if (!finished) {
          finished = true;
          resolve();
        }
      },
    });
  });
}

/* =========================
   Translation pipeline
   ========================= */

async function runTranslation(context, models, config) {
  const workspaceName = models.workspace?.name || 'workspace';
  const safeWorkspaceName = sanitizeFileName(workspaceName);
  const outputFilePath = buildOutputFilePath(
    config.outputDirectory,
    `${safeWorkspaceName}_k6.js`
  );

  const exportedData = await context.data.export.insomnia({
    includePrivate: true,
    format: 'yaml',
    workspace: models.workspace,
  });

  const exportedYaml = normalizeExportData(exportedData);

  const tempInputPath = path.join(
    os.tmpdir(),
    `insomnia-k6-${Date.now()}.yaml`
  );

  fs.writeFileSync(tempInputPath, exportedYaml, 'utf8');

  const args = buildCliArgs(config, tempInputPath, outputFilePath);

  try {
    const result = await execFileAsync(CLI_PATH, args);
    return {
      outputFilePath,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  } finally {
    try {
      fs.unlinkSync(tempInputPath);
    } catch {
      // temporary file cleanup is not critical
    }
  }
}

function buildCliArgs(config, inputPath, outputFilePath) {
  const args = [
    'translate',
    '--input',
    inputPath,
    '--output',
    outputFilePath,
  ];

  if (config.mode === 'constant-vus') {
    if (config.vus) {
      args.push('--vus', config.vus);
    }
    if (config.duration) {
      args.push('--duration', config.duration);
    }
  }

  if (config.mode === 'shared-iterations') {
    if (config.vus) {
      args.push('--vus', config.vus);
    }
    if (config.iterations) {
      args.push('--iterations', config.iterations);
    }
  }

  if (config.mode === 'stages') {
    for (const stage of config.stages || []) {
      args.push('--stage', stage);
    }
  }

  for (const threshold of config.thresholds || []) {
    args.push('--threshold', threshold);
  }

  return args;
}

function buildOutputFilePath(outputDirectory, fileName) {
  const baseDir = outputDirectory && outputDirectory.trim()
    ? outputDirectory.trim()
    : 'result';

  return path.join(baseDir, fileName);
}

function sanitizeFileName(value) {
  return String(value || 'workspace')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '') || 'workspace';
}

function execFileAsync(file, args) {
  return new Promise((resolve, reject) => {
    execFile(file, args, { windowsHide: true }, (error, stdout, stderr) => {
      if (error) {
        reject(
          new Error(
            [
              'CLI execution failed.',
              `Executable: ${file}`,
              `Args: ${args.join(' ')}`,
              '',
              stderr || error.message || String(error),
            ].join('\n')
          )
        );
        return;
      }

      resolve({ stdout, stderr });
    });
  });
}

function normalizeExportData(data) {
  if (typeof data === 'string') {
    return data;
  }

  if (Array.isArray(data)) {
    if (data.every(item => typeof item === 'string')) {
      return data.join('\n');
    }

    if (data.length === 1 && typeof data[0] === 'string') {
      return data[0];
    }

    throw new Error(
      `Insomnia export returned an array with unsupported structure. ` +
      `First item type: ${data.length > 0 ? typeof data[0] : 'empty array'}`
    );
  }

  throw new Error(
    `Insomnia export returned unsupported type: ${typeof data}`
  );
}

/* =========================
   UI helpers
   ========================= */

function closeCurrentDialog(childElement) {
  const dialogRoot =
    childElement.closest('[role="dialog"]') ||
    document.querySelector('[role="dialog"]');

  if (dialogRoot) {
    const closeButton = dialogRoot.querySelector(
      'button[aria-label="Close"], button[title="Close"]'
    );

    if (closeButton) {
      closeButton.click();
      return;
    }
  }

  document.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
    })
  );
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}