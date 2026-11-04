// Прогон интерфейса в браузере + кадры для портфолио: node tests/ui.cjs [адрес]
const assert = require('assert');
const path = require('path');
const { createRequire } = require('module');
const { chromium } = createRequire('E:/Портфолио/omega-hakaton/e2e/')('@playwright/test');

const BASE = process.argv[2] || 'http://127.0.0.1:5600/ai-assistants-demo/';
// на чужом адресе (например, GitHub Pages) только проверяем, картинки в docs/ не трогаем
const OUT = process.argv[2] ? require('os').tmpdir() : path.join(__dirname, '..', 'docs');
// Вопрос → ожидаемый источник ответа (null — ассистент должен предложить менеджера)
const DIALOGS = {
    dental: [['Почём у вас почистить зубы?', 'Профессиональная чистка'], ['А пломбу ставить больно?', 'Лечение кариеса и пломбы'], ['Удаляете зубы мудрости?', null]],
    shop: [['Через сколько дней доставите в Казань?', 'Доставка'], ['Не знаю, M или L брать', 'Подбор размера'], ['Вы шьёте на заказ по меркам?', null]],
    auto: [['Загорелся check engine', 'Диагностика'], ['Скрипят колодки при торможении', 'Тормоза'], ['Делаете кузовной ремонт?', null]],
    hr: [['Хочу в отпуск в июле, что сделать?', 'Отпуск'], ['Не работает ноутбук', 'Техника и доступы'], ['Где взять пропуск в офис?', null]],
};

(async () => {
    const browser = await chromium.launch({ channel: 'msedge' });
    const errors = [];
    for (const [name, dialog] of Object.entries(DIALOGS)) {
        const page = await browser.newPage({ viewport: { width: 1180, height: 900 }, deviceScaleFactor: 1.5 });
        page.on('pageerror', (e) => errors.push(e.message));
        await page.goto(`${BASE}#${name}`, { waitUntil: 'networkidle' });
        await page.evaluate(() => document.fonts.ready);
        for (const [question, source] of dialog) {
            const before = await page.locator('.msg--bot').count();
            await page.fill('#input', question);
            await page.press('#input', 'Enter');
            await page.waitForFunction((n) => document.querySelectorAll('.msg--bot:not(.typing)').length > n, before);
            const last = page.locator('.msg--bot').last();
            if (source) {
                assert.equal(await last.locator('.msg__src b').textContent(), source, `${name}: ${question}`);
                assert.equal(await page.locator('#kbList li.is-hit').textContent(), source);
            } else {
                assert.match(await last.textContent(), /Не нашёл точного ответа/, `${name}: ${question}`);
                assert.ok(await page.locator('.chip', { hasText: 'Передать менеджеру' }).isVisible());
            }
        }
        await page.waitForTimeout(400); // дождаться анимации появления
        await page.locator('.layout').screenshot({ path: path.join(OUT, `${name}.png`) });
        await page.close();
    }
    // телефон: без горизонтального скролла, кнопка менеджера работает
    const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    await phone.goto(`${BASE}#shop`, { waitUntil: 'networkidle' });
    assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0, 'горизонтальный скролл');
    await phone.click('.chip >> nth=0');
    await phone.waitForSelector('.msg__src');
    await phone.click('text=Не то? Позвать менеджера');
    await phone.waitForSelector('text=Передал вопрос менеджеру');
    await phone.waitForTimeout(400);
    await phone.locator('.chat').screenshot({ path: path.join(OUT, 'phone.png') });
    await browser.close();
    assert.deepEqual(errors, []);
    console.log('ok: интерфейс и диалоги всех 4 ассистентов');
})().catch((e) => { console.error(e); process.exit(1); });
