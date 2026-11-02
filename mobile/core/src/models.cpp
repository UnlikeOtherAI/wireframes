#include <cstdint>
#include <cstdio>
#include <string>
#include <vector>

#include "json_out.h"
#include "wf_core.h"

namespace {

struct ModelFile {
  const char* name;
  const char* sha256;
  uint64_t bytes;
  const char* mirror_key;
  const char* fallback_url;
};

// The digests are the contract. Any source may serve the bytes, because nothing
// is installed unless it hashes to these values.
const ModelFile kE2B = {
    "gemma-4-E2B_q4_0-it.gguf",
    "fa401b55b07ee70a54c6dae3903c783a6e65064312529ea57175cb5f8dec6634",
    3349516256ULL,
    "gemma4/e2b/q4_0/fa401b55b07ee70a54c6dae3903c783a6e65064312529ea57175cb5f8dec6634/gemma-4-E2B_q4_0-it.gguf",
    "https://huggingface.co/google/gemma-4-E2B-it-qat-q4_0-gguf/resolve/main/gemma-4-E2B_q4_0-it.gguf",
};
const ModelFile kE4B = {
    "gemma-4-E4B_q4_0-it.gguf",
    "676c35070db6dbe52f93e9c864ee0fba4eddea94b9c875d9cb10daff453fbaee",
    5154941280ULL,
    "gemma4/e4b/q4_0/676c35070db6dbe52f93e9c864ee0fba4eddea94b9c875d9cb10daff453fbaee/gemma-4-E4B_q4_0-it.gguf",
    "https://huggingface.co/google/gemma-4-E4B-it-qat-q4_0-gguf/resolve/main/gemma-4-E4B_q4_0-it.gguf",
};

// Devices sold with 8 GB report a little less.
constexpr double kMinimumRamGib = 7.0;
constexpr double kE4BRamGib = 11.0;
constexpr uint64_t kWorkingReserveBytes = 1ULL << 30;

std::string file_json(const char* id, const ModelFile& file, const std::string& mirror) {
  std::string urls = "[";
  if (!mirror.empty()) urls += wf::json_quote(mirror + "/" + file.mirror_key) + ",";
  urls += wf::json_quote(file.fallback_url) + "]";
  return wf::JsonObject()
      .add("id", id)
      .add("fileName", file.name)
      .add("sha256", file.sha256)
      .add("bytes", file.bytes)
      .raw("urls", urls)
      .str();
}

}  // namespace

extern "C" void wf_free(char* value) { std::free(value); }

extern "C" char* wf_catalog_json(const char* mirror_base_url) {
  std::string mirror = mirror_base_url ? mirror_base_url : "";
  while (!mirror.empty() && mirror.back() == '/') mirror.pop_back();
  return wf::dup_string("[" + file_json("e2b", kE2B, mirror) + "," + file_json("e4b", kE4B, mirror) + "]");
}

extern "C" char* wf_select_model(double physical_ram_gib, uint64_t free_disk_bytes, int thermal, bool e4b_qualified, const char* failed_model) {
  (void)thermal;  // Heat delays a generation; it never changes which model belongs on a device.
  const std::string failed = failed_model ? failed_model : "";
  if (physical_ram_gib < kMinimumRamGib || failed == "e2b") {
    return wf::dup_string(wf::JsonObject().add("status", "unsupported").add("model", "").add("requiredBytes", uint64_t{0}).str());
  }
  const bool use_e4b = e4b_qualified && physical_ram_gib >= kE4BRamGib && failed != "e4b";
  const ModelFile& file = use_e4b ? kE4B : kE2B;
  const uint64_t required = file.bytes + kWorkingReserveBytes;
  return wf::dup_string(wf::JsonObject()
                            .add("status", free_disk_bytes >= required ? "ok" : "storage")
                            .add("model", use_e4b ? "e4b" : "e2b")
                            .add("requiredBytes", required)
                            .str());
}
