// Service worker: получает курс USD у Нацбанка РБ.
// Запрос идёт отсюда, а не из content script, чтобы host_permissions обходили
// CORS-политику страниц kufar.by.

const NATIONAL_BANK_USD_RATE_URL = 'https://api.nbrb.by/exrates/rates/431';
const RATE_REQUEST_TIMEOUT_MILLISECONDS = 5000;

chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action !== 'getRate') {
    return false;
  }

  fetchUsdRate()
    .then((rate) => sendResponse({ rate: rate }))
    .catch((error) => {
      console.error('Kufar Currency Converter: не удалось получить курс', error);
      sendResponse({ rate: null });
    });

  return true;
});

async function fetchUsdRate() {
  const timeoutController = new AbortController();
  const timeoutHandle = setTimeout(
    () => timeoutController.abort(),
    RATE_REQUEST_TIMEOUT_MILLISECONDS
  );

  let response;
  try {
    response = await fetch(NATIONAL_BANK_USD_RATE_URL, { signal: timeoutController.signal });
  } finally {
    clearTimeout(timeoutHandle);
  }

  if (!response.ok) {
    throw new RateRequestError(`api.nbrb.by ответил ${response.status}`);
  }

  const data = await response.json();
  const rate = data.Cur_OfficialRate;
  if (!rate) {
    throw new RateRequestError('в ответе api.nbrb.by нет Cur_OfficialRate');
  }

  await chrome.storage.local.set({ usdRate: rate, lastUpdate: new Date().toISOString() });
  return rate;
}

class RateRequestError extends Error {}
