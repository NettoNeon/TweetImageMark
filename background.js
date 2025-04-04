// 拡張機能がインストールされたときにメニュー作成
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "save-image-with-text",
    title: "TweetImageMark（文字入り画像を保存）",
    contexts: ["image"],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "save-image-with-text") {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: runContentScript,
      args: [info.srcUrl], // ← 画像URLを渡す
    });
  }
});

// contentScript を関数として注入（argsあり）
function runContentScript(imageUrl) {
  function notify(message) {
    alert(`[Twitter Image DL]\n${message}`);
  }

  const url = location.href;
  const urlPattern = /https:\/\/x\.com\/([^\/]+)\/status\/([^\/]+)/;
  const match = url.match(urlPattern);
  if (!match) {
    notify("画像ページではないか、URL形式が不正です。");
    return;
  }

  const userID = match[1];
  const tweetID = match[2];

  // srcURL に一致する <img> 要素を探す
  const img = [...document.images].find((i) => i.src.startsWith(imageUrl));
  if (!img) {
    notify("画像要素が見つかりませんでした。");
    return;
  }

  function drawRoundedRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();
  }

  function drawMultilineTextWithBox(ctx, lines, x, y, fontSize = 20, letterSpacingEm = 0.05, lineHeight = 1.4) {
    const padding = 8;
    const borderRadius = 4;

    ctx.font = `${fontSize}px 'Century Gothic'`;
    ctx.textBaseline = "top";

    const letterSpacing = fontSize * letterSpacingEm;
    const lineHeightPx = fontSize * lineHeight;

    // 計算：幅（最大行の長さ）と高さ（行数）
    let maxLineWidth = 0;
    lines.forEach((line) => {
      let width = 0;
      for (const char of line) {
        width += ctx.measureText(char).width + letterSpacing;
      }
      maxLineWidth = Math.max(maxLineWidth, width);
    });

    const totalHeight = lines.length * lineHeightPx;

    // 背景描画
    ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
    drawRoundedRect(ctx, x - padding, y - padding, maxLineWidth + padding * 2, totalHeight + padding, borderRadius);

    // テキスト描画
    ctx.fillStyle = "white";
    lines.forEach((line, lineIndex) => {
      let cursorX = x;
      const cursorY = y + lineIndex * lineHeightPx;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        ctx.fillText(char, cursorX, cursorY);
        cursorX += ctx.measureText(char).width + letterSpacing;
      }
    });
  }

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;

  const image = new Image();
  image.crossOrigin = "Anonymous";
  image.src = img.src;
  image.onload = () => {
    ctx.drawImage(image, 0, 0);
    const lines = [`userID: @${userID}`, `tweetID: ${tweetID}`];
    drawMultilineTextWithBox(ctx, lines, 20, canvas.height - 48 * 1.4);
    // ========== ダウンロード ==========
    const link = document.createElement("a");
    link.download = `image_${tweetID}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };
}
