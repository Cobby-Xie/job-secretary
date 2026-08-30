#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "$0")/.." && pwd)"
source_png="$project_dir/resources/求职秘书-icon.png"
output_icns="$project_dir/resources/求职秘书.icns"
temp_dir="$(mktemp -d)"
iconset="$temp_dir/求职秘书.iconset"

cleanup() {
  rm -rf "$temp_dir"
}
trap cleanup EXIT

mkdir -p "$iconset"

make_icon() {
  local pixels="$1"
  local name="$2"
  sips -z "$pixels" "$pixels" "$source_png" --out "$iconset/$name" >/dev/null
}

make_icon 16 icon_16x16.png
make_icon 32 icon_16x16@2x.png
make_icon 32 icon_32x32.png
make_icon 64 icon_32x32@2x.png
make_icon 128 icon_128x128.png
make_icon 256 icon_128x128@2x.png
make_icon 256 icon_256x256.png
make_icon 512 icon_256x256@2x.png
make_icon 512 icon_512x512.png
make_icon 1024 icon_512x512@2x.png

iconutil -c icns "$iconset" -o "$output_icns"
echo "Created $output_icns"
