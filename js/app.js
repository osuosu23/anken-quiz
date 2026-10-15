/**
 * js/app.js
 * サムネイル案件クイズ - クライアントサイドメインロジック
 */

// カテゴリ定義（全9ジャンル）
const CATEGORIES = [
  { key: 'all', name: '🌟 総合（全ジャンル）' },
  { key: 'gadget', name: '📱 ガジェット・家電' },
  { key: 'beauty', name: '💄 コスメ・美容・暮らし' },
  { key: 'gaming', name: '🎮 ゲーム' },
  { key: 'entertainment', name: '🎉 エンタメ・バラエティ' },
  { key: 'vlog', name: '☕️ 日常・Vlog' },
  { key: 'vehicles', name: '🚗 車・乗り物' },
  { key: 'sports', name: '⚽️ スポーツ・筋トレ' },
  { key: 'business', name: '💼 ビジネス・教養' }
];

// ランク判定テーブル
const RANKS = [
  {
    minScore: 10,
    title: '🏆 伝説の案件ソムリエ',
    desc: '「歩く景品表示法」の異名を持つ。サムネのわずかな違和感、色味、画角からすべての企業案件を看破する神の領域です。'
  },
  {
    minScore: 8,
    title: '🥇 一流案件鑑定士',
    desc: 'ステマを見抜く鋭い眼光の持ち主。巧妙に隠されたタイアップ動画も高確率で見破ることができます。'
  },
  {
    minScore: 6,
    title: '🥈 中堅リスナー',
    desc: 'なかなかの見極め力。あからさまな案件には騙されませんが、巧みな企画系タイアップには時々惑わされることも。'
  },
  {
    minScore: 4,
    title: '🥉 一般視聴者',
    desc: 'サムネイルの魅力に素直に惹かれるタイプ。「えっ、これ案件だったの！？」と後から気づくことが多いはず。'
  },
  {
    minScore: 0,
    title: '🌱 ピュアな心の持ち主',
    desc: 'すべての動画を純粋無垢に楽しむ聖人。PR表記があろうがなかろうが、動画が面白ければオールOK！'
  }
];

// DOM要素の参照
const screens = {
  category: document.getElementById('screen-category'),
  quiz: document.getElementById('screen-quiz'),
  result: document.getElementById('screen-result')
};

const categoryChipsContainer = document.getElementById('category-chips');
const btnStart = document.getElementById('btn-start');

// クイズ画面要素
const quizCatName = document.getElementById('quiz-cat-name');
const quizProgressText = document.getElementById('quiz-progress-text');
const progressBarFill = document.getElementById('progress-bar-fill');
const quizThumb = document.getElementById('quiz-thumb');
const quizPlayerContainer = document.getElementById('quiz-player-container');
const quizIframe = document.getElementById('quiz-iframe');
const quizVideoTitle = document.getElementById('quiz-video-title');
const quizChannelTitle = document.getElementById('quiz-channel-title');

const choiceButtonsRow = document.getElementById('choice-buttons-row');
const btnAnswerSponsored = document.getElementById('btn-answer-sponsored');
const btnAnswerNormal = document.getElementById('btn-answer-normal');

const feedbackBox = document.getElementById('feedback-box');
const feedbackBanner = document.getElementById('feedback-banner');
const feedbackIcon = document.getElementById('feedback-icon');
const feedbackTitle = document.getElementById('feedback-title');
const feedbackDetail = document.getElementById('feedback-detail');
const btnNext = document.getElementById('btn-next');

// 結果画面要素
const resultScore = document.getElementById('result-score');
const resultRankTitle = document.getElementById('result-rank-title');
const resultRankDesc = document.getElementById('result-rank-desc');
const btnShareX = document.getElementById('btn-share-x');
const btnReplay = document.getElementById('btn-replay');
const btnChangeCat = document.getElementById('btn-change-cat');
const reviewList = document.getElementById('review-list');

// ゲーム状態管理
let selectedCategory = CATEGORIES[0];
let questions = []; // 全10問（案件5 + 通常5）
let currentIndex = 0;
let userAnswers = []; // 各問の回答履歴
let isCurrentAnswered = false;

