// Интерфейс демо: вкладки компаний, чат и база знаний сбоку
const KBS = ['dental', 'shop', 'auto', 'hr'];
const $ = (id) => document.getElementById(id);
const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
let bot;
let kb;

async function load(name) {
    kb = await fetch(`kb/${name}.json`).then((r) => r.json());
    bot = new Assistant(kb);
    document.documentElement.style.setProperty('--c', kb.color);
    document.querySelectorAll('.tabs button').forEach((b) => b.setAttribute('aria-selected', b.dataset.kb === name));
    $('ava').textContent = (kb.name.match(/«(.)/) || kb.name)[1];
    $('botName').textContent = kb.name;
    $('botRole').textContent = kb.role;
    $('kbInfo').textContent = `${kb.items.length} статей. Ассистент отвечает только тем, что в них написано.`;
    $('kbList').innerHTML = kb.items.map((it) => `<li data-id="${it.id}">${esc(it.title)}</li>`).join('');
    $('log').innerHTML = '';
    say('bot', kb.greeting);
    chips(kb.suggestions);
    history.replaceState(null, '', `#${name}`);
}

function say(who, html, source) {
    const p = document.createElement('p');
    p.className = `msg msg--${who}`;
    p.innerHTML = html + (source ? `<span class="msg__src">Источник: <b>${esc(source)}</b></span>` : '');
    $('log').append(p);
    $('log').scrollTop = $('log').scrollHeight;
}

function chips(list, ghost = []) {
    $('chips').innerHTML = [...list.map((t) => `<button class="chip" type="button">${esc(t)}</button>`),
        ...ghost.map((t) => `<button class="chip chip--ghost" type="button">${esc(t)}</button>`)].join('');
    $('log').scrollTop = $('log').scrollHeight; // подсказки сжали ленту — последний ответ должен остаться виден
}

async function ask(question) {
    if (!question.trim()) return;
    say('me', esc(question));
    chips([]);
    if (question === 'Позвать менеджера' || question === 'Передать менеджеру') {
        say('bot', 'Готово! Передал вопрос менеджеру — ответ придёт сюда в течение 15 минут. <i>(В демо никуда не отправляется.)</i>');
        return;
    }
    const typing = document.createElement('p');
    typing.className = 'msg msg--bot typing';
    typing.innerHTML = '<i></i><i></i><i></i>';
    $('log').append(typing);
    await new Promise((r) => setTimeout(r, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 450));
    typing.remove();

    const r = bot.answer(question);
    document.querySelectorAll('#kbList li').forEach((li) => li.classList.toggle('is-hit', li.dataset.id === r.id));
    if (r.type === 'answer') {
        say('bot', esc(r.text), r.title);
        chips(r.related ? [r.related] : [], ['Не то? Позвать менеджера']);
    } else if (r.type === 'fallback') {
        say('bot', r.text);
        chips(['Передать менеджеру'], ['Спросить иначе']);
    } else {
        say('bot', esc(r.text));
        chips(kb.suggestions);
    }
}

$('tabs').innerHTML = KBS.map((k) => `<button type="button" role="tab" data-kb="${k}">…</button>`).join('');
// названия вкладок — из самих баз
Promise.all(KBS.map((k) => fetch(`kb/${k}.json`).then((r) => r.json()))).then((all) =>
    all.forEach((k, i) => { $('tabs').children[i].textContent = k.name; }));
$('tabs').addEventListener('click', (e) => e.target.dataset.kb && load(e.target.dataset.kb));
$('chips').addEventListener('click', (e) => {
    if (!e.target.classList.contains('chip')) return;
    const t = e.target.textContent;
    if (t === 'Спросить иначе') return $('input').focus();
    ask(t === 'Не то? Позвать менеджера' ? 'Позвать менеджера' : t);
});
$('form').addEventListener('submit', (e) => {
    e.preventDefault();
    ask($('input').value);
    $('input').value = '';
});
load(KBS.includes(location.hash.slice(1)) ? location.hash.slice(1) : KBS[0]);
