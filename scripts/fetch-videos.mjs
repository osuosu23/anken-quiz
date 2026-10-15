#!/usr/bin/env node
/**
 * scripts/fetch-videos.mjs
 * 
 * YouTube Data API v3 を使用して、過去半年間の日本の話題動画（案件・通常）を
 * カテゴリごとに取得・仕分けし、data/{category}.json に上書き保存するスクリプト。
 * 
 * 環境変数:
 *   YOUTUBE_API_KEY: YouTube Data API v3 の API キー
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../data');

// 対象カテゴリ定義（全8ジャンル: スポーツは除外）
const CATEGORIES = [
  { id: null, key: 'all', name: '総合（全ジャンル）' },
  { id: '28', key: 'gadget', name: 'ガジェット・家電' },
  { id: '26', key: 'beauty', name: 'コスメ・美容・暮らし' },
  { id: '20', key: 'gaming', name: 'ゲーム' },
  { id: '24', key: 'entertainment', name: 'エンタメ・バラエティ' },
  { id: '22', key: 'vlog', name: '日常・Vlog' },
  { id: '2', key: 'vehicles', name: '車・乗り物' },
  { id: '27', key: 'business', name: 'ビジネス・教養' }
];

// 除外対象のYouTube動画カテゴリID（カテゴリー分析による除外）
// 25: News & Politics (ニュースと政治)
// 17: Sports (スポーツ)
const BLOCKED_CATEGORY_IDS = new Set(['25', '17']);

// 判明している除外対象チャンネルID（ブロックリスト）
const BLOCKED_CHANNEL_IDS = new Set([
  'UCGCZAYq5Xxojl_tSXcVJhiQ', // ANNnewsCH
  'UC1ipzc08F-FjrZ5jIaZVPIw', // FNNプライムオンライン
  'UCWt0yfrBaUk148rxaOp4b4w', // 日テレNEWS
  'UCeCmAYh1ylwIsgGrmqaklzg', // TBS NEWS DIG
  'UCkKVQ_GNjd8FbAuT6xDcWgg', // テレ東BIZ
  'UCJ-l-sMQFHogSy8KXRyMIRA', // SPOTVNOW
  'UCoFLB_Gw_AoxUuuzKjXrc_Q'  // DAZN Japan
]);

// チャンネルタイトルによる除外正規表現（ニュース系報道、スポーツ中継・速報系公式チャンネル）
const BLOCKED_CHANNEL_TITLE_REGEX = /^(?:ANNnewsCH|FNN.*|日テレNEWS.*|TBS NEWS DIG.*|テレ東BIZ.*|SPOTVNOW.*|DAZN.*|.*NEWS DIG|カンテレ.*|読売テレビ.*|サンテレビ|.*パ・リーグTV.*|.*TBS スポーツ|スポーツナビ.*|日刊スポーツ|NHK.*)$/i;

// ニュース・スポーツなど除外判定（カテゴリー分析、チャンネルID、チャンネル名: *テレビ*, *公式*）
function isBlockedVideo(item) {
  const categoryId = item.snippet?.categoryId;
  if (categoryId && BLOCKED_CATEGORY_IDS.has(String(categoryId))) {
    return true;
  }

  const channelId = item.snippet?.channelId;
  if (channelId && BLOCKED_CHANNEL_IDS.has(channelId)) {
    return true;
  }

  const channelTitle = item.snippet?.channelTitle || '';
  if (channelTitle.includes('テレビ') || channelTitle.includes('公式')) {
    return true;
  }
  if (BLOCKED_CHANNEL_TITLE_REGEX.test(channelTitle)) {
    return true;
  }

  return false;
}

// タイトルネタバレNGワード（タイトルにこれらが入っている動画はクイズにならないため除外）
const SPOILER_REGEX = /(?:PR|案件|提供|プロモーション|タイアップ|#PR|#pr|AD|sponsor)/i;

// 日本語文字判定（ひらがな、カタカナ）
const JAPANESE_CHAR_REGEX = /[\u3040-\u309F\u30A0-\u30FF]/;

// 日付範囲計算: 過去半年間（180日前）〜 昨日
function getDateRange() {
  const now = new Date();
  
  // 昨日 23:59:59Z
  const yesterday = new Date(now);
  yesterday.setUTCDate(now.getUTCDate() - 1);
  yesterday.setUTCHours(23, 59, 59, 999);

  // 180日前 00:00:00Z
  const past = new Date(now);
  past.setUTCDate(now.getUTCDate() - 180);
  past.setUTCHours(0, 0, 0, 0);

  return {
    publishedAfter: past.toISOString(),
    publishedBefore: yesterday.toISOString()
  };
}

// YouTube search.list API 呼び出し（ページネーション対応で最大3ページ・150件取得）
async function fetchSearchPages(apiKey, options, maxPages = 3) {
  const allItems = [];
  let pageToken = null;

  for (let page = 0; page < maxPages; page++) {
    const url = new URL('https://www.googleapis.com/youtube/v3/search');
    url.searchParams.set('part', 'snippet');
    url.searchParams.set('maxResults', '50');
    url.searchParams.set('order', 'viewCount');
    url.searchParams.set('q', 'の|に|は|を|で -切り抜き -MV');
    url.searchParams.set('regionCode', 'JP');
    url.searchParams.set('relevanceLanguage', 'ja');
    url.searchParams.set('type', 'video');
    url.searchParams.set('videoDuration', 'medium');
    url.searchParams.set('videoEmbeddable', 'true');
    url.searchParams.set('publishedAfter', options.publishedAfter);
    url.searchParams.set('publishedBefore', options.publishedBefore);
    url.searchParams.set('key', apiKey);

    if (pageToken) {
      url.searchParams.set('pageToken', pageToken);
    }
    if (options.videoPaidProductPlacement) {
      url.searchParams.set('videoPaidProductPlacement', options.videoPaidProductPlacement);
    }
    if (options.videoCategoryId) {
      url.searchParams.set('videoCategoryId', options.videoCategoryId);
    }

    const res = await fetch(url);
    if (!res.ok) {
      const errorText = await res.text();
      console.warn(`    ⚠️ search.list page ${page + 1} (${res.status}): ${errorText}`);
      break;
    }

    const data = await res.json();
    const items = data.items || [];
    allItems.push(...items);

    pageToken = data.nextPageToken;
    if (!pageToken || items.length < 50) break;
  }

  return allItems;
}

// YouTube videos.list API 呼び出し（50件ずつバッチ分割して全件を公式検証）
async function fetchVideosList(apiKey, videoIds) {
  if (videoIds.length === 0) return [];

  const chunks = [];
  for (let i = 0; i < videoIds.length; i += 50) {
    chunks.push(videoIds.slice(i, i + 50));
  }

  const allItems = [];
  for (const chunk of chunks) {
    const url = new URL('https://www.googleapis.com/youtube/v3/videos');
    url.searchParams.set('part', 'snippet,paidProductPlacementDetails');
    url.searchParams.set('id', chunk.join(','));
    url.searchParams.set('key', apiKey);

    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      allItems.push(...(data.items || []));
    } else {
      const errorText = await res.text();
      console.warn(`    ⚠️ videos.list batch error (${res.status}): ${errorText}`);
    }
  }

  return allItems;
}

// 動画の基本フィルタ（日本語文字有無、タイトルネタバレなし）
function isValidQuizVideo(snippet) {
  const title = snippet.title || '';
  // 日本語文字を含まないものは除外
  if (!JAPANESE_CHAR_REGEX.test(title)) return false;
  // タイトルにPR/提供などのネタバレを含むものは除外
  if (SPOILER_REGEX.test(title)) return false;
  return true;
}

// 1カテゴリの収集処理（3倍取得 & 公式APIバッジ完全検証 & チャンネル重複排除）
async function processCategory(apiKey, category, dateRange) {
  console.log(`\n========================================`);
  console.log(`🔍 [${category.name}] 3倍収集開始... (ID: ${category.id || 'なし'})`);

  // 1. プロモーション true で 3ページ（最大150件）取得
  console.log(`  -> search.list (videoPaidProductPlacement=true, 3ページ)...`);
  const rawSponsoredSearch = await fetchSearchPages(apiKey, {
    ...dateRange,
    videoCategoryId: category.id,
    videoPaidProductPlacement: 'true'
  }, 3);

  const sponsoredCandidates = rawSponsoredSearch.filter(item => {
    return item.id && item.id.videoId && isValidQuizVideo(item.snippet);
  });
  console.log(`  -> 案件候補（タイトルフィルタ後）: ${sponsoredCandidates.length} 本`);

  // 2. プロモーション any で 3ページ（最大150件）取得
  console.log(`  -> search.list (videoPaidProductPlacement=any, 3ページ)...`);
  const rawAnySearch = await fetchSearchPages(apiKey, {
    ...dateRange,
    videoCategoryId: category.id,
    videoPaidProductPlacement: 'any'
  }, 3);

  const anyCandidates = rawAnySearch.filter(item => {
    return item.id && item.id.videoId && isValidQuizVideo(item.snippet);
  });
  console.log(`  -> 通常候補（タイトルフィルタ後）: ${anyCandidates.length} 本`);

  // 全候補のIDを一意に統合
  const allCandidateIds = Array.from(new Set([
    ...sponsoredCandidates.map(c => c.id.videoId),
    ...anyCandidates.map(c => c.id.videoId)
  ]));

  console.log(`  -> 全動画（計 ${allCandidateIds.length} 本）を videos.list (paidProductPlacementDetails) で公式検証中...`);

  // 全候補を公式APIで詳細取得し、公式プロモーションバッジ有無のみで判定（推測は一切行わない）
  const verifiedVideoDetails = await fetchVideosList(apiKey, allCandidateIds);

  // 同一ジャンル内でのチャンネル重複排除用Set（同じチャンネルの2番目以降は載せない）
  const seenCategoryChannels = new Set();
  const finalSponsored = [];
  const finalNormal = [];

  // 1. 案件動画（sponsored）を最優先で登録
  for (const vItem of verifiedVideoDetails) {
    if (!vItem || !vItem.id || !vItem.snippet) continue;

    // 【公式判定基準】YouTubeシステムが保持する有料プロモーション開示フラグ
    const hasOfficialBadge = vItem.paidProductPlacementDetails?.hasPaidProductPlacement === true;
    if (!hasOfficialBadge) continue;

    // ニュース・スポーツ等除外判定（カテゴリ25/17、ブロックID、テレビ等）
    if (isBlockedVideo(vItem)) {
      continue;
    }

    const cid = vItem.snippet.channelId;
    const cTitle = vItem.snippet.channelTitle || '';

    // 同一ジャンル内重複チャンネルのスキップ（2番目以降は除外）
    const channelKey = cid || cTitle;
    if (seenCategoryChannels.has(channelKey)) {
      continue;
    }

    seenCategoryChannels.add(channelKey);
    finalSponsored.push({
      id: vItem.id,
      title: vItem.snippet.title,
      channelId: cid,
      channelTitle: cTitle,
      thumbnailUrl: vItem.snippet.thumbnails?.high?.url || vItem.snippet.thumbnails?.medium?.url || `https://i.ytimg.com/vi/${vItem.id}/hqdefault.jpg`
    });
  }

  // 2. 通常動画（normal）を登録（案件で採用されたチャンネルも重複除外される）
  for (const vItem of verifiedVideoDetails) {
    if (!vItem || !vItem.id || !vItem.snippet) continue;

    const hasOfficialBadge = vItem.paidProductPlacementDetails?.hasPaidProductPlacement === true;
    if (hasOfficialBadge) continue; // 案件は登録済み

    // ニュース・スポーツ等除外判定（カテゴリ25/17、ブロックID、テレビ等）
    if (isBlockedVideo(vItem)) {
      continue;
    }

    const cid = vItem.snippet.channelId;
    const cTitle = vItem.snippet.channelTitle || '';

    // 同一ジャンル内重複チャンネルのスキップ（2番目以降は除外）
    const channelKey = cid || cTitle;
    if (seenCategoryChannels.has(channelKey)) {
      continue;
    }

    seenCategoryChannels.add(channelKey);
    finalNormal.push({
      id: vItem.id,
      title: vItem.snippet.title,
      channelId: cid,
      channelTitle: cTitle,
      thumbnailUrl: vItem.snippet.thumbnails?.high?.url || vItem.snippet.thumbnails?.medium?.url || `https://i.ytimg.com/vi/${vItem.id}/hqdefault.jpg`
    });
  }

  console.log(`  ✨ [${category.name}] フィルタ・重複排除完了: 案件 ${finalSponsored.length} 本 / 通常 ${finalNormal.length} 本`);

  return {
    category: category.key,
    categoryName: category.name,
    updatedAt: new Date().toISOString(),
    counts: {
      sponsored: finalSponsored.length,
      normal: finalNormal.length,
      total: finalSponsored.length + finalNormal.length
    },
    sponsored: finalSponsored,
    normal: finalNormal
  };
}

async function main() {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    console.error('❌ エラー: 環境変数 YOUTUBE_API_KEY が設定されていません。');
    console.error('GitHub Secrets に YOUTUBE_API_KEY を設定するか、export YOUTUBE_API_KEY="xxx" を指定してください。');
    process.exit(1);
  }

  await fs.mkdir(DATA_DIR, { recursive: true });
  const dateRange = getDateRange();
  console.log('🚀 YouTube 案件クイズ データ収集スクリプト起動');
  console.log(`📅 対象期間: ${dateRange.publishedAfter} 〜 ${dateRange.publishedBefore}（過去180日間）`);

  const categoryIndex = [];

  for (const cat of CATEGORIES) {
    try {
      const result = await processCategory(apiKey, cat, dateRange);
      
      const sponsoredPath = path.join(DATA_DIR, `${cat.key}_sponsored.json`);
      const normalPath = path.join(DATA_DIR, `${cat.key}_normal.json`);

      await fs.writeFile(sponsoredPath, JSON.stringify(result.sponsored, null, 2), 'utf-8');
      await fs.writeFile(normalPath, JSON.stringify(result.normal, null, 2), 'utf-8');
      console.log(`  💾 保存完了: ${sponsoredPath} (${result.sponsored.length}本)`);
      console.log(`  💾 保存完了: ${normalPath} (${result.normal.length}本)`);

      categoryIndex.push({
        key: cat.key,
        name: cat.name,
        counts: result.counts
      });

      // API レートリミット配慮で少し待機
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (err) {
      console.error(`❌ [${cat.name}] の取得でエラーが発生しました:`, err.message);
    }
  }

  // カテゴリ一覧インデックスファイル（index.json）も保存
  const indexPath = path.join(DATA_DIR, 'index.json');
  await fs.writeFile(indexPath, JSON.stringify({
    updatedAt: new Date().toISOString(),
    categories: categoryIndex
  }, null, 2), 'utf-8');
  console.log(`\n🎉 全カテゴリの収集・分割保存が完了しました！ -> ${indexPath}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
