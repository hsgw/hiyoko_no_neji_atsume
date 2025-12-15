// (c) 2025, Takuya Urakawa (@hsgw 5z6p.com)
// This software is released under the MIT License.

// ----------------------------------------------------------------
// 1. 定数と調整可能パラメータ
// ----------------------------------------------------------------
const NATIVE_WIDTH = 160; // ゲーム画面の幅
const NATIVE_HEIGHT = 144;
const GRID_SIZE = 8;
const FPS_TARGET = 60;
const BASE_SPEED_GPS = 2; // グリッド/秒
const INITIAL_SPEED_MULTIPLIER = 1.0;
const SPEED_INCREASE_PICKUP = 0.2;
const SPEED_INCREASE_DELIVERY = 0.6;
const SPEED_DECREASE_DELIVERY = 0.6;

// カラーパレット (仕様書準拠)
const COLORS = {
  BG: "#9bbc0f",
  SPRITE_1: "#8bac0f",
  SPRITE_2: "#306230",
  TEXT_AND_SPRITE_3: "#0f380f",
};

// マップタイル定義 (仕様書準拠)
const TILES = {
  EMPTY: " ",
  WALL: "W",
  SCREW_1: "N1",
  SCREW_2: "N2",
  BOX_1: "B1",
  BOX_2: "B2",
};

// スプライトシートのインデックス (仕様書準拠)
const SPRITES = {
  CHICK_DOWN: 0,
  CHICK_LEFT: 1,
  CHICK_RIGHT: 2,
  CHICK_UP: 3,
  SCREW_1_ITEM: 4,
  SCREW_2_ITEM: 5,
  SCREW_1_BODY: 6,
  SCREW_2_BODY: 7,
  BOX_1: 8,
  BOX_2: 9,
  WALL: 10,
};

// ビットマップフォント定義
const FONT_SPRITE_HEIGHT = 8;
const CHAR_SPACING = 0; // 文字間のスペース
const FONT_MAP = {};

// 可変幅フォントの情報を生成する
function setupFontMap() {
  const fontOrder = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789:.() "; // The last char is a space
  const charWidth = 5; // All characters in the spritesheet are 5px wide

  for (let i = 0; i < fontOrder.length; i++) {
    const char = fontOrder[i];
    // Store the source x position and the standard width
    FONT_MAP[char] = { sx: i * charWidth, width: charWidth };
  }
}
setupFontMap();

// ----------------------------------------------------------------
// アセット読み込み
// ----------------------------------------------------------------

// スプライトシートの読み込み
const spriteSheet = new Image();
spriteSheet.src = "resources/hiyoko.png";
let spritesLoaded = false;
spriteSheet.onload = () => {
  spritesLoaded = true;
};

// ----------------------------------------------------------------
// サウンド (追加)
// ----------------------------------------------------------------
const SOUNDS = {
  GAME_START: "game_start",
  ITEM_PICKUP: "item_pickup",
  ITEM_DELIVERY: "item_delivery",
  ITEM_DELIVERY_FAIL: "item_delivery_fail",
  GAME_OVER: "game_over",
};

const audioContext = new (window.AudioContext || window.webkitAudioContext)();
const loadedSounds = {};
let soundsLoaded = false;

async function loadSounds() {
  const soundFiles = {
    [SOUNDS.GAME_START]: "resources/game_start.wav",
    [SOUNDS.ITEM_PICKUP]: "resources/item_pickup.wav",
    [SOUNDS.ITEM_DELIVERY]: "resources/item_delivery.wav",
    [SOUNDS.ITEM_DELIVERY_FAIL]: "resources/item_delivery_fail.wav",
    [SOUNDS.GAME_OVER]: "resources/game_over.wav",
  };

  const promises = Object.keys(soundFiles).map(async (key) => {
    try {
      const response = await fetch(soundFiles[key]);
      if (!response.ok) {
        throw new Error(
          `Failed to load sound: ${soundFiles[key]} status: ${response.status}`
        );
      }
      const arrayBuffer = await response.arrayBuffer();
      loadedSounds[key] = await audioContext.decodeAudioData(arrayBuffer);
    } catch (error) {
      console.error(`Error loading sound ${soundFiles[key]}:`, error);
      // Fallback or handle missing sound gracefully
      loadedSounds[key] = null; // Mark as failed to load
    }
  });

  await Promise.all(promises);
  soundsLoaded = true;
  console.log("All sounds loaded!");
}

