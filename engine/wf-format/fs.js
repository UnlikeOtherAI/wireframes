'use strict';

const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const { packDocuments, unpackDocuments, looksLikeWf } = require('./index');

const PROJECT_GLOBS = [
  'manifest.yaml',
  'sitemap.yaml',
  'templates.yaml',
  'components.yaml',
];

function readYaml(file) {
  try {
    return yaml.load(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    return { __error: `${path.basename(file)}: ${error.message}` };
  }
}

function listYaml(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((name) => name.endsWith('.yaml') || name.endsWith('.yml'))
    .sort()
    .map((name) => path.join(dir, name));
}

function collectProjectDocuments(projectPath) {
  const files = [
    ...PROJECT_GLOBS.map((name) => path.join(projectPath, name)).filter((file) => fs.existsSync(file)),
    ...listYaml(path.join(projectPath, 'pages')),
    ...listYaml(path.join(projectPath, 'components')),
    ...listYaml(path.join(projectPath, 'data')),
  ];

  const documents = [];
  const errors = [];

  // .wfrc.yaml is CLI config rather than a project document, but a packed
  // project that loses it will not build, so it travels as `config`.
  const rcPath = path.join(projectPath, '.wfrc.yaml');
  if (fs.existsSync(rcPath)) {
    const rc = readYaml(rcPath);
    if (rc && rc.__error) {
      errors.push(rc.__error);
    } else if (rc && typeof rc === 'object') {
      documents.push({ documentType: 'config', id: 'wfrc', config: rc });
    }
  }
  for (const file of files) {
    const document = readYaml(file);
    if (document && document.__error) {
      errors.push(document.__error);
    } else if (document && typeof document === 'object') {
      documents.push(document);
    }
  }
  return { documents, errors };
}

const DUMP_OPTIONS = { lineWidth: 100, noRefs: true, sortKeys: false };

function dumpStream(documents) {
  return documents.map((document) => yaml.dump(document, DUMP_OPTIONS)).join('---\n');
}

/** Pack a project folder into a single `.wf` file. */
function packProject(projectPath, outputFile) {
  const { documents, errors } = collectProjectDocuments(projectPath);
  if (errors.length > 0) {
    return { ok: false, error: `Could not read every document:\n  ${errors.join('\n  ')}` };
  }

  const packed = packDocuments(documents, dumpStream);
  if (!packed.ok) return packed;

  const target = outputFile || path.join(projectPath, `${path.basename(path.resolve(projectPath))}.wf`);
  fs.mkdirSync(path.dirname(path.resolve(target)), { recursive: true });
  fs.writeFileSync(target, packed.text, 'utf8');
  return { ok: true, output: target, documentCount: packed.documents.length, bytes: Buffer.byteLength(packed.text) };
}

/** Read a `.wf` file into the documents the engine already understands. */
function readWfFile(file) {
  const text = fs.readFileSync(file, 'utf8');
  if (!looksLikeWf(text)) {
    return { ok: false, error: `${path.basename(file)} is not a .wf project (no "format: wf/1" and no document separator).` };
  }
  let documents;
  try {
    documents = yaml.loadAll(text);
  } catch (error) {
    return { ok: false, error: `Invalid YAML in ${path.basename(file)}: ${error.message}` };
  }
  return unpackDocuments(documents);
}

/** Expand a `.wf` file back into a project folder, losslessly. */
function unpackProject(file, outputDir) {
  const result = readWfFile(file);
  if (!result.ok) return result;

  const target = outputDir || path.join(path.dirname(path.resolve(file)), path.basename(file, path.extname(file)));
  const written = [];
  for (const [name, document] of Object.entries(result.files)) {
    const destination = path.join(target, name);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    const body = name === '.wfrc.yaml' ? document.config : document;
    fs.writeFileSync(destination, yaml.dump(body, DUMP_OPTIONS), 'utf8');
    written.push(name);
  }
  return { ok: true, output: target, files: written.sort() };
}

module.exports = {
  collectProjectDocuments,
  dumpStream,
  packProject,
  readWfFile,
  unpackProject,
};
