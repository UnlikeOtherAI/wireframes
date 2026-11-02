#pragma once

#include <sqlite3.h>

#include <cstdint>
#include <string>

struct wf_store {
  sqlite3* db;
};

namespace wf {

/** A prepared statement that finalizes itself. */
class Statement {
 public:
  Statement(sqlite3* db, const char* sql) { sqlite3_prepare_v2(db, sql, -1, &statement_, nullptr); }
  ~Statement() { sqlite3_finalize(statement_); }
  Statement(const Statement&) = delete;
  Statement& operator=(const Statement&) = delete;

  Statement& bind(int index, int64_t value) {
    sqlite3_bind_int64(statement_, index, value);
    return *this;
  }
  Statement& bind(int index, const char* value) {
    sqlite3_bind_text(statement_, index, value ? value : "", -1, SQLITE_TRANSIENT);
    return *this;
  }
  bool row() { return statement_ && sqlite3_step(statement_) == SQLITE_ROW; }
  bool done() { return statement_ && sqlite3_step(statement_) == SQLITE_DONE; }
  void reset() { sqlite3_reset(statement_); }
  int64_t int64(int column) { return sqlite3_column_int64(statement_, column); }
  std::string text(int column) {
    const auto* value = reinterpret_cast<const char*>(sqlite3_column_text(statement_, column));
    return value ? value : "";
  }

 private:
  sqlite3_stmt* statement_ = nullptr;
};

}  // namespace wf