function playSound(soundName) {
  if (!soundsLoaded) {
    console.warn("Sounds not yet loaded.");
    return;
  }
  const soundBuffer = loadedSounds[soundName];
  if (soundBuffer) {
    const source = audioContext.createBufferSource();
    source.buffer = soundBuffer;
    source.connect(audioContext.destination);
    source.start(0);
  } else {
    console.warn(`Sound '${soundName}' not available.`);
  }
}

async function playDeliverySound(comboCount) {
  if (!soundsLoaded) {
    console.warn("Sounds not yet loaded.");
    return;
  }
  for (let i = 0; i < comboCount; i++) {
    playSound(SOUNDS.ITEM_DELIVERY);
    // Add a small delay between sounds for combo effect
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

// タイトル画像の読み込み
const titleImage = new Image();
titleImage.src = "resources/title.png";
let titleImageLoaded = false;
titleImage.onload = () => {
  titleImageLoaded = true;
};

// ゲームオーバー画像の読み込み
const gameOverImage = new Image();
gameOverImage.src = "resources/game_over.png";
let gameOverImageLoaded = false;
gameOverImage.onload = () => {
  gameOverImageLoaded = true;
};

// フォント画像の読み込み
let fontSheet = new Image();
fontSheet.src = "resources/font.png";
let fontSheetLoaded = false;
fontSheet.onload = () => {
  // フォント画像をカラーパレットに合わせて色付けする
  const colorizedFontCanvas = document.createElement("canvas");
  const colorizedFontCtx = colorizedFontCanvas.getContext("2d");

  colorizedFontCanvas.width = fontSheet.width;
  colorizedFontCanvas.height = fontSheet.height;

  // 元のフォント画像を非表示Canvasに描画
  colorizedFontCtx.drawImage(fontSheet, 0, 0);

  // ピクセルデータを取得
  const imageData = colorizedFontCtx.getImageData(
    0,
    0,
    fontSheet.width,
    fontSheet.height
  );
  const data = imageData.data;
  const targetColor = { r: 15, g: 56, b: 15 }; // #0f380f

  // 黒い部分(透明でない部分)をターゲットの色に変更
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] > 128) {
      // アルファ値が128より大きいピクセル
      data[i] = targetColor.r;
      data[i + 1] = targetColor.g;
      data[i + 2] = targetColor.b;
    }
  }

  // 変更したピクセルデータを非表示Canvasに戻す
  colorizedFontCtx.putImageData(imageData, 0, 0);

  // 色付けしたCanvasを新しいフォントシートとして使用する
  fontSheet = colorizedFontCanvas;
  fontSheetLoaded = true; // 処理が完了したのでフラグを立てる
};

// ----------------------------------------------------------------
// 2. ゲーム状態 (gameState)
// ----------------------------------------------------------------
let gameState;
let globalTime = 0; // For animations independent of game state (e.g., title screen)

function getInitialGameState() {
  return {
    currentScene: "TITLE", // 'TITLE', 'PLAYING', 'GAME_OVER'
    chickPos: { x: 0, y: 0 },
    chickDirection: "UP",
    moveFrameTimer: 0,
    body: [],
    speedMultiplier: INITIAL_SPEED_MULTIPLIER,
    deliveryBaseSpeed: INITIAL_SPEED_MULTIPLIER,
    score: 0,
    elapsedTime: 0,
    inputQueue: [],
    gameMap: [],
  };
}

function triggerGameOver() {
  gameState.currentScene = "GAME_OVER";
  playSound(SOUNDS.GAME_OVER);
}

// ----------------------------------------------------------------
// 3. 初期化処理 (init)
// ----------------------------------------------------------------
function resetGame() {
  console.log("Resetting game state for PLAYING scene...");
  // gameStateの大部分をリセットするが、currentSceneは変更しない
  const scene = gameState.currentScene;
  gameState = getInitialGameState();
  gameState.currentScene = scene;
}

