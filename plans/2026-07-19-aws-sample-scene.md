# AWS サンプルシーン

## Context

Maplogue を初めて開いた人が、ノード、グループ、有向エッジによる整理例をすぐ理解できるよう、AWS 上の一般的な Web アプリケーション構成をサンプルとして提供する。

## Scope

- `data/scene.json` と `data/scene.sample.json` に同一の AWS Web アプリケーション構成を定義する。
- 公開リクエスト経路（利用者 → CloudFront → ALB → ECS/Fargate）と、アプリケーションから RDS/S3 への依存関係を表現する。
- ネットワーク、アプリケーション、データストアをグループで整理する。

## Acceptance Criteria

- [x] 両方の scene ファイルに、利用者、CloudFront、ALB、ECS/Fargate、RDS、S3 が含まれる。
- [x] 公開リクエスト経路とデータアクセスを、意味のあるラベル付き有向エッジで確認できる。
- [x] 両ファイルが既存の scene スキーマに適合する。
- [x] `npm run validate:scene` と `npm run validate:scene data/scene.sample.json` が成功する。
