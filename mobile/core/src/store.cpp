#include <sqlite3.h>

#include <cstdint>
#include <string>
#include <vector>

#include "json_out.h"
#include "store_internal.h"
#include "wf_core.h"

using wf::JsonObject;
using wf::Statement;

namespace {

const char* kSchema = R"sql(
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 0,
  chat INTEGER NOT NULL DEFAULT 0,
  created INTEGER NOT NULL,
  updated INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS revisions (
  id INTEGER PRIMARY KEY,
  project INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  parent INTEGER NOT NULL DEFAULT 0,
  wf TEXT NOT NULL,
  summary TEXT NOT NULL,
  page TEXT NOT NULL,
  created INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS revisions_parent ON revisions(project, parent);
CREATE TABLE IF NOT EXISTS chats (
  id INTEGER PRIMARY KEY,
  project INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY,
  chat INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  text TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 0,
  created INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS messages_chat ON messages(chat, id);
)sql";

// Added after the first schema. Fails harmlessly when the column already exists.
const char* kAddLabel = "ALTER TABLE revisions ADD COLUMN label TEXT NOT NULL DEFAULT ''";

bool exec(sqlite3* db, const char* sql) { return sqlite3_exec(db, sql, nullptr, nullptr, nullptr) == SQLITE_OK; }

int64_t new_chat(sqlite3* db, int64_t project, int64_t now) {
  Statement insert(db, "INSERT INTO chats (project, created) VALUES (?, ?)");
  insert.bind(1, project).bind(2, now);
  if (!insert.done()) return 0;
  const int64_t chat = sqlite3_last_insert_rowid(db);
  Statement update(db, "UPDATE projects SET chat = ? WHERE id = ?");
  update.bind(1, chat).bind(2, project);
  return update.done() ? chat : 0;
}

std::string error_json(const char* code) { return JsonObject().add("error", code).str(); }

std::string project_json(sqlite3* db, int64_t project) {
  Statement query(db,
                  "SELECT p.name, p.revision, p.chat, p.updated, r.wf, r.page, r.parent, r.label, "
                  "EXISTS (SELECT 1 FROM revisions c WHERE c.project = p.id AND c.parent = p.revision) "
                  "FROM projects p JOIN revisions r ON r.id = p.revision WHERE p.id = ?");
  query.bind(1, project);
  if (!query.row()) return error_json("NOT_FOUND");
  return JsonObject()
      .add("id", project)
      .add("name", query.text(0))
      .add("revision", query.int64(1))
      .add("chat", query.int64(2))
      .add("updated", query.int64(3))
      .add("wf", query.text(4))
      .add("page", query.text(5))
      .add("canUndo", query.int64(6) != 0)
      .add("saved", !query.text(7).empty())
      .add("canRedo", query.int64(8) != 0)
      .str();
}

}  // namespace

extern "C" wf_store* wf_store_open(const char* path, char** error) {
  sqlite3* db = nullptr;
  if (sqlite3_open(path, &db) != SQLITE_OK || !exec(db, kSchema)) {
    if (error) *error = wf::dup_string(db ? sqlite3_errmsg(db) : "Could not open the database.");
    sqlite3_close(db);
    return nullptr;
  }
  exec(db, kAddLabel);
  return new wf_store{db};
}

extern "C" void wf_store_close(wf_store* store) {
  if (!store) return;
  sqlite3_close(store->db);
  delete store;
}

extern "C" char* wf_store_get_setting(wf_store* store, const char* key) {
  Statement query(store->db, "SELECT value FROM settings WHERE key = ?");
  query.bind(1, key);
  return query.row() ? wf::dup_string(query.text(0)) : nullptr;
}

extern "C" bool wf_store_set_setting(wf_store* store, const char* key, const char* value) {
  if (!value) {
    Statement remove(store->db, "DELETE FROM settings WHERE key = ?");
    remove.bind(1, key);
    return remove.done();
  }
  Statement write(store->db, "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value");
  write.bind(1, key).bind(2, value);
  return write.done();
}

extern "C" char* wf_store_projects(wf_store* store) {
  Statement query(store->db,
                  "SELECT p.id, p.name, p.updated, "
                  "(SELECT COUNT(*) FROM revisions r WHERE r.project = p.id) "
                  "FROM projects p ORDER BY p.updated DESC, p.id DESC");
  std::string out = "[";
  bool first = true;
  while (query.row()) {
    if (!first) out += ",";
    first = false;
    out += JsonObject().add("id", query.int64(0)).add("name", query.text(1)).add("updated", query.int64(2)).add("revisions", query.int64(3)).str();
  }
  return wf::dup_string(out + "]");
}

extern "C" char* wf_store_create_project(wf_store* store, const char* name, const char* wf, const char* page, int64_t now) {
  sqlite3* db = store->db;
  if (!exec(db, "BEGIN IMMEDIATE")) return wf::dup_string(error_json("BUSY"));
  Statement project(db, "INSERT INTO projects (name, created, updated) VALUES (?, ?, ?)");
  project.bind(1, name).bind(2, now).bind(3, now);
  bool ok = project.done();
  const int64_t id = sqlite3_last_insert_rowid(db);
  Statement revision(db, "INSERT INTO revisions (project, wf, summary, page, created) VALUES (?, ?, '', ?, ?)");
  revision.bind(1, id).bind(2, wf).bind(3, page).bind(4, now);
  ok = ok && revision.done();
  const int64_t first = sqlite3_last_insert_rowid(db);
  Statement update(db, "UPDATE projects SET revision = ? WHERE id = ?");
  update.bind(1, first).bind(2, id);
  ok = ok && update.done() && new_chat(db, id, now) != 0;
  exec(db, ok ? "COMMIT" : "ROLLBACK");
  return wf::dup_string(ok ? project_json(db, id) : error_json("WRITE_FAILED"));
}

extern "C" char* wf_store_project(wf_store* store, int64_t project) { return wf::dup_string(project_json(store->db, project)); }

extern "C" bool wf_store_rename_project(wf_store* store, int64_t project, const char* name, int64_t now) {
  Statement update(store->db, "UPDATE projects SET name = ?, updated = ? WHERE id = ?");
  update.bind(1, name).bind(2, now).bind(3, project);
  return update.done();
}

extern "C" bool wf_store_delete_project(wf_store* store, int64_t project) {
  Statement remove(store->db, "DELETE FROM projects WHERE id = ?");
  remove.bind(1, project);
  return remove.done();
}

extern "C" char* wf_store_commit(wf_store* store, int64_t project, int64_t base_revision, const char* wf, const char* summary, const char* page, int64_t now) {
  sqlite3* db = store->db;
  if (!exec(db, "BEGIN IMMEDIATE")) return wf::dup_string(error_json("BUSY"));
  Statement current(db, "SELECT revision FROM projects WHERE id = ?");
  current.bind(1, project);
  if (!current.row() || current.int64(0) != base_revision) {
    current.reset();
    exec(db, "ROLLBACK");
    return wf::dup_string(error_json("STALE"));
  }
  current.reset();
  Statement revision(db, "INSERT INTO revisions (project, parent, wf, summary, page, created) VALUES (?, ?, ?, ?, ?, ?)");
  revision.bind(1, project).bind(2, base_revision).bind(3, wf).bind(4, summary).bind(5, page).bind(6, now);
  bool ok = revision.done();
  const int64_t id = sqlite3_last_insert_rowid(db);
  Statement update(db, "UPDATE projects SET revision = ?, updated = ? WHERE id = ?");
  update.bind(1, id).bind(2, now).bind(3, project);
  ok = ok && update.done();
  exec(db, ok ? "COMMIT" : "ROLLBACK");
  return wf::dup_string(ok ? project_json(db, project) : error_json("WRITE_FAILED"));
}

extern "C" char* wf_store_undo(wf_store* store, int64_t project) {
  Statement update(store->db,
                   "UPDATE projects SET revision = (SELECT parent FROM revisions WHERE id = projects.revision) "
                   "WHERE id = ? AND (SELECT parent FROM revisions WHERE id = projects.revision) != 0");
  update.bind(1, project);
  update.done();
  return wf::dup_string(project_json(store->db, project));
}

extern "C" char* wf_store_redo(wf_store* store, int64_t project) {
  // The newest child: after an undo and a fresh edit, redo follows the new work.
  Statement update(store->db,
                   "UPDATE projects SET revision = COALESCE("
                   "(SELECT MAX(id) FROM revisions c WHERE c.project = projects.id AND c.parent = projects.revision), revision) "
                   "WHERE id = ?");
  update.bind(1, project);
  update.done();
  return wf::dup_string(project_json(store->db, project));
}

extern "C" char* wf_store_versions(wf_store* store, int64_t project) {
  Statement query(store->db,
                  "WITH RECURSIVE chain(id, parent, summary, label) AS ("
                  " SELECT r.id, r.parent, r.summary, r.label FROM revisions r JOIN projects p ON p.revision = r.id WHERE p.id = ?"
                  " UNION ALL SELECT r.id, r.parent, r.summary, r.label FROM revisions r JOIN chain c ON r.id = c.parent"
                  ") SELECT id, summary, (SELECT COUNT(*) FROM chain), label FROM chain ORDER BY id DESC");
  query.bind(1, project);
  std::string out = "[";
  int64_t offset = 0;
  while (query.row()) {
    if (offset > 0) out += ",";
    out += JsonObject().add("id", query.int64(0)).add("summary", query.text(1)).add("number", query.int64(2) - offset).add("label", query.text(3)).str();
    ++offset;
  }
  return wf::dup_string(out + "]");
}

extern "C" char* wf_store_save_version(wf_store* store, int64_t project, const char* label) {
  Statement update(store->db, "UPDATE revisions SET label = ? WHERE id = (SELECT revision FROM projects WHERE id = ?)");
  update.bind(1, label).bind(2, project);
  update.done();
  return wf::dup_string(project_json(store->db, project));
}

extern "C" char* wf_store_checkout(wf_store* store, int64_t project, int64_t revision) {
  Statement update(store->db,
                   "UPDATE projects SET revision = ? WHERE id = ? "
                   "AND EXISTS (SELECT 1 FROM revisions r WHERE r.id = ? AND r.project = ?)");
  update.bind(1, revision).bind(2, project).bind(3, revision).bind(4, project);
  update.done();
  return wf::dup_string(project_json(store->db, project));
}

extern "C" char* wf_store_new_chat(wf_store* store, int64_t project, int64_t now) {
  new_chat(store->db, project, now);
  return wf::dup_string(project_json(store->db, project));
}

extern "C" char* wf_store_messages(wf_store* store, int64_t chat) {
  Statement query(store->db, "SELECT id, role, text, revision, created FROM messages WHERE chat = ? ORDER BY id");
  query.bind(1, chat);
  std::string out = "[";
  bool first = true;
  while (query.row()) {
    if (!first) out += ",";
    first = false;
    out += JsonObject().add("id", query.int64(0)).add("role", query.text(1)).add("text", query.text(2)).add("revision", query.int64(3)).add("created", query.int64(4)).str();
  }
  return wf::dup_string(out + "]");
}

extern "C" int64_t wf_store_add_message(wf_store* store, int64_t chat, const char* role, const char* text, int64_t revision, int64_t now) {
  Statement insert(store->db, "INSERT INTO messages (chat, role, text, revision, created) VALUES (?, ?, ?, ?, ?)");
  insert.bind(1, chat).bind(2, role).bind(3, text).bind(4, revision).bind(5, now);
  return insert.done() ? sqlite3_last_insert_rowid(store->db) : 0;
}
