import './forma-shell.css';

const app = document.querySelector('#app');
const main = app?.querySelector('main');
if (app && main) {
  const initialHome = main.innerHTML;
  const state = { tab: 'home', meals: JSON.parse(localStorage.getItem('forma-meals') || '[]'), weight: localStorage.getItem('forma-weight') || '', chat: [] };
  const targets = { kcal: 1850, protein: 120, fat: 65, carbs: 205 };
  const fmt = n => Math.round(n).toLocaleString('ru-RU');
  const totals = () => state.meals.reduce((a,m) => ({kcal:a.kcal+m.kcal,p:a.p+m.p,f:a.f+m.f,c:a.c+m.c}),{kcal:0,p:0,f:0,c:0});
  const esc = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const nav = [...app.querySelectorAll('.nav-item')];
  const mealsHTML = () => state.meals.length ? state.meals.map((m,i)=>`<article class="forma-food-row"><div class="forma-food-icon">✳</div><div class="forma-food-main"><b>${esc(m.name)}</b><span>${esc(m.type)} · ${m.grams} г · ${fmt(m.kcal)} ккал</span><small>Б ${m.p} г · Ж ${m.f} г · У ${m.c} г</small></div><button class="forma-remove" data-remove="${i}" aria-label="Удалить">×</button></article>`).join('') : '<div class="forma-empty"><span>＋</span><b>Дневник пока пуст</b><p>Добавь первый продукт или блюдо — показатели обновятся автоматически.</p></div>';
  function home() {
    const t=totals(), left=Math.max(0,targets.kcal-t.kcal), pct=Math.min(100,t.kcal/targets.kcal*100);
    return `<section class="forma-greeting"><div><p class="eyebrow">ЧЕТВЕРГ · ТВОЙ РИТМ</p><h1>День начинается<br>с заботы о себе.</h1><p class="muted">Не идеальный план. Подходящий именно тебе.</p></div><span class="forma-date">26 НОЯБРЯ</span></section>
    <section class="forma-home-grid"><article class="forma-card forma-energy"><div class="forma-card-head"><div><p class="eyebrow">ТВОЙ БАЛАНС</p><h2>Питание сегодня</h2></div><span class="forma-tag">Цель на день</span></div><div class="forma-energy-line"><div class="forma-donut" style="--pct:${pct}%"><div><b>${fmt(left)}</b><span>ккал осталось</span></div></div><div class="forma-energy-numbers"><span>Уже съедено</span><b>${fmt(t.kcal)} <small>/ ${fmt(targets.kcal)} ккал</small></b><span>Дневная цель</span><b>${fmt(targets.kcal)} ккал</b></div></div><div class="forma-macros">${[['Белки','p',targets.protein,'#7c9273'],['Жиры','f',targets.fat,'#c7a783'],['Углеводы','c',targets.carbs,'#9ba9b4']].map(([n,k,g,col])=>`<div><div><span>${n}</span><b>${fmt(t[k])} / ${g} г</b></div><i><em style="width:${Math.min(100,t[k]/g*100)}%;background:${col}"></em></i></div>`).join('')}</div><button class="forma-primary" data-action="diary">Добавить еду <span>＋</span></button></article>
    <article class="forma-card forma-insight"><p class="eyebrow">ПОДСКАЗКА FORMA</p><div class="forma-spark">✳</div><h2>Твой день — не гонка.</h2><p>Записывай питание в своём темпе. Мы поможем увидеть общую картину, а не зацикливаться на одной цифре.</p><button class="forma-link" data-action="chat">Обсудить с помощником ↗</button></article></section>
    <section class="forma-section-head"><div><p class="eyebrow">ТВОЙ ДЕНЬ</p><h2>Приёмы пищи</h2></div><button class="forma-link" data-action="diary">Весь дневник ↗</button></section><section class="forma-meals-preview">${mealsHTML()}</section>
    <section class="forma-next"><div><span class="forma-next-icon">↗</span><div><b>Следующий шаг</b><p>Добавь то, что уже ел(а), чтобы видеть актуальный баланс.</p></div></div><button data-action="diary">Записать</button></section>`;
  }
  function diary() {
    const t=totals();
    return `<section class="forma-page-intro"><p class="eyebrow">ТВОЁ ПИТАНИЕ</p><h1>Дневник</h1><p class="muted">Подробно, но без лишней сложности.</p></section>
    <section class="forma-card forma-diary-summary"><div><span>Съедено сегодня</span><b>${fmt(t.kcal)} <small>/ ${targets.kcal} ккал</small></b></div><div class="forma-summary-macros"><span>Б <b>${fmt(t.p)} г</b></span><span>Ж <b>${fmt(t.f)} г</b></span><span>У <b>${fmt(t.c)} г</b></span></div></section>
    <div class="forma-section-head"><div><p class="eyebrow">ЗАПИСИ</p><h2>Сегодня</h2></div><span class="forma-tag">${state.meals.length} записей</span></div>
    <section class="forma-card forma-food-list">${mealsHTML()}</section>
    <div class="forma-add-methods"><button data-action="add-product"><span>＋</span><b>Добавить продукт</b><small>Найти и указать граммовку</small></button><button data-action="add-product"><span>▧</span><b>Добавить блюдо</b><small>Состав и ингредиенты</small></button><button data-action="photo"><span>◎</span><b>По фото</b><small>Распознавание — позже</small></button><button data-action="barcode"><span>▥</span><b>По штрихкоду</b><small>Сканирование — позже</small></button></div>`;
  }
  function plan() {
    return `<section class="forma-page-intro"><p class="eyebrow">ТВОЯ СИСТЕМА ПИТАНИЯ</p><h1>План</h1><p class="muted">Планируй неделю или собирай меню по настроению.</p></section><section class="forma-card"><div class="forma-card-head"><div><p class="eyebrow">НЕДЕЛЯ</p><h2>Твоё меню</h2></div><span class="forma-tag">Планирование</span></div><div class="forma-week">${['ПН','ВТ','СР','ЧТ','ПТ','СБ','ВС'].map((d,i)=>`<div class="${i===3?'selected':''}"><small>${d}</small><b>${23+i}</b></div>`).join('')}</div><div class="forma-empty"><span>✳</span><b>Здесь будет твоё меню</b><p>Составляй его самостоятельно или попроси FORMA предложить варианты.</p><button class="forma-primary" data-action="chat">Подобрать меню</button></div></section><section class="forma-card forma-plan-tools"><button data-action="recipes">Книга рецептов <span>↗</span></button><button data-action="shopping">Список покупок <span>↗</span></button><button data-action="constructor">Конструктор меню <span>↗</span></button></section>`;
  }
  function progress() {
    return `<section class="forma-page-intro"><p class="eyebrow">ИЗМЕНЕНИЯ ВО ВРЕМЕНИ</p><h1>Прогресс</h1><p class="muted">Смотрим на тенденции, а не на отдельные цифры.</p></section><section class="forma-card forma-weight-card"><p class="eyebrow">ТЕКУЩИЙ ВЕС</p><div class="forma-weight-value">${state.weight?esc(state.weight)+' <small>кг</small>':'— <small>кг</small>'}</div><p class="muted">Последнее записанное значение</p><form id="forma-weight-form"><label for="forma-weight">Добавить измерение</label><div><input id="forma-weight" type="number" min="20" max="400" step="0.1" placeholder="Например, 72.5" required><button class="forma-primary">Сохранить</button></div></form></section><section class="forma-card forma-empty"><span>↗</span><b>Твоя динамика появится здесь</b><p>Добавляй измерения регулярно, в комфортном для себя ритме.</p></section><section class="forma-card forma-plan-tools"><button data-action="measurements">Замеры тела <span>↗</span></button><button data-action="report">Отчёт за неделю <span>↗</span></button></section>`;
  }
  function profile() {
    return `<section class="forma-page-intro"><p class="eyebrow">ТВОИ НАСТРОЙКИ</p><h1>Профиль</h1><p class="muted">FORMA подстраивается под твою жизнь.</p></section><section class="forma-card forma-profile-head"><div class="forma-profile-avatar">F</div><div><b>Мой профиль</b><span>Персональные настройки</span></div></section><section class="forma-card forma-settings">${[['Личные данные','Возраст, рост, вес'],['Моя цель','Снижение веса, набор или поддержание'],['Активность','Движение и тренировки'],['Предпочтения в питании','Любимые продукты и исключения'],['Аллергии и ограничения','Что важно учитывать'],['Мои нормы','Калории и КБЖУ'],['Уведомления','Напоминания и отчёты'],['Подписка FORMA','Тариф и возможности']].map(([a,b])=>`<button data-action="setting"><span><b>${a}</b><small>${b}</small></span><i>›</i></button>`).join('')}</section>`;
  }
  function chat() {
    return `<section class="forma-page-intro"><p class="eyebrow">ТВОЙ ПЕРСОНАЛЬНЫЙ ПОМОЩНИК</p><h1>Давай разберёмся.</h1><p class="muted">Можно спросить о питании, меню или своих показателях.</p></section><section class="forma-chat-window"><div class="forma-chat-message assistant"><small>FORMA</small>Привет! Я помогу разобраться с питанием и планированием. С чего начнём?</div>${state.chat.map(m=>`<div class="forma-chat-message user">${esc(m)}</div><div class="forma-chat-message assistant"><small>FORMA</small>Я пока работаю в демонстрационном режиме. В полноценной версии смогу анализировать твои записи и предлагать решения с учётом контекста.</div>`).join('')}</section><form id="forma-chat-form" class="forma-chat-form"><input name="message" placeholder="Напиши свой вопрос..." required><button aria-label="Отправить">↑</button></form><p class="forma-footnote">Ответы помощника в этой версии демонстрационные.</p>`;
  }
  function render(tab) {
    state.tab=tab; nav.forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
    main.innerHTML=tab==='home'?home():tab==='diary'?diary():tab==='menu'?plan():tab==='body'?progress():tab==='profile'?profile():chat();
    bindPage();
  }
  function toast(message) { let el=app.querySelector('.toast'); if(!el){el=document.createElement('div');el.className='toast';app.append(el);} el.textContent=message;el.classList.add('visible');setTimeout(()=>el.classList.remove('visible'),2200); }
  function bindPage() {
    main.querySelectorAll('[data-action],[data-go]').forEach(b=>b.addEventListener('click',()=>action(b.dataset.action||b.dataset.go)));
    main.querySelectorAll('[data-remove]').forEach(b=>b.addEventListener('click',()=>{state.meals.splice(Number(b.dataset.remove),1);localStorage.setItem('forma-meals',JSON.stringify(state.meals));render(state.tab);}));
    const wf=main.querySelector('#forma-weight-form'); if(wf) wf.addEventListener('submit',e=>{e.preventDefault();state.weight=main.querySelector('#forma-weight').value;localStorage.setItem('forma-weight',state.weight);render('body');toast('Измерение сохранено');});
    const cf=main.querySelector('#forma-chat-form'); if(cf) cf.addEventListener('submit',e=>{e.preventDefault();const v=new FormData(cf).get('message').trim();if(v){state.chat.push(v);render('chat');}});
    const pf=main.querySelector('#forma-product-form'); if(pf) pf.addEventListener('submit',e=>{e.preventDefault();const d=new FormData(pf);const grams=Number(d.get('grams'));const factor=grams/100;state.meals.push({name:d.get('name'),type:d.get('type'),grams,kcal:Number(d.get('kcal'))*factor,p:Number(d.get('p'))*factor,f:Number(d.get('f'))*factor,c:Number(d.get('c'))*factor});localStorage.setItem('forma-meals',JSON.stringify(state.meals));render('diary');toast('Продукт добавлен в дневник');});
  }
  function action(a) {
    if(a==='diary'){render('diary');return;}
    if(a==='chat'){render('chat');return;}
    if(a==='add-product'){productForm();return;}
    if(a==='photo'||a==='barcode'){toast('Эта функция запланирована для следующего этапа');return;}
    toast('Этот экран добавим следующим этапом');
  }
  function productForm() {
    main.innerHTML=`<section class="forma-page-intro"><button class="forma-back" id="forma-back">← Дневник</button><p class="eyebrow">ПОДРОБНАЯ ЗАПИСЬ</p><h1>Добавить продукт</h1><p class="muted">Укажи значения на 100 г — FORMA рассчитает твою порцию.</p></section><form id="forma-product-form" class="forma-card forma-product-form"><label>Название продукта<input name="name" placeholder="Например, куриное филе" required></label><label>Приём пищи<select name="type"><option>Завтрак</option><option>Обед</option><option>Перекус</option><option>Ужин</option></select></label><label>Вес порции, г<input name="grams" type="number" min="1" max="5000" value="150" required></label><div class="forma-form-divider">Пищевая ценность на 100 г</div><div class="forma-nutrient-grid"><label>Калории, ккал<input name="kcal" type="number" min="0" step="0.1" placeholder="165" required></label><label>Белки, г<input name="p" type="number" min="0" step="0.1" placeholder="31" required></label><label>Жиры, г<input name="f" type="number" min="0" step="0.1" placeholder="3.6" required></label><label>Углеводы, г<input name="c" type="number" min="0" step="0.1" placeholder="0" required></label></div><label>Состояние продукта<select name="state"><option>Сырой вес</option><option>Готовый вес</option><option>Указано на упаковке</option></select></label><button class="forma-primary">Добавить в дневник <span>→</span></button><p class="forma-footnote">Пищевая ценность будет рассчитана пропорционально указанному весу.</p></form>`;
    main.querySelector('#forma-back').onclick=()=>render('diary');bindPage();
  }
  document.addEventListener('click',e=>{const b=e.target.closest('.nav-item');if(b){e.preventDefault();e.stopImmediatePropagation();render(b.dataset.tab);}},true);
  render('home');
}
