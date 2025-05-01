let lastHref = document.location.href;
let hideDebounceTimer = null;

function hideVisibleShortsElements() {
    // 메인 프레임이고 컨텍스트가 유효할 때만 실행
    if (window.self !== window.top || chrome.runtime.lastError) {
        // console.warn("hideVisibleShortsElements: Skipping in sub-frame or invalid context.");
        return 0;
    }
    console.log(">>> hideVisibleShortsElements 실행 시도...");

    let newlyHiddenCount = 0;
    const commonSelectors = [
        'ytd-rich-item-renderer',       // 홈 피드, 검색 결과 등
        'ytd-grid-video-renderer',      // 채널 동영상 탭 등
        'ytd-video-renderer',           // 검색 결과 (가끔 비디오 형태)
        'ytd-compact-video-renderer',   // 관련 동영상 목록
        'ytd-reel-item-renderer',       // Shorts 탭 내부 아이템 (추가)
        'ytd-reel-video-renderer'       // Shorts 피드 아이템, Shorts 플레이어 내부 등 (중요)
    ].join(', ');

    // (1) 피드, 검색결과 등의 Shorts 썸네일 숨기기
    try {
        const candidates = document.querySelectorAll(commonSelectors);
        console.log(`>>> hideVisibleShortsElements: 후보 요소 ${candidates.length}개 발견 (피드 등).`);
        candidates.forEach(el => {
            // 이미 처리되었거나 숨겨진 요소는 건너뜀
            if (el.dataset.shortsProcessed === 'true' || el.style.display === 'none') return;

            // Shorts 링크가 있거나, 명시적인 reel 렌더러인 경우 숨김
            const hasShortsLink = el.querySelector('a[href^="/shorts/"]');
            const isReelRenderer = el.tagName.toLowerCase() === 'ytd-reel-video-renderer' || el.tagName.toLowerCase() === 'ytd-reel-item-renderer';

            if (hasShortsLink || isReelRenderer) {
                // console.log(`   - 숨김 대상 발견: ${el.tagName} (Link: ${!!hasShortsLink}, Reel: ${isReelRenderer})`);
                el.style.display = 'none';
                el.dataset.shortsProcessed = 'true';
                newlyHiddenCount++;
            }
        });
    } catch (e) {
        console.error(">>> hideVisibleShortsElements 오류 (Candidates):", e);
    }


    // (2) “Shorts” 섹션(쉘프) 전체 숨기기
    try {
        const shelves = document.querySelectorAll('ytd-rich-shelf-renderer, ytd-reel-shelf-renderer');
        console.log(`>>> hideVisibleShortsElements: 후보 요소 ${shelves.length}개 발견 (선반).`);
        shelves.forEach(el => {
            if (el.dataset.shortsProcessed === 'true' || el.style.display === 'none') return;
            const titleText = el.querySelector('#title')?.textContent || '';
            const isReelShelf = el.tagName.toLowerCase() === 'ytd-reel-shelf-renderer';
            const isRichShelfWithShorts = el.tagName.toLowerCase() === 'ytd-rich-shelf-renderer' && titleText.toLowerCase().includes('shorts'); // 대소문자 구분 없이 'shorts' 포함

            if (isReelShelf || isRichShelfWithShorts) {
                // console.log(`   - 숨김 대상 발견: ${el.tagName} (ReelShelf: ${isReelShelf}, RichShelf: ${isRichShelfWithShorts}, Title: "${titleText}")`);
                el.style.display = 'none';
                el.dataset.shortsProcessed = 'true';
                newlyHiddenCount++;
            }
        });
    } catch (e) {
        console.error(">>> hideVisibleShortsElements 오류 (Shelves):", e);
    }

    // (3) /shorts/ 개별 페이지 플레이어 숨기기 (제한 도달 시)
    if (window.location.pathname.startsWith('/shorts/')) {
        try {
            // YouTube Shorts 페이지의 주요 컨테이너를 타겟팅 (더 안정적일 수 있음)
            const playerContainer = document.querySelector('ytd-page-manager > ytd-shorts[is-active]') // 현재 활성화된 Shorts 페이지
                                 || document.querySelector('ytd-shorts-player-renderer') // 이전 방식 대비
                                 || document.querySelector('#player.ytd-shorts'); // 다른 구조 대비
            console.log(`>>> hideVisibleShortsElements: Shorts 플레이어 컨테이너 검색 시도 (결과: ${!!playerContainer})`);

            if (playerContainer && playerContainer.style.display !== 'none' && !playerContainer.dataset.shortsProcessed) {
                console.log("   - 숨김 대상 발견: Shorts 플레이어 컨테이너");
                playerContainer.style.display = 'none';
                playerContainer.dataset.shortsProcessed = 'true';
                newlyHiddenCount++;

                // 오버레이 메시지 표시
                if (!document.getElementById('shorts-limit-overlay')) {
                    const msg = document.createElement('div');
                    msg.id = 'shorts-limit-overlay';
                    chrome.storage.local.get('limitCount', (data) => {
                        const currentLimit = Number(data.limitCount) || 10;
                        msg.textContent = `하루 쇼츠 시청 제한 ${currentLimit}개에 도달했습니다. 홈으로 이동합니다…`;
                    });
                    Object.assign(msg.style, {
                        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
                        backgroundColor: 'rgba(0,0,0,0.9)', color: 'white', padding: '30px',
                        borderRadius: '10px', fontSize: '1.2em', textAlign: 'center', zIndex: '9999'
                    });
                    document.body?.appendChild(msg) || document.documentElement.appendChild(msg);
                    console.log("   - Shorts 제한 오버레이 추가됨.");
                }
            }
        } catch (e) {
            console.error(">>> hideVisibleShortsElements 오류 (Player):", e);
        }
    }

    if (newlyHiddenCount > 0) {
        console.log(`>>> hideVisibleShortsElements: 최종적으로 새로 숨긴 요소 ${newlyHiddenCount}개`);
    }
    return newlyHiddenCount;
}

