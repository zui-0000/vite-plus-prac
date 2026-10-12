# Vite+ のモノレポ構成（React + Hono + Bun）

記録日: 2026-10-13 / 対象: `vite-plus` 1.1.0、pnpm 12.11.2、Bun 1.4.3、Hono 4.13.13

React のフロントエンドと Hono の API を、pnpm ワークスペースのモノレポにまとめられるかを調べた。API は Bun で動かし、Vite+ のツール群と React の開発サーバーは Node.js で動かす想定。このリポジトリには作らず、スクラッチ環境で試した。

## まとめ

- Vite+ は pnpm ワークスペースのモノレポに対応している。`vp create vite:monorepo` でひな形を作れる
- lint・format の設定は、ルートの `vite.config.ts` に 1 つだけ置く。一部のパッケージだけに効かせたいルールは `lint.overrides` で書く
- タスクは `vp run -r`（全パッケージ）や `vp run --filter`（書き方は pnpm と同じ）で実行する。結果はキャッシュできる
- Bun は pnpm に管理させる。`vp env` が管理するのは Node.js とパッケージマネージャーだけなので、API のパッケージの `devEngines.runtime` に Bun を書き、pnpm にダウンロードさせる
- Node.js のバージョンは、`.node-version` を使わずに、ルートの `package.json` の `devEngines.runtime` に `onFail: "error"` で書く。pnpm と Node.js の指定が `package.json` 1 つにまとまり、Bun の固定とも両立する
- 注意点が 3 つある
  - `vp test`（Vitest）は Node.js で動く。Hono のコードは Web 標準の API で書き、Bun 専用の API は起動用のファイルに閉じ込める
  - フロントに型を渡すファイル（`AppType` を export するファイル）から Bun の API を参照すると、フロントの `tsc` が失敗する
  - **TypeScript 7 の `tsc` は、`vp run` のキャッシュの自動追跡が効かない**。ソースを変えてもキャッシュが使われ、型エラーを見逃す

## 構成と役割分担

```text
.
├── package.json          # devEngines（pnpm と Node.js のバージョン）
├── pnpm-workspace.yaml   # packages: apps/*, packages/*
├── vite.config.ts        # lint・format・キャッシュの設定（全体で 1 つ）
├── apps/
│   ├── web/              # React（Vite）。Node.js で動く
│   └── api/              # Hono。Bun で動く
└── packages/             # 共有するコード（必要になったら）
```

| 役割                                                            | 担当    | バージョンの固定方法                                   |
| --------------------------------------------------------------- | ------- | ------------------------------------------------------ |
| パッケージ管理・ワークスペース                                  | pnpm    | ルートの `package.json` の `devEngines.packageManager` |
| Vite+ のツール群（Vite・Vitest・Oxlint）と React の開発サーバー | Node.js | ルートの `package.json` の `devEngines.runtime`        |
| Hono の API サーバー                                            | Bun     | `apps/api/package.json` の `devEngines.runtime`        |

TS/npm で言えば、pnpm ワークスペースと Turborepo を組み合わせた構成に近い。`vp run` が Turborepo の役割（依存順の実行とキャッシュ）を担う。

## `vp create vite:monorepo` が作るもの

`vp create --list` には、Vite+ 組み込みのテンプレートとして `vite:monorepo` / `vite:application` / `vite:library` / `vite:generator` が並んでいる。スクラッチ環境で次のコマンドを実行した。

```bash
vp create vite:monorepo --directory mono-tpl --no-interactive \
  --no-agent --no-editor --no-git --no-hooks --package-manager pnpm
```

```text
.
├── package.json
├── pnpm-workspace.yaml   # packages: apps/*, packages/*, tools/*
├── tsconfig.json
├── vite.config.ts
├── apps/
│   └── website/          # Vite のアプリ（素の TypeScript。React ではない）
└── packages/
    └── utils/            # ライブラリ。vp pack でビルドし、vp test でテストする
```

ルートの `vite.config.ts`:

```ts
import { defineConfig } from "vite-plus";

export default defineConfig({
  fmt: {},
  lint: {
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true, typeCheck: true },
  },
  run: {
    cache: true,
  },
});
```

ルートの `package.json` の scripts:

```json
{
  "ready": "vp check && vp run -r test && vp run -r build",
  "dev": "vp run website#dev"
}
```

気づいたこと:

