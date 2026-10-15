/**
 * js/app.js
 * サムネイル案件クイズ - クライアントサイドメインロジック
 */

// カテゴリ定義
const CATEGORIES = [
  { key: 'all', name: '総合（全ジャンル）' },
  { key: 'gadget', name: 'ガジェット・家電' },
  { key: 'beauty', name: 'コスメ・美容・暮らし' },
  { key: 'gaming', name: 'ゲーム' },
  { key: 'entertainment', name: 'エンタメ・バラエティ' },
  { key: 'vlog', name: '日常・Vlog' },
  { key: 'vehicles', name: '車・乗り物' },
  { key: 'business', name: 'ビジネス・教養' }
];

// DOM要素の参照
const screens = {
  category: document.getElementById('screen-category'),
  quiz: document.getElementById('screen-quiz'),
  result: document.getElementById('screen-result')
};

const categoryChipsContainer = document.getElementById('category-chips');
const loadingNotice = document.getElementById('loading-notice');
const brandSubtitle = document.getElementById('brand-subtitle');

// 背景エフェクト要素
const gameBgEffects = document.getElementById('game-bg-effects');
const bgSymbolWrap = document.getElementById('bg-symbol-wrap');
const bgTextWrap = document.getElementById('bg-text-wrap');

// クイズ画面要素
const quizCatName = document.getElementById('quiz-cat-name');
const quizProgressText = document.getElementById('quiz-progress-text');
const progressBarFill = document.getElementById('progress-bar-fill');
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
const btnShareX = document.getElementById('btn-share-x');
const btnReplay = document.getElementById('btn-replay');
const reviewList = document.getElementById('review-list');

// ゲーム状態管理
let selectedCategory = CATEGORIES[0];
let questions = []; // 全10問（案件5 + 通常5）
let currentIndex = 0;
let userAnswers = []; // 各問の回答履歴
let isCurrentAnswered = false;

