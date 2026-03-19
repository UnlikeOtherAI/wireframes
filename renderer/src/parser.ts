import yaml from 'js-yaml';

export function parseYaml(content: string, fileName: string): unknown {
  try {
    return yaml.load(content);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid YAML in ${fileName}: ${message}`);
  }
}
