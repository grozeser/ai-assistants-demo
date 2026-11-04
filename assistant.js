// Ассистент по базе знаний без нейросети: ищет статью по смыслу слов (TF-IDF по основам слов)
// и отвечает её текстом. Если уверенного совпадения нет — не выдумывает, а предлагает менеджера.
// Работает и в браузере (window.Assistant), и в Node (require) — для тестов.
(function (root) {
    const STOP = new Set(('а в во да для до же за и из или ли мне меня мы на не но ну о об от по при про с со то у уже что это ' +
        'я вы вас вам ваш ваша ваши вашей быть есть будет бы как так тоже еще ещё очень там тут здравствуйте добрый день ' +
        'подскажите скажите пожалуйста а хочу хотел хотела можно нужно надо ли').split(' '));
    // Окончания для грубого стемминга: «доставка», «доставки», «доставкой» → «достав»
    const ENDINGS = ['иями', 'ями', 'ами', 'ого', 'его', 'ому', 'ему', 'ыми', 'ими', 'ешь', 'ишь', 'ете', 'ите', 'ой', 'ей',
        'ий', 'ый', 'ая', 'яя', 'ое', 'ее', 'ую', 'юю', 'ом', 'ем', 'ам', 'ям', 'ах', 'ях', 'ов', 'ев', 'ть', 'ти', 'ет',
        'ит', 'ут', 'ют', 'ат', 'ят', 'ся', 'сь', 'а', 'я', 'о', 'е', 'ы', 'и', 'у', 'ю', 'ь', 'й'];
    const SMALL_TALK = [
        [/^(привет|здравствуй|добр(ый|ое|ого)|хай|hello)/, 'greeting'],
        [/(спасибо|благодарю|спс)/, 'thanks'],
        [/(менеджер|оператор|живой человек|позовите|соедините)/, 'manager'],
    ];
    // Общие для любого бизнеса синонимы: слово клиента → слово, которым пишут в базе знаний
    const GLOBAL_SYNONYMS = {
        'цена': ['почем', 'почём', 'стоит', 'стоимость', 'стоят', 'прайс', 'расценки'],
        'часы работы': ['открыты', 'открываетесь', 'закрываетесь', 'работаете', 'суббота', 'субботу', 'воскресенье', 'выходные'],
        'запись': ['запишите', 'записаться', 'записать', 'записали', 'окно', 'окошко'],
        'сломался': ['не работает', 'не включается', 'сломалась', 'сломалось', 'поломка'],
    };
    const THRESHOLD = 0.15; // ниже — считаем, что ответа в базе нет

    function stem(word) {
        let w = word;
        for (let pass = 0; pass < 2; pass++) {
            const end = ENDINGS.find((e) => w.endsWith(e) && w.length - e.length >= 3);
            if (!end) break;
            w = w.slice(0, -end.length);
        }
        return w.slice(0, 5);
    }

    const norm = (text) => text.toLowerCase().replace(/ё/g, 'е');

    function terms(text, synonyms = []) {
        let t = ` ${norm(text).replace(/[^a-zа-я0-9]+/g, ' ')} `;
        for (const [from, to] of synonyms) t = t.replaceAll(from, ` ${to} `); // до стоп-слов: «то» в автосервисе — это ТО
        return t.match(/[a-zа-я0-9]+/g)?.filter((w) => !STOP.has(w) && w.length > 1).map(stem) || [];
    }

    function synonymPairs(dict) {
        // ' запишите ' → ' запись ': заменяем целые слова и фразы, длинные раньше коротких
        return Object.entries(dict)
            .flatMap(([canon, words]) => words.map((w) => [` ${norm(w)} `, norm(canon)]))
            .sort((a, b) => b[0].length - a[0].length);
    }

    function vector(weightedTexts, idf, synonyms) {
        const v = new Map();
        for (const [text, weight] of weightedTexts) {
            for (const t of terms(text, synonyms)) v.set(t, (v.get(t) || 0) + weight);
        }
        let norm = 0;
        for (const [t, tf] of v) {
            const x = tf * (idf.get(t) ?? 0);
            v.set(t, x);
            norm += x * x;
        }
        norm = Math.sqrt(norm) || 1;
        for (const [t, x] of v) v.set(t, x / norm);
        return v;
    }

    class Assistant {
        constructor(kb) {
            this.kb = kb;
            this.synonyms = synonymPairs({ ...GLOBAL_SYNONYMS, ...kb.synonyms });
            // документ статьи: заголовок и формулировки вопросов важнее текста ответа
            const docs = kb.items.map((it) => [[it.title, 2], ...it.q.map((q) => [q, 1]), [it.a, 0.4]]);
            const df = new Map();
            for (const doc of docs) {
                for (const t of new Set(doc.flatMap(([text]) => terms(text, this.synonyms)))) df.set(t, (df.get(t) || 0) + 1);
            }
            this.idf = new Map([...df].map(([t, n]) => [t, Math.log(1 + kb.items.length / n)]));
            this.vectors = docs.map((d) => vector(d, this.idf, this.synonyms));
        }

        search(question) {
            const q = vector([[question, 1]], this.idf, this.synonyms);
            // слова, которых нет в базе («обувь», «бампер»), снижают уверенность: про них база ничего не знает
            const words = terms(question, this.synonyms);
            const coverage = words.length ? words.filter((t) => this.idf.has(t)).length / words.length : 0;
            return this.kb.items
                .map((item, i) => {
                    let score = 0;
                    for (const [t, x] of q) score += x * (this.vectors[i].get(t) || 0);
                    return { item, score: score * Math.sqrt(coverage) };
                })
                .sort((a, b) => b.score - a.score);
        }

        answer(question) {
            const text = question.toLowerCase().trim();
            const [best, second] = this.search(question);
            const talk = SMALL_TALK.find(([re]) => re.test(text));
            if (talk && (!best || best.score < THRESHOLD)) {
                const replies = { greeting: this.kb.greeting, thanks: 'Пожалуйста! Если появятся вопросы — пишите.', manager: null };
                if (talk[1] === 'manager') return { type: 'fallback', text: 'Передать ваш вопрос менеджеру?', score: 0 };
                return { type: 'smalltalk', text: replies[talk[1]], score: 1 };
            }
            if (!best || best.score < THRESHOLD) {
                return { type: 'fallback', text: 'Не нашёл точного ответа в базе знаний. Передать вопрос менеджеру?', score: best?.score || 0 };
            }
            // вторую статью предлагаем, если она тоже близка к вопросу
            const related = second && second.score >= THRESHOLD && second.score > best.score * 0.6 ? second.item.title : null;
            return { type: 'answer', id: best.item.id, title: best.item.title, text: best.item.a, score: best.score, related };
        }
    }

    Assistant.terms = terms;
    if (typeof module !== 'undefined') module.exports = Assistant;
    else root.Assistant = Assistant;
})(typeof window !== 'undefined' ? window : globalThis);
