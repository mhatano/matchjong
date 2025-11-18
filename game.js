// game.js

// --- DOM要素の取得 ---
const canvas = document.getElementById('game-board');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const statusEl = document.getElementById('game-status');
const handSlotsContainer = document.getElementById('hand-slots');
const hintContainer = document.getElementById('hint-container');
const hintButton = document.getElementById('hint-button');

// --- ゲーム設定 ---
const GRID_SIZE = 20;
const TILE_SIZE = canvas.width / GRID_SIZE;
const PAI_KINDS = [
    ...Array.from({ length: 9 }, (_, i) => createPai(PAI_TYPES.MANZU, i + 1)),
    ...Array.from({ length: 9 }, (_, i) => createPai(PAI_TYPES.PINZU, i + 1)),
    ...Array.from({ length: 9 }, (_, i) => createPai(PAI_TYPES.SOUZU, i + 1)),
    ...Array.from({ length: 7 }, (_, i) => createPai(PAI_TYPES.JIHAI, i + 1)),
];

// --- ゲーム状態 ---
let board = [];
let hand = [];
let score = 0;
let selectedTile = null;
let gameState = 'COLLECTING_MELTS'; // or 'MAKING_PAIR'
let matchableTiles = new Set();
let isHintActive = false; // ヒント機能が有効かどうかのフラグ

// --- 初期化処理 ---
function init() {
    // 手牌スロットの生成
    for (let i = 0; i < 14; i++) {
        const slot = document.createElement('div');
        slot.classList.add('hand-slot');
        slot.id = `slot-${i}`;
        handSlotsContainer.appendChild(slot);
    }

    // ゲーム盤面の初期化
    for (let r = 0; r < GRID_SIZE; r++) {
        board[r] = [];
        for (let c = 0; c < GRID_SIZE; c++) {
            board[r][c] = getRandomPai();
        }
    }
    
    // 初期状態でマッチがないようにする
    let initialMatches;
    while((initialMatches = findMatches()).length > 0) {
        removeMatches(initialMatches.flat());
        fillBoard();
    }

    canvas.addEventListener('click', onCanvasClick);
    hintButton.addEventListener('click', onHintClick);
    updateDisplay();
    drawBoard();
}

// --- 描画処理 ---
function drawBoard() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            const pai = board[r][c];
            if (pai) {
                // マッチ可能な牌は背景色を変える
                const isMatchable = isHintActive && matchableTiles.has(`${r}-${c}`);
                drawPai(c * TILE_SIZE, r * TILE_SIZE, pai, isMatchable);
            }
            // 選択中の牌をハイライト
            if (selectedTile && selectedTile.r === r && selectedTile.c === c) {
                ctx.strokeStyle = 'yellow';
                ctx.lineWidth = 3;
                ctx.strokeRect(c * TILE_SIZE, r * TILE_SIZE, TILE_SIZE, TILE_SIZE);
            }
        }
    }
}

