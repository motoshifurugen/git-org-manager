import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: __dirname + '/../.env' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

type NodeSeed = {
  name: string;
  depth: number;
  parent_index: number | null; // 親ノードの配列インデックス
};

const nodes: NodeSeed[] = [
  { name: '本社', depth: 1, parent_index: null },
  { name: '管理本部', depth: 2, parent_index: 0 },
  { name: '人事部', depth: 3, parent_index: 1 },
  { name: '採用課', depth: 4, parent_index: 2 },
  { name: '新卒採用チーム', depth: 5, parent_index: 3 },
  { name: '中途採用チーム', depth: 5, parent_index: 3 },
  { name: '労務課', depth: 4, parent_index: 2 },
  { name: '勤怠管理チーム', depth: 5, parent_index: 6 },
  { name: '社保対応チーム', depth: 5, parent_index: 6 },
  { name: '総務部', depth: 3, parent_index: 1 },
  { name: '契約課', depth: 4, parent_index: 9 },
  { name: '契約更新チーム', depth: 5, parent_index: 10 },
  { name: '資産課', depth: 4, parent_index: 9 },
  { name: '備品管理チーム', depth: 5, parent_index: 12 },
  { name: 'オフィス環境整備チーム', depth: 5, parent_index: 12 },
  { name: '経理部', depth: 3, parent_index: 1 },
  { name: '会計課', depth: 4, parent_index: 15 },
  { name: '月次決算チーム', depth: 5, parent_index: 16 },
  { name: '年次決算チーム', depth: 5, parent_index: 16 },
  { name: '予算課', depth: 4, parent_index: 15 },
  { name: '各部門予算管理チーム', depth: 5, parent_index: 19 },
  { name: '営業本部', depth: 2, parent_index: 0 },
  { name: '国内営業部', depth: 3, parent_index: 21 },
  { name: '東日本課', depth: 4, parent_index: 22 },
  { name: '関東チーム', depth: 5, parent_index: 23 },
  { name: '西日本課', depth: 4, parent_index: 22 },
  { name: '関西チーム', depth: 5, parent_index: 25 },
  { name: '海外営業部', depth: 3, parent_index: 21 },
  { name: 'アジア課', depth: 4, parent_index: 27 },
  { name: '中国チーム', depth: 5, parent_index: 28 },
  { name: 'ASEANチーム', depth: 5, parent_index: 28 },
  { name: '欧州課', depth: 4, parent_index: 27 },
  { name: '西欧チーム', depth: 5, parent_index: 31 },
  { name: '東欧チーム', depth: 5, parent_index: 31 },
  { name: '営業企画部', depth: 3, parent_index: 21 },
  { name: '商品企画課', depth: 4, parent_index: 34 },
  { name: '顧客管理課', depth: 4, parent_index: 34 },
  { name: '技術本部', depth: 2, parent_index: 0 },
  { name: '開発部', depth: 3, parent_index: 37 },
  { name: 'Web開発課', depth: 4, parent_index: 38 },
  { name: 'フロントエンドチーム', depth: 5, parent_index: 39 },
  { name: 'バックエンドチーム', depth: 5, parent_index: 39 },
  { name: 'モバイル開発課', depth: 4, parent_index: 38 },
  { name: 'QA部', depth: 3, parent_index: 37 },
  { name: 'テスト課', depth: 4, parent_index: 43 },
  { name: '自動テストチーム', depth: 5, parent_index: 44 },
  { name: '手動テストチーム', depth: 5, parent_index: 44 },
  { name: '品質保証課', depth: 4, parent_index: 43 },
  { name: 'インフラ部', depth: 3, parent_index: 37 },
  { name: 'ネットワーク課', depth: 4, parent_index: 48 },
  { name: 'セキュリティ課', depth: 4, parent_index: 48 },
  { name: 'R&D本部', depth: 2, parent_index: 0 },
  { name: 'AI研究部', depth: 3, parent_index: 51 },
  { name: '画像処理課', depth: 4, parent_index: 52 },
  { name: '医療画像チーム', depth: 5, parent_index: 53 },
  { name: '工業画像チーム', depth: 5, parent_index: 53 },
  { name: 'NLP研究部', depth: 3, parent_index: 51 },
  { name: '音声認識課', depth: 4, parent_index: 56 },
  { name: '文書生成課', depth: 4, parent_index: 56 },
  { name: '戦略企画部', depth: 3, parent_index: 51 },
  { name: 'リサーチ課', depth: 4, parent_index: 59 },
  { name: '技術広報課', depth: 4, parent_index: 59 },
];

function generateHash(name: string, depth: number, parentHash: string | null): string {
  return require('crypto')
    .createHash('sha256')
    .update(`${name}-${depth}-${parentHash ?? ''}`)
    .digest('hex');
}

async function main() {
  // org_tree 作成
  const treeInsert = await supabase.from('org_tree').insert({
    created_by: 'seed-script'
  }).select().single();
  if (treeInsert.error || !treeInsert.data) {
    console.error('org_tree insert error:', treeInsert.error);
    return;
  }
  const treeId = treeInsert.data.id;

  // org_node 作成
  const nodeHashMap: { [index: number]: { id: string, hash: string } } = {};
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const parentHash = node.parent_index !== null ? nodeHashMap[node.parent_index].hash : null;
    const hash = generateHash(node.name, node.depth, parentHash);

    // 既存チェック
    const { data: existing } = await supabase
      .from('org_node')
      .select('id')
      .eq('hash', hash)
      .maybeSingle();

    let nodeId = existing?.id;
    if (!nodeId) {
      const { data: inserted, error: insertErr } = await supabase
        .from('org_node')
        .insert({
          name: node.name,
          depth: node.depth,
          parent_hash: parentHash,
          hash: hash
        }).select().single();
      if (insertErr || !inserted) {
        console.error('org_node insert error:', insertErr);
        return;
      }
      nodeId = inserted.id;
    }
    nodeHashMap[i] = { id: nodeId, hash };
  }

  // org_tree_node 作成
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const nodeId = nodeHashMap[i].id;
    const parentId = node.parent_index !== null ? nodeHashMap[node.parent_index].id : null;
    const link = {
      tree_id: treeId,
      node_id: nodeId,
      parent_id: parentId
    };
    const { error: linkErr } = await supabase.from('org_tree_node').insert(link);
    if (linkErr) {
      console.error('org_tree_node insert error:', linkErr);
      return;
    }
  }

  // org_commit 作成
  const commitInsert = await supabase.from('org_commit').insert({
    tree_id: treeId,
    message: '初期データ投入',
    author: 'seed-script'
  }).select().single();
  if (commitInsert.error || !commitInsert.data) {
    console.error('org_commit insert error:', commitInsert.error);
    return;
  }

  console.log('✅ 初期データ投入完了');
}

main();
