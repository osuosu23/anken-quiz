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

// 対象カテゴリ定義（全9ジャンル）
const CATEGORIES = [
  { id: null, key: 'all', name: '総合（全ジャンル）' },
  { id: '28', key: 'gadget', name: 'ガジェット・家電' },
  { id: '26', key: 'beauty', name: 'コスメ・美容・暮らし' },
  { id: '20', key: 'gaming', name: 'ゲーム' },
  { id: '24', key: 'entertainment', name: 'エンタメ・バラエティ' },
  { id: '22', key: 'vlog', name: '日常・Vlog' },
  { id: '2', key: 'vehicles', name: '車・乗り物' },
  { id: '17', key: 'sports', name: 'スポーツ・筋トレ' },
  { id: '27', key: 'business', name: 'ビジネス・教養' }
];

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

// YouTube search.list API 呼び出し
async function fetchSearchList(apiKey, options) {
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

  if (options.videoPaidProductPlacement) {
    url.searchParams.set('videoPaidProductPlacement', options.videoPaidProductPlacement);
  }
  if (options.videoCategoryId) {
    url.searchParams.set('videoCategoryId', options.videoCategoryId);
  }

  const res = await fetch(url);
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`YouTube search.list failed (${res.status}): ${errorText}`);
  }
  return res.json();
}

// YouTube videos.list API 呼び出し（詳細・paidProductPlacementDetails確認）
async function fetchVideosList(apiKey, videoIds) {
  if (videoIds.length === 0) return { items: [] };

  const url = new URL('https://www.googleapis.com/youtube/v3/videos');
  url.searchParams.set('part', 'snippet,paidProductPlacementDetails');
  url.searchParams.set('id', videoIds.join(','));
  url.searchParams.set('key', apiKey);

  const res = await fetch(url);
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`YouTube videos.list failed (${res.status}): ${errorText}`);
  }
  return res.json();
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

// 1カテゴリの収集処理
async function processCategory(apiKey, category, dateRange) {
  console.log(`\n========================================`);
  console.log(`🔍 [${category.name}] 収集開始... (ID: ${category.id || 'なし'})`);

  // 1. プロモーション true で取得（案件動画ファイルA）
  console.log(`  -> search.list (videoPaidProductPlacement=true)...`);
  const sponsoredSearch = await fetchSearchList(apiKey, {
    ...dateRange,
    videoCategoryId: category.id,
    videoPaidProductPlacement: 'true'
  });

  const sponsoredItems = (sponsoredSearch.items || []).filter(item => {
    return item.id && item.id.videoId && isValidQuizVideo(item.snippet);
  });

  const sponsoredMap = new Map();
  for (const item of sponsoredItems) {
    sponsoredMap.set(item.id.videoId, {
      id: item.id.videoId,
      title: item.snippet.title,
      channelTitle: item.snippet.channelTitle,
      thumbnailUrl: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.medium?.url || `https://i.ytimg.com/vi/${item.id.videoId}/hqdefault.jpg`,
      isSponsored: true
    });
  }
  console.log(`  -> 案件動画候補: ${sponsoredMap.size} 本確定`);

  // 2. プロモーション any で取得（通常動画ファイルB候補）
  console.log(`  -> search.list (videoPaidProductPlacement=any)...`);
  const anySearch = await fetchSearchList(apiKey, {
    ...dateRange,
    videoCategoryId: category.id,
    videoPaidProductPlacement: 'any'
  });

  const anyItems = (anySearch.items || []).filter(item => {
    return item.id && item.id.videoId && isValidQuizVideo(item.snippet);
  });

  // Aにすでにあるものは除外し、残りを videos.list で検証
  const candidatesToCheck = [];
  for (const item of anyItems) {
    const vId = item.id.videoId;
    if (!sponsoredMap.has(vId)) {
      candidatesToCheck.push(item);
    }
  }

  console.log(`  -> videos.list で詳細検証する通常候補: ${candidatesToCheck.length} 本`);
  const checkIds = candidatesToCheck.map(item => item.id.videoId);
  
  // 最大50件を一括検証
  const videoDetails = await fetchVideosList(apiKey, checkIds.slice(0, 50));
  
  const normalVideos = [];
  for (const vItem of (videoDetails.items || [])) {
    const isPromo = vItem.paidProductPlacementDetails?.hasPaidProductPlacement === true;
    const videoData = {
      id: vItem.id,
      title: vItem.snippet.title,
      channelTitle: vItem.snippet.channelTitle,
      thumbnailUrl: vItem.snippet.thumbnails?.high?.url || vItem.snippet.thumbnails?.medium?.url || `https://i.ytimg.com/vi/${vItem.id}/hqdefault.jpg`,
      isSponsored: isPromo
    };

    if (isPromo) {
      // もしプロモなら A（案件）に合流
      sponsoredMap.set(vItem.id, videoData);
    } else {
      // プロモでなければ B（通常）に格納
      normalVideos.push(videoData);
    }
  }

  const finalSponsored = Array.from(sponsoredMap.values());
  console.log(`  ✨ [${category.name}] 完了: 案件 ${finalSponsored.length} 本 / 通常 ${normalVideos.length} 本`);

  return {
    category: category.key,
    categoryName: category.name,
    updatedAt: new Date().toISOString(),
    counts: {
      sponsored: finalSponsored.length,
      normal: normalVideos.length,
      total: finalSponsored.length + normalVideos.length
    },
    sponsored: finalSponsored.map(v => ({
      id: v.id,
      title: v.title,
      channelTitle: v.channelTitle,
      thumbnailUrl: v.thumbnailUrl
    })),
    normal: normalVideos.map(v => ({
      id: v.id,
      title: v.title,
      channelTitle: v.channelTitle,
      thumbnailUrl: v.thumbnailUrl
    }))
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
