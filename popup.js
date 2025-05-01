document.addEventListener('DOMContentLoaded', () => {
  const hiddenCountSpan = document.getElementById('hiddenCount');
  if (!hiddenCountSpan) {
      console.error("ID가 'hiddenCount'인 요소를 찾을 수 없습니다.");
      return;
  }

  chrome.storage.local.get('hiddenCount', (result) => {
      // undefined나 null일 경우 0으로 대체
      const count = Number(result.hiddenCount) || 0;
      console.log('chrome.storage.local에서 hiddenCount를 읽었습니다:', count);

      hiddenCountSpan.textContent = `${count}`;
  });
});

console.log("popup.js 파일이 실행되었습니다.");
