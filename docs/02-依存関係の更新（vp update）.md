# 依存関係の更新（vp update / vp outdated）

記録日: 2026-10-07 / 対象: `vite-plus@1.0.0`、pnpm 12.9.1

`vp create` で作ったプロジェクトの `package.json` に `react: ^19.2.8` と書かれていた。最新は 19.3.0 なので古いように見えたが、実際には最新版がインストールされていた。このズレの理由と、`vp update` の使い分けをまとめる。

## まとめ

```bash
vp outdated                 # 1. 更新できるパッケージを確認する（何も変更しない）
vp update                   # 2. 範囲内で更新する。package.json の下限も引き上げられる
vp update -L <パッケージ名>   # 3. メジャーバージョンの更新は、パッケージを指定して個別に行う
```

- `vp update -L` を、パッケージを指定せずに全部へかけない（理由は後述）
- Vite+ 本体（`vite` / `vite-plus`）は `vp update` ではなく、`vp upgrade` → `vp migrate` の順で更新する

## package.json のバージョン表記は「範囲」

`package.json` に書かれているのは、**インストールしてよいバージョンの範囲**。インストールされているバージョンそのものではない。

| 表記       | 意味                    | 例: 許可される範囲         |
| ---------- | ----------------------- | -------------------------- |
| `^19.2.8`  | メジャーバージョンを固定 | 19.2.8 以上、20.0.0 未満    |
| `~6.0.2`   | マイナーバージョンまで固定 | 6.0.2 以上、6.1.0 未満      |
| `1.0.0`    | 完全に固定               | 1.0.0 のみ                  |

インストール時には範囲内の最新が選ばれ、その結果は lockfile（`pnpm-lock.yaml`）に記録される。**実際に何が入っているかは、lockfile か `vp list` で確認する。** ここは npm の `^` / `~` と全く同じ仕組み。

今回のケースでは、create-vite のテンプレートに書かれていた `^19.2.8` がそのまま残っていた。しかしインストール時に範囲内の最新である 19.3.0 が選ばれていたので、`vp list` で見ると最新が入っていた。

```text
dependencies:
├── react@19.3.0          ← package.json は ^19.2.8
├── react-dom@19.3.0
```

## `vp update` の正体

`vp` は `devEngines.packageManager` などからプロジェクトのパッケージマネージャーを判定し、そのパッケージマネージャーの更新コマンドに処理を渡す。このプロジェクトでは pnpm 12.9.1 の `update` が動く（実行ログに `Done in 1.5s using pnpm v12.9.1` と出る）。npm・Yarn・Bun のプロジェクトでも、同じ `vp update` で済む。

| コマンド                     | 更新の範囲                       | `package.json`                       | 主な用途                       |
| ---------------------------- | -------------------------------- | ------------------------------------ | ------------------------------ |
| `vp outdated`                | -（確認のみ）                    | 変更しない                           | 更新の前に確認する              |
| `vp update`                  | 範囲内で最新                     | 下限を、入っているバージョンまで引き上げる | 普段の更新                     |
| `vp update <パッケージ名>`     | 指定したパッケージだけ、範囲内で最新 | 指定したパッケージだけ書き換える        | 特定のパッケージだけ更新する     |
| `vp update -L <パッケージ名>`  | 範囲を無視して最新               | 書き換える（`^` / `~` の記号は残る）    | メジャーバージョンを上げる       |
| `vp update -L`               | 全パッケージを範囲無視で最新      | 全部書き換える                        | **使わない**                    |
| `vp update -i`               | 対話形式で選ぶ                   | 選んだものだけ                        | 見ながら選びたいとき            |
| `vp update --no-save`        | 範囲内で最新                     | 変更しない（lockfile だけ更新する）     | `package.json` を触りたくないとき |

TS/npm で言えば、`vp update -L` は `npx npm-check-updates -u` と依存関係のインストールを一度に行うイメージ。

### `vp update` の後に `vp install` は必要？ → 不要

`vp update` は、次の 3 つを 1 回でまとめて行う。

1. バージョンの解決
2. `package.json` と lockfile の書き換え
3. `node_modules` への反映

そのため、後から `vp install`（`pnpm install`）をやり直す必要はない。確認した結果:

- `vp update` の直後に `node_modules/react/package.json` を見ると、すでに 19.3.0 になっていた
- `vp install --frozen-lockfile` を実行しても `Lockfile is up to date, resolution step is skipped` と出て、何も変わらなかった
- スクラッチ環境で `vp update -L` を実行した直後も、`node_modules/@types/node` はすでに 26.6.4 になっていた

`vp add` / `vp remove` も同じで、インストールまで自動で行う。`vp install` が必要になるのは、**`package.json` や lockfile が `vp` 以外の方法で変わったとき**。

| 状況                                         | `vp install` が必要か |
| -------------------------------------------- | -------------------- |
| `vp update` / `vp add` / `vp remove` の後       | 不要                 |
| `package.json` を手で編集した後                | 必要                 |
| `git pull` やブランチ切り替えで lockfile が変わった後 | 必要                 |
| リポジトリを clone した直後                    | 必要                 |

## 実行結果（このリポジトリ、2026-10-07）

`vite-plus-react/` で `vp update` を実行した結果の `package.json` の差分:

| パッケージ             | 変更前     | 変更後     |
| ---------------------- | ---------- | ---------- |
| react / react-dom      | `^19.2.8`  | `^19.3.0`  |
| @types/react           | `^19.2.18` | `^19.3.0`  |
| @types/react-dom       | `^19.2.7`  | `^19.3.0`  |
| @vitejs/plugin-react   | `^6.1.1`   | `^6.1.2`   |
| @types/node            | `^24.13.3` | `^24.19.1` |
| typescript             | `~6.0.2`   | `~6.0.3`   |

- `^` のパッケージは、すでに入っていたバージョンまで下限が引き上げられただけ。インストールされるもの自体は変わらない（lockfile の差分も specifier の行だけ）
- `typescript` は `~` なので 6.0 系の中でしか上がらず、7 系にはならない
- `@types/node` は `^` なので 24 系の中でしか上がらず、26 系にはならない（これが正しい挙動。後述）

### `package.json` は変わらず、lockfile だけ変わることがある

Testing Library を追加してコミットした後、もう一度 `vp update` を実行すると、`package.json` には差分が無く、`pnpm-lock.yaml` だけが変わった。

```text
@testing-library/jest-dom が使う aria-query: 5.3.0 → 5.3.2
```

`aria-query` は直接インストールしたパッケージではなく、Testing Library が使っている**間接依存（依存の依存）**。`vp update` は直接の依存だけでなく、間接依存も範囲内の最新に解決し直す。

| 依存元                       | `aria-query` の指定 | `vp update` 前 | `vp update` 後 |
| ---------------------------- | ------------------- | -------------- | -------------- |
| `@testing-library/dom`       | `5.3.0`（完全固定） | 5.3.0          | 5.3.0          |
| `@testing-library/jest-dom`  | `^5.0.0`            | 5.3.0          | **5.3.2**      |

**なぜ追加したときは 5.3.0 だったのか**: `aria-query` 5.3.2 が公開されたのは 2024-09 で、`vp add` を実行したときにはすでに存在していた。それでも 5.3.0 が選ばれたのは、pnpm がインストール時に「すでに選ばれているバージョンが範囲を満たすなら、それを使い回して重複を避ける」ため。`@testing-library/dom` が 5.3.0 を完全固定で要求しているので、`^5.0.0` の jest-dom もそれに相乗りしていた。

`vp update` は「範囲内の最新」を優先して解決し直すので、jest-dom 側だけ 5.3.2 になった。その結果、lockfile には 5.3.0 と 5.3.2 の 2 つが入っている。

- 更新後も `vp test` / `vp check` は成功した
- 「新しいパッチを取り込む」か「重複を避ける」かのトレードオフだが、どちらも範囲内なので、`vp update` の結果をそのままコミットしてよい
- 間接依存のバージョンは `vp why <パッケージ名>` で、誰がどの範囲で要求しているかを確認できる

## `vp update -L` を全パッケージにかけない理由

スクラッチ環境で `vp update -L` を実行して確認した結果:

| パッケージ   | 変更前      | `-L` 実行後  | 問題                                 |
| ------------ | ----------- | ------------ | ------------------------------------ |
| @types/node  | `^24.13.3`  | `^26.6.4`    | Node.js 本体は 24 なのに、型だけ 26 になる |
| typescript   | `~6.0.2`    | `~7.0.2`     | メジャーバージョンアップが勝手に混ざる     |

### `@types/node` は Node.js 本体のメジャーバージョンに合わせる

`@types/node` は Node.js の API の型定義で、メジャーバージョンは Node.js 本体と対応している。Node.js 24 で動かしているのに 26 の型を入れると、26 で追加された API を使っても型チェックは通ってしまう。そして実行すると、Node.js 24 にはその API が無いので落ちる。

そのため `@types/node` は、`.node-version`（このリポジトリでは 24.21.0）と同じメジャーバージョンの範囲（`^24.x`）にとどめる。Node.js 本体を 26 に上げるときに、一緒に上げる。

### メジャーバージョンアップは 1 つずつ意図して行う

メジャーバージョンアップには破壊的変更が含まれる可能性がある。全部をまとめて上げると、何かが壊れたときにどのパッケージが原因か分からなくなる。`vp outdated` で確認してから、`vp update -L <パッケージ名>` で 1 つずつ上げ、そのたびに `vp check` / `vp test` / `vp run build` で確認する。

## TypeScript が `^` ではなく `~` になっている理由

TypeScript は semver（セマンティックバージョニング）に厳密には従っておらず、**マイナーバージョンアップ（例: 5.8 → 5.9）でも型チェックの結果が変わる変更が入ることがある**。そのため、テンプレートでは `^` ではなく `~` にして、パッチ更新だけを自動で受け入れるようにしている。

TypeScript 7 に上げる方法は 2 つある。

```bash
vp update -L typescript         # → "~7.0.2"（~ が残る。7.0.x のパッチだけ自動で上がる）
vp add -D typescript@^7.0.2     # → "^7.0.2"（7.x のマイナー更新も自動で上がる）
```

上の理由から、テンプレートの方針に合わせるなら `vp update -L typescript`（`~` を維持）がおすすめ。

## Vite+ 本体（`vite` / `vite-plus`）は別の方法で更新する

`vite` と `vite-plus` は `package.json` で `catalog:` を参照していて、実際のバージョンは `pnpm-workspace.yaml` に**完全固定**で書かれている。

```yaml
catalog:
  vite: npm:@voidzero-dev/vite-plus-core@1.0.0
  vite-plus: 1.0.0
overrides:
  vite@*: "catalog:"
```

`vite` は本物の Vite ではなく、`@voidzero-dev/vite-plus-core` の別名（エイリアス）になっている。`vite-plus` と `vite-plus-core` はバージョンを揃える必要がある。さらに、プロジェクトに Vitest の固定（`vitest` の override）がある場合は、それも Vite+ 同梱のバージョンに合わせる必要がある。これを手作業で揃えるのは事故のもとなので、公式では次の手順が推奨されている。

```bash
vp upgrade     # 1. グローバルの vp を更新する
vp migrate     # 2. プロジェクトの vite-plus・vite のエイリアス・vitest の固定を、グローバルの vp に揃える
vp install
```

`vp migrate` は、すでに Vite+ になっているプロジェクトに対しては、ツールチェーンのバージョン合わせだけを行う。フックやエディタの設定などの初回セットアップはやり直さない（やり直したいときは `--full` を付ける）。

TS/npm で言えば、Vite+ 本体は `npm update` で上げるものではなく、Next.js の codemod（`npx @next/codemod upgrade`）のように専用のアップグレード手順を使うもの、と考えると近い。

### なぜ `vite` / `vite-plus` だけが catalog 参照なのか

`package.json` では `vite` と `vite-plus` だけが `catalog:` を参照していて、react などは普通のバージョン範囲で書かれている。これは **Vite+ の仕様どおり**。

**誰が catalog を作ったのか**: create-vite の `react-ts` テンプレート（GitHub の main ブランチ）には、`"vite": "^8.3.1"` と `"oxlint"` が普通に書かれているだけで、catalog は使っていない。`vp create` は create-vite を実行した**後**に、次の処理を行っている。

