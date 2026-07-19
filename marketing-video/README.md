# Maplogue LP 用操作デモ

Maplogue の「プロンプトからマップへ」を表現する、15 秒・無音の Remotion 動画です。

```bash
cd /Users/yoshiakiyumoto/dev/maplogue/marketing-video
npm install
npm run preview
npm run render
npm run render:preview
```

生成先は `out/maplogue-prompt-to-map.mp4` と `out/maplogue-prompt-to-map-preview.png` です。動画は 1440×810、30 fps、450 フレーム（15 秒）です。`render` はローカルの `ffmpeg` を使い、音声トラックを除外して出力します。
