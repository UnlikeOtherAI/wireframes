// The native core of the offline wireframe app, as a plain C ABI so Swift and
// Kotlin both call it directly. Strings are UTF-8. A returned char* is owned by
// the caller and released with wf_free. Structured results are JSON.
#pragma once

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

void wf_free(char* value);

// Models

/** Every model file the app can install, with its pinned digest and sources. */
char* wf_catalog_json(const char* mirror_base_url);

/**
 * Which model this device should use. No one is ever asked to choose.
 * thermal is 0 nominal, 1 fair, 2 serious, 3 critical. failed_model names a model
 * that already failed on this device, or NULL. Returns
 * {"status":"ok|unsupported|storage","model":"e2b|e4b|","requiredBytes":n}.
 */
char* wf_select_model(double physical_ram_gib, uint64_t free_disk_bytes, int thermal, bool e4b_qualified, const char* failed_model);

/** Return false to cancel. */
typedef bool (*wf_progress_fn)(uint64_t done, uint64_t total, void* context);

/** The file's SHA-256 as hex, or NULL if it could not be read or was cancelled. */
char* wf_sha256_file(const char* path, wf_progress_fn progress, void* context);

// Projects, history and chat

typedef struct wf_store wf_store;

wf_store* wf_store_open(const char* path, char** error);
void wf_store_close(wf_store* store);

char* wf_store_get_setting(wf_store* store, const char* key);
bool wf_store_set_setting(wf_store* store, const char* key, const char* value);

char* wf_store_projects(wf_store* store);
char* wf_store_create_project(wf_store* store, const char* name, const char* wf, const char* page, int64_t now);
char* wf_store_project(wf_store* store, int64_t project);
bool wf_store_rename_project(wf_store* store, int64_t project, const char* name, int64_t now);
bool wf_store_delete_project(wf_store* store, int64_t project);

/**
 * Add a revision on top of base_revision and make it current. Returns the same
 * JSON as wf_store_project, or {"error":"STALE"} if the project has moved on, so
 * a late result can never overwrite a newer design. The write is one transaction.
 */
char* wf_store_commit(wf_store* store, int64_t project, int64_t base_revision, const char* wf, const char* summary, const char* page, int64_t now);
char* wf_store_undo(wf_store* store, int64_t project);
char* wf_store_redo(wf_store* store, int64_t project);
/** The current revision and its ancestors, newest first: [{"id":n,"summary":"...","number":n,"label":"..."}]. */
char* wf_store_versions(wf_store* store, int64_t project);
/** Name the current revision, marking it as a version the user chose to keep. */
char* wf_store_save_version(wf_store* store, int64_t project, const char* label);
/** Make an existing revision current. Returns the same JSON as wf_store_project. */
char* wf_store_checkout(wf_store* store, int64_t project, int64_t revision);

char* wf_store_new_chat(wf_store* store, int64_t project, int64_t now);
char* wf_store_messages(wf_store* store, int64_t chat);
/** role is "user" or "assistant". revision is 0 when the message changed nothing. */
int64_t wf_store_add_message(wf_store* store, int64_t chat, const char* role, const char* text, int64_t revision, int64_t now);

// The model

typedef struct wf_engine wf_engine;

typedef struct {
  int context_tokens;
  int gpu_layers;
  int threads;
} wf_engine_params;

wf_engine* wf_engine_create(void);
void wf_engine_destroy(wf_engine* engine);

/** Returns {"ok":true,"gpuLayers":n,"loadMs":n} or {"ok":false,"error":"..."}. */
char* wf_engine_load(wf_engine* engine, const char* model_path, wf_engine_params params);
void wf_engine_unload(wf_engine* engine);
bool wf_engine_is_loaded(wf_engine* engine);
int wf_engine_count_tokens(wf_engine* engine, const char* text);

/** Safe from any thread. Generation stops at its next step. */
void wf_engine_cancel(wf_engine* engine);

/** Receives each piece of output as it is produced. */
typedef void (*wf_token_fn)(const char* piece, void* context);

/**
 * Blocks until done. Returns
 * {"ok":true,"text":"...","finish":"stop|length|cancelled","promptTokens":n,"tokens":n,"firstTokenMs":n,"totalMs":n}
 * or {"ok":false,"error":"..."}.
 */
char* wf_engine_generate(wf_engine* engine, const char* prompt, int max_tokens, float temperature, wf_token_fn on_token, void* context);

// Prompts and compaction

/** How the model is told to behave. Owned by the core so every platform matches. */
const char* wf_system_prompt(void);

typedef struct {
  const char* system;
  const char* elements;
  const char* pages;
  const char* outline;
  const char* selected;
  bool selected_is_shared;
  const char* request;
  /** Set on a repair attempt: what the model wrote, and what was wrong with it. */
  const char* failed_output;
  const char* diagnostics;
  /** Messages at or after this id are not part of the history. */
  int64_t before_message;
  int64_t chat;
  int64_t project;
  int input_token_limit;
} wf_prompt_input;

/** Returns {"prompt":"...","tokens":n,"droppedTurns":n}, or {"error":"TOO_LARGE"}. */
char* wf_prompt_build(wf_store* store, wf_engine* engine, const wf_prompt_input* input);

#ifdef __cplusplus
}
#endif
