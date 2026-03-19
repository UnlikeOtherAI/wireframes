'use strict';

const cachedSchema = require('./schema.json');

function loadSchema() {
  return cachedSchema;
}

function decodeJsonPointerToken(token) {
  return token.replace(/~1/g, '/').replace(/~0/g, '~');
}

function resolvePointer(rootSchema, pointer) {
  if (pointer === '#' || pointer === '#/') {
    return rootSchema;
  }
  if (typeof pointer !== 'string' || !pointer.startsWith('#/')) {
    return null;
  }

  const segments = pointer
    .slice(2)
    .split('/')
    .map((segment) => decodeJsonPointerToken(segment));
  let current = rootSchema;

  for (const segment of segments) {
    if (current == null || typeof current !== 'object' || !Object.prototype.hasOwnProperty.call(current, segment)) {
      return null;
    }
    current = current[segment];
  }

  return current;
}

function deepEqual(left, right) {
  if (left === right) {
    return true;
  }

  if (left == null || right == null || typeof left !== 'object' || typeof right !== 'object') {
    return false;
  }

  if (Array.isArray(left) !== Array.isArray(right)) {
    return false;
  }

  if (Array.isArray(left)) {
    if (left.length !== right.length) {
      return false;
    }
    for (let i = 0; i < left.length; i += 1) {
      if (!deepEqual(left[i], right[i])) {
        return false;
      }
    }
    return true;
  }

  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  for (const key of leftKeys) {
    if (!Object.prototype.hasOwnProperty.call(right, key)) {
      return false;
    }
    if (!deepEqual(left[key], right[key])) {
      return false;
    }
  }

  return true;
}

function getType(value) {
  if (value === null) {
    return 'null';
  }
  if (Array.isArray(value)) {
    return 'array';
  }
  return typeof value;
}