function startGame() {
  gameState = getInitialGameState();

  const MAP_WIDTH = NATIVE_WIDTH / GRID_SIZE;
  const MAP_HEIGHT = (NATIVE_HEIGHT - 16) / GRID_SIZE;

  gameState.gameMap = Array.from({ length: MAP_HEIGHT }, (_, y) =>
    Array.from({ length: MAP_WIDTH }, (_, x) => {
      if (y === 0 || y === MAP_HEIGHT - 1 || x === 0 || x === MAP_WIDTH - 1) {
        return TILES.WALL;
      }
      return TILES.EMPTY;
    })
  );

  // ねじと箱の初期配置 (仕様書準拠)
  // 1. 全種類のねじと箱を1つずつ必ず配置
  spawnObject(TILES.SCREW_1);
  spawnObject(TILES.SCREW_2);
  spawnObject(TILES.BOX_1);
  spawnObject(TILES.BOX_2);

  // 2. 仕様に基づき、ねじをもう1つランダムに配置して合計3つにする
  const randomScrewType = Math.random() < 0.5 ? TILES.SCREW_1 : TILES.SCREW_2;
  spawnObject(randomScrewType);

  gameState.chickPos = { x: 10, y: 9 };
  gameState.chickDirection = "UP";
  gameState.moveFrameTimer = 0;
  gameState.body = [];
  gameState.speedMultiplier = INITIAL_SPEED_MULTIPLIER;
  gameState.score = 0;
  gameState.elapsedTime = 0;
  gameState.currentScene = "PLAYING";
  gameState.inputQueue = [];

  // Play game start sound
  playSound(SOUNDS.GAME_START);
}

// ----------------------------------------------------------------
// 4. コアロジック (update, checkEvents)
// ----------------------------------------------------------------
function update() {
  // グローバルタイマーは常に更新
  globalTime += 1 / FPS_TARGET;

  // ゲームプレイ中のみ時間を進める
  if (gameState.currentScene === "PLAYING") {
    gameState.elapsedTime += 1 / FPS_TARGET;
  }

  // ゲームプレイ中以外はここで処理を終了
  if (gameState.currentScene !== "PLAYING") {
    return;
  }

  // --- 以下は PLAYING シーンの時のみ実行 ---

  gameState.moveFrameTimer--;

  if (gameState.moveFrameTimer <= 0) {
    // 1. 方向転換
    if (gameState.inputQueue.length > 0) {
      const nextDir = gameState.inputQueue.shift();
      const isOpposite = (dir1, dir2) =>
        (dir1 === "UP" && dir2 === "DOWN") ||
        (dir1 === "DOWN" && dir2 === "UP") ||
        (dir1 === "LEFT" && dir2 === "RIGHT") ||
        (dir1 === "RIGHT" && dir2 === "LEFT");

      if (!isOpposite(nextDir, gameState.chickDirection)) {
        gameState.chickDirection = nextDir;
      }
    }

    // 2. 体を追従させる
    if (gameState.body.length > 0) {
      // 後ろから順に、前のセグメントの位置に移動する
      for (let i = gameState.body.length - 1; i > 0; i--) {
        gameState.body[i].pos = { ...gameState.body[i - 1].pos };
      }
      // 先頭のセグメントは、ひよこの現在の位置に移動する
      gameState.body[0].pos = { ...gameState.chickPos };
    }

    // 3. ひよこのグリッド座標を更新
    switch (gameState.chickDirection) {
      case "UP":
        gameState.chickPos.y--;
        break;
      case "DOWN":
        gameState.chickPos.y++;
        break;
      case "LEFT":
        gameState.chickPos.x--;
        break;
      case "RIGHT":
        gameState.chickPos.x++;
        break;
    }

    // 4. イベントチェック
    checkEvents();
    if (gameState.currentScene === "GAME_OVER") return;

    // 5. タイマーリセット
    const waitFrames = Math.floor(
      FPS_TARGET / (BASE_SPEED_GPS * gameState.speedMultiplier)
    );
    gameState.moveFrameTimer = waitFrames;
  }
}

function spawnObject(tileToSpawn) {
  const emptyCells = [];
  for (let y = 1; y < gameState.gameMap.length - 1; y++) {
    for (let x = 1; x < gameState.gameMap[y].length - 1; x++) {
      if (gameState.gameMap[y][x] === TILES.EMPTY) {
        let isOccupied =
          (gameState.chickPos.x === x && gameState.chickPos.y === y) ||
          gameState.body.some((seg) => seg.pos.x === x && seg.pos.y === y);
        if (!isOccupied) {
          emptyCells.push({ x, y });
        }
      }
    }
  }

  if (emptyCells.length === 0) return;

  const { x, y } = emptyCells[Math.floor(Math.random() * emptyCells.length)];
  gameState.gameMap[y][x] = tileToSpawn;
}

