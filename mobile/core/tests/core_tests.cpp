#include <cstdio>
#include <cstdlib>
#include <string>
#include <vector>

#include <unistd.h>

#include "wf_core.h"

namespace {

int failures = 0;

void check(bool ok, const char* what) {
  if (!ok) {
    ++failures;
    std::printf("FAIL %s\n", what);
  } else {
    std::printf("ok   %s\n", what);
  }
}

std::string take(char* value) {
  std::string out = value ? value : "";
  wf_free(value);
  return out;
}

bool has(const std::string& text, const std::string& part) { return text.find(part) != std::string::npos; }

std::string temp_path(const char* suffix) {
  char path[] = "/tmp/wfcoreXXXXXX";
  const int fd = mkstemp(path);
  close(fd);
  return std::string(path) + suffix;
}

int64_t field(const std::string& json, const std::string& key) {
  const auto at = json.find("\"" + key + "\":");
  return at == std::string::npos ? -1 : std::atoll(json.c_str() + at + key.size() + 3);
}

void test_policy() {
  const uint64_t plenty = 64ULL << 30;
  check(has(take(wf_select_model(4.0, plenty, 0, false, nullptr)), "\"unsupported\""), "under 8 GB is unsupported");
  check(has(take(wf_select_model(7.6, plenty, 0, false, nullptr)), "\"e2b\""), "an 8 GB device gets E2B");
  check(has(take(wf_select_model(12.0, plenty, 0, false, nullptr)), "\"e2b\""), "E4B needs a qualified profile");
  check(has(take(wf_select_model(12.0, plenty, 0, true, nullptr)), "\"e4b\""), "a qualified 12 GB device gets E4B");
  check(has(take(wf_select_model(7.6, plenty, 0, true, nullptr)), "\"e2b\""), "qualification does not override RAM");
  check(has(take(wf_select_model(12.0, plenty, 0, true, "e4b")), "\"e2b\""), "a failed E4B falls back to E2B");
  check(has(take(wf_select_model(12.0, plenty, 0, true, "e2b")), "\"unsupported\""), "a failed E2B ends support");
  check(has(take(wf_select_model(7.6, 1ULL << 30, 0, false, nullptr)), "\"storage\""), "too little disk is reported");
}

void test_catalog() {
  const auto catalog = take(wf_catalog_json("https://models.example/"));
  check(has(catalog, "https://models.example/gemma4/e2b/q4_0/fa401b55"), "the mirror comes first");
  check(has(catalog, "fa401b55b07ee70a54c6dae3903c783a6e65064312529ea57175cb5f8dec6634"), "E2B is pinned");
  check(has(catalog, "3349516256"), "E2B size is pinned");
  check(!has(take(wf_catalog_json("")), "\"/gemma4"), "no mirror means no mirror URL");
}

void test_sha256() {
  const auto path = temp_path(".bin");
  std::FILE* file = std::fopen(path.c_str(), "wb");
  std::fputs("abc", file);
  std::fclose(file);
  check(take(wf_sha256_file(path.c_str(), nullptr, nullptr)) == "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad", "SHA-256 of abc");

  const auto large = temp_path(".bin");
  file = std::fopen(large.c_str(), "wb");
  const std::string chunk(1000, 'a');
  for (int i = 0; i < 1000; ++i) std::fwrite(chunk.data(), 1, chunk.size(), file);
  std::fclose(file);
  check(take(wf_sha256_file(large.c_str(), nullptr, nullptr)) == "cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0", "SHA-256 across blocks");
  check(wf_sha256_file("/no/such/file", nullptr, nullptr) == nullptr, "a missing file gives no digest");
  check(wf_sha256_file(large.c_str(), [](uint64_t, uint64_t, void*) { return false; }, nullptr) == nullptr, "hashing can be cancelled");
  std::remove(path.c_str());
  std::remove(large.c_str());
}

void test_store() {
  char* error = nullptr;
  const auto path = temp_path(".db");
  wf_store* store = wf_store_open(path.c_str(), &error);
  check(store != nullptr, "the store opens");

  check(wf_store_get_setting(store, "marker") == nullptr, "an unset setting is empty");
  wf_store_set_setting(store, "marker", "abc");
  check(take(wf_store_get_setting(store, "marker")) == "abc", "a setting round-trips");
  wf_store_set_setting(store, "marker", nullptr);
  check(wf_store_get_setting(store, "marker") == nullptr, "a setting can be cleared");

  const auto created = take(wf_store_create_project(store, "Acme", "v1", "home", 100));
  const int64_t project = field(created, "id");
  const int64_t first = field(created, "revision");
  check(has(created, "\"canUndo\":false"), "a new project has nothing to undo");
  check(field(created, "chat") > 0, "a new project has a chat");

  const auto second = take(wf_store_commit(store, project, first, "v2", "Added a header", "home", 200));
  const int64_t second_revision = field(second, "revision");
  check(has(second, "\"wf\":\"v2\"") && has(second, "\"canUndo\":true"), "a commit becomes current");
  check(has(take(wf_store_commit(store, project, first, "late", "Late", "home", 300)), "STALE"), "a stale commit is refused");
  check(has(take(wf_store_project(store, project)), "\"wf\":\"v2\""), "a stale commit changes nothing");

  const auto undone = take(wf_store_undo(store, project));
  check(has(undone, "\"wf\":\"v1\"") && has(undone, "\"canRedo\":true"), "undo restores the parent");
  check(has(take(wf_store_undo(store, project)), "\"wf\":\"v1\""), "undo stops at the first revision");
  const auto redone = take(wf_store_redo(store, project));
  check(has(redone, "\"wf\":\"v2\"") && field(redone, "revision") == second_revision, "redo returns");
  check(has(take(wf_store_redo(store, project)), "\"wf\":\"v2\""), "redo stops at the newest revision");

  const auto versions = take(wf_store_versions(store, project));
  check(has(versions, "\"number\":2") && has(versions, "Added a header") && has(versions, "\"number\":1"), "versions are numbered");
  check(has(take(wf_store_checkout(store, project, first)), "\"wf\":\"v1\""), "an older version can be restored");
  check(has(take(wf_store_checkout(store, project, 999999)), "\"wf\":\"v1\""), "an unknown version changes nothing");
  take(wf_store_checkout(store, project, second_revision));

  check(has(take(wf_store_project(store, project)), "\"saved\":false"), "a revision starts unsaved");
  check(has(take(wf_store_save_version(store, project, "Before the redesign")), "\"saved\":true"), "a version can be saved");
  check(has(take(wf_store_versions(store, project)), "\"label\":\"Before the redesign\""), "a saved version keeps its name");

  const int64_t chat = field(created, "chat");
  const int64_t message = wf_store_add_message(store, chat, "user", "Add a \"header\"\nnow", 0, 400);
  check(message > 0, "a message is stored");
  check(has(take(wf_store_messages(store, chat)), "Add a \\\"header\\\"\\nnow"), "messages are escaped");

  const auto fresh = take(wf_store_new_chat(store, project, 500));
  check(field(fresh, "chat") != chat, "a new chat replaces the current one");
  check(has(fresh, "\"wf\":\"v2\""), "a new chat keeps the design");
  check(take(wf_store_messages(store, field(fresh, "chat"))) == "[]", "a new chat is empty");

  check(has(take(wf_store_projects(store)), "\"revisions\":2"), "projects are listed");
  wf_store_rename_project(store, project, "Renamed", 600);
  check(has(take(wf_store_project(store, project)), "\"name\":\"Renamed\""), "a project can be renamed");

  wf_store_close(store);
  store = wf_store_open(path.c_str(), &error);
  check(has(take(wf_store_project(store, project)), "\"wf\":\"v2\""), "everything survives a reopen");

  wf_store_delete_project(store, project);
  check(take(wf_store_projects(store)) == "[]", "a project can be deleted");
  check(take(wf_store_messages(store, field(fresh, "chat"))) == "[]", "deleting a project deletes its chats");
  wf_store_close(store);
}

void test_prompt() {
  char* error = nullptr;
  const auto path = temp_path(".db");
  wf_store* store = wf_store_open(path.c_str(), &error);
  const auto created = take(wf_store_create_project(store, "Acme", "v1", "home", 100));
  const int64_t project = field(created, "id");
  const int64_t chat = field(created, "chat");
  take(wf_store_commit(store, project, field(created, "revision"), "v2", "Added the billing table", "home", 200));

  wf_prompt_input input{};
  input.system = "You edit wireframes.";
  input.elements = "heading: text, level";
  input.pages = "home (current): Home";
  input.outline = "slot main:";
  input.selected = "id: search";
  input.selected_is_shared = true;
  input.request = "Make it bigger";
  input.chat = chat;
  input.project = project;
  input.input_token_limit = 4000;

  auto prompt = take(wf_prompt_build(store, nullptr, &input));
  check(has(prompt, "<|turn>system\\nYou edit wireframes."), "the prompt opens with the system turn");
  check(has(prompt, "## Selected component (shared"), "a shared selection says so");
  check(has(prompt, "## Request\\nMake it bigger"), "the request is included");
  check(has(prompt, "<|turn>model\\nchanges:\\n\""), "the prompt ends inside the edit");

  input.failed_output = "changes: [";
  input.diagnostics = "INVALID_YAML";
  check(has(take(wf_prompt_build(store, nullptr, &input)), "INVALID_YAML"), "a repair includes the diagnostics");
  input.failed_output = nullptr;
  input.diagnostics = nullptr;

  const std::string long_turn(3000, 'x');
  for (int i = 0; i < 10; ++i) wf_store_add_message(store, chat, "user", long_turn.c_str(), 0, 300 + i);
  const int64_t newest = wf_store_add_message(store, chat, "user", "the newest turn", 0, 400);
  const auto compacted = take(wf_prompt_build(store, nullptr, &input));
  check(field(compacted, "droppedTurns") > 0, "old turns are compacted away");
  check(has(compacted, "the newest turn"), "the newest turn is kept");
  check(has(compacted, "## Earlier decisions") && has(compacted, "Added the billing table"), "decisions survive compaction");
  check(field(compacted, "tokens") <= input.input_token_limit, "the prompt fits the budget");

  input.before_message = newest;
  check(!has(take(wf_prompt_build(store, nullptr, &input)), "the newest turn"), "the current message is not history");

  input.input_token_limit = 10;
  check(has(take(wf_prompt_build(store, nullptr, &input)), "TOO_LARGE"), "an oversized request is refused");
  wf_store_close(store);
}

}  // namespace

int main() {
  test_policy();
  test_catalog();
  test_sha256();
  test_store();
  test_prompt();
  std::printf(failures ? "%d FAILED\n" : "all passed\n", failures);
  return failures ? 1 : 0;
}
