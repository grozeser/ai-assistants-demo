// Карточки для портфолио из скриншотов tests/ui.cjs: node render/render.cjs → docs/card-<имя>.png
const path = require('path');
const { pathToFileURL } = require('url');
const { createRequire } = require('module');
const { chromium } = createRequire('E:/Портфолио/omega-hakaton/e2e/')('@playwright/test');

const docs = path.join(__dirname, '..', 'docs');
const img = (p) => pathToFileURL(p).href;
const COMMON = ['Отвечает текстом из вашей базы', 'Показывает источник ответа', 'Нет ответа — зовёт менеджера, не выдумывает'];
const CARDS = {
    dental: { accent: '#0ea5e9', tag: 'ИИ-ассистент · сайт', title: 'Ассистент <em>клиники</em> 24/7', sub: 'Стоматология «Жемчуг»: цены, запись, лечение и гарантии',
        features: ['Понимает вопрос своими словами', ...COMMON] },
    shop: { accent: '#0f766e', tag: 'ИИ-ассистент · магазин', title: 'Консультант <em>магазина</em>', sub: 'Доставка, размеры, возврат и оплата — без очереди в поддержку',
        features: ['Снимает типовые вопросы с поддержки', ...COMMON] },
    auto: { accent: '#ea580c', tag: 'ИИ-ассистент · сервис', title: 'Мастер-<em>приёмщик</em> в&nbsp;чате', sub: 'Автосервис «Гайка»: цены на ТО и ремонт, сроки, запись',
        features: ['Понимает «загорелся чек»', ...COMMON] },
    hr: { accent: '#7c3aed', tag: 'ИИ-ассистент · для команды', title: 'HR-помощник <em>для&nbsp;команды</em>', sub: 'Отпуск, больничный, ДМС, зарплата и справки — по внутренней базе',
        features: ['Разгружает HR от одних и тех же вопросов', ...COMMON] },
    shturman: { accent: '#14b8a6', tag: 'ИИ-агент · командный проект', title: 'Штурман: <em>поездка</em> из&nbsp;запроса', sub: 'AI-агент для путешествий с хакатона: понимает запрос и собирает план',
        features: ['Выводит скрытые требования', 'Проверяет 62 направления', 'Объясняет, почему не подходит', 'Пересобирает план по реплике'],
        image: img('E:/Портфолио/shturman/portfolio/docs/screenshots/plan.png'), width: 1150 },
};

(async () => {
    const browser = await chromium.launch({ channel: 'msedge' });
    const page = await browser.newPage({ viewport: { width: 1320, height: 880 }, deviceScaleFactor: 1.5 });
    await page.goto(pathToFileURL(path.join(__dirname, 'card.html')).href);
    for (const [name, card] of Object.entries(CARDS)) {
        const m = { image: img(path.join(docs, `${name}.png`)), ...card };
        if (name !== 'shturman') m.badge = '<b>Живое демо</b> — можно задать свой вопрос';
        await page.evaluate((x) => window.renderCard(x), m);
        await page.evaluate(() => document.fonts.ready);
        await page.waitForLoadState('networkidle');
        await page.locator('#card').screenshot({ path: path.join(docs, `card-${name}.png`) });
    }
    await browser.close();
    console.log('ok', Object.keys(CARDS).length);
})().catch((e) => { console.error(e); process.exit(1); });
