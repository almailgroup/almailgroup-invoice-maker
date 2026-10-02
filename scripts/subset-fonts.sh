#!/usr/bin/env bash
# Regenerates the subset fonts in src/pdf/fonts from the @expo-google-fonts
# packages (SIL Open Font License). Requires fonttools: pip install fonttools
# Subsetting keeps Latin (incl. Vietnamese), Greek, Cyrillic, punctuation,
# currency symbols and the OpenType features used for print (kerning,
# ligatures, tabular/lining figures). Hinting is dropped (not used in PDFs).
set -euo pipefail
cd "$(dirname "$0")/.."

SRC=node_modules/@expo-google-fonts
OUT=src/pdf/fonts
UNICODES="U+0000-024F,U+0259,U+02B0-02FF,U+0300-036F,U+0370-03FF,U+0400-04FF,U+1E00-1EFF,U+2000-206F,U+20A0-20CF,U+2100-214F,U+2190-21FF,U+2212,U+2215,U+2219,U+221E,U+2248,U+2260,U+2264,U+2265,U+25A0-25FF,U+2713,U+2714,U+FEFF,U+FFFD"

mkdir -p "$OUT"

subset() {
  local pkg=$1 file=$2 name=$3
  local src
  src=$(find "$SRC/$pkg" -name "$file" | head -n 1)
  pyftsubset "$src" \
    --unicodes="$UNICODES" \
    --layout-features='kern,liga,clig,calt,ccmp,locl,mark,mkmk,tnum,lnum,pnum,case' \
    --no-hinting \
    --name-IDs='*' \
    --notdef-outline \
    --output-file="$OUT/$name.ttf"
}

subset inter Inter_400Regular.ttf inter-400
subset inter Inter_400Regular_Italic.ttf inter-400-italic
subset inter Inter_500Medium.ttf inter-500
subset inter Inter_600SemiBold.ttf inter-600
subset inter Inter_700Bold.ttf inter-700
subset inter Inter_800ExtraBold.ttf inter-800

subset manrope Manrope_400Regular.ttf manrope-400
subset manrope Manrope_500Medium.ttf manrope-500
subset manrope Manrope_600SemiBold.ttf manrope-600
subset manrope Manrope_700Bold.ttf manrope-700
subset manrope Manrope_800ExtraBold.ttf manrope-800

subset ibm-plex-sans IBMPlexSans_400Regular.ttf plexsans-400
subset ibm-plex-sans IBMPlexSans_400Regular_Italic.ttf plexsans-400-italic
subset ibm-plex-sans IBMPlexSans_500Medium.ttf plexsans-500
subset ibm-plex-sans IBMPlexSans_600SemiBold.ttf plexsans-600
subset ibm-plex-sans IBMPlexSans_700Bold.ttf plexsans-700

subset ibm-plex-mono IBMPlexMono_400Regular.ttf plexmono-400
subset ibm-plex-mono IBMPlexMono_500Medium.ttf plexmono-500
subset ibm-plex-mono IBMPlexMono_600SemiBold.ttf plexmono-600

subset playfair-display PlayfairDisplay_400Regular.ttf playfair-400
subset playfair-display PlayfairDisplay_400Regular_Italic.ttf playfair-400-italic
subset playfair-display PlayfairDisplay_600SemiBold.ttf playfair-600
subset playfair-display PlayfairDisplay_700Bold.ttf playfair-700

subset lora Lora_400Regular.ttf lora-400
subset lora Lora_400Regular_Italic.ttf lora-400-italic
subset lora Lora_500Medium.ttf lora-500
subset lora Lora_600SemiBold.ttf lora-600
subset lora Lora_700Bold.ttf lora-700

subset space-grotesk SpaceGrotesk_400Regular.ttf spacegrotesk-400
subset space-grotesk SpaceGrotesk_500Medium.ttf spacegrotesk-500
subset space-grotesk SpaceGrotesk_600SemiBold.ttf spacegrotesk-600
subset space-grotesk SpaceGrotesk_700Bold.ttf spacegrotesk-700

subset dm-serif-display DMSerifDisplay_400Regular.ttf dmserif-400
subset dm-serif-display DMSerifDisplay_400Regular_Italic.ttf dmserif-400-italic

echo "Fonts written to $OUT"
