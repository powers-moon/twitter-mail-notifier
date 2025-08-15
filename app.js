// app.js
const { TwitterApi } = require('twitter-api-v2');
const nodemailer = require('nodemailer');
const fs = require('fs');

// ====== 設定 ======
const BEARER_TOKEN = process.env.BEARER_TOKEN;
const TARGET_USERNAME = process.env.TARGET_USERNAME; // 通知したいXユーザー
const EMAIL_FROM = process.env.EMAIL_FROM;
const EMAIL_TO = process.env.EMAIL_TO;

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

const client = new TwitterApi(BEARER_TOKEN);
const LAST_ID_FILE = './last_id.txt';

// ==== ヘルパー関数 ====
async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ==== メイン関数 ====
async function fetchAndSend() {
  try {
    const user = await client.v2.userByUsername(TARGET_USERNAME);
    const userId = user.data.id;

    let tweets;
    while (true) {
      try {
        tweets = await client.v2.userTimeline(userId, {
          max_results: 5,
          'tweet.fields': ['created_at', 'text', 'id'],
          exclude: 'retweets,replies'
        });
        break; // 成功したらループ終了
      } catch (err) {
        if (err.code === 429 && err.rateLimit) {
          const waitSec = err.rateLimit.reset - Math.floor(Date.now() / 1000);
          console.log(`429 Too Many Requests, ${waitSec}s 待機して再試行します...`);
          await sleep((waitSec + 1) * 1000);
        } else {
          throw err;
        }
      }
    }

    let lastId = fs.existsSync(LAST_ID_FILE) ? fs.readFileSync(LAST_ID_FILE, 'utf-8') : null;
    const allTweets = tweets.data?.data || [];

    // ID の大小比較用に BigInt を使用してソート
    const sortedTweets = allTweets.sort((a, b) => {
      const idA = BigInt(a.id);
      const idB = BigInt(b.id);
      if (idA < idB) return -1;
      if (idA > idB) return 1;
      return 0;
    });

    // 新着ツイートだけ抽出
    const newTweets = sortedTweets.filter(t => !lastId || BigInt(t.id) > BigInt(lastId));

    if (newTweets.length > 0) {
      // 最新ツイートIDを保存（最後の要素が一番新しい）
      fs.writeFileSync(LAST_ID_FILE, newTweets[newTweets.length - 1].id);

      const body = newTweets.map(t =>
        `${t.created_at}\n${t.text}\nhttps://x.com/${TARGET_USERNAME}/status/${t.id}`
      ).join('\n\n');

      await transporter.sendMail({
        from: EMAIL_FROM,
        to: EMAIL_TO,
        subject: `X新着ツイート: ${TARGET_USERNAME}`,
        text: body
      });

      console.log(`送信完了: ${newTweets.length}件`);
    } else {
      console.log('新着なし');
    }

  } catch (err) {
    console.error('エラー', err);
    process.exit(1); // GitHub Actions で失敗扱いにする
  }
}

// ==== 実行 ====
fetchAndSend();
