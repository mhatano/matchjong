// mahjong-logic.js

// 牌の種類を定義
const PAI_TYPES = {
    MANZU: 'm', // 萬子
    PINZU: 'p', // 筒子
    SOUZU: 's', // 索子
    JIHAI: 'z'  // 字牌
};

// 牌を表現するヘルパー関数
function createPai(type, number) {
    return { type, number };
}

// 牌の文字列表現
function paiToString(pai) {
    if (!pai) return '';

    const KANJI_NUM = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
    const FULL_WIDTH_ARABIC_NUM = ['１', '２', '３', '４', '５', '６', '７', '８', '９'];
    const FULL_WIDTH_ROMAN_NUM = ['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ', 'Ⅵ', 'Ⅶ', 'Ⅷ', 'Ⅸ'];
    const JIHAI_CHARS = ['東', '南', '西', '北', '白', '發', '中'];

    switch (pai.type) {
        case PAI_TYPES.MANZU:
            return KANJI_NUM[pai.number - 1];
        case PAI_TYPES.PINZU:
            return FULL_WIDTH_ARABIC_NUM[pai.number - 1];
        case PAI_TYPES.SOUZU:
            return FULL_WIDTH_ROMAN_NUM[pai.number - 1];
        case PAI_TYPES.JIHAI:
            return JIHAI_CHARS[pai.number - 1];
        default:
            return `${pai.number}${pai.type}`;
    }
}

// 手牌から役を判定し、点数を返す（簡易版）
function calculateScore(hand) {
    // hand は 14牌の配列
    if (hand.length !== 14) return 0;

    let score = 1000; // 基本点
    let yakuName = "和了";

    // 断么九（タンヤオチュー）の判定: 1,9牌、字牌を含まない
    const isTanyao = hand.every(pai => 
        pai.type !== PAI_TYPES.JIHAI && pai.number > 1 && pai.number < 9
    );

    if (isTanyao) {
        score += 1000;
        yakuName = "断么九";
    }

    // 他の役判定もここに追加...
    
    console.log(`和了役: ${yakuName}`);
    return score;
}