function typeMatches(value, expectedType) {
  if (expectedType === 'integer') {
    return Number.isInteger(value);
  }

  if (expectedType === 'number') {
    return typeof value === 'number' && Number.isFinite(value);
  }

  if (expectedType === 'null') {
    return value === null;
  }

  if (expectedType === 'array') {
    return Array.isArray(value);
  }

  if (expectedType === 'object') {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  return typeof value === expectedType;
}

function appendPath(basePath, segment) {
  if (typeof segment === 'number') {
    return `${basePath}[${segment}]`;
  }

  if (/^[a-zA-Z0-9_]+$/.test(String(segment))) {
    return `${basePath}.${segment}`;
  }

  return `${basePath}[${JSON.stringify(segment)}]`;
}

function appendSchemaPath(basePath, segment) {
  if (segment == null) {
    return basePath;
  }
  return `${basePath}/${segment}`;
}

function addError(errors, code, path, schemaPath, message) {
  errors.push({
    code,
    path,
    schemaPath,
    message,
  });
}

function resolveSchemaRef(schema, context) {
  if (schema == null || typeof schema !== 'object') {
    return {
      schema,
      schemaPath: context.schemaPath,
    };
  }

  if (schema.$ref == null) {
    return {
      schema,
      schemaPath: context.schemaPath,
    };
  }

  const resolved = resolvePointer(context.rootSchema, schema.$ref);
  if (resolved == null) {
    return {
      schema,
      schemaPath: context.schemaPath,
    };
  }

  return {
    schema: resolved,
    schemaPath: schema.$ref,
  };
}

function validateAgainstSingleSchema(value, schema, context) {
  const { schema: resolvedSchema, schemaPath } = resolveSchemaRef(schema, context);
  const errors = [];

  if (resolvedSchema == null || typeof resolvedSchema !== 'object') {
    return errors;
  }

  if (Array.isArray(resolvedSchema.allOf)) {
    for (let i = 0; i < resolvedSchema.allOf.length; i += 1) {
      const subSchema = resolvedSchema.allOf[i];
      const subPath = appendSchemaPath(schemaPath, `allOf/${i}`);
      errors.push(...validateAgainstSchema(value, subSchema, {
        ...context,
        schemaPath: subPath,
      }));
    }
  }

  if (resolvedSchema.if != null) {
    const thenSchema = resolvedSchema.then;
    const elseSchema = resolvedSchema.else;

    const ifContext = { ...context, schemaPath: appendSchemaPath(schemaPath, 'if') };
    const ifMatches = validateAgainstSchema(value, resolvedSchema.if, ifContext).length === 0;

    if (ifMatches && thenSchema != null) {
      errors.push(...validateAgainstSchema(value, thenSchema, {
        ...context,
        schemaPath: appendSchemaPath(schemaPath, 'then'),
      }));
    }
    if (!ifMatches && elseSchema != null) {
      errors.push(...validateAgainstSchema(value, elseSchema, {
        ...context,
        schemaPath: appendSchemaPath(schemaPath, 'else'),
      }));
    }
  }

  if (resolvedSchema.oneOf != null) {
    if (!Array.isArray(resolvedSchema.oneOf)) {
      addError(errors, 'SCHEMA_ONE_OF', context.path, schemaPath, `'oneOf' must be an array.`);
      return errors;
    }

    const oneOfResults = [];
    for (let i = 0; i < resolvedSchema.oneOf.length; i += 1) {
      const candidate = resolvedSchema.oneOf[i];
      const candidateContext = {
        ...context,
        schemaPath: appendSchemaPath(schemaPath, `oneOf/${i}`),
      };
      const candidateErrors = validateAgainstSchema(value, candidate, candidateContext);
      oneOfResults.push({
        candidate,
        index: i,
        candidateErrors,
      });
    }

    const matches = oneOfResults.reduce((count, result) => count + (result.candidateErrors.length === 0 ? 1 : 0), 0);

    if (matches !== 1) {
      const valueIsDocument = context.path === '$' && value != null && typeof value === 'object' && !Array.isArray(value);
      const documentType = valueIsDocument ? value.documentType : undefined;

      if (typeof documentType === 'string') {
        for (const result of oneOfResults) {
          const { schema: candidateSchema } = resolveSchemaRef(result.candidate, {
            rootSchema: context.rootSchema,
            path: context.path,
            schemaPath: result.candidate?.$ref == null ? appendSchemaPath(schemaPath, `oneOf/${result.index}`) : result.candidate.$ref,
          });
          if (candidateSchema?.properties?.documentType?.const === documentType) {
            errors.push(...result.candidateErrors);
            return errors;
          }
        }
      }

      addError(
        errors,
        'SCHEMA_ONE_OF',
        context.path,
        schemaPath,
        `Value at ${context.path} must match exactly one schema in oneOf, but matched ${matches}.`,
      );
    }
    if (matches !== 1) {
      return errors;
    }
  }

  if (resolvedSchema.anyOf != null) {
    if (!Array.isArray(resolvedSchema.anyOf)) {
      addError(errors, 'SCHEMA_ANY_OF', context.path, schemaPath, `'anyOf' must be an array.`);
      return errors;
    }
    const matches = resolvedSchema.anyOf.some((candidate) => {
      const candidateErrors = validateAgainstSchema(value, candidate, {
        ...context,
        schemaPath: appendSchemaPath(schemaPath, 'anyOf/*'),
      });
      return candidateErrors.length === 0;
    });
    if (!matches) {
      addError(errors, 'SCHEMA_ANY_OF', context.path, schemaPath, `Value at ${context.path} must match at least one schema in anyOf.`);
    }
  }

  if (resolvedSchema.const !== undefined && !deepEqual(value, resolvedSchema.const)) {
    addError(
      errors,
      'SCHEMA_CONST',
      context.path,
      schemaPath,
      `Value at ${context.path} must exactly equal constant ${JSON.stringify(resolvedSchema.const)}.`,
    );
  }

  if (resolvedSchema.enum != null) {
    if (!Array.isArray(resolvedSchema.enum)) {
      addError(errors, 'SCHEMA_ENUM', context.path, schemaPath, `'enum' must be an array.`);
    } else if (!resolvedSchema.enum.some((entry) => deepEqual(value, entry))) {
      addError(
        errors,
        'SCHEMA_ENUM',
        context.path,
        schemaPath,
        `Value at ${context.path} is not one of the allowed enum values.`,
      );
    }
  }

  if (resolvedSchema.type != null) {
    const expectedTypes = Array.isArray(resolvedSchema.type) ? resolvedSchema.type : [resolvedSchema.type];
    const actualType = getType(value);
    const matchesExpected = expectedTypes.some((expectedType) => typeMatches(value, expectedType));

    if (!matchesExpected) {
      addError(
        errors,
        'SCHEMA_TYPE',
        context.path,
        schemaPath,
        `Expected ${expectedTypes.join(' | ')}, got ${actualType} at ${context.path}.`,
      );
      return errors;
    }
  }

  if (resolvedSchema.required != null && resolvedSchema.type === 'object' && (value == null || typeof value !== 'object' || Array.isArray(value))) {
    addError(
      errors,
      'SCHEMA_REQUIRED',
      context.path,
      schemaPath,
      `Expected object at ${context.path} to validate required properties, but value is not an object.`,
    );
    return errors;
  }

  if (Array.isArray(resolvedSchema.required) && value != null && typeof value === 'object' && !Array.isArray(value)) {
    const valueObject = value;
    for (const requiredProperty of resolvedSchema.required) {
      if (!Object.prototype.hasOwnProperty.call(valueObject, requiredProperty)) {
        addError(
          errors,
          'SCHEMA_REQUIRED',
          appendPath(context.path, requiredProperty),
          schemaPath,
          `Missing required property "${requiredProperty}" at ${appendPath(context.path, requiredProperty)}.`,
        );
      }
    }
  }

  if (resolvedSchema.properties != null && value != null && typeof value === 'object' && !Array.isArray(value)) {
    const valueObject = value;
    const properties = resolvedSchema.properties;

    for (const [propertyName, propertySchema] of Object.entries(properties)) {
      if (Object.prototype.hasOwnProperty.call(valueObject, propertyName)) {
        const valuePath = appendPath(context.path, propertyName);
        errors.push(...validateAgainstSchema(
          valueObject[propertyName],
          propertySchema,
          {
            rootSchema: context.rootSchema,
            path: valuePath,
            schemaPath: appendSchemaPath(schemaPath, `properties/${propertyName}`),
          },
        ));
      }
    }

    if (resolvedSchema.additionalProperties === false) {
      for (const propertyName of Object.keys(valueObject)) {
        if (!Object.prototype.hasOwnProperty.call(properties, propertyName)) {
          addError(
            errors,
            'SCHEMA_ADDITIONAL_PROPERTIES',
            appendPath(context.path, propertyName),
            schemaPath,
            `Property "${propertyName}" is not allowed at ${context.path}.`,
          );
        }
      }
    } else if (resolvedSchema.additionalProperties != null && typeof resolvedSchema.additionalProperties === 'object') {
      const extraPropertySchema = resolvedSchema.additionalProperties;
      for (const [propertyName, propertyValue] of Object.entries(valueObject)) {
        if (Object.prototype.hasOwnProperty.call(properties, propertyName)) {
          continue;
        }
        errors.push(...validateAgainstSchema(
          propertyValue,
          extraPropertySchema,
          {
            rootSchema: context.rootSchema,
            path: appendPath(context.path, propertyName),
            schemaPath: appendSchemaPath(schemaPath, 'additionalProperties'),
          },
        ));
      }
    }
  }

  if (resolvedSchema.items != null && value != null && Array.isArray(value)) {
    const itemsSchema = resolvedSchema.items;
    for (let index = 0; index < value.length; index += 1) {
      errors.push(...validateAgainstSchema(
        value[index],
        itemsSchema,
        {
          rootSchema: context.rootSchema,
          path: appendPath(context.path, index),
          schemaPath: appendSchemaPath(schemaPath, 'items'),
        },
      ));
    }
  }

  if (Array.isArray(value) && Array.isArray(resolvedSchema.minItems) === false && resolvedSchema.minItems != null) {
    if (value.length < resolvedSchema.minItems) {
      addError(
        errors,
        'SCHEMA_MIN_ITEMS',
        context.path,
        schemaPath,
        `Expected at least ${resolvedSchema.minItems} items at ${context.path}, got ${value.length}.`,
      );
    }
  }

  if (Array.isArray(value) && Array.isArray(resolvedSchema.maxItems) === false && resolvedSchema.maxItems != null) {
    if (value.length > resolvedSchema.maxItems) {
      addError(
        errors,
        'SCHEMA_MAX_ITEMS',
        context.path,
        schemaPath,
        `Expected at most ${resolvedSchema.maxItems} items at ${context.path}, got ${value.length}.`,
      );
    }
  }

  if (typeof value === 'string' && resolvedSchema.pattern != null) {
    const matcher = new RegExp(resolvedSchema.pattern);
    if (!matcher.test(value)) {
      addError(
        errors,
        'SCHEMA_PATTERN',
        context.path,
        schemaPath,
        `String at ${context.path} does not match pattern ${resolvedSchema.pattern}.`,
      );
    }
  }

  if (typeof value === 'number' && resolvedSchema.minimum != null && value < resolvedSchema.minimum) {
    addError(
      errors,
      'SCHEMA_MINIMUM',
      context.path,
      schemaPath,
      `Value at ${context.path} is below minimum ${resolvedSchema.minimum}.`,
    );
  }

  return errors;
}

function validateAgainstSchema(value, schema, context) {
  return validateAgainstSingleSchema(value, schema, context);
}

function validateDocumentAgainstSchema(document, filePath) {
  const schema = loadSchema();

  const errors = validateAgainstSchema(document, schema, {
    rootSchema: schema,
    path: '$',
    schemaPath: '#',
  });

  return errors.map((error) => ({
    ...error,
    filePath,
  }));
}

module.exports = {
  validateDocumentAgainstSchema,
};
