// scripts/generate-mock-data.mjs
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../data');

const CATEGORIES = [
  { key: 'all', name: '総合（全ジャンル）' },
  { key: 'gadget', name: 'ガジェット・家電' },
  { key: 'beauty', name: 'コスメ・美容・暮らし' },
  { key: 'gaming', name: 'ゲーム' },
  { key: 'entertainment', name: 'エンタメ・バラエティ' },
  { key: 'vlog', name: '日常・Vlog' },
  { key: 'vehicles', name: '車・乗り物' },
  { key: 'sports', name: 'スポーツ・筋トレ' },
  { key: 'business', name: 'ビジネス・教養' }
];

// 案件動画サンプル（実在ID）
const SPONSORED_POOL = [
  {
    id: 'kCY4XJ32VZ4',
    title: '【徹底検証】話題の新作シャンプーを本音レビュー！',
    channelTitle: '美容系クリエイターTV',
    category: 'beauty'
  },
  {
    id: 'vY3LLtjjM2w',
    title: '【正直レビュー】最近話題のスキンケア試してみた！',
    channelTitle: 'コスメマニアCH',
    category: 'beauty'
  },
  {
    id: '6lGhPZohqbk',
    title: '【検証】最新ドライヤーを試したら衝撃の結果に…',
    channelTitle: 'オモコロチャンネル',
    category: 'gadget'
  },
  {
    id: 'egafi2On9Y4',
    title: '一人暮らしの食生活を劇的に改善する神サービス見つけた',
    channelTitle: 'スーツ交通 / 散歩',
    category: 'vlog'
  },
  {
    id: 'udUyyohJSiM',
    title: '【時短】仕事が忙しい平日の夜ご飯ルーティン',
    channelTitle: '青海ルーティンCH',
    category: 'vlog'
  },
  {
    id: 'LBofnBciP0E',
    title: '【神回】最新ゲームで本気バトルしてみた！勝てるか！？',
    channelTitle: 'はじめしゃちょー（hajime）',
    category: 'gaming'
  },
  {
    id: '2zu1f1MK5eM',
    title: '超高額オリパを大量開封したら奇跡の神引き連発！？',
    channelTitle: 'みさわTCGチャンネル',
    category: 'gaming'
  },
  {
    id: '3OfeZQmrRpo',
    title: '最近愛用してる激推しヘアケア＆お風呂グッズ紹介',
    channelTitle: '中町綾チャンネル',
    category: 'beauty'
  },
  {
    id: 'tyUBOLNC9Z0',
    title: '【コント】最新トレンドに敏感すぎる美容系インフルエンサー奴',
    channelTitle: 'ジャルジャルアイランド',
    category: 'entertainment'
  },
  {
    id: 'kCY4XJ32VZ4',
    title: '【衝撃】デスク周りを激変させるおすすめアイテム5選',
    channelTitle: 'ガジェットLab',
    category: 'gadget'
  },
  {
    id: '6lGhPZohqbk',
    title: '【神機材】作業効率が爆上がりしたスマートガジェットを紹介',
    channelTitle: 'Monograph Style',
    category: 'gadget'
  },
  {
    id: 'egafi2On9Y4',
    title: '【革命】時間の無駄をなくすタイパ最強の食事習慣とは',
    channelTitle: '生産性マニアTV',
    category: 'business'
  },
  {
    id: 'udUyyohJSiM',
    title: '忙しい社会人のための無理しない筋トレ＆PFCバランス管理法',
    channelTitle: 'フィットネスLife',
    category: 'sports'
  },
  {
    id: 'LBofnBciP0E',
    title: '【新作試乗】話題の最新EV車に乗ってみたら異次元だった件',
    channelTitle: 'CAR REVIEW JAPAN',
    category: 'vehicles'
  }
];

