#!/usr/bin/env bash
set -euo pipefail

# GitHub's release download redirect can fail while its asset API still works.
# Populate @electron/get's ordinary cache without skipping its installer.
version="${1:?Exact Electron version is required}"
cache_root="${2:?Cache directory is required}"
if [[ ! "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Expected an exact Electron version, got: $version" >&2
  exit 1
fi
filename="electron-v${version}-$(node -p 'process.platform')-$(node -p 'process.arch').zip"
release_url="https://github.com/electron/electron/releases/download/v${version}"
# @electron/get hashes the directory URL without a trailing slash.
cache_key="$(printf '%s' "$release_url" | shasum -a 256 | cut -d ' ' -f 1)"
directory="$cache_root/$cache_key"
mkdir -p "$directory"
temporary="$(mktemp -d "$cache_root/download-XXXXXX")"
trap 'rm -rf "$temporary"' EXIT

gh api "repos/electron/electron/releases/tags/v$version" > "$temporary/release.json"
archive_id="$(jq -er --arg name "$filename" '.assets[] | select(.name == $name) | .id' "$temporary/release.json")"
checksums_id="$(jq -er '.assets[] | select(.name == "SHASUMS256.txt") | .id' "$temporary/release.json")"
gh api -H 'Accept: application/octet-stream' "repos/electron/electron/releases/assets/$checksums_id" > "$temporary/SHASUMS256.txt"
gh api -H 'Accept: application/octet-stream' "repos/electron/electron/releases/assets/$archive_id" > "$temporary/$filename"

expected="$(awk -v filename="$filename" '$2 == filename || $2 == "*" filename {print $1}' "$temporary/SHASUMS256.txt")"
actual="$(shasum -a 256 "$temporary/$filename" | cut -d ' ' -f 1)"
if [[ ! "$expected" =~ ^[a-f0-9]{64}$ ]] || [ "$actual" != "$expected" ]; then
  echo "Checksum mismatch for $filename; refusing to cache the download" >&2
  exit 1
fi
mv "$temporary/$filename" "$directory/$filename"
# Forge also uses @electron/get and may request the checksum manifest.
mv "$temporary/SHASUMS256.txt" "$directory/SHASUMS256.txt"
echo "Verified and cached $filename"
