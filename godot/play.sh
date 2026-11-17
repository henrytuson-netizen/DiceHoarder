#!/usr/bin/env bash
# One-step launcher for ChromeOS / Linux: fetch the latest game, then open it in Godot.
# Usage:  bash ~/DiceHoarder/godot/play.sh          (opens the editor; press F5 to play)
#         bash ~/DiceHoarder/godot/play.sh --play   (starts the game directly)
#         add --lite to use the lighter renderer if the screen is black or very slow
set -e
REPO="$(cd "$(dirname "$0")/.." && pwd)"
GODOT="${GODOT:-$(ls "$HOME"/Godot_v4.7.2-stable_linux.x86_64 2>/dev/null | head -1)}"
if [ -z "$GODOT" ] || [ ! -x "$GODOT" ]; then
  echo "Godot not found in your home folder. Downloading Godot 4.7.2..."
  cd "$HOME"
  wget -q --show-progress https://github.com/godotengine/godot/releases/download/4.7.2-stable/Godot_v4.7.2-stable_linux.x86_64.zip
  unzip -o -q Godot_v4.7.2-stable_linux.x86_64.zip && rm Godot_v4.7.2-stable_linux.x86_64.zip
  chmod +x Godot_v4.7.2-stable_linux.x86_64
  GODOT="$HOME/Godot_v4.7.2-stable_linux.x86_64"
fi
echo "Getting the latest version of the game..."
git -C "$REPO" pull --ff-only || echo "(could not update - opening the version you have)"
ARGS=(--path "$REPO/godot")
for a in "$@"; do
  case "$a" in
    --lite) ARGS+=(--rendering-method gl_compatibility) ;;
    --play) PLAY=1 ;;
  esac
done
[ -z "$PLAY" ] && ARGS+=(--editor)
exec "$GODOT" "${ARGS[@]}"
