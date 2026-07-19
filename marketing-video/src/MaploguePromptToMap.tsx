import type React from "react";
import { Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

const prompt = "AWSでWebアプリを構成したい。CloudFront、ALB、ECS/Fargate、RDS、S3の関係を整理して。";
const FONT = '"Hiragino Sans", "Yu Gothic UI", system-ui, sans-serif';

type NodeData = {
  id: string;
  title: string;
  body: string;
  x: number;
  y: number;
  accent: string;
  start: number;
};

const nodes: NodeData[] = [
  { id: "cloudfront", title: "Amazon CloudFront", body: "エッジでコンテンツをキャッシュして配信", x: 182, y: 196, accent: "#7c4dff", start: 220 },
  { id: "alb", title: "Application Load Balancer", body: "HTTPS リクエストをアプリへ振り分け", x: 505, y: 196, accent: "#ff8f00", start: 250 },
  { id: "ecs", title: "Amazon ECS / AWS Fargate", body: "コンテナ化した Web アプリケーション", x: 827, y: 196, accent: "#00a862", start: 280 },
  { id: "rds", title: "Amazon RDS", body: "トランザクションデータを管理", x: 716, y: 420, accent: "#2f6fed", start: 310 },
  { id: "s3", title: "Amazon S3", body: "画像・静的アセットをオブジェクト保存", x: 1040, y: 420, accent: "#d76408", start: 340 },
];

const edgeData = [
  { d: "M 458 260 C 476 260, 486 260, 505 260", label: "動的リクエスト", x: 477, y: 232, start: 238 },
  { d: "M 781 260 C 799 260, 809 260, 827 260", label: "負荷分散", x: 796, y: 232, start: 268 },
  { d: "M 941 329 C 925 361, 878 386, 850 420", label: "SQL 読み書き", x: 864, y: 369, start: 298 },
  { d: "M 1030 329 C 1060 361, 1100 386, 1125 420", label: "保存・取得", x: 1063, y: 369, start: 328 },
  { d: "M 390 329 C 494 490, 916 535, 1040 472", label: "静的アセット", x: 694, y: 528, start: 358 },
];

const clamp = (value: number) => Math.max(0, Math.min(1, value));

const Reveal: React.FC<{ start: number; children: React.ReactNode }> = ({ start, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const entered = spring({ frame: frame - start, fps, config: { damping: 200 }, durationInFrames: 14 });
  return <div style={{ opacity: clamp(entered), transform: `translateY(${(1 - clamp(entered)) * 14}px) scale(${0.97 + clamp(entered) * 0.03})` }}>{children}</div>;
};

const MapNode: React.FC<{ node: NodeData }> = ({ node }) => (
  <Reveal start={node.start}>
    <div
      style={{
        position: "absolute", left: node.x, top: node.y, width: 276, minHeight: 133,
        padding: "17px 18px", background: "#fff", border: "1px solid #d9dee6", borderRadius: 10,
        boxShadow: "0 3px 10px rgba(20,30,50,.10)", fontFamily: FONT, color: "#1f2430",
      }}
    >
      <div style={{ position: "absolute", left: 0, top: 20, bottom: 20, width: 4, background: node.accent, borderRadius: "0 3px 3px 0" }} />
      <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-.01em" }}>{node.title}</div>
      <div style={{ marginTop: 9, color: "#596476", fontSize: 13.5, lineHeight: 1.58 }}>{node.body}</div>
      <div style={{ position: "absolute", width: 7, height: 7, background: "#b6c0d0", left: -4, top: 63, borderRadius: 4 }} />
      <div style={{ position: "absolute", width: 7, height: 7, background: "#b6c0d0", right: -4, top: 63, borderRadius: 4 }} />
    </div>
  </Reveal>
);

const MapEdges: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <svg width="1440" height="810" style={{ position: "absolute", inset: 0, overflow: "visible" }}>
      <defs>
        <marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
          <path d="M0,0 L0,6 L9,3 z" fill="#7e899a" />
        </marker>
      </defs>
      {edgeData.map((edge) => {
        const progress = interpolate(frame, [edge.start, edge.start + 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
        return (
          <g key={edge.label} opacity={progress}>
            <path d={edge.d} fill="none" stroke="#7e899a" strokeWidth="2" strokeDasharray="5 5" pathLength={1} strokeDashoffset={1 - progress} markerEnd={progress > 0.92 ? "url(#arrow)" : undefined} />
            {progress > 0.75 ? <text x={edge.x} y={edge.y} textAnchor="middle" fill="#687486" fontFamily={FONT} fontSize="12" fontWeight="600">{edge.label}</text> : null}
          </g>
        );
      })}
    </svg>
  );
};

export const MaploguePromptToMap: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const appIn = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const typingStart = 52;
  const typingFrames = 145;
  const typedCount = Math.floor(interpolate(frame, [typingStart, typingStart + typingFrames], [0, prompt.length], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const typed = prompt.slice(0, typedCount);
  const isTyping = frame >= typingStart && frame <= typingStart + typingFrames;
  const cursorVisible = Math.floor(frame / 12) % 2 === 0;
  const processing = frame >= 202 && frame < 220;
  const finish = spring({ frame: frame - 370, fps, config: { damping: 200 }, durationInFrames: 18 });

  return (
    <main style={{ width: "100%", height: "100%", overflow: "hidden", background: "#f6f7f9", opacity: appIn, fontFamily: FONT, color: "#1f2430" }}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(#e1e6ee 1px, transparent 1px)", backgroundSize: "22px 22px", opacity: 0.55 }} />
      <div style={{ position: "absolute", top: 14, left: 16, zIndex: 5, display: "flex", alignItems: "center", gap: 8, width: 670, padding: 7, border: "1px solid #d9dee6", borderRadius: 8, background: "rgba(255,255,255,.94)", boxShadow: "0 1px 5px rgba(20,30,50,.1)" }}>
        <div style={{ width: 192, height: 30, padding: "6px 10px", border: "1px solid #d0d6e0", borderRadius: 6, fontSize: 13, color: "#2f3542" }}>AWS Web アプリケーション構成</div>
        <div style={{ flex: 1, height: 30, padding: "6px 10px", border: "1px solid #d0d6e0", borderRadius: 6, color: "#9ca5b2", fontSize: 13 }}>新規ワークスペース名</div>
        <div style={{ padding: "7px 13px", borderRadius: 6, background: "#2f6fed", color: "#fff", fontSize: 13, fontWeight: 700 }}>追加</div>
      </div>
      <div style={{ position: "absolute", top: 63, left: 16, zIndex: 5, padding: "7px 14px", borderRadius: 8, background: "rgba(255,255,255,.88)", boxShadow: "0 1px 4px rgba(0,0,0,.08)", fontSize: 15, fontWeight: 700, color: "#3a4150" }}>AWS Web アプリケーション構成</div>
      <div style={{ position: "absolute", top: 16, right: 18, zIndex: 5, padding: "7px 14px", borderRadius: 99, background: processing ? "#2f6fed" : "#edf1f6", color: processing ? "#fff" : "#657083", fontSize: 12.5, fontWeight: 700, boxShadow: "0 1px 4px rgba(0,0,0,.08)" }}>{processing ? "マップを整理中…" : "準備完了"}</div>

      {frame < 218 ? <div style={{ position: "absolute", top: 330, left: 0, right: 0, textAlign: "center", color: "#8b95a5", fontSize: 16, lineHeight: 2 }}>アイデアや依頼を入力すると<br />関係性をマップに整理します</div> : null}
      <MapEdges />
      {nodes.map((node) => <MapNode key={node.id} node={node} />)}

      <div style={{ position: "absolute", bottom: 20, left: "50%", zIndex: 10, width: 760, transform: "translateX(-50%)", padding: 10, border: `1px solid ${isTyping ? "#7a97d4" : "#d9dee6"}`, borderRadius: 14, background: "#fff", boxShadow: isTyping ? "0 6px 24px rgba(47,111,237,.20)" : "0 6px 20px rgba(20,30,50,.14)" }}>
        <div style={{ display: "flex", gap: 4, marginBottom: 9 }}>
          <span style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #7a97d4", background: "#e4ebf8", color: "#2a3f6e", fontSize: 12, fontWeight: 700 }}>通常整理</span>
          <span style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #d0d6e0", background: "#f3f5f8", color: "#657083", fontSize: 12, fontWeight: 600 }}>構造化</span>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
          <div style={{ flex: 1, minHeight: 46, padding: "3px 6px", fontSize: 15, lineHeight: 1.5, color: typed ? "#2f3542" : "#9ca5b2" }}>
            {typed || "思いつくまま書いて Enter（Shift+Enter で改行）"}{(isTyping || (typed && frame < 210)) && cursorVisible ? <span style={{ color: "#2f6fed", fontWeight: 400 }}>|</span> : null}
          </div>
          <div style={{ padding: "9px 19px", borderRadius: 10, background: typedCount === prompt.length ? "#2f6fed" : "#b9c6e2", color: "#fff", fontSize: 13, fontWeight: 700 }}>送信</div>
        </div>
      </div>
      {frame >= 370 ? <div style={{ position: "absolute", top: 96, left: "50%", transform: `translateX(-50%) translateY(${(1 - clamp(finish)) * -8}px)`, opacity: clamp(finish), zIndex: 8, padding: "8px 14px", border: "1px solid #bcd7c8", borderRadius: 99, background: "rgba(240,250,244,.96)", color: "#26734d", fontSize: 13, fontWeight: 700, boxShadow: "0 2px 8px rgba(20,80,50,.08)" }}>✓ 5つのサービスと関係性をマップに整理しました</div> : null}
    </main>
  );
};
