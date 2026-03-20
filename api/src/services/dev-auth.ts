import { createHash } from "node:crypto";
import { config } from "../config.js";
import { findDocumentsByProjectId, upsertDocument } from "../repositories/document.js";
import { createProjectWithOwner, findProjectsByUserId } from "../repositories/project.js";
import { findOrCreateUser, type AuthUser } from "./user.js";

export async function loginAsDevUser(): Promise<AuthUser> {
  const user = await findOrCreateUser({
    ssoSubject: config.devAuthUserSubject,
    email: config.devAuthUserEmail,
    displayName: config.devAuthUserName,
  });

  const projects = await findProjectsByUserId(user.userId);
  let defaultProject = projects.find(
    (project) => project.name === config.devAuthProjectName,
  );

  if (!defaultProject) {
    defaultProject = await createProjectWithOwner(config.devAuthProjectName, user.userId);
  }

  await seedStarterProject(defaultProject.id, defaultProject.name);

  return user;
}

async function seedStarterProject(projectId: string, projectName: string): Promise<void> {
  const existingDocuments = await findDocumentsByProjectId(projectId);
  const hasDocument = (documentType: string, documentId: string) => existingDocuments.some(
    (document) => document.documentType === documentType && document.documentId === documentId,
  );

  if (!hasDocument("manifest", "manifest")) {
    await saveStarterDocument(projectId, "manifest", "manifest", [
      "documentType: manifest",
      'specVersion: "1.1"',
      "id: manifest",
      "manifest:",
      `  projectId: "${projectId}"`,
      `  name: "${projectName}"`,
      '  schemaVersion: "1.1"',
      "",
    ].join("\n"));
  }

  if (!hasDocument("sitemap", "sitemap")) {
    await saveStarterDocument(projectId, "sitemap", "sitemap", [
      "documentType: sitemap",
      'specVersion: "1.1"',
      "id: sitemap",
      "defaultTemplate: app_template",
      "routes:",
      "  - id: home",
      '    path: "/"',
      "    page: home",
      "    template: app_template",
      "",
    ].join("\n"));
  }

  if (!hasDocument("templates", "templates")) {
    await saveStarterDocument(projectId, "templates", "templates", [
      "documentType: templates",
      'specVersion: "1.1"',
      "id: templates",
      "templates:",
      "  app_template:",
      "    layout:",
      "      type: stack",
      "    regions:",
      "      - id: main_content",
      "        kind: slot",
      "",
    ].join("\n"));
  }

  if (!hasDocument("page", "home")) {
    await saveStarterDocument(projectId, "page", "home", [
      "documentType: page",
      'specVersion: "1.1"',
      "id: home",
      "page:",
      "  id: home",
      "  template: app_template",
      "  viewport:",
      "    device: web",
      "  wireframeStyle:",
      "    border:",
      "      style: solid",
      "  slots:",
      "    - slotId: main_content",
      "      content:",
      "        - id: home_heading",
      "          component: heading",
      "          props:",
      `            label: "${projectName}"`,
      "            level: 1",
      "        - id: home_intro",
      "          component: paragraph",
      "          props:",
      '            label: "Use the editor or dev chat to update this page."',
      "",
    ].join("\n"));
  }
}

async function saveStarterDocument(
  projectId: string,
  documentType: string,
  documentId: string,
  content: string,
): Promise<void> {
  await upsertDocument(
    projectId,
    documentType,
    documentId,
    content,
    createHash("sha256").update(content).digest("hex"),
  );
}