function drawPai(x, y, pai, isMatchable = false) {
    ctx.fillStyle = isMatchable ? '#e6f7ff' : 'white'; // マッチ可能なら水色、そうでなければ白
    ctx.fillRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
    ctx.strokeRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
    
    ctx.fillStyle = 'black';
    ctx.font = `${TILE_SIZE * 0.6}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(paiToString(pai), x + TILE_SIZE / 2, y + TILE_SIZE / 2);
}

// --- 画面更新 ---
function updateDisplay() {
    scoreEl.textContent = score;

    // 手牌スロットの更新
    for (let i = 0; i < 14; i++) {
        const slot = document.getElementById(`slot-${i}`);
        slot.textContent = hand[i] ? paiToString(hand[i]) : '';
    }

    // ゲーム状態の表示
    if (gameState === 'COLLECTING_MELTS') {
        statusEl.textContent = `面子を集めてください (${hand.length}/12)`;
    } else {
        statusEl.textContent = '聴牌！ 対子を作って和了！';
    }

    // スコアに応じてヒントボタンの表示を切り替える
    if (score >= 200 && gameState === 'COLLECTING_MELTS') {
        hintContainer.style.display = 'block';
    } else {
        hintContainer.style.display = 'none';
    }
}

// --- ゲームロジック ---

function getRandomPai() {
    return PAI_KINDS[Math.floor(Math.random() * PAI_KINDS.length)];
}

function onHintClick() {
    if (score < 200 || isHintActive) return;

    score -= 200;
    isHintActive = true;
    
    findAllMatchableTiles();
    updateDisplay();
    drawBoard();
}


async function onCanvasClick(event) {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const c = Math.floor(x / TILE_SIZE);
    const r = Math.floor(y / TILE_SIZE);

    if (!selectedTile) {
        selectedTile = { r, c };
    } else {
        // 隣接タイルかチェック
        const isAdjacent = Math.abs(selectedTile.r - r) + Math.abs(selectedTile.c - c) === 1;
        if (isAdjacent) {
            await swapAndCheck(selectedTile.r, selectedTile.c, r, c);
        }
        selectedTile = null;
    }
    drawBoard();
}

async function swapAndCheck(r1, c1, r2, c2) {
    // ヒントが有効な場合、スワップ操作が行われた時点で無効化する
    if (isHintActive) {
        isHintActive = false;
        matchableTiles.clear();
    }

    swap(r1, c1, r2, c2);
    drawBoard();
    await sleep(200);

    if (gameState === 'MAKING_PAIR') {
        // 聴牌時は、スワップした2牌が対子になるかだけをチェック
        const pai1 = board[r1][c1];
        const pai2 = board[r2][c2];
        const isPair = pai1.type === pai2.type && pai1.number === pai2.number;

        if (isPair) {
            // 和了！
            await handleWin([pai1, pai2], [{r: r1, c: c1}, {r: r2, c: c2}]);
        } else {
            // 対子でなければ、たとえ3つ揃いができても無効な動きとして元に戻す
            swap(r1, c1, r2, c2);
            drawBoard();
        }
    } else {
        // 通常の面子集め状態
        const matches = findMatches();
        if (matches.length > 0) {
            // マッチ成功
            await handleMatches(matches);
        } else {
            // マッチ失敗、元に戻す
            swap(r1, c1, r2, c2);
            drawBoard();
        }
    }
}

function swap(r1, c1, r2, c2) {
    [board[r1][c1], board[r2][c2]] = [board[r2][c2], board[r1][c1]];
}

function findMatches() {
    const matches = [];
    const checked = new Set();

    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            const key = `${r}-${c}`;
            if (checked.has(key) || !board[r][c]) continue;

            // --- 刻子（同じ牌が3つ）---
            // 横
            if (c < GRID_SIZE - 2 && board[r][c].type === board[r][c+1].type && board[r][c].number === board[r][c+1].number && board[r][c+1].type === board[r][c+2].type && board[r][c+1].number === board[r][c+2].number) {
                const match = [{r, c}, {r, c: c+1}, {r, c: c+2}];
                matches.push(match);
                // マッチを一つ見つけたら、すぐに結果を返して探索を終了する
                return matches;
            }
            // 縦
            if (r < GRID_SIZE - 2 && board[r][c].type === board[r+1][c].type && board[r][c].number === board[r+1][c].number && board[r+1][c].type === board[r+2][c].type && board[r+1][c].number === board[r+2][c].number) {
                const match = [{r, c}, {r: r+1, c}, {r: r+2, c}];
                matches.push(match);
                // マッチを一つ見つけたら、すぐに結果を返して探索を終了する
                return matches;
            }

            // --- 順子（連続した数字）---
            // 横
            if (c < GRID_SIZE - 2) {
                const pais = [board[r][c], board[r][c+1], board[r][c+2]].sort((a,b) => a.number - b.number);
                if (pais[0].type !== 'z' && pais[0].type === pais[1].type && pais[1].type === pais[2].type && pais[0].number + 1 === pais[1].number && pais[1].number + 1 === pais[2].number) {
                    const match = [{r, c}, {r, c: c+1}, {r, c: c+2}];
                    matches.push(match);
                    // マッチを一つ見つけたら、すぐに結果を返して探索を終了する
                    return matches;
                }
            }
            // 縦
            if (r < GRID_SIZE - 2) {
                const pais = [board[r][c], board[r+1][c], board[r+2][c]].sort((a,b) => a.number - b.number);
                if (pais[0].type !== 'z' && pais[0].type === pais[1].type && pais[1].type === pais[2].type && pais[0].number + 1 === pais[1].number && pais[1].number + 1 === pais[2].number) {
                    const match = [{r, c}, {r: r+1, c}, {r: r+2, c}];
                    matches.push(match);
                    // マッチを一つ見つけたら、すぐに結果を返して探索を終了する
                    return matches;
                }
            }
        }
    }
    return matches;
}

async function handleWin(winPais, winPositions) {
    hand.push(...winPais);

    if (hand.length === 14) {
        const yakuScore = calculateScore(hand);
        score += yakuScore;
        updateDisplay(); // スコアを先に更新
        await sleep(100);
        alert(`和了！ ${yakuScore}点獲得！`);

        // リセット
        hand = [];
        gameState = 'COLLECTING_MELTS';
    } else {
        console.error("手牌が14枚になっていません。和了処理を中断します。");
        hand.pop();
        hand.pop();
        return; // 異常終了
    }

    // 和了した牌を盤面から消す
    for (const pos of winPositions) {
        board[pos.r][pos.c] = null;
    }
    await processBoardAfterRemove();
}

async function handleMatches(matches) {
    for (const match of matches) {
        const pais = match.map(p => board[p.r][p.c]);
        
        if (gameState === 'COLLECTING_MELTS' && hand.length < 12) {
            hand.push(...pais);
            hand.sort((a, b) => a.type.localeCompare(b.type) || a.number - b.number);
        }
    }

    // 状態遷移
    if (hand.length >= 12 && gameState === 'COLLECTING_MELTS') {
        gameState = 'MAKING_PAIR';
    }
    
    removeMatches(matches.flat());
    await processBoardAfterRemove();
}

async function processBoardAfterRemove() {
    drawBoard();
    await sleep(300);

    // 牌を落とす
    fallDown();
    drawBoard();
    await sleep(300);

    // 新しい牌を補充
    fillBoard();
    drawBoard();
    await sleep(300);
    
    // 補充後に新たなマッチがあれば連鎖（聴牌状態では連鎖しない）
    if (gameState === 'COLLECTING_MELTS') {
        await checkAndHandleChain();
    }

    updateDisplay();
}

async function checkAndHandleChain() {
    const newMatches = findMatches();
    if (newMatches.length > 0) {
        await handleMatches(newMatches);
    } else {
        // 連鎖が終了し、操作可能な状態になったら手詰まりをチェック
        if (!hasValidMoves()) {
            alert("手詰まりになりました。盤面をシャッフルします。");
            await shuffleBoard();
        }
    }
}

function removeMatches(matchPositions) {
    if (!matchPositions) { // 引数がない場合は全マッチを探す
        matchPositions = findMatches().flat();
    }
    for (const pos of matchPositions) {
        board[pos.r][pos.c] = null;
    }
}

function fallDown() {
    for (let c = 0; c < GRID_SIZE; c++) {
        let emptyRow = -1;
        for (let r = GRID_SIZE - 1; r >= 0; r--) {
            if (board[r][c] === null && emptyRow === -1) {
                emptyRow = r;
            } else if (board[r][c] !== null && emptyRow !== -1) {
                board[emptyRow][c] = board[r][c];
                board[r][c] = null;
                emptyRow--;
            }
        }
    }
}

function fillBoard() {
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            if (board[r][c] === null) {
                board[r][c] = getRandomPai();
            }
        }
    }
}

/**
 * マッチ可能なすべての牌を見つけて matchableTiles を更新する
 */
function findAllMatchableTiles() {
    matchableTiles.clear();
    if (gameState === 'MAKING_PAIR') return;

    // 水平方向のスワップをチェック
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE - 1; c++) {
            swap(r, c, r, c + 1); // 仮想的にスワップ
            if (findMatches().length > 0) {
                matchableTiles.add(`${r}-${c}`);
                matchableTiles.add(`${r}-${c + 1}`);
            }
            swap(r, c, r, c + 1); // 元に戻す
        }
    }

    // 垂直方向のスワップをチェック
    for (let r = 0; r < GRID_SIZE - 1; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            swap(r, c, r + 1, c); // 仮想的にスワップ
            if (findMatches().length > 0) {
                matchableTiles.add(`${r}-${c}`);
                matchableTiles.add(`${r + 1}-${c}`);
            }
            swap(r, c, r + 1, c); // 元に戻す
        }
    }
}

/**
 * 盤面上に有効な手（マッチにつながるスワップ）があるかチェックする
 * @returns {boolean} 有効な手がある場合は true, ない場合は false
 */
function hasValidMoves() {
    // 聴牌状態ではこのチェックは不要
    if (gameState === 'MAKING_PAIR') return true;

    // 盤面全体をチェックして有効な手があるか確認
    // 水平方向のスワップをチェック
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE - 1; c++) {
            swap(r, c, r, c + 1); // 仮想的にスワップ
            if (findMatches().length > 0) {
                swap(r, c, r, c + 1); // 元に戻す
                return true;
            }
            swap(r, c, r, c + 1); // 元に戻す
        }
    }
    // 垂直方向のスワップをチェック
    for (let r = 0; r < GRID_SIZE - 1; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            swap(r, c, r + 1, c); // 仮想的にスワップ
            if (findMatches().length > 0) {
                swap(r, c, r + 1, c); // 元に戻す
                return true;
            }
            swap(r, c, r + 1, c); // 元に戻す
        }
    }
    return false;
}

async function shuffleBoard() {
    let allPais = board.flat();

    // Fisher-Yates shuffle
    for (let i = allPais.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allPais[i], allPais[j]] = [allPais[j], allPais[i]];
    }

    board = Array.from({ length: GRID_SIZE }, (_, r) => allPais.slice(r * GRID_SIZE, (r + 1) * GRID_SIZE));
    
    drawBoard();
    await sleep(300);

    // シャッフル後もマッチや手詰まりがないか再チェック
    await checkAndHandleChain();
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// --- ゲーム開始 ---
init();
