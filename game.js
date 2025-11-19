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
let PAI_KINDS; // init関数内で初期化

// --- ゲーム状態 ---
let board = [];
let hand = [];
let score;
let stars;
let lastStarRecoveryCheckTime; // 時間による★回復を最後にチェックした時刻
let selectedTile = null;
let gameState;
let matchableTiles = new Set();
let isHintActive = false; // ヒント機能が有効かどうかのフラグ

// --- 初期化処理 ---
function init() {
    // 牌の種類を定義（mahjong-logic.jsの読み込み後に行う）
    PAI_KINDS = [
        ...Array.from({ length: 9 }, (_, i) => createPai(PAI_TYPES.MANZU, i + 1)),
        ...Array.from({ length: 9 }, (_, i) => createPai(PAI_TYPES.PINZU, i + 1)),
        ...Array.from({ length: 9 }, (_, i) => createPai(PAI_TYPES.SOUZU, i + 1)),
        ...Array.from({ length: 7 }, (_, i) => createPai(PAI_TYPES.JIHAI, i + 1)),
    ];

    if (loadGame()) {
        // 時間経過による★の回復を計算
        const now = Date.now();
        const elapsedHours = (now - lastStarRecoveryCheckTime) / (1000 * 60 * 60);
        if (elapsedHours >= 5) {
            const starsToRecover = Math.min(Math.floor(elapsedHours / 5), 5); // 回復は最大5個まで
            stars = Math.min(stars, 10); // 現在のスターが10を超えていたら10にする
            stars = Math.min(stars + starsToRecover, 10); // 回復しても10を超えない
            lastStarRecoveryCheckTime = now; // 最終チェック時刻を更新
            saveGame();
        }
    } else {
        // セーブデータがない場合、ゲームを初期化
        resetGame();
    }

    // 手牌スロットの生成
    for (let i = 0; i < 14; i++) {
        const slot = document.createElement('div');
        slot.classList.add('hand-slot');
        slot.id = `slot-${i}`;
        handSlotsContainer.appendChild(slot);
    }

    canvas.addEventListener('click', onCanvasClick);
    hintButton.addEventListener('click', onHintClick);
    updateDisplay();
    drawBoard();
}

function resetGame() {
    board = [];
    hand = [];
    score = 0;
    stars = 5;
    lastStarRecoveryCheckTime = Date.now();
    gameState = 'COLLECTING_MELTS';

    // ゲーム盤面の初期化
    for (let r = 0; r < GRID_SIZE; r++) {
        board[r] = [];
        for (let c = 0; c < GRID_SIZE; c++) {
            board[r][c] = getRandomPai();
        }
    }

    // 初期状態でマッチがないようにする
    let initialMatches;
    do {
        while ((initialMatches = findMatches()).length > 0) {
            removeMatches(initialMatches.flat());
            fillBoard();
        }
    } while (!hasValidMoves()); // 手詰まりで始まらないようにする

    saveGame();
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
    document.getElementById('stars').textContent = stars;

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

    // ヒントボタンの活性状態を切り替える
    hintContainer.style.display = 'block'; // 常に表示
    if (stars > 0 && gameState === 'COLLECTING_MELTS') {
        hintButton.disabled = false;
    } else {
        hintButton.disabled = true;
    }
}

// --- ゲームロジック ---

function getRandomPai() {
    return PAI_KINDS[Math.floor(Math.random() * PAI_KINDS.length)];
}

