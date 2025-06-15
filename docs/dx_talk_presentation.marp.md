---
marp: true
theme: custom-theme
paginate: true
---

<!-- 表紙装飾：L字型分岐バージョン -->
<div class="git-decoration-branch">
  <div class="main-branch">
    <span class="git-dot"></span>
    <span class="git-line"></span>
    <span class="git-dot"></span>
    <span class="git-line"></span>
    <span class="git-dot"></span>
    <span class="git-line"></span>
    <span class="git-dot"></span>
  </div>
  <div class="branch-l">
    <div class="branch-vertical"></div>
    <div class="branch-horizontal"></div>
    <span class="git-branch-dot"></span>
  </div>
</div>

# Git の発想を使って、<br>組織をバージョン管理してみた

2025/06/20 DX勉強会：DX 開発2部 古堅基史

---

## はじめに

**バージョン管理、していますか？**

👍：ファイル名で管理しています
❤️：変更履歴をよく確認します
👏：Gitを使って歴史を改変できます
😆：記憶と履歴は全て頭の中です

---

## はじめに

### 今回のゴールは **Git の考え方** に触れること

Git がなぜそういう設計になっているのかを理解することで、
他の文脈にも応用できる感覚を感じてくれたらとても嬉しい

---

## この勉強会で話すこと

1. Git って何？
2. Git の仕組み
3. 組織管理に応用してみた

---

## この勉強会で話さないこと

- Git コマンドの詳細解説
- チーム開発 Tips（ブランチ運用など）
- 他のバージョン管理手法との比較
- GitHub、Gitlabなど関連ツールの使い方

---

## なぜ今 Git の話？

- いまだに現役の Git の汎用性
- Pro Git 読書会で仕組みの面白さに触れた
- ドキュメントも Git で管理しはじめた

---

## ネタ本

<div class="books-flex">
  <div class="book-item">
    <img src="https://i.gyazo.com/fea96c38763e537d80d7a64a32417794.png" alt="Image from Gyazo" width="180"/>
    <div style="margin-top: 0.7em; font-weight: bold;">Pro Git（日本語版）</div>
    <div class="book-item-desc">無料で読める</div>
    <div class="book-item-desc">Gitの仕組みがわかる</div>
  </div>
  <div class="book-item">
    <img src="https://i.gyazo.com/fea96c38763e537d80d7a64a32417794.png" alt="Image from Gyazo" width="180"/>
    <div style="margin-top: 0.7em; font-weight: bold;">もう1冊の本タイトル</div>
    <div class="book-item-desc">無料で読める</div>
    <div class="book-item-desc">Gitの考え方が身につく</div>
  </div>
</div>

---

## Git とは何か？

- ファイルの変更履歴を記録するツール
- 分散型（すべての履歴を手元で持てる）
- 仕組みが特徴的：ステージング・ハッシュ・オブジェクト構造

---

## Git が変だと言われる理由

- `add`しても保存されない
- `HEAD`って誰？
- `push`で世界が壊れる（ときもある）

---

## でも、その変さには理由がある

- 一見ややこしい設計にも、  
  　**情報を守る・管理するための哲学**がある

---

## Git の基本構造：3 つの状態

```
Working Directory → Staging Area → HEAD
```

- 実ファイル → 一時置き → 確定済み履歴

---

## Git の操作フロー

```
fetch → merge → add → commit → push
```

- 分けて取り込む
- 必要なものだけ記録する
- そして履歴として共有する

---

## Git は"オブジェクト"でできている

- `blob`：ファイル内容
- `tree`：フォルダ構造
- `commit`：履歴・メタ情報
- `tag`：ラベル

---

## Git の構造まとめ

- すべてが**ハッシュ値**でつながっている
- 変更は「内容ベース」で追跡される
- 差分ではなく**スナップショット方式**

---

## 仕組みが見えてくると…

- なぜ`commit`と`push`が分かれてるのか？
- なぜ`merge`でコンフリクトが起こるのか？
- なぜ`rebase`は危ないのか？

---

## 応用してみた：組織もバージョン管理？

- Git の構造で**組織情報の履歴管理**はできるのか？
- 試しにツールを作ってみた

---

## 自作ツール：git-org-manager

[https://github.com/motoshifurugen/git-org-manager](https://github.com/motoshifurugen/git-org-manager)

- 組織ノード、ツリー、コミットを Git っぽく管理
- データ構造も思想も、Git をまねした

---

## Git との対応関係（一部）

| Git         | 組織ツール             |
| ----------- | ---------------------- |
| commit      | org_commit             |
| tree        | org_tree_node          |
| branch      | org_tree（バージョン） |
| fetch/merge | 他チームとの統合       |

---

## 作ってみて思った ①

### 3-way マージは必須だった

- 一方的な上書きでは**履歴が壊れる**
- **差分の比較元（共通の親）**がないと成り立たない

---

## 作ってみて思った ②

### スナップショット全部保存は無理

- 毎回全体を持つと肥大化
- 差分＋圧縮が必要
- Git の圧縮構造のすごさを実感

---

## 作ってみて思った ③

### fetch→merge がやっぱり安心

- `pull`は一気に変わって怖い
- `fetch`と`merge`を分けた設計は**安全志向の現れ**

---

## その他の学び

- Git は**構造と履歴を分けて考える**ための道具
- "なぜ"の設計思想が見えてくると運用の理解が変わる

---

## 組織に応用する意味

- 組織も**履歴を持つ"情報構造"**
- Git 的な視点はドキュメントにも、チーム構造にも活きる

---

## Git を知ると…

- 「変更」とは何か？
- 「履歴」とはどうあるべきか？
- 「情報の扱い方」の根本が見えてくる

---

## まとめ

- Git はツールであり、**設計思想のかたまり**
- 自分でまねしてみて、その凄みが見えてきた
- 組織にも、情報にも、通じるヒントがあった

---

## ご清聴ありがとうございました！

🎤 ご質問・感想などぜひお気軽に！

📘 Pro Git 読書会も続いてます  
📫 お声かけください
