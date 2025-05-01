/*document.addEventListener('DOMContentLoaded', () => {
    const slider   = document.getElementById('countSlider');
    const countVal = document.getElementById('countValue');
    const CONFIRMED_KEY = 'hasConfirmed';
  
    // 이미 확인한 적이 있으면 바로 결과 페이지로 이동
    chrome.storage.local.get([CONFIRMED_KEY], (res) => {
      if (res[CONFIRMED_KEY]) {
        window.location.href = chrome.runtime.getURL('popup.html');
        return;
      }
  
      // 최초 실행 시 슬라이더 값 세팅
      countVal.textContent = slider.value;
      slider.addEventListener('input', () => {
        countVal.textContent = slider.value;
      });
  
      // 확인 버튼 클릭 시 limitCount 저장
      document.getElementById('confirmBtn').addEventListener('click', () => {
        const value = slider.value;
        chrome.storage.local.set({
          limitCount: value,        // ← 저장 키를 limitCount 로 변경
          [CONFIRMED_KEY]: true
        }, () => {
          window.location.href = chrome.runtime.getURL('popup.html');
        });
      });
    });
  });
  */
  document.addEventListener('DOMContentLoaded', () => {
    const CONF_KEY       = 'hasConfirmed';
    const DATE_KEY       = 'lastConfirmDate';
    const today          = new Date().toDateString();
    const slider         = document.getElementById('countSlider');
    const countVal       = document.getElementById('countValue');
  
    function initSlider() {
      // 슬라이더 초기화
      countVal.textContent = slider.value;
      slider.addEventListener('input', () => {
        countVal.textContent = slider.value;
      });
      document.getElementById('confirmBtn').addEventListener('click', () => {
        const value = slider.value;
        chrome.storage.local.set({
          limitCount: value,
          [CONF_KEY]: true,
          [DATE_KEY]: today
        }, () => {
          window.location.href = chrome.runtime.getURL('popup.html');
        });
      });
    }
  
    // 1) 저장된 키와 날짜를 불러온다.
    chrome.storage.local.get([CONF_KEY, DATE_KEY], res => {
      const confirmed   = res[CONF_KEY];
      const lastDate    = res[DATE_KEY];
      // 2) 날짜가 다르면 “확인” 플래그 초기화
      if (lastDate !== today) {
        chrome.storage.local.set({ [CONF_KEY]: false, [DATE_KEY]: today }, initSlider);
      }
      // 3) 이미 오늘 확인한 적이 있으면 바로 팝업으로
      else if (confirmed) {
        window.location.href = chrome.runtime.getURL('popup.html');
      }
      // 4) 확인 안 했으면 슬라이더 화면 보여주기
      else {
        initSlider();
      }
    });
  });
  
  