function checkShortsLimit() {
    console.log(">>> checkShortsLimit 실행 시도...");

    // 메인 프레임이고 컨텍스트 유효성 확인
    if (window.self !== window.top || chrome.runtime.lastError) {
        console.warn(">>> checkShortsLimit 실행 중단: 하위 프레임 또는 컨텍스트 무효화.", chrome.runtime.lastError);
        return;
    }

    const today = new Date().toDateString();
    // console.log(">>> checkShortsLimit (메인 프레임) - 오늘 날짜:", today); // 로그 반복 최소화
    console.log(">>> checkShortsLimit: 스토리지 데이터 로드 시도...");

    chrome.storage.local.get(['shortsCount', 'lastResetDate', 'lastViewedShortId', 'hiddenCount', 'limitCount'], (data) => {
        // console.log(">>> checkShortsLimit: 스토리지 콜백 실행됨.");

        if (chrome.runtime.lastError) {
            console.warn(">>> checkShortsLimit: 스토리지 콜백 오류.", chrome.runtime.lastError);
            return; // 스토리지 오류 시 중단
        }

        // 변수 초기화 및 타입/값 검증
        let count = Number(data.shortsCount || 0);
        let lastReset = data.lastResetDate;
        let lastViewedId = data.lastViewedShortId || null;
        let totalDailyHiddenCount = Number(data.hiddenCount || 0);
        let limitCount = data.limitCount;

        if (typeof limitCount === 'undefined' || limitCount === null) {
            limitCount = 10; // 기본값
            console.warn(">>> limitCount 정의되지 않음/null. 기본값 10 사용");
        } else {
            limitCount = Number(limitCount);
            if (isNaN(limitCount)) {
                limitCount = 10; // 숫자가 아니면 기본값
                console.warn(">>> limitCount 숫자 변환 실패. 기본값 10 사용");
            }
        }
        // console.log(">>> 스토리지 데이터:", { shortsCount: count, lastResetDate: lastReset, lastViewedShortId: lastViewedId, hiddenCount: totalDailyHiddenCount, limitCount });

        let needsSave = false; // 스토리지 저장 필요 여부 플래그

        // --- 일자 변경 시 초기화 ---
        if (lastReset !== today) {
            console.log(`>>> 날짜 변경 감지 (${lastReset} -> ${today}). 카운트 및 상태 초기화.`);
            count = 0;
            lastReset = today;
            totalDailyHiddenCount = 0;
            lastViewedId = null; // 중요: 마지막 본 ID도 초기화
            needsSave = true;
            console.log(">>> 초기화 결과:", { count, lastReset, totalDailyHiddenCount, lastViewedId });
            const overlay = document.getElementById('shorts-limit-overlay');
            if (overlay) { overlay.remove(); console.log(">>> 이전 오버레이 제거됨."); }
        } else {
            // console.log(">>> 동일 날짜. 초기화 불필요.");
        }

        // --- 현재 페이지 정보 파싱 ---
        const isOnShortsPage = window.location.pathname.startsWith('/shorts/');
        const rawId = isOnShortsPage ? window.location.pathname.split('/shorts/')[1] : null;
        const currentShortId = isOnShortsPage && rawId ? rawId.split('?')[0] : null;

        // --- 비-쇼츠 페이지에서 lastViewedId 초기화 ---
        if (!isOnShortsPage && lastViewedId !== null) {
            console.log(">>> 쇼츠 페이지 아님. lastViewedId 초기화.");
            lastViewedId = null;
            needsSave = true;
        }

        // --- 쇼츠 시청 카운트 증가 로직 ---
        // 메인 프레임, 쇼츠 페이지, 유효한 새 ID 인 경우 카운트 증가
        if (window.self === window.top && isOnShortsPage && currentShortId && currentShortId !== lastViewedId) {
            console.log(`>>> 새 쇼츠(${currentShortId}) 감지. 이전 ID: ${lastViewedId}. 카운트 증가 전: ${count}`);
            count++; // 카운트 증가
            lastViewedId = currentShortId; // 마지막 본 ID 업데이트
            needsSave = true; // 저장 필요 플래그 설정
            console.log(`>>> 카운트 증가 후: ${count} (제한: ${limitCount})`);
        } else if (isOnShortsPage && currentShortId === lastViewedId) {
            // console.log(`>>> 동일 쇼츠(${currentShortId}) 재방문. 카운트 유지: ${count}`);
        }

        // --- 최종 카운트 확인 및 제한 도달 시 액션 ---
        // 카운트 증가 로직 *후에* 최종 카운트를 기준으로 판단
        if (count >= limitCount) {
            console.log(`>>> 최종 카운트(${count})가 제한(${limitCount}) 도달/초과. 숨김/리디렉션 처리 시작.`);

            // 1. 요소 숨김
            const newlyHidden = hideVisibleShortsElements();
            if (newlyHidden > 0) {
                totalDailyHiddenCount += newlyHidden;
                needsSave = true;
                console.log(`>>> 새로 숨긴 요소 ${newlyHidden}개 반영. 오늘 총 숨김: ${totalDailyHiddenCount}`);
            } else {
                // console.log(">>> 제한 도달 상태이나 새로 숨길 요소 없음 (이미 숨겨졌거나 없음).");
            }

            // 2. 쇼츠 페이지면 리디렉션
            if (isOnShortsPage) {
                console.log(">>> 쇼츠 페이지에서 제한 도달 감지. 홈으로 리디렉션 시도.");
                // setTimeout으로 약간의 지연을 주어 로그 확인 및 숨김 처리가 반영될 시간을 줍니다.
                setTimeout(() => {
                    if (window.self === window.top && !chrome.runtime.lastError) { // 리디렉션 전 최종 확인
                        console.log(">>> 리디렉션 실행...");
                        window.location.href = "https://www.youtube.com";
                    } else {
                        console.warn(">>> 리디렉션 불가 (하위 프레임 또는 오류)", chrome.runtime.lastError);
                    }
                }, 100); // 100ms 지연
                // 리디렉션이 예정되었으므로, 이후 저장 로직 등이 불필요할 수 있으나 일단 두어도 문제는 없습니다.
            } else {
                // console.log(">>> 쇼츠 페이지 아님. 제한 도달했으나 리디렉션은 불필요.");
            }
        } else {
            // console.log(`>>> 최종 카운트(${count})가 제한(${limitCount}) 미만.`);
        }

        // --- 스토리지 저장 ---
        if (needsSave && window.self === window.top) {
            console.log(">>> 변경사항 스토리지 저장 시도...");
            // console.log(">>> 저장 데이터:", { shortsCount: count, lastResetDate: lastReset, lastViewedShortId: lastViewedId, hiddenCount: totalDailyHiddenCount });
            chrome.storage.local.set({
                shortsCount: count,
                lastResetDate: lastReset,
                lastViewedShortId: lastViewedId,
                hiddenCount: totalDailyHiddenCount
            }, () => {
                if (chrome.runtime.lastError) {
                    console.warn(">>> 스토리지 저장 콜백 오류:", chrome.runtime.lastError);
                } else {
                    // console.log(">>> 스토리지 저장 완료.");
                }
            });
        } else {
            // console.log(">>> 저장할 변경사항 없음.");
        }

        // console.log(">>> checkShortsLimit: 스토리지 콜백 처리 완료.");
    }); // 스토리지 get 콜백 끝

    // console.log(">>> checkShortsLimit 함수 실행 완료.");
} // checkShortsLimit 함수 정의 끝


