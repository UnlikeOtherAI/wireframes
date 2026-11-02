// Stands in for engine.cpp in the unit tests, which do not build llama.cpp.
#include "json_out.h"
#include "wf_core.h"

struct wf_engine {};

extern "C" wf_engine* wf_engine_create(void) { return new wf_engine(); }
extern "C" void wf_engine_destroy(wf_engine* engine) { delete engine; }
extern "C" char* wf_engine_load(wf_engine*, const char*, wf_engine_params) {
  return wf::dup_string(wf::JsonObject().add("ok", false).add("error", "No inference in this build.").str());
}
extern "C" void wf_engine_unload(wf_engine*) {}
extern "C" bool wf_engine_is_loaded(wf_engine*) { return false; }
extern "C" int wf_engine_count_tokens(wf_engine*, const char*) { return 0; }
extern "C" void wf_engine_cancel(wf_engine*) {}
extern "C" char* wf_engine_generate(wf_engine*, const char*, int, float, wf_token_fn, void*) {
  return wf::dup_string(wf::JsonObject().add("ok", false).add("error", "No inference in this build.").str());
}
