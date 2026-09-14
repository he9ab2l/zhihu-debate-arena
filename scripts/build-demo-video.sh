#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ASSETS="$ROOT/docs/assets"
OUT="$ROOT/docs/zhihu-debate-arena-demo.mp4"
FONT="/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"
mkdir -p "$ROOT/docs"
ffmpeg -y \
  -loop 1 -t 4 -i "$ASSETS/debate-arena-cover.png" \
  -loop 1 -t 6 -i "$ASSETS/debate-arena-desktop.png" \
  -loop 1 -t 5 -i "$ASSETS/debate-arena-mobile.png" \
  -loop 1 -t 6 -i "$ASSETS/debate-arena-cover.png" \
  -filter_complex "
    [0:v]scale=1280:720,setsar=1,format=yuv420p,fade=t=in:st=0:d=0.45,fade=t=out:st=3.3:d=0.7,drawtext=fontfile=$FONT:text='真实来源 · 结构化交锋 · AI 辅助总结':fontcolor=white:fontsize=28:x=64:y=650:alpha=0.95[v0];
    [1:v]scale=1280:720,setsar=1,format=yuv420p,fade=t=in:st=0:d=0.45,fade=t=out:st=5.3:d=0.7,drawtext=fontfile=$FONT:text='01 真实检索与历史辩题':fontcolor=white:fontsize=26:box=1:boxcolor=black@0.48:boxborderw=14:x=54:y=54[v1];
    [2:v]scale=560:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=#f7f2e9,setsar=1,format=yuv420p,fade=t=in:st=0:d=0.45,fade=t=out:st=4.3:d=0.7,drawtext=fontfile=$FONT:text='02 移动端侧栏与证据阅读':fontcolor=#222222:fontsize=26:box=1:boxcolor=#f7f2e9@0.9:boxborderw=14:x=54:y=54[v2];
    [3:v]scale=1280:720,setsar=1,format=yuv420p,fade=t=in:st=0:d=0.45,fade=t=out:st=5.3:d=0.7,drawtext=fontfile=$FONT:text='03 把观点变成自己的判断条件':fontcolor=white:fontsize=28:x=64:y=650:alpha=0.95[v3];
    [v0][v1][v2][v3]concat=n=4:v=1:a=0,format=yuv420p[v]
  " -map "[v]" -an -r 30 -c:v libx264 -preset medium -crf 20 -movflags +faststart "$OUT"
printf 'created %s\n' "$OUT"
