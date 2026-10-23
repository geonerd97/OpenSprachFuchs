#!/usr/bin/env bash
# Builds a signed release APK and publishes it as a GitHub release v<versionName>.
# Needs: android/keystore.properties (see README), the GitHub CLI (`gh auth login`), Node 22.5+.
set -euo pipefail
cd "$(dirname "$0")/.."

[ -f android/keystore.properties ] || { echo "android/keystore.properties fehlt (siehe README, 'Release bauen')."; exit 1; }
command -v gh >/dev/null || { echo "Die GitHub CLI (gh) fehlt: https://cli.github.com"; exit 1; }
version=$(sed -n 's/^ *versionName = "\(.*\)"/\1/p' android/app/build.gradle.kts)
# The GitHub repository from app/js/config.js, and the git remote that points to it.
repo=$(sed -n 's/^ *GITHUB_REPO: "\(.*\)",/\1/p' app/js/config.js)
[ -n "$repo" ] || { echo "GITHUB_REPO in app/js/config.js ist leer."; exit 1; }
remote=$(git remote -v | awk -v r="github.com[/:]$repo(\\.git)? " '$0 ~ r && /\(push\)/ {print $1; exit}')
[ -n "$remote" ] || { echo "Kein git-Remote für github.com/$repo gefunden."; exit 1; }
tag="v$version"
if gh release view "$tag" --repo "$repo" >/dev/null 2>&1; then echo "Release $tag gibt es schon. Erst versionCode und versionName erhöhen."; exit 1; fi
if [ -n "$(git status --porcelain)" ]; then echo "Es gibt nicht committete Änderungen. Bitte erst committen."; exit 1; fi

echo "Tests …"
npm test
echo "Baue Release $version …"
(cd android && ./gradlew --console=plain clean assembleRelease)
apk="android/app/build/outputs/apk/release/app-release.apk"
[ -f "$apk" ] || { echo "Keine signierte APK gefunden ($apk)."; exit 1; }
out="android/app/build/outputs/apk/release/openlingo-$version.apk"
cp "$apk" "$out"

git tag "$tag"
git push "$remote" "$tag"
# Versions below 1.0 are experimental and published as pre-releases.
flags=()
case "$version" in 0.*) flags+=(--prerelease); title="Openlingo $version (experimentell)";; *) title="Openlingo $version";; esac
gh release create "$tag" --repo "$repo" "$out" --title "$title" --generate-notes ${flags[@]+"${flags[@]}"}
echo "Fertig: Release $tag veröffentlicht."