function spawnNewScrew() {
  // 仕様書 5.4.1: 新しいねじの生成ロジック
  // 盤上に必ずどちらの種類のねじも存在し続けるようにする

  // 1. 現在盤上にあるすべてのねじの種類をチェック (ひよこが運んでいるものは除く)
  const existingScrewTypes = new Set();
  // a. gameMap上のねじ
  for (let y = 0; y < gameState.gameMap.length; y++) {
    for (let x = 0; x < gameState.gameMap[y].length; x++) {
      const tile = gameState.gameMap[y][x];
      if (tile === TILES.SCREW_1 || tile === TILES.SCREW_2) {
        existingScrewTypes.add(tile);
      }
    }
  }

  // 2. 生成するねじの種類を決定
  let screwTypeToSpawn;
  const hasScrew1 = existingScrewTypes.has(TILES.SCREW_1);
  const hasScrew2 = existingScrewTypes.has(TILES.SCREW_2);

  if (hasScrew1 && hasScrew2) {
    // 両方存在する場合、ランダム
    screwTypeToSpawn = Math.random() < 0.5 ? TILES.SCREW_1 : TILES.SCREW_2;
  } else if (!hasScrew1) {
    // ねじ1が欠けている場合、ねじ1を生成
    screwTypeToSpawn = TILES.SCREW_1;
  } else {
    // ねじ2が欠けている場合、ねじ2を生成
    screwTypeToSpawn = TILES.SCREW_2;
  }

  // 3. 新しいねじを配置
  spawnObject(screwTypeToSpawn);
}

function checkEvents() {
  const headPos = gameState.chickPos;
  // headPosがマップ範囲外の場合、早期にリターン
  if (
    headPos.y < 0 ||
    headPos.y >= gameState.gameMap.length ||
    headPos.x < 0 ||
    headPos.x >= gameState.gameMap[0].length
  ) {
    triggerGameOver();
    return;
  }
  const targetTile = gameState.gameMap[headPos.y][headPos.x];

  // 壁または自損
  if (
    targetTile === TILES.WALL ||
    gameState.body.some(
      (seg) => seg.pos.x === headPos.x && seg.pos.y === headPos.y
    )
  ) {
    triggerGameOver();
    return;
  }

  // ねじ取得
  if (targetTile === TILES.SCREW_1 || targetTile === TILES.SCREW_2) {
    playSound(SOUNDS.ITEM_PICKUP); // Play pickup sound
    const lastSegment =
      gameState.body.length > 0
        ? gameState.body[gameState.body.length - 1]
        : gameState;
    gameState.body.push({ type: targetTile, pos: { ...lastSegment.pos } });
    gameState.gameMap[headPos.y][headPos.x] = TILES.EMPTY;
    gameState.speedMultiplier += SPEED_INCREASE_PICKUP;
    spawnNewScrew();
    return;
  }

  // 箱へのデリバリー
  if (targetTile === TILES.BOX_1 || targetTile === TILES.BOX_2) {
    if (gameState.body.length === 0) {
      // 空振り (アイテムなし)
      playSound(SOUNDS.ITEM_DELIVERY_FAIL);
      gameState.speedMultiplier += SPEED_INCREASE_DELIVERY;
      // ゲームオーバーにはせず、箱も再配置しない
      return;
    }

    const boxType = targetTile === TILES.BOX_1 ? TILES.SCREW_1 : TILES.SCREW_2;
    const firstScrewType = gameState.body[0].type;

    if (boxType === firstScrewType) {
      let comboCount = 0;
      while (
        gameState.body.length > comboCount &&
        gameState.body[comboCount].type === firstScrewType
      ) {
        comboCount++;
      }

      playDeliverySound(comboCount); // Play delivery sound with combo

      // デリバリー後、残ったねじを前方に詰める
      // slice()で残りのねじを抽出し、map()で各ねじの位置を
      // 元の配列の先頭からの位置に更新した新しい配列を生成する。
      const newBody = gameState.body.slice(comboCount).map((segment, i) => ({
        ...segment, // ねじのプロパティ(type)はそのまま維持
        pos: { ...gameState.body[i].pos }, // 位置(pos)を、デリバリーされたねじがあった場所へ更新
      }));

      // ねじの配列全体を、位置更新済みの新しい配列で置き換える
      gameState.body = newBody;

      gameState.score += (comboCount * (comboCount + 1)) / 2;
      // 仕様書 5.5: デリバリー成功時には速度が減少
      // 基準速度からの増加分に対して、減少率を適用する
      gameState.speedMultiplier =
        gameState.deliveryBaseSpeed +
        (gameState.speedMultiplier - gameState.deliveryBaseSpeed) *
          SPEED_DECREASE_DELIVERY;

      // 現在の速度を次回の基準速度として保存
      gameState.deliveryBaseSpeed = gameState.speedMultiplier;

      gameState.gameMap[headPos.y][headPos.x] = TILES.EMPTY;
      spawnObject(targetTile);
    } else {
      // アイテムの種類が箱と一致しない場合
      triggerGameOver();
    }
  }
}

