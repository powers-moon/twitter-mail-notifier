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

async function fetchAndSend() {
  try {
    const user = await client.v2.userByUsername(TARGET_USERNAME);
    const userId = user.data.id;

    const tweets = await client.v2.userTimeline(userId, {
      max_results: 5,
      'tweet.fields': ['created_at', 'text', 'id'],
      exclude: 'retweets,replies'
    });

    let lastId = fs.existsSync(LAST_ID_FILE) ? fs.readFileSync(LAST_ID_FILE, 'utf-8') : null;
    console.log('tweets.data:', tweets.data);

    const newTweets = tweets.data?.filter(t => !lastId || t.id > lastId) || [];

    if (newTweets.length > 0) {
      fs.writeFileSync(LAST_ID_FILE, newTweets[0].id);

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

fetchAndSend();