- `pnpm-workspace.yaml` に `catalogMode: prefer` が入っている。`vp add` で追加した依存は catalog に書かれ、`package.json` には `catalog:` と書かれる。ワークスペース内のパッケージ（`vp add 'api@workspace:*'`）も、catalog に `api: workspace:*` として入った
- Node.js のバージョンは、ルートの `package.json` の `engines.node`（`>=22.18.0`）で範囲指定されているだけで、固定はされていない。固定するなら `devEngines.runtime` に書く（「Node.js のバージョンをどこに書くか」を参照）
- `run.cache: true` によって、`package.json` の scripts もキャッシュされる（既定ではキャッシュされない。後述）
- 今回は React のアプリは作らず、`apps/website` をフロントの代わりに使った

## lint・format の設定はルートに 1 つ

lint と format の設定は、ルートの `vite.config.ts` に置く。React 用のルールのように一部のパッケージだけに効かせたいものは、`lint.overrides` で対象のパスを絞る。

```ts
lint: {
  // ...ルート全体の設定
  overrides: [
    {
      files: ["apps/website/**"],
      plugins: ["react"],
      rules: { "react/rules-of-hooks": "error" },
    },
  ],
},
```

`apps/website` と `apps/api` に、条件付きで Hook を呼ぶ同じコードを置いて `vp check` を実行すると、`apps/website` だけが `react-hooks(rules-of-hooks)` で検出された。各パッケージのフォルダで `vp check` を実行しても、ルートの設定（`overrides` を含む）が使われた。

TS/npm で言えば、ESLint の flat config で `files: ["apps/web/**"]` を指定するのと同じ。

このリポジトリの `frontend/vite.config.ts` にある React Compiler 系のルール（`05-React Compiler（Rust 版）の導入.md` を参照）も、モノレポにするなら `overrides` に移すことになる。

## `vp run` でタスクを実行する

| コマンド                                              | 意味                                            | pnpm で言えば                   |
| ----------------------------------------------------- | ----------------------------------------------- | ------------------------------- |
| `vp run -r build`                                     | 全パッケージの `build` を、依存の順番に実行する | `pnpm -r build`                 |
| `vp run --filter website build`                       | 指定したパッケージだけ実行する                  | `pnpm --filter website build`   |
| `vp run website#dev`                                  | `パッケージ名#タスク名` で 1 つを指定する       | -                               |
| `vp run -t build`                                     | 今のパッケージと、その依存パッケージを実行する  | `pnpm --filter <名前>... build` |
| `vp run --parallel --filter website --filter api dev` | 依存の順番を無視して同時に実行する              | `pnpm -r --parallel dev`        |

`--filter` の書き方は pnpm と同じ（`./apps/*`、`web...`、`...utils`、`!api` など）。

**オプションはタスク名より前に書く**: `vp run --filter website build --no-cache` のようにタスク名の後に書くと、`vp run` のオプションではなく、タスクへの引数として渡される。このときは `vp build --no-cache` が実行され、`Unknown option --cache` で失敗した。

### 開発サーバーをまとめて起動する

```bash
vp run --parallel --filter website --filter api dev
```

```text
~/apps/api$ bun --hot src/index.ts
~/apps/website$ vp dev ⊘ cache disabled

  VITE+ v1.1.0

  ➜  Local:   http://localhost:5173/
Bun 1.4.3 で起動しました
Started development server: http://localhost:3999
```

フロント（`http://localhost:5173/`）と API（`http://localhost:3999/hello`）の両方に応答があった。

- `vp dev` は `cache disabled` と表示され、キャッシュの対象から外れる
- `bun --hot` のように終わらないコマンドも、キャッシュの心配はない。キャッシュが保存されるのは、タスクが終了コード 0 で終わったときだけなので

## キャッシュ

`vp run` は、タスクが成功すると出力を保存する。次の実行で入力が変わっていなければ、タスクを実行せずに保存した出力を再生する。

| 設定（ルートの `run.cache`） | 既定値  | 意味                                       |
| ---------------------------- | ------- | ------------------------------------------ |
| `scripts`                    | `false` | `package.json` の scripts をキャッシュする |
| `tasks`                      | `true`  | `run.tasks` に書いたタスクをキャッシュする |

テンプレートはルートに `run: { cache: true }` と書いているので、scripts もキャッシュされる。2 回目の `vp run -r build` は `3/3 cache hit (100%), 2.82s saved` になった。

このリポジトリの `frontend/` は `run` を設定していないので、`vp run build` は `cache disabled` と表示され、キャッシュされない。