// ----------------------------------------------------------------
// 5. 描画処理 (draw)
// ----------------------------------------------------------------
function drawSprite(ctx, spriteIndex, dx, dy) {
  if (!spritesLoaded) return;
  const sx = spriteIndex * GRID_SIZE;
  ctx.drawImage(
    spriteSheet,
    sx,
    0,
    GRID_SIZE,
    GRID_SIZE,
    Math.round(dx),
    Math.round(dy),
    GRID_SIZE,
    GRID_SIZE
  );
}

function drawText(ctx, text, startX, startY, align = "left", scale = 1) {
  if (!fontSheetLoaded) return;

  // テキスト全体の幅を計算
  let textWidth = 0;
  const upperText = text.toUpperCase();
  for (const char of upperText) {
    const fontData = FONT_MAP[char];
    if (fontData) {
      let charWidth = fontData.width;
      const advance =
        (charWidth + (char === "T" || char === "W" ? 1 : 0) + CHAR_SPACING) *
        scale;
      textWidth += advance;
    }
  }
  if (text.length > 0) {
    textWidth -= CHAR_SPACING * scale; // Remove spacing after the last character
  }

  let drawX = startX;
  if (align === "center") {
    drawX = Math.floor(startX - textWidth / 2);
  } else if (align === "right") {
    drawX = startX - textWidth; // Adjust for right alignment
  }

  let currentDrawX = drawX;
  for (const char of upperText) {
    const fontData = FONT_MAP[char];
    if (fontData) {
      let charDrawX = currentDrawX;
      if (char === "I") {
        charDrawX -= 1 * scale; // 前方1pxを省略する。
      }

      const destWidth = fontData.width * scale;
      const destHeight = FONT_SPRITE_HEIGHT * scale;
      ctx.drawImage(
        fontSheet,
        fontData.sx,
        0, // Source position and size
        fontData.width,
        FONT_SPRITE_HEIGHT,
        Math.round(charDrawX), // Destination position
        Math.round(startY),
        destWidth, // Destination size
        destHeight
      );
      // Advance cursor for the next character
      let charWidth = fontData.width;
      if (char === "I") {
        charWidth = 4;
      }
      const advance =
        (charWidth + (char === "T" || char === "W" ? 1 : 0) + CHAR_SPACING) *
        scale;
      currentDrawX += advance;
    }
  }
}
function drawTitleScreen(ctx) {
  if (!titleImageLoaded) return;

  // 背景画像
  ctx.drawImage(titleImage, 0, 0, NATIVE_WIDTH, NATIVE_HEIGHT);

  // "PRESS START" の点滅表示 (1秒周期)
  if (Math.floor(globalTime * 2) % 2 === 0) {
    drawText(ctx, "PRESS START", NATIVE_WIDTH / 2, 126, "center");
  }

  drawText(ctx, "(C) 2025 5z6p.com", NATIVE_WIDTH / 2, 135, "center");
}

function drawGameOverScreen(ctx) {
  // 半透明のオーバーレイ
  ctx.fillStyle = "rgba(15, 56, 15, 0.7)"; // #0f380f with 70% alpha
  ctx.fillRect(0, 0, NATIVE_WIDTH, NATIVE_HEIGHT);

  // テキスト用の背景ボックス
  const boxWidth = 128; // 16 * 8
  const boxHeight = 64; // 8 * 8
  const boxX = (NATIVE_WIDTH - boxWidth) / 2;
  const boxY = (NATIVE_HEIGHT - boxHeight) / 2;
  ctx.fillStyle = COLORS.SPRITE_1; // 背景色: #8bac0f
  ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
  ctx.strokeStyle = COLORS.TEXT_AND_SPRITE_3; // 枠線: #0f380f
  ctx.lineWidth = 1;
  ctx.strokeRect(boxX - 1, boxY - 1, boxWidth + 2, boxHeight + 2);

  // テキスト描画
  if (gameOverImageLoaded) {
    const imgX = (NATIVE_WIDTH - gameOverImage.width) / 2;
    const imgY = boxY + 8;
    ctx.drawImage(gameOverImage, imgX, imgY);
  }

  drawText(
    ctx,
    `SCORE ${gameState.score}`,
    NATIVE_WIDTH / 2,
    boxY + 34,
    "center"
  );
  drawText(ctx, "RETURN TO TITLE", NATIVE_WIDTH / 2, boxY + 48, "center");
}

