// Kufar Currency Converter — content script.
// Находит цены в BYN на странице и показывает под ними приблизительную цену в USD.

const USD_LINE_CLASS = 'kufar-usd-price';
const PROCESSED_MARKER = 'kufarUsdConverted';
const BYN_PRICE_PATTERN = /^\d[\d\s]*\s?р\.$/;
// Нестрогий шаблон для наблюдателя: цена может прийти внутри контейнера.
const BYN_PRICE_HINT_PATTERN = /\d[\d\s]*\s?р\./;
const PRICE_CONTAINER_SELECTOR = '[class*="price"]';
const PRICE_CANDIDATE_SELECTOR = 'span, p';
// "3 278 р. за м2" / "3 278 р. за м²" — ищем по тексту, а не по классу:
// у Kufar этот класс называется по-разному на разных страницах.
const PER_SQUARE_METER_TEXT_PATTERN = /за\s?м[²2]/i;
const PER_SQUARE_METER_SEARCH_DEPTH = 3;
const DOM_SETTLE_DELAY_MILLISECONDS = 150;
const RATE_MAX_AGE_HOURS = 24;
const NATIONAL_BANK_USD_RATE_URL = 'https://api.nbrb.by/exrates/rates/431';
const FALLBACK_RATE = 3.25;

let currentRate = null;
let priceObserver = null;
let pendingProcessTimer = null;

async function init() {
  injectStyles();

  currentRate = await resolveRate();
  if (!currentRate) {
    return;
  }

  convertAllPrices(currentRate);
  observePriceChanges();
}

// --- Отображение ---------------------------------------------------------

function convertAllPrices(rate) {
  if (!rate) {
    return;
  }

  for (const priceElement of document.querySelectorAll(PRICE_CANDIDATE_SELECTOR)) {
    if (!isUnconvertedPriceElement(priceElement)) {
      continue;
    }
    showUsdPrice(priceElement, rate);
  }
}

function showUsdPrice(priceElement, rate) {
  if (!priceElement || !rate) {
    return;
  }

  const usdText = formatUsdPrice(priceElement.textContent, rate);
  if (!usdText) {
    return;
  }

  const anchor = resolveUsdAnchor(priceElement);
  placeUsdLine(anchor, usdText);

  priceElement.dataset[PROCESSED_MARKER] = 'true';
}

// Ищем нашу строку среди соседей по родителю (а не только следующего
// соседа) — React и Yandex Maps (балуны на карте) могут переставлять или
// добавлять узлы между ценой и нашей строкой между перерисовками.
function placeUsdLine(anchor, usdText) {
  const siblingLines = anchor.parentElement
    ? Array.from(anchor.parentElement.children).filter(isOwnNode)
    : [];
  const [existingLine, ...duplicateLines] = siblingLines;

  duplicateLines.forEach((line) => line.remove());

  if (!existingLine) {
    anchor.insertAdjacentElement('afterend', buildUsdLine(usdText));
    return;
  }

  existingLine.textContent = usdText;
  if (existingLine.previousElementSibling !== anchor) {
    anchor.insertAdjacentElement('afterend', existingLine);
  }
}

// Цена в USD должна оказаться на своей строке, под строкой "BYN + цена за
// м2" целиком, а не втиснута в неё рядом с иконкой калькулятора или
// кнопкой "избранное".
function resolveUsdAnchor(priceElement) {
  const priceRow = findRowContainingPerSquareMeterPrice(priceElement);
  return escapeHorizontalRow(priceRow);
}

// Находим наименьшего предка, чей текст содержит и цену, и цену за м2 —
// это и есть "строка с BYN + за м2" целиком.
function findRowContainingPerSquareMeterPrice(priceElement) {
  const priceContainer = priceElement.closest(PRICE_CONTAINER_SELECTOR) || priceElement;

  let candidate = priceContainer;
  for (let depth = 0; depth < PER_SQUARE_METER_SEARCH_DEPTH; depth++) {
    if (PER_SQUARE_METER_TEXT_PATTERN.test(candidate.textContent)) {
      return candidate;
    }
    if (!candidate.parentElement) {
      break;
    }
    candidate = candidate.parentElement;
  }

  return priceContainer;
}

function escapeHorizontalRow(element) {
  let current = element;
  while (current.parentElement && isHorizontalFlexRow(current.parentElement)) {
    current = current.parentElement;
  }
  return current;
}

function isHorizontalFlexRow(element) {
  const style = getComputedStyle(element);
  if (style.display !== 'flex' && style.display !== 'inline-flex') {
    return false;
  }
  return style.flexDirection === 'row' || style.flexDirection === 'row-reverse';
}

function buildUsdLine(usdText) {
  // span, а не div: строка цены в карточках объявлений живёт внутри <p>.
  const usdLine = document.createElement('span');
  usdLine.className = USD_LINE_CLASS;
  usdLine.textContent = usdText;
  return usdLine;
}

function isUnconvertedPriceElement(element) {
  if (element.children.length > 0) {
    return false;
  }
  if (element.dataset[PROCESSED_MARKER]) {
    return false;
  }

  return BYN_PRICE_PATTERN.test(element.textContent.trim());
}

