cmake_minimum_required(VERSION 3.21)
project(wf_core LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

option(WF_CORE_INFERENCE "Build the real engine against llama.cpp" ON)
option(WF_CORE_TESTS "Build the unit tests" OFF)
option(WF_CORE_SMOKE "Build the command-line inference check" OFF)

add_library(wf_core STATIC
  src/models.cpp
  src/sha256.cpp
  src/store.cpp
  src/prompt.cpp
)
target_include_directories(wf_core PUBLIC include PRIVATE src)
target_link_libraries(wf_core PUBLIC sqlite3)

if(WF_CORE_INFERENCE)
  include(FetchContent)
  set(LLAMA_BUILD_TESTS OFF CACHE BOOL "" FORCE)
  set(LLAMA_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
  set(LLAMA_BUILD_TOOLS OFF CACHE BOOL "" FORCE)
  set(LLAMA_BUILD_SERVER OFF CACHE BOOL "" FORCE)
  set(LLAMA_BUILD_COMMON OFF CACHE BOOL "" FORCE)
  set(LLAMA_CURL OFF CACHE BOOL "" FORCE)
  set(BUILD_SHARED_LIBS OFF CACHE BOOL "" FORCE)
  # Shaders are compiled into the library, so the app has no extra file to ship.
  set(GGML_METAL_EMBED_LIBRARY ON CACHE BOOL "" FORCE)
  FetchContent_Declare(llama
    URL "https://github.com/ggml-org/llama.cpp/archive/refs/tags/${WF_LLAMA_TAG}.tar.gz"
    DOWNLOAD_EXTRACT_TIMESTAMP TRUE)
  FetchContent_MakeAvailable(llama)
  target_sources(wf_core PRIVATE src/engine.cpp)
  target_link_libraries(wf_core PUBLIC llama)
else()
  target_sources(wf_core PRIVATE src/engine_stub.cpp)
endif()

if(WF_CORE_TESTS)
  enable_testing()
  add_executable(wf_core_tests tests/core_tests.cpp)
  target_link_libraries(wf_core_tests PRIVATE wf_core)
  add_test(NAME wf_core_tests COMMAND wf_core_tests)
endif()

if(WF_CORE_SMOKE)
  add_executable(wf_smoke tests/smoke.cpp)
  target_link_libraries(wf_smoke PRIVATE wf_core)
endif()
