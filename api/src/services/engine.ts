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