// --- MutationObserver 설정 및 초기 실행 ---

const observer = new MutationObserver(mutations => {
    // 메인 프레임이고 컨텍스트 유효할 때만
    if (window.self !== window.top || chrome.runtime.lastError) return;

    let urlChanged = false;
    // URL 변경 감지
    if (location.href !== lastHref) {
        lastHref = location.href;
        urlChanged = true;
        console.log(">>> URL 변경 감지 (Observer):", location.href);
        checkShortsLimit(); // URL 변경 시 즉시 제한 체크 실행
    }

    // DOM 변경 시 (URL 변경이 아니더라도), 제한 초과 상태면 숨김 처리 (Debounced)
    // URL 변경 시에는 checkShortsLimit가 숨김을 처리하므로, 여기서는 추가적인 DOM 변경에 대한 대응
    if (!urlChanged) {
        chrome.storage.local.get(['shortsCount', 'limitCount'], (data) => {
            if (chrome.runtime.lastError) return;
            const currentCount = Number(data.shortsCount || 0);
            const currentLimit = Number(data.limitCount || 10);

            if (currentCount >= currentLimit) {
                clearTimeout(hideDebounceTimer);
                hideDebounceTimer = setTimeout(() => {
                    console.log(">>> MutationObserver: DOM 변경 후 제한 초과 상태 확인. 숨김 재시도.");
                    // checkShortsLimit를 다시 호출하여 숨김 및 hiddenCount 업데이트를 일관되게 처리
                    checkShortsLimit();
                }, 250); // Debounce 시간 (ms)
            }
        });
    }
});

