// Страница настроек: показывает текущий закэшированный курс USD и позволяет
// обновить его вручную через тот же message-канал, что использует content.js.

const RATE_MAX_AGE_HOURS = 24;
const STATUS_CLEAR_DELAY_MILLISECONDS = 4000;

const rateValueElement = document.getElementById('rate-value');
const rateUpdatedElement = document.getElementById('rate-updated');
const refreshButton = document.getElementById('refresh-button');
const refreshStatusElement = document.getElementById('refresh-status');

document.addEventListener('DOMContentLoaded', () => {
  renderStoredRate().catch((error) => {
    console.error('Kufar Currency Converter (options): не удалось загрузить курс', error);
    rateValueElement.textContent = 'Не удалось загрузить курс';
  });
});
refreshButton.addEventListener('click', refreshRate);

async function renderStoredRate() {
  const stored = await chrome.storage.local.get(['usdRate', 'lastUpdate']);
  if (!stored.usdRate || !stored.lastUpdate) {
    rateValueElement.textContent = 'Курс пока не запрашивался';
    rateUpdatedElement.textContent = 'Откройте страницу kufar.by или нажмите «Обновить курс».';
    return;
  }

  showRate(stored.usdRate, stored.lastUpdate);
}

function showRate(rate, lastUpdateIso) {
  rateValueElement.textContent = `1 USD = ${formatRate(rate)} BYN`;

  const lastUpdate = new Date(lastUpdateIso);
  const ageInHours = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60);
  const freshnessNote = ageInHours < RATE_MAX_AGE_HOURS
    ? '(актуален, кэш ещё не истёк)'
    : '(устарел, будет обновлён при следующем заходе на kufar.by)';

  rateUpdatedElement.textContent = `Обновлён: ${lastUpdate.toLocaleString('ru-RU')} ${freshnessNote}`;
}

function formatRate(rate) {
  return Number(rate).toLocaleString('ru-RU', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}

async function refreshRate() {
  refreshButton.disabled = true;
  refreshStatusElement.textContent = 'Запрашиваем курс у api.nbrb.by…';

  try {
    const response = await chrome.runtime.sendMessage({ action: 'getRate' });
    if (!response || !response.rate) {
      throw new Error('Пустой ответ от service worker');
    }

    const stored = await chrome.storage.local.get(['lastUpdate']);
    showRate(response.rate, stored.lastUpdate || new Date().toISOString());
    setStatus('Курс обновлён.');
  } catch (error) {
    console.error('Kufar Currency Converter (options): не удалось обновить курс', error);
    setStatus('Не удалось получить курс. Попробуйте ещё раз позже.');
  } finally {
    refreshButton.disabled = false;
  }
}

function setStatus(message) {
  refreshStatusElement.textContent = message;
  setTimeout(() => {
    if (refreshStatusElement.textContent === message) {
      refreshStatusElement.textContent = '';
    }
  }, STATUS_CLEAR_DELAY_MILLISECONDS);
}