function draw(ctx) {
  // 背景描画
  ctx.fillStyle = COLORS.BG;
  ctx.fillRect(0, 0, NATIVE_WIDTH, NATIVE_HEIGHT);

  const gameAreaOffsetY = 16;

  // シーンに応じた描画
  switch (gameState.currentScene) {
    case "TITLE":
      drawTitleScreen(ctx);
      break;

    case "PLAYING":
    case "GAME_OVER": // ゲームオーバー時も背景のゲーム画面は描画する
      // gameMapの描画
      for (let y = 0; y < gameState.gameMap.length; y++) {
        for (let x = 0; x < gameState.gameMap[y].length; x++) {
          const tile = gameState.gameMap[y][x];
          const px = x * GRID_SIZE;
          const py = y * GRID_SIZE + gameAreaOffsetY;

          switch (tile) {
            case TILES.WALL:
              drawSprite(ctx, SPRITES.WALL, px, py);
              break;
            case TILES.SCREW_1:
              drawSprite(ctx, SPRITES.SCREW_1_ITEM, px, py);
              break;
            case TILES.SCREW_2:
              drawSprite(ctx, SPRITES.SCREW_2_ITEM, px, py);
              break;
            case TILES.BOX_1:
              drawSprite(ctx, SPRITES.BOX_1, px, py);
              break;
            case TILES.BOX_2:
              drawSprite(ctx, SPRITES.BOX_2, px, py);
              break;
          }
        }
      }

      // 体の描画
      gameState.body.forEach((segment) => {
        const spriteIndex =
          segment.type === TILES.SCREW_1
            ? SPRITES.SCREW_1_BODY
            : SPRITES.SCREW_2_BODY;
        drawSprite(
          ctx,
          spriteIndex,
          segment.pos.x * GRID_SIZE,
          segment.pos.y * GRID_SIZE + gameAreaOffsetY
        );
      });

      // ひよこの描画
      let chickSpriteIndex;
      switch (gameState.chickDirection) {
        case "UP":
          chickSpriteIndex = SPRITES.CHICK_UP;
          break;
        case "LEFT":
          chickSpriteIndex = SPRITES.CHICK_LEFT;
          break;
        case "RIGHT":
          chickSpriteIndex = SPRITES.CHICK_RIGHT;
          break;
        case "DOWN":
        default:
          chickSpriteIndex = SPRITES.CHICK_DOWN;
          break;
      }
      drawSprite(
        ctx,
        chickSpriteIndex,
        gameState.chickPos.x * GRID_SIZE,
        gameState.chickPos.y * GRID_SIZE + gameAreaOffsetY
      );

      // UI描画
      drawText(ctx, `SCORE:${gameState.score}`, 4, 4);
      const time = Math.floor(gameState.elapsedTime);
      const minutes = String(Math.floor(time / 60)).padStart(2, "0");
      const seconds = String(time % 60).padStart(2, "0");
      drawText(ctx, `TIME:${minutes}:${seconds}`, NATIVE_WIDTH - 4, 4, "right");

      // ゲームオーバー画面のオーバーレイ
      if (gameState.currentScene === "GAME_OVER") {
        drawGameOverScreen(ctx);
      }
      break;
  }
}

