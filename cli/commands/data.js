'use strict';

const path = require('node:path');
const yaml = require('js-yaml');
const {
  addDataset,
  addDataItem,
  getDataItem,
  importData,
  listDataItems,
  listDatasets,
  removeDataItem,
  removeDataset,
  validateDataset,
  dataStats,
  dataKeys,
  updateDataItem,
} = require(path.resolve(__dirname, '..', '..', 'shared', 'data'));

const SUBCOMMAND_USAGE = 'Usage: wf data <add|remove|import|list|validate|stats|keys|item> ...';
const ITEM_SUBCOMMAND_USAGE = 'Usage: wf data item <add|update|remove|get|list> ...';

function parseDataAddArgs(args) {
  const options = {
    datasetId: args[0],
    primaryKey: null,
    fields: null,
  };

  for (let index = 1; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--primaryKey') {
      if (index + 1 >= args.length) {
        throw new Error('Missing value for --primaryKey.');
      }
      options.primaryKey = args[index + 1];
      index += 1;
      continue;
    }
    if (arg === '--fields') {
      if (index + 1 >= args.length) {
        throw new Error('Missing value for --fields.');
      }
      options.fields = args[index + 1];
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function parseDataRemoveArgs(args) {
  return {
    datasetId: args[0],
  };
}

function parseDataImportArgs(args, cwd) {
  const options = {
    datasetId: args[0],
    from: null,
    overwrite: false,
  };

  for (let index = 1; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--from') {
      if (index + 1 >= args.length) {
        throw new Error('Missing value for --from.');
      }
      options.from = path.resolve(cwd, args[index + 1]);
      index += 1;
      continue;
    }
    if (arg === '--overwrite') {
      options.overwrite = true;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function parseDataItemAddArgs(args, cwd) {
  const options = {
    datasetId: args[0],
    item: null,
    from: null,
  };

  let hasItem = false;

  for (let index = 1; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--from') {
      if (index + 1 >= args.length) {
        throw new Error('Missing value for --from.');
      }
      options.from = path.resolve(cwd, args[index + 1]);
      index += 1;
      continue;
    }

    if (arg.startsWith('--')) {
      throw new Error(`Unknown argument: ${arg}`);
    }

    if (hasItem) {
      throw new Error('Only one item JSON argument is supported.');
    }
    options.item = arg;
    hasItem = true;
  }

  if (!hasItem && !options.from) {
    throw new Error('wf data item add requires an item JSON payload or --from.');
  }
  if (options.from && options.item) {
    throw new Error('Use only one of item JSON or --from, not both.');
  }

  return options;
}

function parseDataItemUpdateArgs(args) {
  const options = {
    datasetId: args[0],
    primaryKeyValue: args[1],
    item: args[2],
  };

  if (args.length > 3) {
    throw new Error('wf data item update accepts only <datasetId> <primaryKeyValue> <json>.');
  }

  return options;
}

function parseDataItemKeyArgArgs(args) {
  return {
    datasetId: args[0],
    primaryKeyValue: args[1],
  };
}

function runData(args, context = {}) {
  const cwd = context.cwd || process.cwd();
  const [subcommand, ...rest] = args;

  if (!subcommand) {
    console.error(SUBCOMMAND_USAGE);
    process.exitCode = 2;
    return;
  }

  if (subcommand === 'add') {
    let options;
    try {
      options = parseDataAddArgs(rest);
    } catch (error) {
      console.error(error.message);
      console.log(SUBCOMMAND_USAGE);
      process.exitCode = 2;
      return;
    }

    if (!options.datasetId) {
      console.error('wf data add requires <datasetId> and --primaryKey.');
      console.log(SUBCOMMAND_USAGE);
      process.exitCode = 2;
      return;
    }

    if (!options.primaryKey) {
      console.error('wf data add requires --primaryKey.');
      console.log(SUBCOMMAND_USAGE);
      process.exitCode = 2;
      return;
    }

    const result = addDataset({
      projectPath: cwd,
      datasetId: options.datasetId,
      primaryKey: options.primaryKey,
      fields: options.fields,
    });

    if (result.ok) {
      console.log(`Added dataset: ${result.datasetId}`);
      return;
    }

    console.error(`wf data add failed: ${result.error}`);
    process.exitCode = 1;
    return;
  }

  if (subcommand === 'remove') {
    const options = parseDataRemoveArgs(rest);
    if (!options.datasetId) {
      console.error('wf data remove requires <datasetId>.');
      console.log(SUBCOMMAND_USAGE);
      process.exitCode = 2;
      return;
    }

    const result = removeDataset({ projectPath: cwd, datasetId: options.datasetId });
    if (result.ok) {
      console.log(`Removed dataset: ${result.datasetId}`);
      return;
    }

    console.error(`wf data remove failed: ${result.error}`);
    process.exitCode = 1;
    return;
  }

  if (subcommand === 'import') {
    let options;
    try {
      options = parseDataImportArgs(rest, cwd);
    } catch (error) {
      console.error(error.message);
      console.log(SUBCOMMAND_USAGE);
      process.exitCode = 2;
      return;
    }

    if (!options.datasetId || !options.from) {
      console.error('wf data import requires <datasetId> and --from.');
      console.log(SUBCOMMAND_USAGE);
      process.exitCode = 2;
      return;
    }

    const result = importData({
      projectPath: cwd,
      datasetId: options.datasetId,
      from: options.from,
      overwrite: options.overwrite,
    });

    if (result.ok) {
      console.log(`Imported ${result.imported} item(s) into ${result.datasetId}`);
      return;
    }

    console.error(`wf data import failed: ${result.error}`);
    process.exitCode = 1;
    return;
  }

  if (subcommand === 'list') {
    const datasets = listDatasets(cwd);
    for (const datasetId of datasets) {
      console.log(datasetId);
    }
    return;
  }

  if (subcommand === 'validate') {
    const datasetId = rest[0];
    if (!datasetId) {
      console.error('wf data validate requires <datasetId>.');
      console.log(SUBCOMMAND_USAGE);
      process.exitCode = 2;
      return;
    }

    const result = validateDataset({
      projectPath: cwd,
      datasetId,
    });
    if (result.ok) {
      console.log(`Dataset "${result.datasetId}" is valid.`);
      return;
    }

    console.error('wf data validate found issues:');
    for (const issue of result.errors) {
      console.error(`  - ${issue}`);
    }
    process.exitCode = 1;
    return;
  }

  if (subcommand === 'stats') {
    const datasetId = rest[0];
    if (!datasetId) {
      console.error('wf data stats requires <datasetId>.');
      console.log(SUBCOMMAND_USAGE);
      process.exitCode = 2;
      return;
    }

    const result = dataStats({
      projectPath: cwd,
      datasetId,
    });
    if (result.ok) {
      console.log(`Dataset: ${result.datasetId}`);
      console.log(`Item count: ${result.itemCount}`);
      console.log(`Dataset byte size: ${result.byteSize}`);
      const fieldSummary = result.fieldSummary
        .map((field) => `${field.field}:{count=${field.count},types=${field.types.join('|') || 'null'}}`)
        .join('; ');
      console.log(`Field summary: ${fieldSummary || 'none'}`);
      return;
    }

    console.error(`wf data stats failed: ${result.error}`);
    process.exitCode = 1;
    return;
  }

  if (subcommand === 'keys') {
    const datasetId = rest[0];
    if (!datasetId) {
      console.error('wf data keys requires <datasetId>.');
      console.log(SUBCOMMAND_USAGE);
      process.exitCode = 2;
      return;
    }

    const result = dataKeys({
      projectPath: cwd,
      datasetId,
    });
    if (result.ok) {
      for (const primaryKey of result.keys) {
        console.log(primaryKey);
      }
      return;
    }

    console.error(`wf data keys failed: ${result.error}`);
    process.exitCode = 1;
    return;
  }

  if (subcommand === 'item') {
    const [itemSubcommand, ...itemArgs] = rest;
    if (!itemSubcommand) {
      console.error(ITEM_SUBCOMMAND_USAGE);
      process.exitCode = 2;
      return;
    }

    if (itemSubcommand === 'add') {
      let options;
      try {
        options = parseDataItemAddArgs(itemArgs, cwd);
      } catch (error) {
        console.error(error.message);
        console.log(ITEM_SUBCOMMAND_USAGE);
        process.exitCode = 2;
        return;
      }

      if (!options.datasetId) {
        console.error('wf data item add requires <datasetId>.');
        console.log(ITEM_SUBCOMMAND_USAGE);
        process.exitCode = 2;
        return;
      }

      const result = addDataItem({
        projectPath: cwd,
        datasetId: options.datasetId,
        item: options.item,
        from: options.from,
      });
      if (result.ok) {
        console.log(`Added item ${result.primaryKey} to ${result.datasetId}`);
        return;
      }

      console.error(`wf data item add failed: ${result.error}`);
      process.exitCode = 1;
      return;
    }

    if (itemSubcommand === 'update') {
      const options = parseDataItemUpdateArgs(itemArgs);
      if (!options.datasetId || !options.primaryKeyValue || !options.item) {
        console.error('wf data item update requires <datasetId> <primaryKeyValue> <itemJson>.');
        console.log(ITEM_SUBCOMMAND_USAGE);
        process.exitCode = 2;
        return;
      }

      const result = updateDataItem({
        projectPath: cwd,
        datasetId: options.datasetId,
        primaryKeyValue: options.primaryKeyValue,
        item: options.item,
      });
      if (result.ok) {
        console.log(`Updated item ${result.primaryKey} in ${result.datasetId}`);
        return;
      }

      console.error(`wf data item update failed: ${result.error}`);
      process.exitCode = 1;
      return;
    }

    if (itemSubcommand === 'remove') {
      const options = parseDataItemKeyArgArgs(itemArgs);
      if (!options.datasetId || !options.primaryKeyValue) {
        console.error('wf data item remove requires <datasetId> <primaryKeyValue>.');
        console.log(ITEM_SUBCOMMAND_USAGE);
        process.exitCode = 2;
        return;
      }

      const result = removeDataItem({
        projectPath: cwd,
        datasetId: options.datasetId,
        primaryKeyValue: options.primaryKeyValue,
      });
      if (result.ok) {
        console.log(`Removed item ${result.primaryKey} from ${result.datasetId}`);
        return;
      }

      console.error(`wf data item remove failed: ${result.error}`);
      process.exitCode = 1;
      return;
    }

    if (itemSubcommand === 'get') {
      const options = parseDataItemKeyArgArgs(itemArgs);
      if (!options.datasetId || !options.primaryKeyValue) {
        console.error('wf data item get requires <datasetId> <primaryKeyValue>.');
        console.log(ITEM_SUBCOMMAND_USAGE);
        process.exitCode = 2;
        return;
      }

      const result = getDataItem({
        projectPath: cwd,
        datasetId: options.datasetId,
        primaryKeyValue: options.primaryKeyValue,
      });
      if (result.ok) {
        console.log(yaml.stringify(result.item));
        return;
      }

      console.error(`wf data item get failed: ${result.error}`);
      process.exitCode = 1;
      return;
    }

    if (itemSubcommand === 'list') {
      const options = parseDataItemKeyArgArgs(itemArgs);
      if (!options.datasetId) {
        console.error('wf data item list requires <datasetId>.');
        console.log(ITEM_SUBCOMMAND_USAGE);
        process.exitCode = 2;
        return;
      }

      const result = listDataItems({
        projectPath: cwd,
        datasetId: options.datasetId,
      });
      if (!result.ok) {
        console.error(`wf data item list failed: ${result.error}`);
        process.exitCode = 1;
        return;
      }

      for (const primaryKey of result.items) {
        console.log(primaryKey);
      }
      return;
    }

    console.error(`Unknown item command: ${itemSubcommand}`);
    console.log(ITEM_SUBCOMMAND_USAGE);
    process.exitCode = 1;
    return;
  }

  console.error(`Unknown data command: ${subcommand}`);
  console.log(SUBCOMMAND_USAGE);
  process.exitCode = 1;
}

module.exports = {
  runData,
};