function onHintClick() {
    if (stars <= 0 || isHintActive) return;

    stars--;
    isHintActive = true;
    
    findAllMatchableTiles();
    updateDisplay();
    saveGame();
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
    hand.sort((a, b) => a.type.localeCompare(b.type) || a.number - b.number);

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
    saveGame();
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
            saveGame();
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

// --- 役判定とスコア計算 ---

/**
 * 和了形の手牌から役を判定し、スコアを計算します。
 * @param {Array<Object>} completedHand - ソート済みの14枚の手牌
 * @returns {number} 役に応じたスコア
 */
function calculateScore(completedHand) {
    const oldScore = score;
    let totalScore = 1000; // 和了の基本点
    const yakuBonuses = {
        toitoi: 2000,
        ikkitsuukan: 1000,
        iipeikou: 500,
        // 混一色と清一色は、純チャン・チャンタと複合しないルールを適用
        // 役の優先度や複合ルールは麻雀のルールによって様々ですが、ここでは一般的なものを採用します。
        // 混全帯么九(1000) < 混一色(2000)
        // 純全帯么九(2000) < 清一色(4000)
        honitsu: 2000, 
        chinitsu: 4000,
        yakuhai: 500, // 1刻子あたりの点数
        junchan: 2000,
        chanta: 1000,
        sanshokuDoujun: 2000, // 三色同順
        sanshokuDoukou: 2000, // 三色同刻
    };

    // 雀頭の候補を見つける
    const pairs = [];
    const counts = countPais(completedHand);
    for (const key in counts) {
        if (counts[key] >= 2) {
            const [type, number] = key.split('-');
            pairs.push(createPai(type, parseInt(number)));
        }
    }

    // 各雀頭候補について、残りの牌で4面子が作れるか試す
    for (const pair of pairs) {
        const remaining = removePais(completedHand, [pair, pair]);
        const melds = findMelds(remaining);

        if (melds && melds.length === 4) {
            // 和了形が成立した場合、役を判定
            let currentYakuScore = 0;

            // --- 混全帯么九 / 純全帯么九の判定 ---
            const allComponents = [...melds, { type: 'pair', pais: [pair] }];
            const isTerminal = (p) => p.type !== PAI_TYPES.JIHAI && (p.number === 1 || p.number === 9);
            const isYaochuhai = (p) => isTerminal(p) || p.type === PAI_TYPES.JIHAI;

            const allContainYaochuhai = allComponents.every(comp => comp.pais.some(isYaochuhai));

            if (allContainYaochuhai) {
                const allContainTerminals = allComponents.every(comp => comp.pais.some(isTerminal));
                const hasJihai = completedHand.some(p => p.type === PAI_TYPES.JIHAI);

                if (allContainTerminals && !hasJihai) {
                    // 純全帯么九 (字牌を含まず、すべてが数牌の1,9を含む)
                    currentYakuScore += yakuBonuses.junchan;
                } else if (hasJihai) {
                    // 混全帯么九 (字牌を含み、すべてが1,9,字牌を含む)
                    currentYakuScore += yakuBonuses.chanta;
                }
            }

            // 複合役の判定のため、ここで return しない
            const isJunchanOrChanta = currentYakuScore > 0;


            // --- 混一色・清一色の判定 ---
            const paiTypes = new Set(completedHand.map(p => p.type));
            const hasJihai = paiTypes.has(PAI_TYPES.JIHAI);
            const suupaiTypes = new Set();
            completedHand.forEach(p => {
                if (p.type !== PAI_TYPES.JIHAI) {
                    suupaiTypes.add(p.type);
                }
            });

            if (suupaiTypes.size === 1 && !isJunchanOrChanta) { // チャンタ系とホンイツ系は複合しない
                if (hasJihai) {
                    // 混一色
                    currentYakuScore += yakuBonuses.honitsu;
                } else {
                    // 清一色
                    // 純チャンと複合しない清一色の場合のみ加算
                    currentYakuScore += yakuBonuses.chinitsu;
                }
            }

            // --- 対々和の判定 ---
            const isToitoi = melds.every(meld => meld.type === 'koutsu');
            if (isToitoi) {
                currentYakuScore += yakuBonuses.toitoi;
            }

            // --- 三色同刻の判定 ---
            // 刻子が3つ以上ないと成立しない。
            const koutsuMelds = melds.filter(meld => meld.type === 'koutsu');
            if (koutsuMelds.length >= 3) {
                const koutsuByNumber = {};
                for (const meld of koutsuMelds) {
                    const pai = meld.pais[0];
                    if (pai.type !== PAI_TYPES.JIHAI) { // 字牌は対象外
                        if (!koutsuByNumber[pai.number]) {
                            koutsuByNumber[pai.number] = new Set();
                        }
                        koutsuByNumber[pai.number].add(pai.type);
                    }
                }
                if (Object.values(koutsuByNumber).some(types => types.size === 3)) {
                    currentYakuScore += yakuBonuses.sanshokuDoukou;
                }
            }

            // --- 役牌（白・發・中）の判定 ---
            for (const meld of koutsuMelds) {
                const pai = meld.pais[0];
                // 白(5), 發(6), 中(7)
                if (pai.type === PAI_TYPES.JIHAI && [5, 6, 7].includes(pai.number)) {
                    currentYakuScore += yakuBonuses.yakuhai;
                }
            }

            // --- 順子系の役の判定（対々和、清一色、混一色と複合しない場合が多い） ---
            if (!isToitoi && !isJunchanOrChanta) { // 対々和やチャンタ系とは複合しない
                const shuntsuMelds = melds.filter(meld => meld.type === 'shuntsu');
                
                // --- 三色同順の判定 ---
                if (shuntsuMelds.length >= 3) {
                    const shuntsuByNumber = {};
                    for (const meld of shuntsuMelds) {
                        const startPai = meld.pais.sort((a, b) => a.number - b.number)[0];
                        if (!shuntsuByNumber[startPai.number]) {
                            shuntsuByNumber[startPai.number] = new Set();
                        }
                        shuntsuByNumber[startPai.number].add(startPai.type);
                    }
                    // 萬子・筒子・索子の3種類が揃っているかチェック
                    if (Object.values(shuntsuByNumber).some(types => types.size === 3)) {
                        currentYakuScore += yakuBonuses.sanshokuDoujun;
                    }
                }


                // 一気通貫
                const manzuShuntsu = shuntsuMelds.filter(m => m.pais[0].type === PAI_TYPES.MANZU).map(m => m.pais[0].number);
                const pinzuShuntsu = shuntsuMelds.filter(m => m.pais[0].type === PAI_TYPES.PINZU).map(m => m.pais[0].number);
                const souzuShuntsu = shuntsuMelds.filter(m => m.pais[0].type === PAI_TYPES.SOUZU).map(m => m.pais[0].number);

                if ((manzuShuntsu.includes(1) && manzuShuntsu.includes(4) && manzuShuntsu.includes(7)) ||
                    (pinzuShuntsu.includes(1) && pinzuShuntsu.includes(4) && pinzuShuntsu.includes(7)) ||
                    (souzuShuntsu.includes(1) && souzuShuntsu.includes(4) && souzuShuntsu.includes(7))) {
                    currentYakuScore += yakuBonuses.ikkitsuukan;
                }

                // 一盃口
                const shuntsuCounts = {};
                for (const meld of shuntsuMelds) {
                    const key = `${meld.pais[0].type}-${meld.pais[0].number}`;
                    shuntsuCounts[key] = (shuntsuCounts[key] || 0) + 1;
                }
                for (const key in shuntsuCounts) {
                    if (shuntsuCounts[key] >= 2) {
                        currentYakuScore += yakuBonuses.iipeikou;
                        break; // 一盃口は1つまで
                    }
                }
            }
            
            const finalScore = totalScore + currentYakuScore;
            const newScore = oldScore + finalScore;

            // スコアによる★回復チェック
            const starsFromScore = Math.floor(newScore / 10000) - Math.floor(oldScore / 10000);
            if (starsFromScore > 0) {
                stars = Math.min(stars + starsFromScore, 10);
            }

            return finalScore; // 最初の有効な和了形で計算を終了
        }
    }

    return totalScore; // 役なし（基本点のみ）
}

/**
 * 牌の配列から、各牌が何枚あるかを数える
 * @param {Array<Object>} pais 
 * @returns {Object} キーが'type-number'、値が個数のオブジェクト
 */
function countPais(pais) {
    return pais.reduce((acc, pai) => {
        const key = `${pai.type}-${pai.number}`;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {});
}

/**
 * 牌の配列から指定された牌を削除した新しい配列を返す
 * @param {Array<Object>} sourcePais 
 * @param {Array<Object>} paisToRemove 
 * @returns {Array<Object>}
 */
function removePais(sourcePais, paisToRemove) {
    const temp = [...sourcePais];
    for (const pai of paisToRemove) {
        const index = temp.findIndex(p => p.type === pai.type && p.number === pai.number);
        if (index !== -1) {
            temp.splice(index, 1);
        }
    }
    return temp;
}

/**
 * 残りの手牌から再帰的に面子を見つける
 * @param {Array<Object>} pais - ソート済みの手牌
 * @returns {Array<Object>|null} 面子の配列、または見つからなければnull
 */
function findMelds(pais) {
    if (pais.length === 0) return [];

    const p1 = pais[0];
    // 刻子を探す
    if (pais.length >= 3 && pais[1].type === p1.type && pais[1].number === p1.number && pais[2].type === p1.type && pais[2].number === p1.number) {
        const remaining = pais.slice(3);
        const result = findMelds(remaining);
        if (result) return [{ type: 'koutsu', pais: [p1, pais[1], pais[2]] }, ...result];
    }
    // 順子を探す
    if (p1.type !== PAI_TYPES.JIHAI && pais.length >= 3) {
        const p2Index = pais.findIndex(p => p.type === p1.type && p.number === p1.number + 1);
        const p3Index = pais.findIndex(p => p.type === p1.type && p.number === p1.number + 2);
        if (p2Index !== -1 && p3Index !== -1) {
            const p2 = pais[p2Index];
            const p3 = pais[p3Index];
            const remaining = removePais(pais, [p1, p2, p3]);
            const result = findMelds(remaining);
            if (result) return [{ type: 'shuntsu', pais: [p1, p2, p3] }, ...result];
        }
    }
    return null; // 面子が見つからない
}

// --- 状態の保存と読み込み ---

function saveGame() {
    const gameStateData = {
        board,
        hand,
        score,
        stars,
        lastStarRecoveryCheckTime,
        gameState,
    };
    localStorage.setItem('matchjongGameState', JSON.stringify(gameStateData));
}

function loadGame() {
    const savedState = localStorage.getItem('matchjongGameState');
    if (savedState) {
        try {
            const gameStateData = JSON.parse(savedState);
            board = gameStateData.board;
            hand = gameStateData.hand;
            score = gameStateData.score;
            stars = gameStateData.stars;
            lastStarRecoveryCheckTime = gameStateData.lastStarRecoveryCheckTime;
            gameState = gameStateData.gameState;
            return true;
        } catch (e) {
            console.error("セーブデータの読み込みに失敗しました。", e);
            localStorage.removeItem('matchjongGameState');
            return false;
        }
    }
    return false;
}

// --- ゲーム開始 ---
init();