- `vite` を `catalog:` 参照に書き換える
- `vite-plus` を `catalog:` 参照で追加する
- `pnpm-workspace.yaml` を作る
- `oxlint` を消して、設定を `vite.config.ts` に統合する

公式の [Migration Rules](https://viteplus.dev/guide/migrate-rules) にも、次のように書かれている。

- パッケージマネージャーが catalog に対応していれば（pnpm 9.5.0 以降、Yarn、Bun のワークスペース）、Vite+ のツールチェーン（`vite-plus`、`vite`、必要な場合は `vitest`）を catalog 参照にする
- 使える catalog が無ければ、新しく作る
- catalog が使えない場合（npm、単体の Bun プロジェクトなど）は、具体的なバージョンを直接書く

#### catalog を使う 3 つの理由

1. **`vite` と `vite-plus` を同じリリースに揃えるため**: `vite` の正体は `@voidzero-dev/vite-plus-core` なので、`vite-plus` と同じリリースでなければならない。catalog にまとめておけば、`vp migrate` は `pnpm-workspace.yaml` の値だけを書き換えればよい。モノレポでは、`catalog:` を参照している全パッケージがまとめて揃う。
2. **依存の依存まで Vite+ の `vite` に差し替えるため**: `overrides` の `vite@*: "catalog:"` は、`@vitejs/plugin-react` が peer として要求する `vite` のような**依存の依存**まで、vite-plus-core に差し替える設定。差し替え先を catalog にしておけば、バージョンを書く場所が 1 か所で済む。
   - キーが `vite` ではなく `vite@*` になっているのにも理由がある。素の `vite` だと `catalog:` という参照そのものにもマッチしてしまい、`vp update` で具体的なバージョンに書き換えられてしまう。`@*` を付けると、semver の範囲で書かれた依存にだけ効く。**`vp update` を実行しても `vite` / `vite-plus` が変わらなかったのは、この仕組みのおかげ。**
3. **pnpm 11 以降は `package.json` の `"pnpm"` フィールドを読まないため**: overrides は `pnpm-workspace.yaml` に書くしかない。そのため、ワークスペースを使わない単体のプロジェクトでも `pnpm-workspace.yaml` が作られる。0.1 系のプロジェクト（pnpm 10）では、`package.json` の `"pnpm": { "overrides": ... }` に書かれていた。

#### react などが catalog 参照ではない理由

Vite+ が責任を持つのは**自分のツールチェーンだけ**。react などのアプリの依存はユーザーの管理範囲なので、テンプレートが書いた内容に手を付けない。

Gradle で言えば、catalog は Version Catalog（`libs.versions.toml`）とほぼ同じ考え方。Vite+ は、自分のパッケージの分だけを toml に登録した状態と言える。

**react なども catalog に寄せるべきか**: アプリが 1 つだけの今は不要。catalog が本当に役に立つのは、モノレポで複数パッケージのバージョンを揃えるとき。今の「Vite+ の分だけが catalog」という混在した状態が、Vite+ の意図した形。

## 関連: プロジェクトの中では npm コマンドが拒否される

`vite-plus-react/` の中で `npm view react` を実行すると、次のエラーになる。

```text
npm error EBADDEVENGINES Invalid devEngines.packageManager
npm error EBADDEVENGINES Invalid name "pnpm" does not match "npm" for "packageManager"
```

npm 11 は `package.json` の `devEngines.packageManager` を読み、「このプロジェクトは pnpm 用」と宣言されていると、npm 自身の実行を止める。うっかり `npm install` して lockfile が 2 種類できてしまう事故を防ぐためのガードになっている。

プロジェクトの中でパッケージの情報を見たいときは、`vp info react` を使う（`vp` がプロジェクトのパッケージマネージャーで実行してくれる）。

## 参考

- [Package Management（vp install / update / outdated）](https://viteplus.dev/guide/install)
- [Update Vite+（vp migrate による更新）](https://viteplus.dev/guide/upgrade-project)
- [Upgrading Vite+（vp upgrade）](https://viteplus.dev/guide/upgrade)
- [Migration Rules（catalog・overrides の扱い）](https://viteplus.dev/guide/migrate-rules)
- [pnpm: Configuring（pnpm 11 以降の設定ファイル）](https://pnpm.io/configuring)
