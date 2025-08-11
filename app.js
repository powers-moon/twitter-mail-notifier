// app.js
const { TwitterApi } = require('twitter-api-v2');
const nodemailer = require('nodemailer');
const fs = require('fs');

// ====== �ݒ� ======
const BEARER_TOKEN = process.env.X_BEARER_TOKEN;
const TARGET_USERNAME = process.env.TARGET_USERNAME; // �ʒm������X���[�U�[
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
    const newTweets = tweets.data?.filter(t => !lastId || t.id > lastId) || [];

    if (newTweets.length > 0) {
      fs.writeFileSync(LAST_ID_FILE, newTweets[0].id);

      const body = newTweets.map(t =>
        `${t.created_at}\n${t.text}\nhttps://x.com/${TARGET_USERNAME}/status/${t.id}`
      ).join('\n\n');

      await transporter.sendMail({
        from: EMAIL_FROM,
        to: EMAIL_TO,
        subject: `X�V���c�C�[�g: ${TARGET_USERNAME}`,
        text: body
      });

      console.log(`���M����: ${newTweets.length}��`);
    } else {
      console.log('�V���Ȃ�');
    }
  } catch (err) {
    console.error('�G���[', err);
    process.exit(1); // GitHub Actions �Ŏ��s�����ɂ���
  }
}

fetchAndSend();
