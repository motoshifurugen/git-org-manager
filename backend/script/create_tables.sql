-- 部署ノード定義（Gitの blob に相当）
create table if not exists org_node (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  depth integer not null check (depth between 1 and 5),
  parent_hash text, -- 内容的な親ハッシュ（null = ルート）
  hash text unique not null -- hash(name + depth + parent_hash)
);

-- スナップショット（Gitの tree に相当）
create table if not exists org_tree (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp default current_timestamp,
  created_by text not null
);

-- ノード参照構成（Gitの tree の中身）
create table if not exists org_tree_node (
  tree_id uuid references org_tree(id) on delete cascade,
  node_id uuid references org_node(id) on delete restrict,
  parent_id uuid references org_node(id), -- このtree内での親
  primary key (tree_id, node_id)
);

-- スナップショットの commit 情報（Gitの commit）
create table if not exists org_commit (
  id uuid primary key default gen_random_uuid(),
  tree_id uuid references org_tree(id) on delete cascade,
  message text,
  author text not null,
  created_at timestamp default current_timestamp
  parent_commit_id uuid references org_commit(id)
);

-- タグ（任意の名前ラベル）
create table if not exists org_tag (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  commit_id uuid references org_commit(id) on delete cascade
);

-- 共有用の公開 commit（fetch 対象）
create table if not exists org_commit_share (
  id uuid primary key default gen_random_uuid(),
  commit_id uuid references org_commit(id) on delete cascade,
  shared_at timestamp default current_timestamp,
  note text
); 