### キャッシュの入力は自動で追跡される

`cache.input` を書かなければ、タスクが読んだファイルを自動で記録し、それが変わったら実行し直す（公式ドキュメントの「Automatic Data Tracking」）。`apps/website/src/main.ts` を変えると、`vp build` は `cache miss: 'apps/website/src/main.ts' modified` と表示して実行し直した。

### TypeScript 7 の `tsc` は自動追跡が効かない

ここが一番の落とし穴。テンプレートの `apps/website` の `build` は `tsc && vp build` なので、`tsc` もキャッシュされる。ところが、ソースを変えても `tsc` はキャッシュが使われた。

| 変更したもの                                                  | `tsc`                             | `vp build`                                      |
| ------------------------------------------------------------- | --------------------------------- | ----------------------------------------------- |
| `apps/website/src/main.ts`                                    | cache hit（実行されない）         | cache miss（実行し直す）                        |
| `apps/website/src/api.ts`                                     | cache hit                         | cache hit（`main.ts` から import されていない） |
| `apps/api/src/app.ts`（フロントが使うレスポンスの型を壊した） | cache hit。**型エラーを見逃した** | cache hit                                       |

キャッシュを使わずに実行すると（`vp run --no-cache --filter website build`）、`tsc` は型エラー（TS2339）で失敗した。キャッシュが無ければ検出できるエラーを、キャッシュのせいで見逃している。

キャッシュの中身（`node_modules/.vite/task-cache/v18/cache.db`）を見ると、`vp build` や `vp test` の記録にはソースファイルのパスが入っていたが、`tsc` の記録には 1 つも入っていなかった。

原因は特定していない。TypeScript 7 の `tsc` は、Node.js のスクリプト（`typescript/lib/tsc.js`）が Go 製のネイティブバイナリ（`@typescript/typescript-darwin-arm64`）を `execFileSync` で起動する作りになっている。`node node_modules/typescript/bin/tsc` で直接起動しても同じだったので、`node_modules/.bin/tsc`（sh のスクリプト）のせいではない。ネイティブバイナリが読んだファイルが記録されていないのだと考えている。公式ドキュメントは自動追跡の例に `command: 'tsc'` を挙げているので、想定外の動きだと思われる。

#### 対策: `tsc` をキャッシュしない

`tsc` と `vp build` を別のタスクに分けて、`tsc` だけキャッシュを切る。`vp build` は自動追跡が効くので、キャッシュしたままでよい。

```ts
// apps/website/vite.config.ts
import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      typecheck: {
        command: "tsc",
        cache: false,
      },
      build: {
        command: "vp build",
        dependsOn: ["typecheck"],
      },
    },
  },
});
```

- `package.json` の scripts に同じ名前（`build`）があると、`Task website#build conflicts with a package.json script of the same name` というエラーになる。scripts 側の `build` は消す
- この設定で API の型を壊すと、`tsc` が毎回実行されて TS2339 を検出し、`vp build` は実行されなかった

`tsc` が遅くなってキャッシュしたくなったら、`cache.input` で入力を明示する方法もある。`base: "workspace"` を使うと、ほかのパッケージのファイルをワークスペースのルートからのパスで指定できる。

```ts
typecheck: {
  command: "tsc",
  cache: {
    input: ["src/**", "tsconfig.json", { pattern: "apps/api/src/**", base: "workspace" }],
  },
},
```

この設定で `apps/api/src/app.ts` を変えると、`cache miss: 'apps/api/src/app.ts' modified` になった。ただし、依存するパッケージを増やすたびに `input` も直す必要がある。

## Bun は pnpm に管理させる

`vp env --help` の説明は「Manage Node.js and package-manager environments」で、`vp env` が管理するランタイムは Node.js だけ。Bun は、パッケージマネージャーとしてしか扱われない。

一方 pnpm は、`package.json` の `devEngines.runtime` に書かれたランタイムを、そのパッケージ用にダウンロードする。

```json
// apps/api/package.json
{
  "devEngines": {
    "runtime": { "name": "bun", "version": "1.4.3", "onFail": "download" }
  }
}
```

`vp install` を実行すると、次のようになった。

- pnpm 12.11.2 が Bun 1.4.3 をダウンロードし、`apps/api/node_modules/.bin/bun` に置いた
- lockfile では、Bun が `apps/api` の devDependencies（`runtime:1.4.3`）として記録された。OS・CPU ごとのダウンロード URL とハッシュ値も記録されるので、CI でも同じ Bun が入る

