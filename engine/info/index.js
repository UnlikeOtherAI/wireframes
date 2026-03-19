'use strict';

const path = require('node:path');
const { loadDocumentFromFile } = require(path.resolve(__dirname, '..', 'schema'));

function getProjectInfo(projectPath) {
  const manifestPath = path.resolve(projectPath, 'manifest.yaml');
  const loaded = loadDocumentFromFile(manifestPath);
  const manifestData = loaded.document?.manifest || {};

  return {
    projectName: manifestData.name,
    schemaVersion: manifestData.schemaVersion,
    createdWithCLI: manifestData.createdWithCLI,
    defaultGridColumns: manifestData.defaultGridColumns,
    defaultWireframeStyle: manifestData.defaultWireframeStyle,
  };
}

module.exports = {
  getProjectInfo,
};
