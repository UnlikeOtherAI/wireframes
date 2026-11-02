// Just enough JSON writing for the ABI. Nothing in the core needs to parse JSON.
#pragma once

#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <string>

namespace wf {

inline std::string json_quote(const std::string& value) {
  std::string out = "\"";
  for (unsigned char c : value) {
    switch (c) {
      case '"': out += "\\\""; break;
      case '\\': out += "\\\\"; break;
      case '\n': out += "\\n"; break;
      case '\r': out += "\\r"; break;
      case '\t': out += "\\t"; break;
      default:
        if (c < 0x20) {
          char buffer[8];
          std::snprintf(buffer, sizeof(buffer), "\\u%04x", c);
          out += buffer;
        } else {
          out += static_cast<char>(c);
        }
    }
  }
  return out + "\"";
}

class JsonObject {
 public:
  JsonObject& add(const char* key, const std::string& value) { return raw(key, json_quote(value)); }
  JsonObject& add(const char* key, const char* value) { return raw(key, json_quote(value ? value : "")); }
  JsonObject& add(const char* key, int64_t value) { return raw(key, std::to_string(value)); }
  JsonObject& add(const char* key, int value) { return raw(key, std::to_string(value)); }
  JsonObject& add(const char* key, uint64_t value) { return raw(key, std::to_string(value)); }
  JsonObject& add(const char* key, bool value) { return raw(key, value ? "true" : "false"); }
  JsonObject& raw(const char* key, const std::string& value) {
    if (!body_.empty()) body_ += ",";
    body_ += json_quote(key) + ":" + value;
    return *this;
  }
  std::string str() const { return "{" + body_ + "}"; }

 private:
  std::string body_;
};

inline char* dup_string(const std::string& value) {
  auto* copy = static_cast<char*>(std::malloc(value.size() + 1));
  if (copy) std::memcpy(copy, value.c_str(), value.size() + 1);
  return copy;
}

}  // namespace wf
