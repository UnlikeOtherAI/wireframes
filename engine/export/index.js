'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const childProcess = require('node:child_process');
const yaml = require('js-yaml');
const { runValidate } = require(path.resolve(__dirname, '..', 'validate', 'cli-adapter'));

const DEFAULT_EXPORT_CONFIG = {
  strictValidation: true,
  failOnWarnings: false,
  includeAssets: true,
  compressLevel: 9,
};

function coerceExportConfig(raw) {
  const cliConfig = (raw && typeof raw === 'object' && raw.cli && typeof raw.cli === 'object') ? raw.cli : {};
  const exportConfig = (cliConfig.export && typeof cliConfig.export === 'object') ? cliConfig.export : {};

  return {
    strictValidation:
      typeof cliConfig.strictValidation === 'boolean' ? cliConfig.strictValidation : DEFAULT_EXPORT_CONFIG.strictValidation,
    failOnWarnings:
      typeof cliConfig.failOnWarnings === 'boolean' ? cliConfig.failOnWarnings : DEFAULT_EXPORT_CONFIG.failOnWarnings,
    includeAssets:
      typeof exportConfig.includeAssets === 'boolean' ? exportConfig.includeAssets : DEFAULT_EXPORT_CONFIG.includeAssets,
    compressLevel: Number.isInteger(exportConfig.compressLevel)
      ? exportConfig.compressLevel
      : DEFAULT_EXPORT_CONFIG.compressLevel,
  };
}

function normalizeCompressionLevel(level) {
  if (!Number.isInteger(level) || level < 0 || level > 9) {
    return DEFAULT_EXPORT_CONFIG.compressLevel;
  }
  return level;
}

function loadWfrcConfig(projectPath) {
  const wfrcPath = path.join(projectPath, '.wfrc.yaml');
  if (!fs.existsSync(wfrcPath)) {
    return {
      ...DEFAULT_EXPORT_CONFIG,
    };
  }

  let parsed;
  try {
    const content = fs.readFileSync(wfrcPath, 'utf8');
    parsed = yaml.load(content) || {};
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return {
        ...DEFAULT_EXPORT_CONFIG,
      };
    }
  } catch (error) {
    return {
      ...DEFAULT_EXPORT_CONFIG,
      parseError: `Invalid .wfrc.yaml: ${error.message}`,
    };
  }

  return coerceExportConfig(parsed);
}

function buildZipCommand({
  projectPath,
  outputPath,
  includeAssets,
  compressLevel,
}) {
  const zipOutputArg = path.isAbsolute(outputPath) ? outputPath : outputPath;
  const relativeOutput = path.relative(projectPath, outputPath).split(path.sep).join('/');
  const excludes = ['.wfrc.yaml'];

  if (!includeAssets) {
    excludes.push('assets/*');
  }
  if (!relativeOutput.startsWith('..')) {
    excludes.push(relativeOutput);
  }

  const options = [
    '-r',
    '-q',
    `-${normalizeCompressionLevel(compressLevel)}`,
    zipOutputArg,
    '.',
  ];

  if (excludes.length > 0) {
    for (const entry of excludes) {
      options.push('-x', entry);
    }
  }

  return options;
}

function runZipCommand(projectPath, args) {
  const result = childProcess.spawnSync('zip', args, {
    cwd: projectPath,
    encoding: 'utf8',
    maxBuffer: 5_000_000,
  });

  if (result.error) {
    return {
      ok: false,
      missingCommand: result.error.code === 'ENOENT',
      error: result.error.message,
    };
  }

  if (result.status !== 0) {
    const errorMessage = (result.stderr && result.stderr.trim()) || 'Failed to create zip package.';
    return {
      ok: false,
      error: errorMessage,
    };
  }

  return {
    ok: true,
  };
}

function shouldSkipArchiveEntry(relativePath, includeAssets, relativeOutput) {
  const normalized = relativePath.split(path.sep).join('/');
  if (normalized === '.wfrc.yaml') {
    return true;
  }
  if (!includeAssets && (normalized === 'assets' || normalized.startsWith('assets/'))) {
    return true;
  }
  return relativeOutput && normalized === relativeOutput;
}