```yaml
# pnpm-lock.yaml（抜粋）
importers:
  apps/api:
    devDependencies:
      bun:
        specifier: runtime:1.4.3
        version: runtime:1.4.3

packages:
  bun@runtime:1.4.3:
    resolution:
      type: variations
      variants:
        - resolution:
            archive: zip
            bin: bun
            integrity: sha256-gK/UwGm0am+o8+xSC+vHUKeEPkqNW5WD0prUNsAKNAM=
            prefix: bun-darwin-aarch64
            type: binary
            url: https://github.com/oven-sh/bun/releases/download/bun-v1.4.3/bun-darwin-aarch64.zip
          targets:
            - cpu: arm64
              os: darwin
        # ...ほかの OS・CPU
```

`apps/api` のスクリプトの中では、`bun` は 1.4.3、`node` はルートで指定した 24.21.0 になった。Bun と Node.js がパッケージごとに使い分けられている。

```text
$ vp run --no-cache --filter api which   # "which": "bun --version && node --version"
~/apps/api$ bun --version
1.4.3
~/apps/api$ node --version
v24.21.0
```

`apps/api` で `vp env current` を実行しても、`vp` が使う Node.js はルートで指定したもののままだった。`devEngines.runtime` に Bun を書いても、`vp` の Node.js の管理とぶつからない。

TS/npm で言えば、Volta の `volta.node` のようなランタイムの固定を、パッケージごとに書けるイメージ。`devEngines` は npm の公式フィールドで、`onFail: "download"` で実際にダウンロードしてくれるのが pnpm の機能。

## Node.js のバージョンをどこに書くか

`.node-version` は必須ではない。`package.json` の `devEngines.runtime` でも固定できる。`vp env pin` も、`package.json` がある場所ではこちらに書くのが既定（`01-vite-plus-1.0でできること.md` の「プロジェクトへの固定方法」を参照）。

```json
// ルートの package.json
"devEngines": {
  "packageManager": { "name": "pnpm", "version": "12.11.2", "onFail": "download" },
  "runtime": { "name": "node", "version": "24.21.0", "onFail": "error" }
}
```

