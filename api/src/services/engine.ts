// @ts-expect-error — CJS engine, no type declarations
import engine from "@wireframes/engine";

export const validateProject: (
  documentMap: object,
) => { ok: boolean; errors: Array<{ code: string; message: string }>; warnings: unknown[] } =
  engine.validate.validateProject;

export const buildProject: (
  documentMap: object,
  options?: { platform?: string },
) => {
  ok: boolean;
  error?: string;
  pages: Array<{ pageId: string; platform: string; html: string }>;
  css: string;
  js: string;
  routeTable: Record<string, string>;
  indexHtml: string;
  platformIndexes: Record<string, string>;
} = engine.build.buildProject;

export const validateDocument: (
  document: unknown,
  filePath: string,
  supportedSpecVersion?: string,
) => { documentType: string; specVersion: string; id: string } =
  engine.schema.validateDocument;

export const SchemaLoadError: {
  new (message: string, code: string, details?: object): Error & {
    code: string;
    details?: { errors?: Array<{ code?: string; path?: string; message: string }> };
  };
} = engine.schema.SchemaLoadError;
