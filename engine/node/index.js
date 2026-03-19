'use strict';

const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const { runValidate } = require(path.resolve(__dirname, '..', 'validate', 'cli-adapter'));
const {
  ensureObject,
  parseJson,
  parseNodeId,
  parseAddress,
  resolveAddressInRoots,
  resolveComponentBinding,
  resolveTarget,
  uniqueNodeIdsFromRoots,
} = require('./support');

function writeYaml(filePath, value) {
  fs.writeFileSync(filePath, `${yaml.dump(value)}\n`, 'utf8');
}

function validateMutatedProject(projectPath, targetPath, mutate) {
  const previous = fs.existsSync(targetPath) ? fs.readFileSync(targetPath, 'utf8') : null;

  try {
    mutate();
  } catch (error) {
    if (previous != null) {
      fs.writeFileSync(targetPath, previous, 'utf8');
    }
    return {
      ok: false,
      error: error.message,
    };
  }

  const validateResult = runValidate({ projectPath });
  if (validateResult.ok) {
    return { ok: true };
  }

  if (previous != null) {
    fs.writeFileSync(targetPath, previous, 'utf8');
  } else {
    fs.unlinkSync(targetPath);
  }

  return {
    ok: false,
    error: 'Validation failed after mutation.',
    details: {
      errors: validateResult.errors,
      warnings: validateResult.warnings,
    },
  };
}

function addNode({
  projectPath,
  component,
  below,
  inside,
  nodeId,
  props,
}) {
  const normalizedPath = path.resolve(projectPath || process.cwd());

  const nodeIdResult = parseNodeId(nodeId);
  if (!nodeIdResult.ok) {
    return nodeIdResult;
  }

  if (!below && !inside) {
    return { ok: false, error: 'Either --below or --inside is required.' };
  }

  if (below && inside) {
    return { ok: false, error: 'Use only one of --below or --inside, not both.' };
  }

  const componentBinding = resolveComponentBinding(normalizedPath, component);
  if (!componentBinding.ok) {
    return componentBinding;
  }

  let propsObject = {};
  if (props != null) {
    const parsedProps = parseJson(props, '--props');
    if (!parsedProps.ok) {
      return parsedProps;
    }

    const checked = ensureObject(parsedProps.value, '--props');
    if (!checked.ok) {
      return checked;
    }

    propsObject = checked.value;
  }

  const target = resolveTarget(normalizedPath, below || inside);
  if (!target.ok) {
    return target;
  }

  const resolved = resolveAddressInRoots(target.roots, target.segments, {
    allowContainerFinal: Boolean(inside),
  });
  if (!resolved.ok) {
    return resolved;
  }

  if (below && resolved.targetType !== 'node') {
    return { ok: false, error: 'Sibling address for --below must resolve to a node.' };
  }

  if (inside && resolved.targetType === 'node') {
    if (!Array.isArray(resolved.node.children)) {
      if (Object.prototype.hasOwnProperty.call(resolved.node, 'children')) {
        return { ok: false, error: `Node "${resolved.node.id}" cannot accept child nodes.` };
      }
      resolved.node.children = [];
    }
  }

  const existingIds = uniqueNodeIdsFromRoots(target.roots);
  if (existingIds.has(nodeIdResult.value)) {
    return { ok: false, error: `Node id "${nodeIdResult.value}" already exists in this tree.` };
  }

  const newNode = {
    id: nodeIdResult.value,
    ...componentBinding.node,
  };

  if (Object.keys(propsObject).length > 0) {
    newNode.props = propsObject;
  }

  let insertAt;
  let insertList;
  if (resolved.targetType === 'node') {
    if (below) {
      insertAt = resolved.parentIndex + 1;
      insertList = resolved.parentNodes;
    }
    if (inside) {
      insertAt = 0;
      insertList = resolved.node.children;
    }
  } else {
    insertAt = 0;
    insertList = resolved.container.nodes;
  }

  const result = validateMutatedProject(normalizedPath, target.documentPath, () => {
    insertList.splice(insertAt, 0, newNode);
    writeYaml(target.documentPath, target.document);
  });

  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    nodeId: nodeIdResult.value,
    address: target.rawAddress,
    filePath: target.documentPath,
  };
}

function updateNode({
  projectPath,
  address,
  props,
  component,
  layout,
}) {
  const normalizedPath = path.resolve(projectPath || process.cwd());

  const target = resolveTarget(normalizedPath, address);
  if (!target.ok) {
    return target;
  }

  const resolved = resolveAddressInRoots(target.roots, target.segments, { allowContainerFinal: false });
  if (!resolved.ok) {
    return resolved;
  }

  if (resolved.targetType !== 'node') {
    return { ok: false, error: 'Update target must be a node.' };
  }

  const hasLayout = layout != null;
  const hasProps = props != null;
  const hasComponent = component != null;

  if (!hasLayout && !hasProps && !hasComponent) {
    return { ok: false, error: 'Nothing to update. Provide --props, --component, or --layout.' };
  }

  if (hasComponent) {
    const componentBinding = resolveComponentBinding(normalizedPath, component);
    if (!componentBinding.ok) {
      return componentBinding;
    }

    delete resolved.node.component;
    delete resolved.node.use;
    if (componentBinding.node.component) {
      resolved.node.component = componentBinding.node.component;
    } else {
      resolved.node.use = componentBinding.node.use;
    }
  }

  if (hasLayout) {
    const parsedLayout = parseJson(layout, '--layout');
    if (!parsedLayout.ok) {
      return parsedLayout;
    }

    const checked = ensureObject(parsedLayout.value, '--layout');
    if (!checked.ok) {
      return checked;
    }

    resolved.node.layout = checked.value;
  }

  if (hasProps) {
    const parsedProps = parseJson(props, '--props');
    if (!parsedProps.ok) {
      return parsedProps;
    }

    const checked = ensureObject(parsedProps.value, '--props');
    if (!checked.ok) {
      return checked;
    }

    if (!isObject(resolved.node.props)) {
      resolved.node.props = {};
    }

    resolved.node.props = {
      ...resolved.node.props,
      ...checked.value,
    };
  }

  const result = validateMutatedProject(normalizedPath, target.documentPath, () => {
    writeYaml(target.documentPath, target.document);
  });

  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    address,
    filePath: target.documentPath,
  };
}

function removeNode({ projectPath, address }) {
  const normalizedPath = path.resolve(projectPath || process.cwd());

  const target = resolveTarget(normalizedPath, address);
  if (!target.ok) {
    return target;
  }

  const resolved = resolveAddressInRoots(target.roots, target.segments, { allowContainerFinal: false });
  if (!resolved.ok) {
    return resolved;
  }

  if (resolved.targetType !== 'node') {
    return { ok: false, error: 'Remove target must be a node.' };
  }

  const removedNode = resolved.parentNodes.splice(resolved.parentIndex, 1)[0];

  const result = validateMutatedProject(normalizedPath, target.documentPath, () => {
    writeYaml(target.documentPath, target.document);
  });

  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    nodeId: removedNode && removedNode.id,
    address,
    filePath: target.documentPath,
  };
}

function isObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function parseNodeAddress(address) {
  return parseAddress(address);
}

module.exports = {
  addNode,
  parseNodeAddress,
  removeNode,
  updateNode,
};