function formatUsdPrice(priceText, rate) {
  const digits = String(priceText).replace(/[^\d]/g, '');
  if (!digits) {
    return null;
  }

  const priceInBelarusianRubles = parseInt(digits, 10);
  if (!Number.isFinite(priceInBelarusianRubles) || priceInBelarusianRubles <= 0) {
    return null;
  }

  const priceInDollars = Math.round(priceInBelarusianRubles / rate);
  return `≈ $${priceInDollars.toLocaleString('ru-RU')}`;
}

function injectStyles() {
  const style = document.createElement('style');
  style.textContent = `
    .${USD_LINE_CLASS} {
      display: block !important;
      margin-top: 2px !important;
      font-size: 14px !important;
      color: #999 !important;
      font-weight: normal !important;
      line-height: 1.2 !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      pointer-events: none;
      user-select: none;
    }

    [class*="adview_desktop_price"] + .${USD_LINE_CLASS},
    [class*="adview_mobile_price"] + .${USD_LINE_CLASS} {
      margin-top: 4px !important;
      margin-bottom: 4px !important;
    }

    /* Карточки на карте (балуны Яндекс.Карт) — компактнее, без хеш-классов. */
    [class*="map"] .${USD_LINE_CLASS},
    [class*="balloon"] .${USD_LINE_CLASS},
    [class*="rate-line"] .${USD_LINE_CLASS} {
      font-size: 13px !important;
      margin-top: 1px !important;
    }
  `;
  document.head.appendChild(style);
}

// --- Наблюдение за страницей --------------------------------------------

function observePriceChanges() {
  if (priceObserver) {
    priceObserver.disconnect();
  }

  priceObserver = new MutationObserver((mutations) => {
    if (mutations.some(isPriceRelatedMutation)) {
      scheduleConversion();
    }
  });

  priceObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'style']
  });
}

function isPriceRelatedMutation(mutation) {
  if (isOwnNode(mutation.target)) {
    return false;
  }

  for (const addedNode of mutation.addedNodes) {
    if (addedNode.nodeType !== Node.ELEMENT_NODE || isOwnNode(addedNode)) {
      continue;
    }
    if (BYN_PRICE_HINT_PATTERN.test(addedNode.textContent || '')) {
      return true;
    }
    if (looksLikePriceElement(addedNode)) {
      return true;
    }
  }

  return mutation.type === 'attributes' && looksLikePriceElement(mutation.target);
}

function looksLikePriceElement(element) {
  const className = readClassName(element);
  return className.includes('price') || className.includes('rate-line');
}

// className у SVG-элементов — это SVGAnimatedString, а не строка.
function readClassName(element) {
  if (typeof element.className === 'string') {
    return element.className;
  }

  return element.getAttribute ? element.getAttribute('class') || '' : '';
}

function isOwnNode(node) {
  return node.nodeType === Node.ELEMENT_NODE && node.classList.contains(USD_LINE_CLASS);
}

function scheduleConversion() {
  if (pendingProcessTimer) {
    clearTimeout(pendingProcessTimer);
  }

  pendingProcessTimer = setTimeout(() => {
    pendingProcessTimer = null;
    convertAllPrices(currentRate);
  }, DOM_SETTLE_DELAY_MILLISECONDS);
}

// --- Курс ----------------------------------------------------------------

async function resolveRate() {
  const cachedRate = await readCachedRate();
  if (cachedRate) {
    return cachedRate;
  }

  const backgroundRate = await requestRateFromBackground();
  if (backgroundRate) {
    return backgroundRate;
  }

  const directRate = await fetchRateDirectly();
  if (directRate) {
    return directRate;
  }

  console.warn('Kufar Currency Converter: используем резервный курс', FALLBACK_RATE);
  return FALLBACK_RATE;
}

async function readCachedRate() {
  try {
    const stored = await chrome.storage.local.get(['usdRate', 'lastUpdate']);
    if (!stored.usdRate || !stored.lastUpdate) {
      return null;
    }

    const ageInHours = (Date.now() - new Date(stored.lastUpdate).getTime()) / (1000 * 60 * 60);
    if (ageInHours >= RATE_MAX_AGE_HOURS) {
      return null;
    }

    return stored.usdRate;
  } catch (error) {
    console.error('Kufar Currency Converter: не удалось прочитать курс из storage', error);
    return null;
  }
}

// Запрос через service worker: у него есть host_permissions, поэтому CORS
// страницы kufar.by не мешает.
async function requestRateFromBackground() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getRate' });
    return response && response.rate ? response.rate : null;
  } catch (error) {
    console.error('Kufar Currency Converter: service worker не ответил', error);
    return null;
  }
}

async function fetchRateDirectly() {
  try {
    const response = await fetch(NATIONAL_BANK_USD_RATE_URL);
    if (!response.ok) {
      throw new Error(`api.nbrb.by ответил ${response.status}`);
    }

    const data = await response.json();
    const rate = data.Cur_OfficialRate;
    if (!rate) {
      return null;
    }

    await chrome.storage.local.set({ usdRate: rate, lastUpdate: new Date().toISOString() });
    return rate;
  } catch (error) {
    console.error('Kufar Currency Converter: не удалось получить курс с api.nbrb.by', error);
    return null;
  }
}

// --- Запуск --------------------------------------------------------------

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

window.addEventListener('load', scheduleConversion);
window.addEventListener('popstate', scheduleConversion);
