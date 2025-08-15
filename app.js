const allTweets = tweets.data.data || [];

// ツイートIDの大小を数値として比較できるように BigInt を使用
const sortedTweets = allTweets.sort((a, b) => BigInt(a.id) - BigInt(b.id));

// 前回の lastId より新しいツイートだけを残す
const newTweets = sortedTweets.filter(t => !lastId || BigInt(t.id) > BigInt(lastId));

if (newTweets.length > 0) {
  // 最新ツイートの ID を保存（最後の要素が一番新しい）
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
