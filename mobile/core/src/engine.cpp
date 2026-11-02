#include <llama.h>

#include <atomic>
#include <chrono>
#include <cstdint>
#include <memory>
#include <mutex>
#include <string>
#include <vector>

#include "json_out.h"
#include "wf_core.h"

using wf::JsonObject;

struct wf_engine {
  llama_model* model = nullptr;
  llama_context* context = nullptr;
  int gpu_layers = 0;
  std::atomic<bool> cancelled{false};
  std::mutex mutex;
};

namespace {

using Clock = std::chrono::steady_clock;
constexpr int kBatch = 256;

int64_t elapsed_ms(Clock::time_point since) {
  return std::chrono::duration_cast<std::chrono::milliseconds>(Clock::now() - since).count();
}

std::string failure(const std::string& message) { return JsonObject().add("ok", false).add("error", message).str(); }

void unload_locked(wf_engine* engine) {
  if (engine->context) llama_free(engine->context);
  if (engine->model) llama_model_free(engine->model);
  engine->context = nullptr;
  engine->model = nullptr;
}

std::vector<llama_token> tokenize(const llama_vocab* vocab, const char* text) {
  const int32_t length = static_cast<int32_t>(std::strlen(text));
  const int32_t needed = -llama_tokenize(vocab, text, length, nullptr, 0, true, true);
  if (needed <= 0) return {};
  std::vector<llama_token> tokens(needed);
  if (llama_tokenize(vocab, text, length, tokens.data(), needed, true, true) != needed) return {};
  return tokens;
}

std::string piece_of(const llama_vocab* vocab, llama_token token) {
  char buffer[256];
  int size = llama_token_to_piece(vocab, token, buffer, sizeof(buffer), 0, false);
  if (size >= 0) return std::string(buffer, size);
  std::string large(static_cast<size_t>(-size), '\0');
  size = llama_token_to_piece(vocab, token, large.data(), static_cast<int32_t>(large.size()), 0, false);
  return size > 0 ? large.substr(0, size) : "";
}

}  // namespace

extern "C" wf_engine* wf_engine_create(void) {
  static std::once_flag once;
  std::call_once(once, [] { llama_backend_init(); });
  return new wf_engine();
}

extern "C" void wf_engine_destroy(wf_engine* engine) {
  if (!engine) return;
  wf_engine_cancel(engine);
  {
    std::lock_guard<std::mutex> lock(engine->mutex);
    unload_locked(engine);
  }
  delete engine;
}

extern "C" char* wf_engine_load(wf_engine* engine, const char* model_path, wf_engine_params params) {
  std::lock_guard<std::mutex> lock(engine->mutex);
  unload_locked(engine);
  const auto started = Clock::now();

  auto model_params = llama_model_default_params();
  model_params.n_gpu_layers = params.gpu_layers;
  llama_model* model = llama_model_load_from_file(model_path, model_params);
  if (!model) return wf::dup_string(failure("The model could not be loaded."));

  auto context_params = llama_context_default_params();
  context_params.n_ctx = static_cast<uint32_t>(params.context_tokens);
  context_params.n_batch = kBatch;
  context_params.n_threads = params.threads;
  context_params.n_threads_batch = params.threads;
  context_params.abort_callback = [](void* state) { return static_cast<wf_engine*>(state)->cancelled.load(); };
  context_params.abort_callback_data = engine;
  llama_context* context = llama_init_from_model(model, context_params);
  if (!context) {
    llama_model_free(model);
    return wf::dup_string(failure("There is not enough memory for this model."));
  }

  engine->model = model;
  engine->context = context;
  engine->gpu_layers = params.gpu_layers;
  return wf::dup_string(JsonObject().add("ok", true).add("gpuLayers", params.gpu_layers).add("loadMs", elapsed_ms(started)).str());
}

extern "C" void wf_engine_unload(wf_engine* engine) {
  wf_engine_cancel(engine);
  std::lock_guard<std::mutex> lock(engine->mutex);
  unload_locked(engine);
}

extern "C" bool wf_engine_is_loaded(wf_engine* engine) { return engine && engine->model != nullptr; }

extern "C" int wf_engine_count_tokens(wf_engine* engine, const char* text) {
  if (!engine->model) return 0;
  return static_cast<int>(tokenize(llama_model_get_vocab(engine->model), text).size());
}

extern "C" void wf_engine_cancel(wf_engine* engine) {
  if (engine) engine->cancelled = true;
}

extern "C" char* wf_engine_generate(wf_engine* engine, const char* prompt, int max_tokens, float temperature, wf_token_fn on_token, void* context) {
  std::lock_guard<std::mutex> lock(engine->mutex);
  if (!engine->model) return wf::dup_string(failure("The model is not loaded."));
  engine->cancelled = false;
  const auto started = Clock::now();

  const llama_vocab* vocab = llama_model_get_vocab(engine->model);
  auto tokens = tokenize(vocab, prompt);
  const int capacity = static_cast<int>(llama_n_ctx(engine->context));
  if (tokens.empty() || static_cast<int>(tokens.size()) + max_tokens > capacity) {
    return wf::dup_string(failure("The request does not fit in the model's context."));
  }
  llama_memory_clear(llama_get_memory(engine->context), true);

  std::unique_ptr<llama_sampler, decltype(&llama_sampler_free)> sampler(
      llama_sampler_chain_init(llama_sampler_chain_default_params()), llama_sampler_free);
  llama_sampler_chain_add(sampler.get(), llama_sampler_init_top_k(40));
  llama_sampler_chain_add(sampler.get(), llama_sampler_init_top_p(0.9f, 1));
  llama_sampler_chain_add(sampler.get(), llama_sampler_init_temp(temperature));
  llama_sampler_chain_add(sampler.get(), llama_sampler_init_dist(LLAMA_DEFAULT_SEED));

  const int prompt_tokens = static_cast<int>(tokens.size());
  for (int offset = 0; offset < prompt_tokens; offset += kBatch) {
    if (engine->cancelled) break;
    const int size = std::min(kBatch, prompt_tokens - offset);
    if (llama_decode(engine->context, llama_batch_get_one(tokens.data() + offset, size)) != 0 && !engine->cancelled) {
      return wf::dup_string(failure("The model stopped while reading the request."));
    }
  }

  std::string output;
  int generated = 0;
  int64_t first_token_ms = 0;
  const char* finish = "length";
  for (; generated < max_tokens; ++generated) {
    if (engine->cancelled) {
      finish = "cancelled";
      break;
    }
    llama_token token = llama_sampler_sample(sampler.get(), engine->context, -1);
    if (llama_vocab_is_eog(vocab, token)) {
      finish = "stop";
      break;
    }
    if (generated == 0) first_token_ms = elapsed_ms(started);
    const std::string piece = piece_of(vocab, token);
    output += piece;
    if (on_token && !piece.empty()) on_token(piece.c_str(), context);
    if (llama_decode(engine->context, llama_batch_get_one(&token, 1)) != 0) {
      if (engine->cancelled) {
        finish = "cancelled";
        break;
      }
      return wf::dup_string(failure("The model stopped while writing."));
    }
  }

  return wf::dup_string(JsonObject()
                            .add("ok", true)
                            .add("text", output)
                            .add("finish", finish)
                            .add("promptTokens", prompt_tokens)
                            .add("tokens", generated)
                            .add("firstTokenMs", first_token_ms)
                            .add("totalMs", elapsed_ms(started))
                            .str());
}