// HTMLエスケープヘルパー
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// 配列シャッフル (Fisher-Yates)
function shuffleArray(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// ゲーム背景エフェクト表示（巨大◯・✕ & 案件・案件じゃない）
let effectTimerId = null;

function showAnswerEffect(isCorrect, isSponsored) {
  if (!gameBgEffects || !bgSymbolWrap || !bgTextWrap) return;

  clearAnswerEffect();

  // 1. 巨大 ◯ / ✕
  if (isCorrect) {
    bgSymbolWrap.innerHTML = `
      <svg class="bg-symbol-svg symbol-correct" viewBox="0 0 200 200">
        <circle cx="100" cy="100" r="74" fill="none" stroke="currentColor" stroke-width="26" />
      </svg>
    `;
  } else {
    bgSymbolWrap.innerHTML = `
      <svg class="bg-symbol-svg symbol-wrong" viewBox="0 0 200 200">
        <line x1="38" y1="38" x2="162" y2="162" stroke="currentColor" stroke-width="26" stroke-linecap="round" />
        <line x1="162" y1="38" x2="38" y2="162" stroke="currentColor" stroke-width="26" stroke-linecap="round" />
      </svg>
    `;
  }

  // 2. 巨大「案件」/「案件\nじゃない」
  if (isSponsored) {
    bgTextWrap.innerHTML = `<span class="bg-stamp-text stamp-sponsored">案件</span>`;
  } else {
    bgTextWrap.innerHTML = `<span class="bg-stamp-text stamp-normal">案件<br>じゃない</span>`;
  }

  gameBgEffects.className = 'game-bg-effects active';

  // 要望: 「もう1びょう長く」（合計2秒で消える）
  effectTimerId = setTimeout(() => {
    clearAnswerEffect();
  }, 2000);
}

// ゲーム背景エフェクトの消去
function clearAnswerEffect() {
  if (effectTimerId) {
    clearTimeout(effectTimerId);
    effectTimerId = null;
  }
  if (!gameBgEffects) return;
  gameBgEffects.className = 'game-bg-effects';
  if (bgSymbolWrap) bgSymbolWrap.innerHTML = '';
  if (bgTextWrap) bgTextWrap.innerHTML = '';
}

// 画面切り替え（DOM操作）
function switchScreen(screenName) {
  clearAnswerEffect();
  Object.values(screens).forEach(screen => {
    screen.classList.remove('active');
  });
  if (screens[screenName]) {
    screens[screenName].classList.add('active');
  }

  // 1ページ目（category）と2・3ページ目（quiz・result）でヘッダー・フッターの表示を切り替え
  if (screenName === 'category') {
    document.body.classList.remove('mode-compact-bars');
    if (brandSubtitle) {
      brandSubtitle.textContent = 'サムネとタイトルだけで企業案件を見抜こう！';
    }
  } else {
    document.body.classList.add('mode-compact-bars');
    if (brandSubtitle) {
      brandSubtitle.textContent = 'サムネとタイトルだけで、企業案件か見抜けるか？';
    }
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

const DATA_BASE_URL = 'https://raw.githubusercontent.com/osuosu23/anken-quiz-data/main/data';

// カテゴリデータの読み込み
async function loadCategoryData(categoryKey) {
  const cacheBust = `?t=${Date.now()}`;
  const spUrl = `${DATA_BASE_URL}/${categoryKey}_sponsored.json${cacheBust}`;
  const nmUrl = `${DATA_BASE_URL}/${categoryKey}_normal.json${cacheBust}`;

  try {
    const [spRes, nmRes] = await Promise.all([
      fetch(spUrl),
      fetch(nmUrl)
    ]);

    if (spRes.ok && nmRes.ok) {
      const sponsored = await spRes.json();
      const normal = await nmRes.json();

      if (Array.isArray(sponsored) && Array.isArray(normal) && sponsored.length >= 5 && normal.length >= 5) {
        return { sponsored, normal };
      }
    }
  } catch (err) {
    console.error(`[loadCategoryData] データ読み込み失敗 (${categoryKey}):`, err);
  }

  return { sponsored: [], normal: [] };
}



// 10問サンプリング（厳密に案件5問＋通常5問を抽出してシャッフル）
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

// 1ページ目: ジャンル選択UIの初期化
// ジャンルを選択すると即座に次ページへ遷移
function initCategoryPicker() {
  categoryChipsContainer.innerHTML = '';
  CATEGORIES.forEach(cat => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'category-chip';
    chip.textContent = cat.name;
    chip.dataset.key = cat.key;

    chip.addEventListener('click', () => {
      selectedCategory = cat;
      startQuiz();
    });

    categoryChipsContainer.appendChild(chip);
  });
}

// クイズ開始処理（ジャンル選択から直接呼ばれる）
async function startQuiz() {
  if (loadingNotice) {
    loadingNotice.style.display = 'block';
  }
  // 全チップを一時的に無効化
  const chips = categoryChipsContainer.querySelectorAll('.category-chip');
  chips.forEach(c => c.disabled = true);

  const data = await loadCategoryData(selectedCategory.key);

  if (loadingNotice) {
    loadingNotice.style.display = 'none';
  }
  chips.forEach(c => c.disabled = false);

  if (data.sponsored.length === 0 && data.normal.length === 0) {
    alert('クイズデータの読み込みに失敗しました。');
    return;
  }

  questions = sampleQuestions(data.sponsored, data.normal);
  currentIndex = 0;
  userAnswers = [];

  // 問題画面へDOM切り替え
  switchScreen('quiz');
  renderQuestion(currentIndex);
}

// 2ページ目: 問題画面の描画
function renderQuestion(index) {
  clearAnswerEffect();
  const q = questions[index];
  isCurrentAnswered = false;

  // 上部進行バー
  quizCatName.textContent = selectedCategory.name;
  quizProgressText.textContent = `第 ${index + 1} / 10 問`;
  progressBarFill.style.width = `${((index + 1) / 10) * 100}%`;

  // 画像は使わず、最初からYouTube埋め込みプレーヤーを表示（自動再生なし）
  quizIframe.src = `https://www.youtube-nocookie.com/embed/${q.id}?rel=0`;

  // メタ情報（タイトル・投稿者）
  quizVideoTitle.textContent = q.title;
  quizChannelTitle.textContent = `投稿者: ${q.channelTitle || '不明'}`;

  // ボタン状態リセット
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

  // 要望: 「回答ボタンは回答したら消してそこに答えをだして、あと高さが変わらないように」
  choiceButtonsRow.style.display = 'none';

  // フィードバック表示（ボタンと同じ領域に入れ替え表示）
  feedbackBox.classList.add('active');
  feedbackBanner.className = `feedback-banner ${isCorrect ? 'correct' : 'wrong'}`;
  feedbackIcon.textContent = isCorrect ? '⭕️' : '❌';
  feedbackTitle.textContent = isCorrect ? '正解！' : '不正解！';
  feedbackDetail.textContent = q.isSponsored
    ? 'この動画は【案件】です。'
    : 'この動画は【案件じゃない】です。';

  // 要望: 「背景に 正解ならめちゃくちゃ大きな◯ 不正解ならばつ をアニメーションでだして。案件なら案件、案件じゃないなら案件\nじゃない」
  showAnswerEffect(isCorrect, q.isSponsored);

  // 次へボタンのラベル
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

// 3ページ目: 結果画面表示
function showResult() {
  // 問題画面のiframe再生を停止
  quizIframe.src = '';

  const correctCount = userAnswers.filter(a => a.isCorrect).length;
  // 変な称号は使わず、正解数のみシンプルに表示
  resultScore.textContent = `${correctCount} / 10`;

  // Xシェアリンク生成（称号は含めない）
  const shareText = `【サムネイル案件クイズ】\nジャンル: ${selectedCategory.name}\n正解数: 10問中 ${correctCount}問！\n\nサムネとタイトルだけで企業案件か見抜けるか挑戦しよう！\n`;
  const shareUrl = window.location.href.split('#')[0];
  const xUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}&hashtags=${encodeURIComponent('サムネイル案件クイズ,YouTube')}`;
  btnShareX.href = xUrl;

  // 振り返りリスト作成（画像は使わず、すべてYouTube埋め込みで表示）
  reviewList.innerHTML = '';
  userAnswers.forEach((ans, idx) => {
    const q = ans.question;
    const item = document.createElement('div');
    item.className = 'review-card';

    item.innerHTML = `
      <div class="review-embed-container">
        <iframe
          src="https://www.youtube-nocookie.com/embed/${q.id}?rel=0"
          title="${escapeHtml(q.title)}"
          loading="lazy"
          allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen>
        </iframe>
      </div>
      <div class="review-info">
        <div class="review-status-row">
          <span class="badge-status ${ans.isCorrect ? 'correct' : 'wrong'}">
            ${ans.isCorrect ? '⭕️ 正解' : '❌ 不正解'}
          </span>
          <span class="badge-type">
            ${q.isSponsored ? '案件' : '案件じゃない'}
          </span>
        </div>
        <h3 class="review-title">${escapeHtml(q.title)}</h3>
        <p class="review-channel">投稿者: ${escapeHtml(q.channelTitle || '不明')}</p>
      </div>
    `;

    reviewList.appendChild(item);
  });

  // 結果画面へDOM切り替え
  switchScreen('result');
}

// イベントリスナーの登録
function initEventListeners() {
  btnAnswerSponsored.addEventListener('click', () => handleAnswer(true));
  btnAnswerNormal.addEventListener('click', () => handleAnswer(false));
  btnNext.addEventListener('click', handleNext);

  btnReplay.addEventListener('click', () => {
    switchScreen('category');
  });
}

// 初期化実行
function init() {
  initCategoryPicker();
  initEventListeners();
}

document.addEventListener('DOMContentLoaded', init);
