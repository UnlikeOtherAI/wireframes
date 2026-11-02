#include <algorithm>
#include <cstdint>
#include <string>
#include <vector>

#include "json_out.h"
#include "store_internal.h"
#include "wf_core.h"

namespace {

// How much of the input budget older context may take. The current request, the
// selection and the page outline are never trimmed: they are what the edit is about.
constexpr double kHistoryShare = 0.25;
constexpr int kLedgerEntries = 12;

// The prompt ends here so the model's first token is already inside the edit.
const char* kPrefill = "changes:\n";

const char* kSystem = R"prompt(You edit a wireframe by writing a YAML list of changes. Answer with YAML only: no explanation and no code fence. Your answer always starts with "changes:".

Operations:
- op: append        Add new nodes at the end of a container or of the page. node is a container id, or the slot name for the whole page. value is a node or a list of nodes.
- op: insertAfter   Add new nodes straight after node. value is a node or a list of nodes.
- op: set           Change one value of node. path is like props.text.
- op: remove        Delete node.
- op: addPage       Add a page: id (lower_case), title, and content, a list of nodes.
- op: removePage    Delete the page named by id.

Rules:
1. node must be an id copied exactly from the Current page outline, or the slot name. Never invent an id for node. If the outline is empty, use append with node: main.
2. Do only what was asked. Do not remove or change anything else.
3. A request for a new page always uses addPage, and that page's content goes only inside addPage. A link to a page is route: <page id> in a button's props.
4. New nodes have a new lower_case id, a component from the Elements list and that element's props. Containers have children.
5. A wireframe is greyscale, so never set colours or images. Write real, specific text, not lorem ipsum. Put each prop on its own line and wrap text in double quotes.
6. When a component is selected, the request is about that component.

Example. Outline is empty. Request: Add a sign in form.
changes:
  - op: append
    node: main
    value:
      - id: sign_in_title
        component: heading
        props:
          text: "Sign in"
          level: 1
      - id: sign_in_form
        component: form
        children:
          - id: email
            component: input
            props:
              label: "Email"
              inputType: email
          - id: submit
            component: button
            props:
              label: "Sign in"
              variant: primary

Example. Outline has - sign_in_title (heading). Request: Add a help page and link to it under the title.
changes:
  - op: addPage
    id: help
    title: Help
    content:
      - id: help_title
        component: heading
        props:
          text: "Help"
          level: 1
  - op: insertAfter
    node: sign_in_title
    value:
      id: help_link
      component: button
      props:
        label: "Get help"
        variant: link
        route: help

Example. Outline has - sign_in_title (heading). Request: Call it Welcome back.
changes:
  - op: set
    node: sign_in_title
    path: props.text
    value: "Welcome back"

Example. Outline has - old_notice (alert). Request: Remove the notice.
changes:
  - op: remove
    node: old_notice)prompt";

struct Turn {
  std::string role;
  std::string text;
};

int count_tokens(wf_engine* engine, const std::string& text) {
  if (engine && wf_engine_is_loaded(engine)) return wf_engine_count_tokens(engine, text.c_str());
  return static_cast<int>(text.size() / 4) + 1;  // Without a model, a conservative estimate.
}

std::string section(const char* title, const char* body) {
  if (!body || !*body) return "";
  return std::string("\n\n## ") + title + "\n" + body;
}

/**
 * What compaction keeps once old turns leave the prompt: what was decided. Accepted
 * changes survive with no summarising call, so compaction costs nothing and the
 * project's YAML stays the memory of record.
 */
std::string ledger(sqlite3* db, int64_t project) {
  wf::Statement query(db,
                      "SELECT summary FROM revisions WHERE project = ? AND summary != '' "
                      "ORDER BY id DESC LIMIT ?");
  query.bind(1, project).bind(2, static_cast<int64_t>(kLedgerEntries));
  std::vector<std::string> lines;
  while (query.row()) lines.push_back("- " + query.text(0));
  std::reverse(lines.begin(), lines.end());
  std::string out;
  for (const auto& line : lines) out += line + "\n";
  return out;
}

std::vector<Turn> history(sqlite3* db, int64_t chat, int64_t before) {
  wf::Statement query(db, "SELECT role, text FROM messages WHERE chat = ? AND (? = 0 OR id < ?) ORDER BY id");
  query.bind(1, chat).bind(2, before).bind(3, before);
  std::vector<Turn> turns;
  while (query.row()) turns.push_back({query.text(0), query.text(1)});
  return turns;
}

std::string turn(const std::string& role, const std::string& text) {
  // Gemma 4's own turn markers. The tokenizer parses them as special tokens.
  return "<|turn>" + role + "\n" + text + "<turn|>\n";
}

}  // namespace

extern "C" const char* wf_system_prompt(void) { return kSystem; }

extern "C" char* wf_prompt_build(wf_store* store, wf_engine* engine, const wf_prompt_input* input) {
  std::string system = input->system ? input->system : "";
  system += section("Elements", input->elements);

  std::string request;
  request += section("Pages", input->pages);
  request += section("Current page outline", input->outline);
  if (input->selected && *input->selected) {
    request += section(input->selected_is_shared ? "Selected component (shared: changing it changes every place it is used)" : "Selected component", input->selected);
  }
  request += section("Request", input->request);
  if (input->failed_output && *input->failed_output) {
    request += section("Your previous answer", input->failed_output);
    request += section("It was rejected for these reasons. Answer again with the corrected edit", input->diagnostics);
  }

  const std::string open = "<|turn>model\n";
  const std::string fixed = turn("system", system) + turn("user", request) + open + kPrefill;
  const int fixed_tokens = count_tokens(engine, fixed);
  if (fixed_tokens > input->input_token_limit) {
    return wf::dup_string(wf::JsonObject().add("error", "TOO_LARGE").str());
  }

  const int history_budget = std::min(input->input_token_limit - fixed_tokens,
                                      static_cast<int>(input->input_token_limit * kHistoryShare));
  const auto turns = history(store->db, input->chat, input->before_message);

  // Newest turns first, until the budget runs out.
  std::vector<std::string> kept;
  int used = 0;
  size_t dropped = turns.size();
  for (size_t i = turns.size(); i > 0; --i) {
    const auto& entry = turns[i - 1];
    const std::string rendered = turn(entry.role == "assistant" ? "model" : "user", entry.text);
    const int cost = count_tokens(engine, rendered);
    if (used + cost > history_budget) break;
    used += cost;
    kept.push_back(rendered);
    --dropped;
  }

  std::string decided;
  if (dropped > 0) {
    const std::string entries = ledger(store->db, input->project);
    const std::string candidate = section("Earlier decisions", entries.c_str());
    if (!candidate.empty() && used + count_tokens(engine, candidate) <= history_budget) decided = candidate;
  }

  std::string prompt = turn("system", system + decided);
  for (auto it = kept.rbegin(); it != kept.rend(); ++it) prompt += *it;
  prompt += turn("user", request) + open + kPrefill;

  return wf::dup_string(wf::JsonObject()
                            .add("prompt", prompt)
                            .add("tokens", count_tokens(engine, prompt))
                            .add("droppedTurns", static_cast<int64_t>(dropped))
                            .str());
}
