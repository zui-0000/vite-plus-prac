# vp install と pnpm の関係

記録日: 2026-10-12 / 対象: `vite-plus@1.0.0`、pnpm 12.9.1

このリポジトリのパッケージマネージャーは pnpm だが、セットアップ手順では `pnpm install` ではなく `vp install` を使っている。`pnpm install` を別に実行する必要があるのか、`pnpm` を直接実行してもよいのかを調べた。

## まとめ

- `vp install` だけでよい。`pnpm install` を別に実行する必要はない
- `vp install` は自分でインストールしているのではなく、中で `pnpm install` を実行している。lockfile（`pnpm-lock.yaml`）も `node_modules` の構成も pnpm のもの
- `pnpm install` を直接実行しても、このマシンでは同じ pnpm 12.9.1 が動くので結果は同じ。ただし、PATH の状態によっては別のバージョンの pnpm が動く可能性があるので、`vp install` を使う
- `npm install` は `devEngines` によってエラーで止められる

## `vp install` の正体

`vp install` は次の流れで動く。

1. `package.json` などから、プロジェクトのパッケージマネージャーとバージョンを判定する
2. そのバージョンが手元に無ければダウンロードする
3. 判定したパッケージマネージャーの install コマンドに処理を渡す

`frontend/` で実行すると、pnpm 12.9.1 が動いていることがログで分かる。

```text
$ vp install
Already up to date
Done in 10ms using pnpm v12.9.1
```

`vp update` も同じ仕組みで動いている（`02-依存関係の更新（vp update）.md` の「`vp update` の正体」を参照）。

TS/npm で言えば、[`ni`](https://github.com/antfu-collective/ni) と corepack を組み合わせたもの。

- `ni` と同じく、プロジェクトを見て npm / Yarn / pnpm / Bun のどれを使うかを判定し、そのコマンドを実行する
- corepack と同じく、`package.json` で指定されたバージョンのパッケージマネージャーを用意する。ダウンロードした本体がハッシュ値と一致するかも検証する

### パッケージマネージャーの判定順

公式ドキュメントによると、次の順に調べて、最初に見つかったものを使う。

1. `package.json` の `packageManager`
2. `package.json` の `devEngines.packageManager`
3. `pnpm-workspace.yaml`
4. `pnpm-lock.yaml`
5. `yarn.lock` / `.yarnrc.yml`
6. `package-lock.json`
7. `bun.lock` / `bun.lockb`
8. `.pnpmfile.cjs` / `pnpmfile.cjs`
9. `bunfig.toml`
10. `yarn.config.cjs`

どれも見つからなければ pnpm を使う。`frontend/package.json` には `packageManager` が無く、`devEngines.packageManager`（pnpm 12.9.1）があるので、2 番目で決まる。

## `pnpm install` を直接実行するとどうなるか

`vp install` と `pnpm install` の違いは、**どのバージョンの pnpm を動かすかを誰が決めるか**にある。

| コマンド       | 動く pnpm の決まり方                                         |
| -------------- | ------------------------------------------------------------ |
| `vp install`   | `vp` が `devEngines.packageManager` を読んで決める（12.9.1） |
| `pnpm install` | シェルの PATH で最初に見つかった `pnpm` が動く               |

このマシンでは、`pnpm` を実行すると mise の shim から vp の shim へ処理が渡る。vp の shim は `devEngines` を読むので、12.9.1 が動く。これは `01-vite-plus-1.0でできること.md` の「対応内容」で、pnpm を managed モードにしたため。そのため、今は `pnpm install` を実行しても結果は同じになる。

ただし、PATH で別の pnpm が先に見つかる環境では結果が変わる。スクラッチ環境で `devEngines.packageManager` に pnpm 12.9.1 を指定し、mise で古い pnpm を直接実行して確かめた。

| 実行した pnpm             | 結果                                                                                                           |
| ------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 12.9.1（vp の shim 経由） | 12.9.1 でインストールする。lockfile に pnpm 自身のバージョンが記録される（後述）                               |
| 11.0.9                    | `devEngines` を読んで 12.9.1 に切り替えようとしたが、切り替え先の起動で `SyntaxError` になった（原因は未調査） |
| 10.27.0                   | `devEngines` を無視して、10.27.0 のままインストールした。lockfile に pnpm のバージョンは記録されない           |

pnpm を直接実行すると、PATH の状態によっては指定と違うバージョンが動く。`vp install` なら PATH に関係なく、指定どおりのバージョンが動く。これが `vp install` を使う理由。

### lockfile の先頭にある pnpm の記録

`frontend/pnpm-lock.yaml` は、`---` で区切られた 2 つの YAML ドキュメントでできている。

- 1 つ目: pnpm 12.9.1 自身のバージョン（`packageManagerDependencies`）と、OS・CPU ごとの本体のハッシュ値
- 2 つ目: 普段の依存関係

pnpm 12.9.1 は、`devEngines.packageManager` で指定された pnpm 自身も lockfile に記録する。npm で言えば、npm 本体のバージョンまで `package-lock.json` に書かれるイメージ。上の表のとおり、pnpm 10 はこの記録を書かない。

## `npm install` を実行するとどうなるか

`frontend/` の `package.json` などをスクラッチ環境にコピーし、`npm install` を実行すると、npm 11.19.0 は次のエラーで止まった。

```text
npm error EBADDEVENGINES Invalid devEngines.packageManager
npm error EBADDEVENGINES Invalid name "pnpm" does not match "npm" for "packageManager"
```

`devEngines` は npm 公式のフィールドなので、npm 自身もこれを読み、パッケージマネージャーが違えば止める。`package-lock.json` も `node_modules` も作られなかった。うっかり `npm install` を実行しても、lockfile が 2 つになる事故は起きない。

## `vp` に無いコマンドは `vp pm` で pnpm に渡す

`vp` には `install` / `add` / `update` などの主なコマンドがそろっている。それ以外の pnpm 固有のコマンドは、`vp pm` を付けるとそのまま pnpm に渡せる。

```bash
vp pm audit            # pnpm audit
vp pm approve-builds   # pnpm approve-builds
```

`vp pm audit` を実行すると、pnpm の audit の結果（`No known vulnerabilities found`）が表示された。

## `vp install -g` は pnpm のグローバルとは別

`vp install -g <パッケージ名>` は、pnpm のグローバル（`pnpm add -g`）には入らない。Vite+ が独自に管理する場所に入る。公式ドキュメントにも「パッケージマネージャーのグローバルのインストール先には触らない」と書かれている。

## `vp install` を実行するタイミング

`vp add` / `vp remove` / `vp update` はインストールまで自動で行うので、後から `vp install` を実行する必要はない。`vp install` が必要になるのは、clone した直後や、`git pull` で lockfile が変わった後など。詳しくは `02-依存関係の更新（vp update）.md` の「`vp update` の後に `vp install` は必要？」を参照。

## 参考

- [Installing Dependencies（vp install）](https://viteplus.dev/guide/install)
- [Environment（vp env）](https://viteplus.dev/guide/env)