// Fisher-Yates 配列シャッフル
function shuffleArray(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// 画面切り替え
function switchScreen(screenName) {
  Object.values(screens).forEach(screen => {
    screen.classList.remove('active');
  });
  if (screens[screenName]) {
    screens[screenName].classList.add('active');
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// カテゴリデータの読み込み（完全相対パス対応・独自ドメイン / 各種ホスティング対応）
async function loadCategoryData(categoryKey) {
  const spUrl = `./data/${categoryKey}_sponsored.json`;
  const nmUrl = `./data/${categoryKey}_normal.json`;

  try {
    const [spRes, nmRes] = await Promise.all([
      fetch(spUrl),
      fetch(nmUrl)
    ]);

    if (spRes.ok && nmRes.ok) {
      const sponsored = await spRes.json();
      const normal = await nmRes.json();

      if (sponsored.length >= 5 && normal.length >= 5) {
        return { sponsored, normal };
      }
    }
  } catch (err) {
    console.warn(`[loadCategoryData] 相対パスでの読み込みに失敗 (${categoryKey}):`, err);
  }

  // 万が一データ不足・失敗時の予備フォールバック（総合データ・相対パス）
  try {
    const [allSpRes, allNmRes] = await Promise.all([
      fetch('./data/all_sponsored.json'),
      fetch('./data/all_normal.json')
    ]);
    return {
      sponsored: allSpRes.ok ? await allSpRes.json() : [],
      normal: allNmRes.ok ? await allNmRes.json() : []
    };
  } catch (err) {
    console.error('データ読み込みエラー:', err);
    return { sponsored: [], normal: [] };
  }
}

// 10問サンプラー（厳密に案件5問＋通常5問を抽出してシャッフル）
function sampleQuestions(sponsoredList, normalList) {
  const shuffledSponsored = shuffleArray(sponsoredList).slice(0, 5).map(item => ({
    ...item,
    isSponsored: true
  }));

  const shuffledNormal = shuffleArray(normalList).slice(0, 5).map(item => ({
    ...item,
    isSponsored: false
  }));

  const combined = [...shuffledSponsored, ...shuffledNormal];
  return shuffleArray(combined);
}

// カテゴリ選択UIの初期化
function initCategoryPicker() {
  categoryChipsContainer.innerHTML = '';
  CATEGORIES.forEach((cat, index) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = `category-chip ${index === 0 ? 'selected' : ''}`;
    chip.textContent = cat.name;
    chip.dataset.key = cat.key;

    chip.addEventListener('click', () => {
      document.querySelectorAll('.category-chip').forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');
      selectedCategory = cat;
    });

    categoryChipsContainer.appendChild(chip);
  });
}

// クイズ開始
async function startQuiz() {
  btnStart.disabled = true;
  btnStart.textContent = '問題を作成中...';

  const data = await loadCategoryData(selectedCategory.key);

  if (data.sponsored.length === 0 && data.normal.length === 0) {
    alert('クイズデータの取得に失敗しました。');
    btnStart.disabled = false;
    btnStart.textContent = 'クイズを始める（全10問）';
    return;
  }

  questions = sampleQuestions(data.sponsored, data.normal);
  currentIndex = 0;
  userAnswers = [];

  btnStart.disabled = false;
  btnStart.textContent = 'クイズを始める（全10問）';

  switchScreen('quiz');
  renderQuestion(currentIndex);
}

// 問題の描画
function renderQuestion(index) {
  const q = questions[index];
  isCurrentAnswered = false;

  // 上部進行バー
  quizCatName.textContent = selectedCategory.name;
  quizProgressText.textContent = `第 ${index + 1} / 10 問`;
  progressBarFill.style.width = `${((index + 1) / 10) * 100}%`;

  // サムネイル設定
  quizThumb.src = q.thumbnailUrl || `https://i.ytimg.com/vi/${q.id}/hqdefault.jpg`;
  quizThumb.alt = q.title;
  quizThumb.style.display = 'block';

  // プレイヤー非表示＆リセット
  quizPlayerContainer.classList.remove('active');
  quizIframe.src = '';

  // メタ情報
  quizVideoTitle.textContent = q.title;
  quizChannelTitle.textContent = q.channelTitle || 'YouTube Channel';

  // ボタンリセット
  btnAnswerSponsored.disabled = false;
  btnAnswerNormal.disabled = false;
  choiceButtonsRow.style.display = 'grid';

  // フィードバック非表示
  feedbackBox.classList.remove('active');
}

// 回答処理
function handleAnswer(userChoice) {
  if (isCurrentAnswered) return;
  isCurrentAnswered = true;

  const q = questions[currentIndex];
  const isCorrect = (userChoice === q.isSponsored);

  // 回答履歴に保存
  userAnswers.push({
    question: q,
    userChoice: userChoice,
    isCorrect: isCorrect
  });

  // 選択ボタンを無効化
  btnAnswerSponsored.disabled = true;
  btnAnswerNormal.disabled = true;

  // YouTube 埋め込みプレイヤーを起動（回答後に正解検証可能にする）
  quizPlayerContainer.classList.add('active');
  quizIframe.src = `https://www.youtube-nocookie.com/embed/${q.id}?autoplay=1&rel=0`;

  // フィードバック表示
  feedbackBox.classList.add('active');
  feedbackBanner.className = `feedback-banner ${isCorrect ? 'correct' : 'wrong'}`;
  feedbackIcon.textContent = isCorrect ? '⭕️' : '❌';
  feedbackTitle.textContent = isCorrect ? '正解！' : '不正解！';
  feedbackDetail.textContent = q.isSponsored
    ? 'この動画は【企業案件】です。'
    : 'この動画は【通常の動画（非案件）】です。';

  // 次へボタンのテキスト
  btnNext.textContent = (currentIndex === 9) ? '結果を見る' : '次の問題へ';
}

// 次の問題へ
function handleNext() {
  if (currentIndex < 9) {
    currentIndex++;
    renderQuestion(currentIndex);
  } else {
    showResult();
  }
}

// 結果画面表示
function showResult() {
  const correctCount = userAnswers.filter(a => a.isCorrect).length;
  resultScore.textContent = `${correctCount} / 10`;

  // ランク判定
  const rank = RANKS.find(r => correctCount >= r.minScore) || RANKS[RANKS.length - 1];
  resultRankTitle.textContent = rank.title;
  resultRankDesc.textContent = rank.desc;

  // X（Twitter）シェアリンク生成
  const shareText = `【サムネイル案件クイズ】\nジャンル: ${selectedCategory.name}\n結果: 10問中 ${correctCount}問 正解！\n称号: ${rank.title}\n\nサムネとタイトルだけで企業案件を見抜けるか挑戦しよう！\n`;
  const shareUrl = window.location.href.split('#')[0];
  const xUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}&hashtags=${encodeURIComponent('サムネイル案件クイズ,YouTube')}`;
  btnShareX.href = xUrl;

  // 振り返りリスト作成
  reviewList.innerHTML = '';
  userAnswers.forEach((ans, idx) => {
    const q = ans.question;
    const item = document.createElement('div');
    item.className = 'review-item';

    item.innerHTML = `
      <a href="https://www.youtube.com/watch?v=${q.id}" target="_blank" rel="noopener noreferrer">
        <img class="review-thumb" src="${q.thumbnailUrl}" alt="${q.title}">
      </a>
      <div class="review-meta">
        <a class="review-title" href="https://www.youtube.com/watch?v=${q.id}" target="_blank" rel="noopener noreferrer">${q.title}</a>
        <span class="review-channel">${q.channelTitle}</span>
      </div>
      <div class="review-badge-group">
        <span class="badge-status ${ans.isCorrect ? 'correct' : 'wrong'}">
          ${ans.isCorrect ? '⭕️ 正解' : '❌ 不正解'}
        </span>
        <span class="badge-tag">${q.isSponsored ? '💼 案件' : '🎬 通常'}</span>
      </div>
    `;

    reviewList.appendChild(item);
  });

  switchScreen('result');
}

// イベントリスナー登録
function initEventListeners() {
  btnStart.addEventListener('click', startQuiz);

  btnAnswerSponsored.addEventListener('click', () => handleAnswer(true));
  btnAnswerNormal.addEventListener('click', () => handleAnswer(false));
  btnNext.addEventListener('click', handleNext);

  btnReplay.addEventListener('click', startQuiz);
  btnChangeCat.addEventListener('click', () => {
    switchScreen('category');
  });
}

// 初期化実行
function init() {
  initCategoryPicker();
  initEventListeners();
}

document.addEventListener('DOMContentLoaded', init);