// ----------------------------------------------------------------
// 6. 入力処理
// ----------------------------------------------------------------
async function resumeAudioContext() {
  // ユーザーの操作をトリガーにAudioContextを再開する (ブラウザの自動再生ポリシー対策)
  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }
}
async function handleKeyDown(e) {
  e.preventDefault();
  // ユーザーの最初の操作(キーボード/UIボタン)でAudioContextを再開する
  await resumeAudioContext();

  switch (gameState.currentScene) {
    case "TITLE":
      if (e.code === "Space") {
        startGame();
      }
      return;

    case "GAME_OVER":
      if (e.code === "Space") {
        // gameStateを完全に初期化してタイトルシーンに設定
        gameState = getInitialGameState();
        // elapsedTimeをリセットしてタイトルのアニメーションを最初からにする
        globalTime = 0;
        gameState.elapsedTime = 0;
      }
      return;

    case "PLAYING":
      if (gameState.inputQueue.length >= 2) return;

      let direction = null;
      switch (e.code) {
        case "KeyW":
        case "ArrowUp":
          direction = "UP";
          break;
        case "KeyA":
        case "ArrowLeft":
          direction = "LEFT";
          break;
        case "KeyS":
        case "ArrowDown":
          direction = "DOWN";
          break;
        case "KeyD":
        case "ArrowRight":
          direction = "RIGHT";
          break;
        default:
          return;
      }

      const lastQueuedDir =
        gameState.inputQueue.length > 0
          ? gameState.inputQueue[gameState.inputQueue.length - 1]
          : gameState.chickDirection;
      if (direction === lastQueuedDir) return;

      gameState.inputQueue.push(direction);
      break;
  }
}

// --- Touch Event Handling for UI Buttons ---
const buttons = document.querySelectorAll("[data-key]");

buttons.forEach((button) => {
  button.addEventListener(
    "touchstart",
    (e) => {
      e.preventDefault(); // スクロールなどのデフォルト動作を防止
      button.classList.add("active-touch");
    },
    { passive: false }
  );

  button.addEventListener("touchend", () => {
    button.classList.remove("active-touch");
  });
});

// ----------------------------------------------------------------
// 7. ゲームループ
// ----------------------------------------------------------------
const gameCanvas = document.getElementById("gameCanvas");
const gameCtx = gameCanvas.getContext("2d");
gameCtx.imageSmoothingEnabled = false;

// キャンバスのサイズ設定
gameCanvas.width = NATIVE_WIDTH;
gameCanvas.height = NATIVE_HEIGHT;

function gameLoop() {
  // ループの次のフレームを要求
  requestAnimationFrame(gameLoop);

  // 必要なアセットが読み込まれていなければ、ローディング表示などを出すことも可能
  if (
    !spritesLoaded ||
    !soundsLoaded ||
    !titleImageLoaded ||
    !gameOverImageLoaded ||
    !fontSheetLoaded
  ) {
    // ここでローディング画面を描画しても良い
    return;
  }

  // ゲームの状態を更新
  update();

  // 描画
  draw(gameCtx);
}

// ----------------------------------------------------------------
// 8. ゲーム開始
// ----------------------------------------------------------------
document.addEventListener("keydown", (e) => handleKeyDown(e));

// DOMContentLoadedを待ってからアセットロードとゲーム初期化を開始
document.addEventListener("DOMContentLoaded", async () => {
  await loadSounds(); // すべてのサウンドがロードされるのを待つ

  // UIボタンにイベントリスナーを設定
  const uiButtons = document.querySelectorAll("[data-key]");
  uiButtons.forEach((button) => {
    const key = button.dataset.key;
    const eventData = { code: key, preventDefault: () => {} };

    // マウス操作用のイベントリスナー
    button.addEventListener("mousedown", async (e) => {
      e.preventDefault();
      await handleKeyDown(eventData);
    });

    // タッチ操作用のイベントリスナー
    // touchendを使うことで、touchstart -> clickの連続発火を防ぐ
    button.addEventListener("touchend", async (e) => {
      e.preventDefault();
      await handleKeyDown(eventData);
    });
  });

  // --- 説明モーダルの処理 ---
  const modal = document.getElementById("instruction-modal");
  const infoButton = document.getElementById("info-button");
  const closeModalButton = document.getElementById("close-modal-btn");

  if (modal && infoButton && closeModalButton) {
    // INFOボタンをクリックしたらモーダルを表示
    infoButton.addEventListener("click", (e) => {
      e.preventDefault();
      modal.classList.remove("hidden");
    });

    // 閉じるボタンをクリックしたらモーダルを非表示
    closeModalButton.addEventListener("click", () => {
      modal.classList.add("hidden");
    });
  } else {
    console.error("Modal-related elements not found!");
  }

  gameState = getInitialGameState(); // まずタイトルシーンのステートを設定
  requestAnimationFrame(gameLoop);
});
