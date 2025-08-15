// app.js
const { TwitterApi } = require('twitter-api-v2');
const nodemailer = require('nodemailer');
const fs = require('fs');

// ====== 設定 ======
const BEARER_TOKEN = process.env.BEARER_TOKEN;
const TARGET_USERNAME = process.env.TARGET_USERNAME;
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

// ====== ユーティリティ ======
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchTweetsWithRetry(userId, retries = 5) {
  for (let i = 0; i < retries; i++) {
    try {
      const tweets = await client.v2.userTimeline(userId, {
        max_results: 5,
        'tweet.fields': ['created_at', 'text', 'id'],
        exclude: 'retweets,replies'
      });
      return tweets;
    } catch (err) {
      if (err.code === 429) {
        const reset = err.rateLimit?.reset ? parseInt(err.rateLimit.reset, 10) * 1000 : 60000;
        const waitTime = reset - Date.now();
        console.warn(`レート制限 429 発生、${waitTime / 1000}s 待機して再試行`);
        await sleep(waitTime > 0 ? waitTime : 60000);
      } else {
        throw err;
      }
    }
  }
  throw new Error('最大リトライ回数に達しました');
}

// ====== メイン処理 ======
async function fetchAndSend() {
  try {
    const user = await client.v2.userByUsername(TARGET_USERNAME);
    const userId = user.data.id;

    const tweets = await fetchTweetsWithRetry(userId);

    let lastId = fs.existsSync(LAST_ID_FILE) ? fs.readFileSync(LAST_ID_FILE, 'utf-8') : null;

    const allTweets = tweets.data || [];
    const sortedTweets = allTweets.sort((a, b) => {
      const idA = BigInt(a.id);
      const idB = BigInt(b.id);
      if (idA < idB) return -1;
      if (idA > idB) return 1;
      return 0;
    });

    const newTweets = sortedTweets.filter(t => !lastId || BigInt(t.id) > BigInt(lastId));

    if (newTweets.length > 0) {
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
    process.exit(1);
  }
}

// ====== 実行 ======
fetchAndSend();