console.log(">>> Content Script 초기화 시작...");

// MutationObserver 시작
const targetNode = document.body;
if (targetNode) {
    console.log(">>> MutationObserver 설정 및 시작...");
    observer.observe(targetNode, { childList: true, subtree: true });
} else {
    window.addEventListener('DOMContentLoaded', () => {
        if (chrome.runtime.lastError) {
            console.warn(">>> DOMContentLoaded 콜백 시작 시 오류 발생.", chrome.runtime.lastError);
            return; // 스토리지
        }
        const bodyNode = document.body;
        if(bodyNode) {
             console.log(">>> DOMContentLoaded 후 MutationObserver 설정 및 시작...");
             observer.observe(bodyNode, { childList: true, subtree: true });
        } else {
             console.error(">>> DOMContentLoaded 후에도 body 찾기 실패. Observer 시작 불가.");
        }
        // DOM 로드 후 첫 체크 실행
        console.log(">>> DOMContentLoaded 후 checkShortsLimit 실행.");
        checkShortsLimit();
    });
    console.warn(">>> body 없음. DOMContentLoaded 리스너 추가됨.");
}

// 페이지 초기 로드 시 checkShortsLimit 실행 (body가 이미 있다면 여기서도 실행됨)
if (targetNode) { // body가 존재할 때만 즉시 실행
    console.log(">>> 페이지 초기 로드 시 checkShortsLimit 실행.");
    checkShortsLimit();
}

// --- 중복 호출 제거 ---
// console.log(">>> 페이지 초기 로드 시 checkShortsLimit 실행."); // 제거
// checkShortsLimit(); // 제거
// console.log(">>> 스크립트 초기 실행 완료."); // 제거

// 쇼츠 페이지 특별 처리 (SPA 네비게이션 대응 및 초기 렌더링 지연 고려)
if (window.location.pathname.startsWith('/shorts/')) {
    console.log(">>> Shorts 페이지 초기 진입 감지. 추가 checkShortsLimit 예정.");
    // 약간의 지연 후 실행하여 Shorts 플레이어 렌더링 시간을 확보
    setTimeout(() => {
         console.log(">>> Shorts 페이지 지연 후 checkShortsLimit 실행.");
         checkShortsLimit();
    }, 500);
}

console.log(">>> Content Script 초기 설정 완료.");