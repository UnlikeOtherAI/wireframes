#!/bin/zsh
# Builds the C++ core and llama.cpp for iPhone/iPad and the simulator, as one
# xcframework. Run it on a Mac. Only rerun it when mobile/core changes.
set -euo pipefail

here="${0:A:h}"
core="${here}/../../core"
out="${here}/../build"
work="${WF_CORE_BUILD_DIR:-/tmp/wf-core-build}"
tag="${WF_LLAMA_TAG:-v0.8.0}"
target="17.0"

build_one() {
  local name="$1" sysroot="$2" metal="$3"
  local dir="${work}/${name}"
  cmake -S "${core}" -B "${dir}" -G Ninja \
    -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_SYSTEM_NAME=iOS \
    -DCMAKE_OSX_SYSROOT="${sysroot}" \
    -DCMAKE_OSX_ARCHITECTURES=arm64 \
    -DCMAKE_OSX_DEPLOYMENT_TARGET="${target}" \
    -DCMAKE_TRY_COMPILE_TARGET_TYPE=STATIC_LIBRARY \
    -DWF_LLAMA_TAG="${tag}" \
    -DGGML_METAL="${metal}" \
    -DGGML_METAL_EMBED_LIBRARY="${metal}" \
    -DGGML_BLAS=OFF \
    -DGGML_OPENMP=OFF \
    -DLLAMA_BUILD_TESTS=OFF
  cmake --build "${dir}" --target wf_core
  local libs=(${(f)"$(find "${dir}" -name '*.a' -not -path '*/CMakeFiles/*')"})
  xcrun libtool -static -no_warning_for_no_symbols -o "${dir}/libWfCore.a" "${libs[@]}"
}

build_one device iphoneos ON
build_one simulator iphonesimulator OFF

headers="${work}/headers"
rm -rf "${headers}" "${out}/WfCore.xcframework"
mkdir -p "${headers}" "${out}"
cp "${core}/include/wf_core.h" "${headers}/"
cat > "${headers}/module.modulemap" <<'EOF'
module WfCore {
  header "wf_core.h"
  export *
}
EOF

xcodebuild -create-xcframework \
  -library "${work}/device/libWfCore.a" -headers "${headers}" \
  -library "${work}/simulator/libWfCore.a" -headers "${headers}" \
  -output "${out}/WfCore.xcframework"
