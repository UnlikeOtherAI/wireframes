// Loads a real model and answers one prompt, to check inference outside the app.
// wf_smoke <model.gguf> <prompt-file> [gpu-layers]
#include <cstdio>
#include <fstream>
#include <sstream>
#include <string>

#include "wf_core.h"

int main(int argc, char** argv) {
  if (argc < 3) {
    std::fprintf(stderr, "usage: wf_smoke <model.gguf> <prompt-file> [gpu-layers]\n");
    return 2;
  }
  std::ifstream file(argv[2]);
  std::stringstream prompt;
  prompt << file.rdbuf();

  wf_engine* engine = wf_engine_create();
  wf_engine_params params{8192, argc > 3 ? std::atoi(argv[3]) : 99, 4};
  char* loaded = wf_engine_load(engine, argv[1], params);
  std::printf("%s\n", loaded);
  wf_free(loaded);
  if (!wf_engine_is_loaded(engine)) return 1;

  char* result = wf_engine_generate(engine, prompt.str().c_str(), 1024, 0.2f, nullptr, nullptr);
  std::printf("%s\n", result);
  wf_free(result);
  wf_engine_destroy(engine);
  return 0;
}
