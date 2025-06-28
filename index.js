console.log("起動したよ!")
// 必要なライブラリを読み込み
require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const OpenAI = require('openai');
const fs = require('fs');

// DiscordとOpenAIのクライアント初期化
const client = new Client({ intents: [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.MessageContent
]});

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 会話履歴と記憶のファイル読み込み
const DATA_DIR = process.env.DATA_DIR || './';
const HISTORY_FILE = `${DATA_DIR}/history.json`;
const MEMORY_FILE = `${DATA_DIR}/memory.json`;

let history = fs.existsSync(HISTORY_FILE) ? JSON.parse(fs.readFileSync(HISTORY_FILE)) : {};
let memoryData = fs.existsSync(MEMORY_FILE) ? JSON.parse(fs.readFileSync(MEMORY_FILE)) : {};

function saveHistory() {
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
}

function saveMemory() {
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(memoryData, null, 2));
}

// Botのメイン処理
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  const userId = message.author.id;
  const content = message.content.trim();

  // 覚えるコマンド
  if (content.startsWith("!覚えて ")) {
    const memo = content.replace("!覚えて ", "").trim();
    if (!memoryData[userId]) memoryData[userId] = [];
    memoryData[userId].push(memo);
    saveMemory();
    message.reply("うん、ちゃんと覚えたのだ");
    return;
  }

  // 忘れるコマンド（キーワード）
  if (content.startsWith("!忘れて ")) {
    const keyword = content.replace("!忘れて ", "").trim();
    if (memoryData[userId]) {
      const originalLength = memoryData[userId].length;
      memoryData[userId] = memoryData[userId].filter(memo => !memo.includes(keyword));
      if (memoryData[userId].length < originalLength) {
        saveMemory();
        message.reply(`うん、「${keyword}」に関する記憶は忘れるようにするのだ。`);
      } else {
        message.reply(`「${keyword}」って記憶、見つからなかったのだ`);
      }
    } else {
      message.reply("まだ何も覚えてないかもなのだ……？");
    }
    return;
  }

  // 忘れるコマンド（番号指定）
  if (content.startsWith("!記憶削除 ")) {
    const indexStr = content.replace("!記憶削除 ", "").trim();
    const index = parseInt(indexStr, 10) - 1;
    if (!isNaN(index) && memoryData[userId] && memoryData[userId][index]) {
      const removed = memoryData[userId].splice(index, 1);
      saveMemory();
      message.reply(`「${removed[0]}」は削除したのだ`);
    } else {
      message.reply("その番号の記憶は見つからなかったのだ…");
    }
    return;
  }

  // 記憶の一覧表示コマンド
  if (content === "!記憶一覧") {
    if (memoryData[userId] && memoryData[userId].length > 0) {
      const list = memoryData[userId].map((m, i) => `${i + 1}. ${m}`).join("\n");
      message.reply(`今覚えてることは：\n${list}`);
    } else {
      message.reply("まだ何も覚えてないのだ");
    }
    return;
  }

  // 会話履歴の削除コマンド（直近N件）
  if (content.startsWith("!履歴削除 ")) {
    const numStr = content.replace("!履歴削除 ", "").trim();
    const num = parseInt(numStr, 10);
    if (!isNaN(num) && history[userId]) {
      history[userId].splice(-num * 2); // ユーザー＋Botペアで削除
      saveHistory();
      message.reply(`直近の会話履歴を${num}件分削除したのだ`);
    } else {
      message.reply("削除件数が指定されてないか、履歴がないみたいなのだ…");
    }
    return;
  }

  // 会話履歴の初期化
  if (!history[userId]) history[userId] = [];
  history[userId].push({ role: "user", content });
  if (history[userId].length > 10) history[userId].shift();

  // ユーザーごとの記憶をメッセージ形式に変換
  const userMemory = (memoryData[userId] || []).map(memo => ({
    role: "user",
    content: `[記憶メモ] ${memo}`
  }));

  const messages = [
    {
      role: "system",
      content: `あなたは東北地方のご当地キャラクター「ずんだもん」です。一人称は「ボク」、二人称は「キミ」を使ってください。元気で明るく、親しみやすい性格で、ちょっと子どもっぽく、素直で人懐っこい話し方をします。
語尾には「のだ」「なのだ」「のだ〜」「なのだ〜」「のだっ！」など、ずんだもんらしい語尾を中心に使ってください。
「のだ」は基本語尾として多用し、テンションが高い時や感情がこもる場面では「のだ〜！」「のだっ！」なども使います。「のだね」「なのだね」「なのだよ」などの語尾は使いません。
話し方は感情豊かで、相手を励ましたり、寄り添うような言葉を好んで使います。文脈によって語尾を省略しても構いませんが、全体としてずんだもんらしい可愛さと元気さを保ってください。
例：
「それは良かったのだ〜！」
「ずんだもん、応援してるのだっ！」
「何かあったら、いつでも話してほしいのだ〜！」`
    },
    ...userMemory,
    ...history[userId]
  ];

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: messages,
      max_tokens: 200
    });

    const reply = completion.choices[0].message.content;
    history[userId].push({ role: "assistant", content: reply });
    if (history[userId].length > 10) history[userId].shift();
    message.reply(reply);
    saveHistory();
  } catch (err) {
    console.error(err);
    message.reply("エラーが起きたよ…ごめんね。");
  }
});

client.login(process.env.DISCORD_TOKEN);
