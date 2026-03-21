# React テンプレートの作成方法

このメモは、Vite+ を調べた内容と、React をどう始めるのが自然かをまとめたものです。

## Vite+ とは

Vite+ は `vp` という単一の CLI で、開発時によく使う処理をまとめて扱えるツールチェーンです。

- `vp dev`: 開発サーバー起動
- `vp check`: フォーマット、lint、型チェック
- `vp test`: テスト実行
- `vp build`: 本番ビルド
- `vp install`: 依存関係のインストール

従来のように ESLint、Prettier、Vitest などを個別に選んで揃える負担はかなり減ります。ただし、React や UI ライブラリのようなアプリ本体の依存は、引き続きプロジェクト側で持ちます。

## インストール方法

現時点では、Vite+ 自体の公式な Homebrew 配布は見当たりませんでした。公式案内は次の形式です。

```bash
curl -fsSL https://vite.plus | bash
```

つまり `brew install vite` は通常の Vite を入れるもので、Vite+ の `vp` とは別です。

## `vp` を使うための前提

Vite+ は次の 2 つで成り立っています。

- グローバルの `vp` CLI
- 各プロジェクトに入る `vite-plus` パッケージ

そのため、`package.json` に `vite-plus` が入っているだけでは、ターミナルで `vp` コマンドは使えません。まずローカル PC 側に `vp` を導入する必要があります。

逆に、`vp` だけ PC に入っていても、プロジェクト側に `vite-plus` がなければ、そのプロジェクトで Vite+ の構成を前提にした開発は完結しません。

実務上は、次の理解で問題ありません。

- PC 側: `vp` コマンドを使えるようにする
- プロジェクト側: `vite-plus` を依存として持つ

## 新しいバージョンが出たときの更新方法

Vite+ はグローバル CLI とプロジェクト依存を別々に更新できます。

### グローバルの `vp` を更新

```bash
vp upgrade
```

### プロジェクトの `vite-plus` を更新

```bash
vp update vite-plus
```

明示的に最新版へ寄せたい場合は、次のようにしてもよいです。

```bash
vp add vite-plus@latest
```

つまり、ローカル PC に入れた `vp` もアップデート可能ですし、各リポジトリの `vite-plus` も別で更新できます。

## Node バージョン管理

Vite+ は `vp env` により Node.js のバージョン管理を行えます。

よく使う例:

```bash
vp env pin lts
vp env install
vp env current
```

## Bun 対応について

今回確認した範囲では、Vite+ が公式に管理対象としているのは Node.js です。パッケージマネージャーも `pnpm` / `npm` / `yarn` が前提で、Bun を Vite+ のランタイム管理や依存管理に統合する説明は見当たりませんでした。

そのため、現時点では次の理解が安全です。

- Node.js 管理: `vp env`
- 依存管理: `vp install` などで `pnpm` / `npm` / `yarn`
- Bun: Vite+ の公式な統合対象ではなさそう

## Oxlint のルールカスタム方法

Vite+ では、Oxlint の設定は `vite.config.ts` の `lint` ブロックにまとめるのが推奨です。`.oxlintrc.json` や `oxlint.config.ts` を別で持つより、Vite+ 側の設定に寄せたほうが管理しやすいです。

例:

```ts
import { defineConfig } from "vite-plus";

export default defineConfig({
  lint: {
    ignorePatterns: ["dist/**"],
    options: {
      typeAware: true,
      typeCheck: true,
    },
    categories: {
      suspicious: "warn",
      pedantic: "off",
    },
    rules: {
      "no-console": "warn",
    },
    overrides: [
      {
        files: ["**/*.test.ts"],
        rules: {
          "no-console": "off",
        },
      },
    ],
  },
});
```

このリポジトリでも、すでに `lint.options` は有効化されています。

## React はどう導入するか

結論として、React を使いたい場合は「手動導入しかない」わけではありません。Vite+ の `vp create` から、Vite の React テンプレートを使えます。

React + TypeScript の新規作成例:

```bash
vp create vite -- --template react-ts
```

このコマンドは、Vite のテンプレート選択を Vite+ 経由で forward している形です。

## React テンプレートで ESLint パッケージが入る件

React テンプレートで作成したプロジェクトでは、`eslint` や `eslint-plugin-react-hooks`、`eslint-plugin-react-refresh` などが自動で入ることがあります。

ただし、これらがそのまま Oxlint に適用されるわけではありません。

考え方としては次のとおりです。

- `vp lint` / `vp check`: Vite+ 経由で Oxlint が動く
- `eslint .` や `vp run lint`: `package.json` のスクリプト経由で ESLint が動く

つまり、React テンプレート直後の状態では、Oxlint 用の設定と ESLint 用の設定が同居していることがあります。

そのため、`eslint-plugin-react-hooks` や `eslint-plugin-react-refresh` は、通常は ESLint 側で使われるものであり、Oxlint に自動変換されているわけではない、と理解しておくのが安全です。

もし Vite+ に寄せて整理したい場合は、ESLint 関連パッケージと `eslint.config.*` を外し、lint を `vp lint` / `vp check` に寄せる方針を検討できます。ただしその場合、React 特有のルールを Oxlint 側でどこまでカバーできるかは個別に確認が必要です。

## monorepo で作りたい場合

Vite+ には monorepo 用の組み込みテンプレートがあります。

```bash
vp create vite:monorepo
```

対話式で選びたい場合は、次のようにして開始してもよいです。

```bash
vp create
```

この場合、プロンプトの中で monorepo テンプレートを選ぶ形になります。

React を monorepo で使いたい場合は、まず `vite:monorepo` で土台を作り、その後に app や package を追加していく流れを考えるのが自然です。

## 既存リポジトリに対する考え方

今の `vite-plus-research` は、Vite+ の土台はあるものの、React 依存はまだ入っていない状態です。そのため、選択肢は次の 2 つです。

1. 新しく React テンプレートで作る
2. この既存プロジェクトに React を手動で追加する

新規に始めるなら、通常はテンプレートを使うほうが自然です。既存の構成や履歴を活かしたい場合は、現在のプロジェクトへ React を追加していく形になります。

## まとめ

- Vite+ は `vp` で開発フローをまとめて扱える
- Homebrew ではなく、公式スクリプトで入れる想定
- `vp` を使うには、PC 側のグローバル CLI とプロジェクト側の `vite-plus` の両方を意識する
- グローバルの `vp` は `vp upgrade` で更新できる
- プロジェクトの `vite-plus` は `vp update vite-plus` などで更新できる
- Node.js のバージョン管理はできる
- Bun の公式統合は、現時点では見当たらない
- Oxlint のカスタムは `vite.config.ts` の `lint` に書く
- React は `vp create vite -- --template react-ts` でテンプレート作成できる
- React テンプレートでは ESLint 関連パッケージが入ることがあり、Oxlint とは別系統で動く場合がある
- monorepo は `vp create vite:monorepo` で作成できる