`devEngines.runtime` は `vp` も pnpm も読む。GitHub Actions の `setup-node` も、`node-version-file: package.json` を指定すると `devEngines.runtime` の Node.js を読む（[setup-node のドキュメント](https://github.com/actions/setup-node/blob/main/docs/advanced-usage.md#node-version-file)）。

### `onFail` を `"download"` 以外にする理由

pnpm 11 以降は、`devEngines.runtime` に Node.js があると、`vp` とは別に自分でも Node.js をダウンロードする。同じバージョンの Node.js を 2 か所に持つことになる。

これを止める方法として、`01-vite-plus-1.0でできること.md` では `pnpm-workspace.yaml` の `runtimeOnFail: ignore` を紹介した。しかしこの設定はワークスペース全体に効くので、**Bun のダウンロードまで止まる**。Vite+ のドキュメントにも「Bun や Deno の自動管理も無効になる」と書かれている。

スクラッチ環境のモノレポ（ルートで Node.js、`apps/api` で Bun を指定）で比べた。

| Node.js の固定方法                                          | pnpm が Node.js もダウンロードするか                                                            | `apps/api` の Bun                                                        |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| ルートの `.node-version`                                    | しない                                                                                          | 指定どおりダウンロードされる                                             |
| `devEngines.runtime`（`onFail: "download"`）                | **する**。lockfile に `node@runtime:24.21.0` が入り、スクリプトの `node` が pnpm 側のものになる | 指定どおりダウンロードされる                                             |
| 上に加えて `pnpm-workspace.yaml` に `runtimeOnFail: ignore` | しない                                                                                          | **ダウンロードされない**。1.3.9 を指定しても、`vp` が持つ 1.4.3 が動いた |
| `devEngines.runtime`（`onFail: "error"`）                   | しない                                                                                          | 指定どおりダウンロードされる                                             |

`onFail` は、`devEngines.runtime` のエントリーごとに書ける。Node.js のエントリーだけ `"download"` 以外にすれば、Node.js のダウンロードだけが止まり、`apps/api` の Bun（`"download"` のまま）はダウンロードされる。`onFail: "ignore"` でも同じ結果だった。

`"error"` にしておくと、`vp` を通さずに違うバージョンの Node.js で `pnpm install` を実行したときに止めてくれる（終了コード 1）。

```text
$ vp env exec --node 24.20.0 pnpm install
Error: ERR_PNPM_BAD_RUNTIME_VERSION

  × This project requires Node.js 24.21.0. Your current Node.js is v24.20.0
```

そのほかに確かめたこと:

- `vp env pin` でバージョンを変えても、`onFail: "error"` は書き換えられずに残った。`onFail` を手で書き換えるのは最初の 1 回だけでよい
- `apps/api` の `devEngines.runtime` は Bun なので、`vp` は Node.js の指定として扱わない。ルートの `package.json` までさかのぼり、`apps/api` でも Node.js 24.21.0 を使った
- スクリプトの中の `node` は、`vp` が持つ Node.js（`~/.vite-plus/js_runtime/node/24.21.0`）になった

### `engines.node` は固定に使わない

`engines.node` は、そのパッケージが動く Node.js のバージョン範囲を利用者に示すためのもの。Vite+ のドキュメントでも、`devEngines.runtime`（開発環境の要件）より優先度が低い。テンプレートの `>=22.18.0` のような範囲だと、手元にどのバージョンが入っているかで使われるバージョンが変わる。

### このリポジトリが `.node-version` のままでよい理由

このリポジトリは、ルートに `package.json` が無く、`frontend/` の中にしか無い。リポジトリ全体に効かせるには、ルートに置ける `.node-version` を使うしかない（`01-vite-plus-1.0でできること.md` の「別の方法: Node.js を `.node-version` で固定する」を参照）。モノレポはルートに `package.json` があるので、`devEngines.runtime` にまとめられる。

## Hono を Bun で動かす

Hono のアプリ本体（`app.ts`）と、Bun で起動するファイル（`index.ts`）を分ける。

```ts
// apps/api/src/app.ts（Web 標準の API だけで書く）
import { Hono } from "hono";

export const app = new Hono().get("/hello", (c) => c.json({ message: "hello" }));

export type AppType = typeof app;
```

```ts
// apps/api/src/index.ts（Bun 専用の処理はここに置く）
import { app } from "./app.ts";

export default {
  port: 3999,
  fetch: app.fetch,
};

console.log(`Bun ${Bun.version} で起動しました`);
```

```json
// apps/api/package.json（抜粋）
{
  "exports": { ".": "./src/app.ts" },
  "scripts": {
    "dev": "bun --hot src/index.ts",
    "start": "bun src/index.ts",
    "test": "vp test"
  },
  "devDependencies": { "@types/bun": "1.4.3" }
}
```

- Bun は、`fetch` を持つオブジェクトを `export default` すると、それをサーバーとして起動する。Hono の公式ドキュメントにある書き方
- `Bun.version` などの型は `@types/bun` から来る。`apps/api/tsconfig.json` の `types` に `"bun"` を書く
- `exports` で TypeScript のソースをそのまま公開している。フロントは API をビルドせずに型を import できる

**なぜファイルを分けるのか**: `app.ts` を Web 標準の API だけで書いておくと、Node.js で動く `vp test` でテストでき、フロントからも型を import できる。次の 2 つの節がその理由。

## `vp test` は Node.js で動く

Vitest は Node.js で動くので、`vp test` の中では `Bun` が使えない。Hono は `app.request()` でサーバーを起動せずにテストできるので、`app.ts` が Web 標準の API だけで書かれていれば問題ない。

```ts
// apps/api/src/app.test.ts
import { expect, test } from "vite-plus/test";
import { app } from "./app.ts";

test("GET /hello の場合、message を返すこと", async () => {
  const res = await app.request("/hello");
  expect(await res.json()).toEqual({ message: "hello" });
  expect(typeof (globalThis as { Bun?: unknown }).Bun).toBe("undefined");
});
```

このテストは成功した。2 つ目の `expect` で、テストが Bun ではなく Node.js で動いていることも確かめている。

`bun:sqlite` や `Bun.file` のような Bun 専用の API を使う部分は、`vp test` ではテストできない。テストするなら、その部分だけ `bun test` を使うことになり、テストランナーが 2 つになる。Bun 専用の API は DB 接続などの端に閉じ込めて、ロジックは Web 標準で書くのがよい。

## Hono RPC でフロントと型を共有する

モノレポにする一番のメリット。API の `AppType` をフロントから import すると、`hc`（Hono のクライアント）が API の型を知った状態で使える。

```ts
// apps/website/src/api.ts
import type { AppType } from "api";
import { hc } from "hono/client";

const client = hc<AppType>("http://localhost:3999");

export async function fetchMessage(): Promise<string> {
  const res = await client.hello.$get();
  const data = await res.json();
  return data.message;
}
```

フロントの `package.json` には、`hono` と `api`（`workspace:*`）を依存に追加する。`data.message` を `data.mesage` と書き間違えると、`vp check` が検出した。

```text
x typescript(TS2551): Property 'mesage' does not exist on type '{ message: string; }'. Did you mean 'message'?
```

API 側でレスポンスの形を変えると、フロントの型チェックで気づける。TS/npm で言えば、tRPC や OpenAPI の型生成と同じことを、生成の手順なしでできる。

### `AppType` から辿れるファイルで Bun の API を使わない

`app.ts` のルートの中で `Bun.version` を使ったところ、`vp check` は成功したが、フロントで `tsc` を実行すると失敗した。

```text
../api/src/app.ts(5,41): error TS2868: Cannot find name 'Bun'. Do you need to install type definitions for Bun? ...
```

- フロントの `tsc` は、`import type { AppType } from "api"` を辿って `apps/api/src/app.ts` も型チェックする。そのとき使われるのはフロントの `tsconfig.json` で、`bun` の型が入っていないのでエラーになる
- `vp check` は成功した。それぞれのファイルを、そのファイルが属するパッケージの `tsconfig.json` で型チェックしているのだと考えられる。つまり `vp check` だけでは気づけない

フロントの `tsconfig.json` に `"bun"` を足しても直るが、ブラウザで動くコードから `Bun` が見えてしまうのでよくない。Bun の API は、フロントから辿られない `index.ts` などに置く。

## その他気づいたこと

- `@types/bun@1.4.3` を追加したとき、pnpm が `pnpm-workspace.yaml` に次の設定を自動で追加した

  ```yaml
  minimumReleaseAgeExclude:
    - "@types/bun@1.4.3"
  ```

  pnpm 11 以降は、公開から 1 日（`minimumReleaseAge` の既定値 1440 分）たっていないバージョンを入れない。ただし、自分で `minimumReleaseAge` を設定していなければ厳格モード（`minimumReleaseAgeStrict`）はオフで、条件を満たすバージョンが無いときは新しいバージョンを入れ、その例外を `minimumReleaseAgeExclude` に記録する（[pnpm の設定](https://pnpm.io/settings/dependency-resolution#minimumreleaseage)）。今回は、公開から 1 日たっていない 1.4.3 をバージョン指定で追加したので、例外として記録された

## 新しく作るときのメモ

このリポジトリの構成からモノレポにするときに変わるところ。Git フックについては試していない。

| もの                        | このリポジトリ                         | モノレポ                                                             |
| --------------------------- | -------------------------------------- | -------------------------------------------------------------------- |
| lint・format の設定         | `frontend/vite.config.ts`              | ルートの `vite.config.ts`。React 用のルールは `overrides`            |
| Node.js のバージョン        | ルートの `.node-version`               | ルートの `package.json` の `devEngines.runtime`（`onFail: "error"`） |
| pnpm のバージョン・lockfile | `frontend/` の中                       | ルート                                                               |
| `tsc` のキャッシュ          | scripts をキャッシュしないので関係ない | `tsc` を `cache: false` のタスクにする                               |
| Git フック（`vp staged`）   | `frontend/` で実行                     | ルートで実行する（未検証）                                           |

## 参考

- [Monorepo（Vite+）](https://viteplus.dev/guide/monorepo)
- [Run（vp run）](https://viteplus.dev/guide/run)
- [Task Caching](https://viteplus.dev/guide/cache)
- [Automatic Data Tracking](https://viteplus.dev/guide/automatic-data-tracking)
- [Environment（vp env）](https://viteplus.dev/guide/env)
- [pnpm の devEngines.runtime](https://pnpm.io/package_json#devenginesruntime)
- [setup-node の node-version-file](https://github.com/actions/setup-node/blob/main/docs/advanced-usage.md#node-version-file)
- [Hono: Bun](https://hono.dev/docs/getting-started/bun)
- [Hono: RPC](https://hono.dev/docs/guides/rpc)
- [Hono: Testing](https://hono.dev/docs/guides/testing)