function copyArchiveEntries(sourceDir, targetDir, includeAssets, relativeOutput, baseDir = sourceDir) {
  fs.mkdirSync(targetDir, { recursive: true });
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDir, entry.name);
    const relativePath = path.relative(baseDir, sourcePath);
    if (shouldSkipArchiveEntry(relativePath, includeAssets, relativeOutput)) {
      continue;
    }
    const targetPath = path.join(targetDir, relativePath);
    if (entry.isDirectory()) {
      copyArchiveEntries(sourcePath, targetDir, includeAssets, relativeOutput, baseDir);
    } else if (entry.isFile()) {
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

function createArchiveWithPowerShell({
  projectPath,
  outputPath,
  includeAssets,
}) {
  const stageRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'wireframe-export-stage-'));
  const relativeOutput = path.relative(projectPath, outputPath).split(path.sep).join('/');
  try {
    copyArchiveEntries(projectPath, stageRoot, includeAssets, relativeOutput);
    const command = [
      '$ErrorActionPreference = "Stop"',
      'Compress-Archive -Path (Join-Path $env:WF_STAGE "*") -DestinationPath $env:WF_ZIP -Force',
    ].join('; ');
    const result = childProcess.spawnSync('powershell', ['-NoProfile', '-Command', command], {
      encoding: 'utf8',
      env: {
        ...process.env,
        WF_STAGE: stageRoot,
        WF_ZIP: outputPath,
      },
      maxBuffer: 5_000_000,
    });
    if (result.error) {
      return { ok: false, error: result.error.message };
    }
    if (result.status !== 0) {
      return { ok: false, error: (result.stderr && result.stderr.trim()) || 'Failed to create zip package.' };
    }
    return { ok: true };
  } finally {
    fs.rmSync(stageRoot, { recursive: true, force: true });
  }
}

function createExportArchive({
  projectPath,
  outputPath,
  includeAssets,
  compressLevel,
}) {
  const outputDir = path.dirname(outputPath);
  if (outputDir && outputDir !== '.' && !fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const args = buildZipCommand({
    projectPath,
    outputPath,
    includeAssets,
    compressLevel,
  });

  const zipResult = runZipCommand(projectPath, args);
  if (!zipResult.ok) {
    if (!zipResult.missingCommand) {
      return zipResult;
    }
    const fallbackResult = createArchiveWithPowerShell({
      projectPath,
      outputPath,
      includeAssets,
    });
    if (!fallbackResult.ok) {
      return fallbackResult;
    }
  }

  if (!fs.existsSync(outputPath)) {
    return {
      ok: false,
      error: `Failed to create export archive at ${outputPath}.`,
    };
  }

  return {
    ok: true,
    outputPath,
  };
}

function runExport({ projectPath = process.cwd(), output = 'build.zip' } = {}) {
  const normalizedProjectPath = path.resolve(projectPath);
  const normalizedOutput = path.isAbsolute(output) ? output : path.resolve(normalizedProjectPath, output);

  const config = loadWfrcConfig(normalizedProjectPath);
  if (config.parseError) {
    return {
      ok: false,
      error: config.parseError,
    };
  }

  const shouldFailOnWarnings = Boolean(config.strictValidation) || Boolean(config.failOnWarnings);
  const validationResult = runValidate({
    projectPath: normalizedProjectPath,
    strict: shouldFailOnWarnings,
  });

  if (!validationResult.ok) {
    return {
      ok: false,
      error: 'Project validation failed. Run wf validate before exporting.',
      details: validationResult,
    };
  }

  if (validationResult.warnings.length > 0 && shouldFailOnWarnings) {
    return {
      ok: false,
      error: 'Project validation produced warnings and configured strict behavior is enabled.',
      details: validationResult,
    };
  }

  const archiveResult = createExportArchive({
    projectPath: normalizedProjectPath,
    outputPath: normalizedOutput,
    includeAssets: config.includeAssets,
    compressLevel: config.compressLevel,
  });

  if (!archiveResult.ok) {
    return {
      ok: false,
      error: `Failed to write export archive: ${archiveResult.error}`,
    };
  }

  return {
    ok: true,
    outputPath: normalizedOutput,
    projectPath: normalizedProjectPath,
    warnings: validationResult.warnings,
    strictValidation: shouldFailOnWarnings,
  };
}

module.exports = {
  runExport,
};