// 通常動画サンプル（実在ID）
const NORMAL_POOL = [
  {
    id: '-IYAkdhKHzs',
    title: '【朝食】みんなで美味しい朝ごはんを食べるだけのまったり動画',
    channelTitle: 'よにのちゃんねる',
    category: 'vlog'
  },
  {
    id: 'sWBy8OVKkl8',
    title: '【近況】最近あった納得いかない話を聞いてほしい',
    channelTitle: '粗品 Official Channel',
    category: 'entertainment'
  },
  {
    id: 'ZGFVQqOWYm8',
    title: '爆買いした洋服をひたすら着てテンション爆上がりする動画',
    channelTitle: '仲里依紗です。',
    category: 'beauty'
  },
  {
    id: 'gTL7wKr2oEI',
    title: 'ネットで酷評されてる激安居酒屋に行ってみた結果…',
    channelTitle: 'びわ湖くん',
    category: 'entertainment'
  },
  {
    id: '8BuIQeO9YTI',
    title: '【生配信】久しぶりに皆さんと雑談します！質問答えます',
    channelTitle: '山口達也チャンネル',
    category: 'entertainment'
  },
  {
    id: 'Bx3lxVDmIU0',
    title: '【マイクラ】初心者でも作れる全自動トラップを完全解説！',
    channelTitle: 'あかさかの箱',
    category: 'gaming'
  },
  {
    id: 'Z2nXmfX6WpE',
    title: '【潜入】ディープな街の裏側にカメラが迫るドキュメンタリー',
    channelTitle: '丸山ゴンザレスの裏社会ジャーニー',
    category: 'business'
  },
  {
    id: 'IL33u5eXn9o',
    title: '100本の激辛スナックを食べ切るまで帰れません！！過酷すぎた…',
    channelTitle: 'Fischer\'s-フィッシャーズ-',
    category: 'entertainment'
  },
  {
    id: 'AY2azIhA628',
    title: '深夜の廃ホテルで一晩過ごしたら怪奇現象が止まらない…',
    channelTitle: 'ブルーシー',
    category: 'entertainment'
  },
  {
    id: 'dD22nQOQ1mU',
    title: '【超難問】メンバーの行動を完全に予言できるか対決！',
    channelTitle: '東海オンエア',
    category: 'entertainment'
  },
  {
    id: '-IYAkdhKHzs',
    title: '自作PCを半年使ってわかったメリット・デメリット正直レビュー',
    channelTitle: '自作PC倶楽部',
    category: 'gadget'
  },
  {
    id: 'sWBy8OVKkl8',
    title: '愛車で真夜中の首都高をドライブしながら語る雑談',
    channelTitle: 'DRIVE & TALK',
    category: 'vehicles'
  },
  {
    id: 'IL33u5eXn9o',
    title: 'ベンチプレス100kg達成するまでにやった練習メニュー全公開！',
    channelTitle: 'パワーリフティング道場',
    category: 'sports'
  },
  {
    id: 'Z2nXmfX6WpE',
    title: '決算書から読み解く有名企業のビジネスモデルと今後の戦略',
    channelTitle: 'ビジネス教養TV',
    category: 'business'
  }
];

function formatVideo(v) {
  return {
    id: v.id,
    title: v.title,
    channelTitle: v.channelTitle,
    thumbnailUrl: `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`
  };
}

async function run() {
  await fs.mkdir(DATA_DIR, { recursive: true });

  const categoryIndex = [];

  for (const cat of CATEGORIES) {
    let spList = [];
    let nmList = [];

    if (cat.key === 'all') {
      spList = SPONSORED_POOL.map(formatVideo);
      nmList = NORMAL_POOL.map(formatVideo);
    } else {
      spList = SPONSORED_POOL.filter(v => v.category === cat.key).map(formatVideo);
      nmList = NORMAL_POOL.filter(v => v.category === cat.key).map(formatVideo);

      // カテゴリ固有の候補が少ない場合はプール全体から最低5件以上になるよう補完
      if (spList.length < 5) {
        const others = SPONSORED_POOL.filter(v => v.category !== cat.key).map(formatVideo);
        spList = [...spList, ...others].slice(0, 8);
      }
      if (nmList.length < 5) {
        const others = NORMAL_POOL.filter(v => v.category !== cat.key).map(formatVideo);
        nmList = [...nmList, ...others].slice(0, 8);
      }
    }

    const spPath = path.join(DATA_DIR, `${cat.key}_sponsored.json`);
    const nmPath = path.join(DATA_DIR, `${cat.key}_normal.json`);

    await fs.writeFile(spPath, JSON.stringify(spList, null, 2), 'utf-8');
    await fs.writeFile(nmPath, JSON.stringify(nmList, null, 2), 'utf-8');

    categoryIndex.push({
      key: cat.key,
      name: cat.name,
      counts: {
        sponsored: spList.length,
        normal: nmList.length,
        total: spList.length + nmList.length
      }
    });

    console.log(`Generated: ${cat.key} (sp: ${spList.length}, nm: ${nmList.length})`);
  }

  const indexPath = path.join(DATA_DIR, 'index.json');
  await fs.writeFile(indexPath, JSON.stringify({
    updatedAt: new Date().toISOString(),
    categories: categoryIndex
  }, null, 2), 'utf-8');

  console.log('✅ All mock datasets created successfully!');
}

run().catch(console.error);
