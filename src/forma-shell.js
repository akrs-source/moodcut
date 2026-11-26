import './forma-shell.css';

const app = document.querySelector('#app');
const main = app?.querySelector('main');
if (app && main) {
  const initialHome = main.innerHTML;
  const tg = window.Telegram?.WebApp;
  tg?.ready?.();
  tg?.expand?.();
  const initData = tg?.initData || '';
  const api = async (action, payload = {}) => {
    if (!initData) return null;
    const response = await fetch('https://tidrkegmipucdcoqdxvd.supabase.co/functions/v1/forma-api', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData, action, payload })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Ошибка синхронизации');
    return result;
  };
  const mealTypeToDb = value => ({'Завтрак':'breakfast','Обед':'lunch','Перекус':'snack','Ужин':'dinner'}[value] || 'other');
  const mealTypeFromDb = value => ({breakfast:'Завтрак',lunch:'Обед',snack:'Перекус',dinner:'Ужин',other:'Другое'}[value] || 'Другое');
  const state = { tab: 'home', meals: JSON.parse(localStorage.getItem('forma-meals') || '[]').map((m,i)=>({...m,id:m.id||'local-existing-'+i})), weight: localStorage.getItem('forma-weight') || '', chat: [], profile: null, goals: JSON.parse(localStorage.getItem('forma-goals') || 'null'), preferences: JSON.parse(localStorage.getItem('forma-preferences') || 'null'), weights: JSON.parse(localStorage.getItem('forma-weights') || '[]'), plans: JSON.parse(localStorage.getItem('forma-plans') || '[]'), shopping: JSON.parse(localStorage.getItem('forma-shopping') || '[]'), recipes: JSON.parse(localStorage.getItem('forma-recipes') || '[]'), foodSearchResults: [], planDate: '', diaryDate: localDate(new Date()) };
  let targets = { kcal: 1850, protein: 120, fat: 65, carbs: 205 };
  const applyGoals = g => { if(g?.daily_kcal) targets = { kcal:Number(g.daily_kcal), protein:Number(g.protein_g||0), fat:Number(g.fat_g||0), carbs:Number(g.carbs_g||0) }; };
  const calculateTargets = g => {
    const age=Number(g.age), height=Number(g.height_cm), weight=Number(g.current_weight_kg);
    const activity={sedentary:1.2,light:1.375,moderate:1.55,high:1.725,athlete:1.9}[g.activity_level]||1.2;
    const sexAdj=g.sex==='male'?5:g.sex==='female'?-161:-78;
    const bmr=10*weight+6.25*height-5*age+sexAdj;
    const factor={lose:.85,gain:1.1,maintain:1,recomposition:.95,healthier:1}[g.goal_type]||1;
    const kcal=Math.round(Math.max(1200,Math.min(6000,bmr*activity*factor))/50)*50;
    const protein=Math.round(weight*1.6), fat=Math.round(weight*.8), carbs=Math.max(0,Math.round((kcal-protein*4-fat*9)/4));
    return {daily_kcal:kcal,protein_g:protein,fat_g:fat,carbs_g:carbs};
  };
  applyGoals(state.goals);
  const fmt = n => Math.round(n).toLocaleString('ru-RU');
  const entryDate = m => m.eaten_at ? localDate(m.eaten_at) : (m.date || localDate(new Date()));
  const diaryMeals = () => state.meals.filter(m => entryDate(m) === state.diaryDate);
  const todayMeals = () => state.meals.filter(m => entryDate(m) === localDate(new Date()));
  const totals = (items=state.meals) => items.reduce((a,m) => ({kcal:a.kcal+Number(m.kcal||0),p:a.p+Number(m.p||0),f:a.f+Number(m.f||0),c:a.c+Number(m.c||0)}),{kcal:0,p:0,f:0,c:0});
  const esc = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const nav = [...app.querySelectorAll('.nav-item')];
  const navIcons = {
    home: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 10.5 12 3.8l8.5 6.7"/><path d="M5.5 9.5v10h13v-10M9.5 19.5v-6h5v6"/></svg>',
    diary: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5h16v15H4z"/><path d="M8 3.5v4M16 3.5v4M8 11h8M8 15h5"/></svg>',
    menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2.5"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',
    body: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19.5V14M10 19.5V9M16 19.5V4.5M22 19.5H2"/></svg>',
    profile: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M4.5 20c.8-3.5 3.4-5.5 7.5-5.5s6.7 2 7.5 5.5"/></svg>'
  };
  const navLabels = {home:'Сегодня',diary:'Питание',menu:'План',body:'Прогресс',profile:'Профиль'};
  nav.forEach(b=>{const key=b.dataset.tab;if(navIcons[key])b.innerHTML='<span class="nav-icon">'+navIcons[key]+'</span><small>'+navLabels[key]+'</small>';});
  const mealsHTML = () => diaryMeals().length ? diaryMeals().map(m=>`<article class="forma-food-row"><div class="forma-food-icon">✳</div><div class="forma-food-main"><b>${esc(m.name)}</b><span>${esc(m.type)} · ${m.grams} г · ${fmt(m.kcal)} ккал</span><small>Б ${m.p} г · Ж ${m.f} г · У ${m.c} г</small></div><button class="forma-remove" data-remove="${esc(String(m.id || ''))}" aria-label="Удалить">×</button></article>`).join('') : '<div class="forma-empty"><span>＋</span><b>Дневник пока пуст</b><p>Добавь первый продукт или блюдо — показатели обновятся автоматически.</p></div>';
  function home() {
    const t=totals(todayMeals()), left=Math.max(0,targets.kcal-t.kcal), pct=Math.min(100,t.kcal/targets.kcal*100), today=new Date(), day=today.toLocaleDateString('ru-RU',{weekday:'long'}).toUpperCase(), date=today.toLocaleDateString('ru-RU',{day:'numeric',month:'long'}).toUpperCase();
    return `<section class="forma-greeting"><div><p class="eyebrow">${day} · ТВОЙ РИТМ</p><h1>День начинается<br>с заботы о себе.</h1><p class="muted">Не идеальный план. Подходящий именно тебе.</p></div><span class="forma-date">${date}</span></section>
    <section class="forma-home-grid"><article class="forma-card forma-energy"><div class="forma-card-head"><div><p class="eyebrow">ТВОЙ БАЛАНС</p><h2>Питание сегодня</h2></div><span class="forma-tag">ТВОИ ОРИЕНТИРЫ</span></div><div class="forma-energy-line"><div class="forma-donut" style="--pct:${pct}%"><div><b>${fmt(left)}</b><span>ккал осталось</span></div></div><div class="forma-energy-numbers"><span>Уже съедено</span><b>${fmt(t.kcal)} <small>/ ${fmt(targets.kcal)} ккал</small></b><span>Твоя цель на день</span><b>${fmt(targets.kcal)} ккал</b></div></div><div class="forma-macros">${[['Белки','p',targets.protein,'#7c9273'],['Жиры','f',targets.fat,'#c7a783'],['Углеводы','c',targets.carbs,'#9ba9b4']].map(([n,k,g,col])=>`<div><div><span>${n}</span><b>${fmt(t[k])} / ${g} г</b></div><i><em style="width:${Math.min(100,t[k]/g*100)}%;background:${col}"></em></i></div>`).join('')}</div><p class="forma-footnote">Ориентиры рассчитаны по твоим параметрам и могут быть изменены в профиле.</p><button class="forma-primary" data-action="diary">Добавить еду <span>＋</span></button></article>
    <article class="forma-card forma-insight"><p class="eyebrow">ПОДСКАЗКА FORMA</p><div class="forma-spark">✳</div><h2>Твой день — не гонка.</h2><p>Записывай питание в своём темпе. Мы поможем увидеть общую картину, а не зацикливаться на одной цифре.</p><button class="forma-link" data-action="chat">Обсудить с помощником ↗</button></article></section>
    <section class="forma-section-head"><div><p class="eyebrow">ТВОЙ ДЕНЬ</p><h2>Приёмы пищи</h2></div><button class="forma-link" data-action="diary">Весь дневник ↗</button></section><section class="forma-meals-preview">${mealsHTML()}</section>
    <section class="forma-next"><div><span class="forma-next-icon">↗</span><div><b>Следующий шаг</b><p>Добавь то, что уже ел(а), чтобы видеть актуальный баланс.</p></div></div><button data-action="diary">Записать</button></section>`;
  }
  function diary() {
    const dayMeals=diaryMeals(),t=totals(dayMeals),selectedDate=new Date(state.diaryDate+'T12:00:00'),today=localDate(new Date()),dayTitle=state.diaryDate===today?'Сегодня':selectedDate.toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'});
    const shiftDate=delta=>{const d=new Date(state.diaryDate+'T12:00:00');d.setDate(d.getDate()+delta);return localDate(d);};
    return `<section class="forma-page-intro"><p class="eyebrow">ТВОЁ ПИТАНИЕ</p><h1>Дневник</h1><p class="muted">Подробно, но без лишней сложности.</p></section>
    <section class="forma-card forma-diary-date"><button type="button" data-diary-shift="-1" aria-label="Предыдущий день">‹</button><label><span>ВЫБРАННЫЙ ДЕНЬ</span><input id="forma-diary-date" type="date" value="${state.diaryDate}" max="${today}"></label><button type="button" data-diary-shift="1" ${state.diaryDate>=today?'disabled':''} aria-label="Следующий день">›</button></section>
    <section class="forma-card forma-diary-summary"><div><span>Съедено · ${dayTitle}</span><b>${fmt(t.kcal)} <small>/ ${targets.kcal} ккал</small></b></div><div class="forma-summary-macros"><span>Б <b>${fmt(t.p)} г</b></span><span>Ж <b>${fmt(t.f)} г</b></span><span>У <b>${fmt(t.c)} г</b></span></div></section>
    <div class="forma-section-head"><div><p class="eyebrow">ЗАПИСИ</p><h2>${dayTitle}</h2></div><span class="forma-tag">${dayMeals.length} записей</span></div>
    <section class="forma-card forma-food-list">${mealsHTML()}</section>
    <div class="forma-add-methods"><button data-action="add-product"><span>＋</span><b>Добавить продукт</b><small>Найти и указать граммовку</small></button><button data-action="add-product"><span>▧</span><b>Добавить блюдо</b><small>Состав и ингредиенты</small></button><button data-action="photo"><span>◎</span><b>По фото</b><small>Распознавание — позже</small></button><button data-action="barcode"><span>▥</span><b>По штрихкоду</b><small>Сканирование — позже</small></button></div>`;
  }
  function localDate(d) { const x=new Date(d); return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0'); }
  const mealLabel = v => ({breakfast:'Завтрак',lunch:'Обед',snack:'Перекус',dinner:'Ужин'}[v]||'Приём пищи');
  function plan() {
    const today=new Date(), monday=new Date(today); monday.setDate(today.getDate()-((today.getDay()+6)%7));
    const days=Array.from({length:7},(_,i)=>{const d=new Date(monday);d.setDate(monday.getDate()+i);return {date:localDate(d),label:['ПН','ВТ','СР','ЧТ','ПТ','СБ','ВС'][i],day:d.getDate()};});
    if(!days.some(d=>d.date===state.planDate))state.planDate=localDate(today);
    const chosen=state.plans.filter(p=>p.plan_date===state.planDate);
    const selected=days.find(d=>d.date===state.planDate);
    return `<section class="forma-page-intro"><p class="eyebrow">ТВОЯ СИСТЕМА ПИТАНИЯ</p><h1>План</h1><p class="muted">Собирай меню на неделю и меняй его под свои планы.</p></section>
    <section class="forma-card"><div class="forma-card-head"><div><p class="eyebrow">НЕДЕЛЯ</p><h2>Твоё меню</h2></div><span class="forma-tag">Планирование</span></div>
    <div class="forma-week">${days.map(d=>`<button type="button" data-plan-date="${d.date}" class="${d.date===state.planDate?'selected':''}"><small>${d.label}</small><b>${d.day}</b></button>`).join('')}</div>
    <div class="forma-section-head"><div><p class="eyebrow">${selected?.date===localDate(today)?'СЕГОДНЯ':selected?.date}</p><h2>Приёмы пищи</h2></div><button class="forma-link" data-action="add-plan">＋ Добавить</button></div>
    ${chosen.length?chosen.map(p=>`<article class="forma-plan-entry"><div><small>${mealLabel(p.meal_type)}</small><b>${esc(p.title)}</b>${p.description?`<p>${esc(p.description)}</p>`:''}<span>${fmt(p.kcal||0)} ккал · Б ${fmt(p.protein_g||0)} · Ж ${fmt(p.fat_g||0)} · У ${fmt(p.carbs_g||0)}</span></div><button data-plan-remove="${esc(p.id)}" aria-label="Удалить">×</button></article>`).join(''):'<div class="forma-empty"><span>✳</span><b>Пока ничего не запланировано</b><p>Добавь блюдо или приём пищи на этот день.</p><button class="forma-primary" data-action="add-plan">Добавить в план</button></div>'}
    </section><section class="forma-card forma-plan-tools"><button data-action="recipes">Книга рецептов <span>↗</span></button><button data-action="shopping">Список покупок <span>↗</span></button></section>`;
  }
  function recipesPage() {
    main.innerHTML=`<section class="forma-page-intro"><button class="forma-back" id="forma-back">← План</button><p class="eyebrow">ТВОЯ КОЛЛЕКЦИЯ</p><h1>Книга рецептов</h1><p class="muted">Сохраняй любимые блюда и добавляй их в недельный план.</p></section>
    <div class="forma-section-head"><div><p class="eyebrow">СОХРАНЁННОЕ</p><h2>Мои рецепты</h2></div><button class="forma-link" data-action="add-recipe">＋ Добавить</button></div>
    ${state.recipes.length?state.recipes.map(r=>`<article class="forma-card forma-recipe-card"><div><h2>${esc(r.title)}</h2><p>${esc(r.ingredients||'Состав не указан')}</p><small>${fmt(r.kcal||0)} ккал · Б ${fmt(r.protein_g||0)} · Ж ${fmt(r.fat_g||0)} · У ${fmt(r.carbs_g||0)}</small></div><div class="forma-recipe-actions"><button data-recipe-plan="${r.id}">В план <span>↗</span></button><button data-recipe-remove="${r.id}" aria-label="Удалить">×</button></div></article>`).join(''):'<div class="forma-card forma-empty"><span>✳</span><b>Здесь пока нет рецептов</b><p>Добавь блюдо, которое хочешь сохранить и использовать в меню.</p><button class="forma-primary" data-action="add-recipe">Добавить рецепт</button></div>'}
    <p class="forma-footnote">Твои рецепты пока хранятся на этом устройстве.</p>`;
    main.querySelector('#forma-back').onclick=()=>render('menu');bindPage();
  }
  function recipeForm() {
    main.innerHTML=`<section class="forma-page-intro"><button class="forma-back" id="forma-back">← Рецепты</button><p class="eyebrow">ЛИЧНАЯ КОЛЛЕКЦИЯ</p><h1>Новый рецепт</h1><p class="muted">Сохрани ингредиенты и пищевую ценность одной порции.</p></section>
    <form id="forma-recipe-form" class="forma-card forma-product-form"><label>Название блюда<input name="title" maxlength="140" placeholder="Например, сырники с ягодами" required></label><label>Ингредиенты<input name="ingredients" maxlength="500" placeholder="Творог, яйцо, мука, ягоды"></label><label>Как готовить<textarea name="instructions" rows="3" placeholder="Коротко опиши приготовление"></textarea></label><div class="forma-form-divider">Пищевая ценность порции</div><div class="forma-nutrient-grid"><label>Ккал<input name="kcal" type="number" min="0" value="0"></label><label>Белки, г<input name="protein_g" type="number" min="0" step="0.1" value="0"></label><label>Жиры, г<input name="fat_g" type="number" min="0" step="0.1" value="0"></label><label>Углеводы, г<input name="carbs_g" type="number" min="0" step="0.1" value="0"></label></div><button class="forma-primary">Сохранить рецепт <span>→</span></button></form>`;
    main.querySelector('#forma-back').onclick=()=>recipesPage();bindPage();
  }
  function shoppingList() {
    const active=state.shopping.filter(x=>!x.done),done=state.shopping.filter(x=>x.done);
    main.innerHTML=`<section class="forma-page-intro"><button class="forma-back" id="forma-back">← План</button><p class="eyebrow">ПОКУПКИ БЕЗ ХАОСА</p><h1>Список покупок</h1><p class="muted">Собирай всё необходимое в одном месте и отмечай по ходу покупок.</p></section>
    <form id="forma-shopping-form" class="forma-card forma-shopping-form"><input name="item" placeholder="Например, яйца, молоко, овощи..." maxlength="100" required><button class="forma-primary">Добавить <span>＋</span></button></form>
    <section class="forma-card forma-shopping-list"><div class="forma-section-head"><div><p class="eyebrow">НУЖНО КУПИТЬ</p><h2>Список</h2></div><span class="forma-tag">${active.length} осталось</span></div>
    ${active.length?active.map(x=>`<div class="forma-shopping-row"><label><input type="checkbox" data-shopping-toggle="${x.id}"><span>${esc(x.name)}</span></label><button data-shopping-remove="${x.id}" aria-label="Удалить">×</button></div>`).join(''):'<div class="forma-empty"><span>✓</span><b>Пока всё куплено</b><p>Добавь продукты, которые понадобятся.</p></div>'}
    ${done.length?`<div class="forma-shopping-done-head"><span>УЖЕ КУПЛЕНО · ${done.length}</span><button data-action="shopping-clear">Очистить</button></div>${done.map(x=>`<div class="forma-shopping-row is-done"><label><input type="checkbox" checked data-shopping-toggle="${x.id}"><span>${esc(x.name)}</span></label><button data-shopping-remove="${x.id}" aria-label="Удалить">×</button></div>`).join('')}`:''}
    </section><p class="forma-footnote">Список пока хранится на этом устройстве.</p>`;
    main.querySelector('#forma-back').onclick=()=>render('menu');bindPage();
  }
  function progress() {
    const history=[...state.weights].filter(x=>Number.isFinite(Number(x.weight_kg))).sort((a,b)=>String(a.measured_at).localeCompare(String(b.measured_at)));
    const recent=history.slice(-8), vals=recent.map(x=>Number(x.weight_kg));
    const min=vals.length?Math.min(...vals)-1:0, max=vals.length?Math.max(...vals)+1:1;
    const points=vals.map((v,i)=>{const x=12+i*276/Math.max(1,recent.length-1);const y=92-(v-min)/(max-min||1)*70;return `${x},${y}`;}).join(' ');
    const first=history[0],last=history[history.length-1],diff=first&&last?Number(last.weight_kg)-Number(first.weight_kg):0;
    const dateLabel=v=>v?new Date(v+'T12:00:00').toLocaleDateString('ru-RU',{day:'numeric',month:'short'}):'';
    return `<section class="forma-page-intro"><p class="eyebrow">ИЗМЕНЕНИЯ ВО ВРЕМЕНИ</p><h1>Прогресс</h1><p class="muted">Смотрим на тенденции, а не на отдельные цифры.</p></section>
    <section class="forma-card forma-weight-card"><p class="eyebrow">ТЕКУЩИЙ ВЕС</p><div class="forma-weight-value">${state.weight?esc(state.weight)+' <small>кг</small>':'— <small>кг</small>'}</div><p class="muted">Последнее записанное значение</p><form id="forma-weight-form"><label for="forma-weight">Добавить измерение</label><div><input id="forma-weight" type="number" min="20" max="400" step="0.1" placeholder="Например, 72.5" required><button class="forma-primary">Сохранить</button></div></form></section>
    <section class="forma-card forma-progress-chart"><div class="forma-card-head"><div><p class="eyebrow">ДИНАМИКА</p><h2>Изменения веса</h2></div><span class="forma-tag">${history.length} измерений</span></div>
    ${recent.length>1?`<svg viewBox="0 0 300 110" role="img" aria-label="График изменения веса" preserveAspectRatio="none"><line x1="0" y1="92" x2="300" y2="92" stroke="#eee5da"/><line x1="0" y1="57" x2="300" y2="57" stroke="#eee5da"/><line x1="0" y1="22" x2="300" y2="22" stroke="#eee5da"/><polyline points="${points}" fill="none" stroke="#a47b55" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>${recent.map((v,i)=>{const [x,y]=points.split(' ')[i].split(',');return `<circle cx="${x}" cy="${y}" r="3.5" fill="#a47b55"/>`;}).join('')}</svg><div class="forma-chart-labels"><span>${dateLabel(recent[0].measured_at)}</span><span>${dateLabel(recent[recent.length-1].measured_at)}</span></div><p class="forma-chart-change">${diff===0?'Пока без изменений':`Изменение за период: ${diff>0?'+':''}${diff.toFixed(1)} кг`}</p>`:`<div class="forma-chart-empty"><span>↗</span><b>Добавь ещё измерения</b><small>Когда появятся хотя бы две записи, здесь отобразится динамика.</small></div>`}
    </section><section class="forma-card forma-history"><div class="forma-section-head"><div><p class="eyebrow">ИСТОРИЯ</p><h2>Последние измерения</h2></div></div>${history.length?history.slice(-8).reverse().map(x=>`<div class="forma-history-row"><span>${dateLabel(x.measured_at)}</span><b>${Number(x.weight_kg).toFixed(1).replace('.',',')} кг</b></div>`).join(''):'<p class="muted">Пока нет сохранённых измерений.</p>'}</section>`;
  }
  function profile() {
    const g=state.goals||{},p=state.preferences||{};
    return `<section class="forma-page-intro"><p class="eyebrow">ТВОИ НАСТРОЙКИ</p><h1>Профиль</h1><p class="muted">FORMA подстраивается под твою жизнь.</p></section>
    <section class="forma-card forma-profile-head"><div class="forma-profile-avatar">F</div><div><b>${esc(state.profile?.first_name||'Мой профиль')}</b><span>${g.daily_kcal?`Ориентир ${fmt(g.daily_kcal)} ккал в день`:'Заполни данные, чтобы настроить FORMA'}</span></div></section>
    <section class="forma-card forma-settings">
      <button data-action="settings-goals"><span><b>Личные данные и цель</b><small>${g.age?`${g.age} лет · ${g.height_cm} см · ${g.current_weight_kg} кг`:'Добавить возраст, рост и вес'}</small></span><i>›</i></button>
      <button data-action="settings-food"><span><b>Питание и предпочтения</b><small>${p.meals_per_day?`${p.meals_per_day} приёма пищи · ${(p.excluded_foods||[]).length} исключений`:'Вкусы, аллергии, бюджет и время готовки'}</small></span><i>›</i></button>
      <button data-action="settings-goals"><span><b>Мои нормы КБЖУ</b><small>${g.daily_kcal?`${g.daily_kcal} ккал · Б ${g.protein_g} · Ж ${g.fat_g} · У ${g.carbs_g}`:'Рассчитать после заполнения параметров'}</small></span><i>›</i></button>
      <button data-action="setting-subscription"><span><b>Подписка FORMA</b><small>Тарифы и дополнительные возможности</small></span><i>›</i></button>
    </section><p class="forma-footnote">Данные и ориентиры можно изменить в любой момент. Расчёт носит справочный характер.</p>`;
  }
  function chat() {
    return `<section class="forma-page-intro"><p class="eyebrow">ТВОЙ ПЕРСОНАЛЬНЫЙ ПОМОЩНИК</p><h1>Давай разберёмся.</h1><p class="muted">Можно спросить о питании, меню или своих показателях.</p></section><section class="forma-chat-window"><div class="forma-chat-message assistant"><small>FORMA</small>Привет! Я помогу разобраться с питанием и планированием. С чего начнём?</div>${state.chat.map(m=>`<div class="forma-chat-message user">${esc(m)}</div><div class="forma-chat-message assistant"><small>FORMA</small>Я пока работаю в демонстрационном режиме. В полноценной версии смогу анализировать твои записи и предлагать решения с учётом контекста.</div>`).join('')}</section><form id="forma-chat-form" class="forma-chat-form"><input name="message" placeholder="Напиши свой вопрос..." required><button aria-label="Отправить">↑</button></form><p class="forma-footnote">Ответы помощника в этой версии демонстрационные.</p>`;
  }
  function render(tab) {
    state.tab=tab; nav.forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
    if(tab==='home' && !state.goals) { onboarding(); return; }
    main.innerHTML=tab==='home'?home():tab==='diary'?diary():tab==='menu'?plan():tab==='body'?progress():tab==='profile'?profile():chat();
    bindPage();
  }
  function onboarding() {
    main.innerHTML=`<section class="forma-page-intro"><p class="eyebrow">НАЧНЁМ С ТЕБЯ</p><h1>Настроим FORMA.</h1><p class="muted">Несколько деталей — и мы рассчитаем ориентиры, от которых можно отталкиваться.</p></section>
    <form id="forma-onboarding-form" class="forma-card forma-product-form">
      <p class="eyebrow">ТВОЯ ЦЕЛЬ</p><label>Что хочешь изменить?<select name="goal_type"><option value="lose">Снизить вес</option><option value="gain">Набрать вес</option><option value="recomposition">Изменить состав тела</option><option value="maintain">Поддерживать вес</option><option value="healthier">Наладить питание</option></select></label>
      <div class="forma-nutrient-grid"><label>Возраст<input name="age" type="number" min="18" max="100" required placeholder="25"></label><label>Пол для расчёта<select name="sex"><option value="female">Женский</option><option value="male">Мужской</option><option value="other">Другое / не указывать</option></select></label>
      <label>Рост, см<input name="height_cm" type="number" min="100" max="250" step="0.1" required placeholder="170"></label><label>Текущий вес, кг<input name="current_weight_kg" type="number" min="20" max="400" step="0.1" required placeholder="75"></label>
      <label>Желаемый вес, кг<input name="target_weight_kg" type="number" min="20" max="400" step="0.1" placeholder="70"></label><label>Активность<select name="activity_level"><option value="sedentary">Преимущественно сижу</option><option value="light">Немного хожу, лёгкая активность</option><option value="moderate">Тренировки 3–5 раз в неделю</option><option value="high">Активно двигаюсь почти каждый день</option><option value="athlete">Высокая спортивная нагрузка</option></select></label></div>
      <button class="forma-primary">Рассчитать мои ориентиры <span>→</span></button><p class="forma-footnote">Это предварительная оценка, а не медицинское назначение. При беременности, заболеваниях или расстройствах пищевого поведения цели нужно согласовать со специалистом.</p>
    </form>`; bindPage();
  }
  function preferencesEditor() {
    const p=state.preferences||{};
    main.innerHTML=`<section class="forma-page-intro"><button class="forma-back" id="forma-back">← Профиль</button><p class="eyebrow">ТВОЙ ОБРАЗ ЖИЗНИ</p><h1>Питание и привычки</h1><p class="muted">Чтобы рекомендации учитывали твои вкусы, ограничения и время.</p></section>
    <form id="forma-preferences-form" class="forma-card forma-product-form">
      <label>Что предпочитаешь?<input name="dietary_preferences" value="${esc((p.dietary_preferences||[]).join(', '))}" placeholder="Например: обычное питание, больше овощей"></label>
      <label>Какие продукты исключить?<input name="excluded_foods" value="${esc((p.excluded_foods||[]).join(', '))}" placeholder="Например: грибы, свинина"></label>
      <label>Аллергии<input name="allergies" value="${esc((p.allergies||[]).join(', '))}" placeholder="Укажи через запятую"></label>
      <label>Сколько приёмов пищи удобно?<select name="meals_per_day"><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option><option value="6">6</option></select></label>
      <label>Бюджет на продукты<select name="budget_level"><option value="low">Экономный</option><option value="medium">Средний</option><option value="flexible">Гибкий</option></select></label>
      <label>Сколько времени готовить?<select name="cooking_time"><option value="quick">До 20 минут</option><option value="medium">Около 30–45 минут</option><option value="flexible">Время не принципиально</option></select></label>
      <button class="forma-primary">Сохранить предпочтения <span>→</span></button>
    </form>`;
    const f=main.querySelector('#forma-preferences-form'); f.elements.meals_per_day.value=String(p.meals_per_day||3); f.elements.budget_level.value=p.budget_level||'medium'; f.elements.cooking_time.value=p.cooking_time||'quick';
    main.querySelector('#forma-back').onclick=()=>render('profile'); bindPage();
  }
  function goalsEditor() {
    const g=state.goals||{};
    main.innerHTML=`<section class="forma-page-intro"><button class="forma-back" id="forma-back">← Профиль</button><p class="eyebrow">ЛИЧНЫЕ ДАННЫЕ И ЦЕЛИ</p><h1>Мои ориентиры</h1><p class="muted">Измени параметры — мы пересчитаем дневные ориентиры.</p></section>
    <form id="forma-goals-form" class="forma-card forma-product-form">
      <label>Цель<select name="goal_type"><option value="lose">Снижение веса</option><option value="gain">Набор веса</option><option value="recomposition">Изменение состава тела</option><option value="maintain">Поддержание</option><option value="healthier">Наладить питание</option></select></label>
      <div class="forma-nutrient-grid"><label>Возраст<input name="age" type="number" min="18" max="100" required></label><label>Пол<select name="sex"><option value="female">Женский</option><option value="male">Мужской</option><option value="other">Другое / не указывать</option></select></label><label>Рост, см<input name="height_cm" type="number" min="100" max="250" step="0.1" required></label><label>Текущий вес, кг<input name="current_weight_kg" type="number" min="20" max="400" step="0.1" required></label><label>Желаемый вес, кг<input name="target_weight_kg" type="number" min="20" max="400" step="0.1"></label><label>Активность<select name="activity_level"><option value="sedentary">Низкая</option><option value="light">Лёгкая</option><option value="moderate">Средняя</option><option value="high">Высокая</option><option value="athlete">Спортивная</option></select></label></div>
      <button class="forma-primary">Пересчитать и сохранить</button>
    </form>`;
    const f=main.querySelector('#forma-goals-form'); if(g.goal_type)f.elements.goal_type.value=g.goal_type;
    ['age','sex','height_cm','current_weight_kg','target_weight_kg','activity_level'].forEach(k=>{if(g[k]!=null)f.elements[k].value=g[k];});
    main.querySelector('#forma-back').onclick=()=>render('profile'); bindPage();
  }
  function toast(message) { let el=app.querySelector('.toast'); if(!el){el=document.createElement('div');el.className='toast';app.append(el);} el.textContent=message;el.classList.add('visible');setTimeout(()=>el.classList.remove('visible'),2200); }
  function bindPage() {
    main.querySelectorAll('[data-action],[data-go]').forEach(b=>b.addEventListener('click',()=>action(b.dataset.action||b.dataset.go)));
    main.querySelectorAll('[data-plan-date]').forEach(b=>b.addEventListener('click',()=>{state.planDate=b.dataset.planDate;render('menu');}));
    main.querySelectorAll('[data-plan-remove]').forEach(b=>b.addEventListener('click',async()=>{const id=b.dataset.planRemove;state.plans=state.plans.filter(p=>String(p.id)!==String(id));localStorage.setItem('forma-plans',JSON.stringify(state.plans));render('menu');if(/^[0-9a-f-]{36}$/i.test(id)){try{await api('delete_plan',{id});}catch(e){toast('Не удалось синхронизировать удаление');}}}));
    main.querySelectorAll('[data-remove]').forEach(b=>b.addEventListener('click',async()=>{const item=state.meals.find(m=>String(m.id||'')===b.dataset.remove);if(!item)return;state.meals=state.meals.filter(m=>m!==item);localStorage.setItem('forma-meals',JSON.stringify(state.meals));render(state.tab);if(item.id&&/^[0-9a-f-]{36}$/i.test(String(item.id))){try{await api('delete_entry',{id:item.id});}catch(e){toast('Не удалось синхронизировать удаление');}}}));
    main.querySelectorAll('[data-diary-shift]').forEach(b=>b.addEventListener('click',()=>{const d=new Date(state.diaryDate+'T12:00:00');d.setDate(d.getDate()+Number(b.dataset.diaryShift));const next=localDate(d);if(next<=localDate(new Date())){state.diaryDate=next;render('diary');}}));
    const diaryDateInput=main.querySelector('#forma-diary-date');if(diaryDateInput)diaryDateInput.addEventListener('change',()=>{if(diaryDateInput.value&&diaryDateInput.value<=localDate(new Date())){state.diaryDate=diaryDateInput.value;render('diary');}});
    const rf=main.querySelector('#forma-recipe-form');if(rf)rf.addEventListener('submit',e=>{e.preventDefault();const d=new FormData(rf),recipe={id:'recipe-'+Date.now(),title:String(d.get('title')).trim(),ingredients:String(d.get('ingredients')||''),instructions:String(d.get('instructions')||''),kcal:Number(d.get('kcal')||0),protein_g:Number(d.get('protein_g')||0),fat_g:Number(d.get('fat_g')||0),carbs_g:Number(d.get('carbs_g')||0)};state.recipes.unshift(recipe);localStorage.setItem('forma-recipes',JSON.stringify(state.recipes));recipesPage();toast('Рецепт сохранён');});
    main.querySelectorAll('[data-recipe-remove]').forEach(b=>b.addEventListener('click',()=>{state.recipes=state.recipes.filter(x=>x.id!==b.dataset.recipeRemove);localStorage.setItem('forma-recipes',JSON.stringify(state.recipes));recipesPage();}));
    main.querySelectorAll('[data-recipe-plan]').forEach(b=>b.addEventListener('click',async()=>{const r=state.recipes.find(x=>x.id===b.dataset.recipePlan);if(!r)return;const payload={plan_date:state.planDate||localDate(new Date()),meal_type:'lunch',title:r.title,description:r.ingredients+(r.instructions?' · '+r.instructions:''),kcal:r.kcal,protein_g:r.protein_g,fat_g:r.fat_g,carbs_g:r.carbs_g};try{const saved=await api('save_plan',payload);state.plans.push(saved?.plan||{...payload,id:'local-'+Date.now()});toast(saved?'Добавлено в план':'Добавлено в план на устройстве');}catch(e){state.plans.push({...payload,id:'local-'+Date.now()});toast('Добавлено в план на устройстве');}localStorage.setItem('forma-plans',JSON.stringify(state.plans));render('menu');}));
    const sf=main.querySelector('#forma-shopping-form');if(sf)sf.addEventListener('submit',e=>{e.preventDefault();const name=String(new FormData(sf).get('item')||'').trim();if(name){state.shopping.push({id:'shop-'+Date.now(),name,done:false});localStorage.setItem('forma-shopping',JSON.stringify(state.shopping));shoppingList();}});
    main.querySelectorAll('[data-shopping-toggle]').forEach(b=>b.addEventListener('change',()=>{const item=state.shopping.find(x=>x.id===b.dataset.shoppingToggle);if(item)item.done=b.checked;localStorage.setItem('forma-shopping',JSON.stringify(state.shopping));shoppingList();}));
    main.querySelectorAll('[data-shopping-remove]').forEach(b=>b.addEventListener('click',()=>{state.shopping=state.shopping.filter(x=>x.id!==b.dataset.shoppingRemove);localStorage.setItem('forma-shopping',JSON.stringify(state.shopping));shoppingList();}));
    const saveGoalForm=async form=>{const d=new FormData(form),g=Object.fromEntries(d.entries());['age','height_cm','current_weight_kg','target_weight_kg'].forEach(k=>g[k]=g[k]===''?null:Number(g[k]));Object.assign(g,calculateTargets(g));state.goals=g;applyGoals(g);localStorage.setItem('forma-goals',JSON.stringify(g));try{const saved=await api('save_goals',g);toast(saved?'Цели сохранены в аккаунте':'Цели сохранены на устройстве');}catch(e){toast('Сохранено на устройстве; синхронизация не удалась');}render('home');};
    const of=main.querySelector('#forma-onboarding-form');if(of)of.addEventListener('submit',e=>{e.preventDefault();saveGoalForm(of);});
    const gf=main.querySelector('#forma-goals-form');if(gf)gf.addEventListener('submit',e=>{e.preventDefault();saveGoalForm(gf);});
    const pf=main.querySelector('#forma-preferences-form');if(pf)pf.addEventListener('submit',async e=>{e.preventDefault();const d=new FormData(pf),split=k=>String(d.get(k)||'').split(',').map(x=>x.trim()).filter(Boolean);state.preferences={dietary_preferences:split('dietary_preferences'),excluded_foods:split('excluded_foods'),allergies:split('allergies'),meals_per_day:Number(d.get('meals_per_day')),budget_level:d.get('budget_level'),cooking_time:d.get('cooking_time')};localStorage.setItem('forma-preferences',JSON.stringify(state.preferences));try{const saved=await api('save_preferences',state.preferences);toast(saved?'Предпочтения сохранены':'Сохранено на устройстве');}catch(e){toast('Сохранено на устройстве; синхронизация не удалась');}render('profile');});
    const plf=main.querySelector('#forma-plan-form');if(plf)plf.addEventListener('submit',async e=>{e.preventDefault();const d=new FormData(plf),payload={plan_date:d.get('plan_date'),meal_type:d.get('meal_type'),title:String(d.get('title')).trim(),description:d.get('description'),kcal:Number(d.get('kcal')||0),protein_g:Number(d.get('protein_g')||0),fat_g:Number(d.get('fat_g')||0),carbs_g:Number(d.get('carbs_g')||0)};try{const saved=await api('save_plan',payload);if(saved?.plan)state.plans.push(saved.plan);else state.plans.push({...payload,id:'local-'+Date.now()});toast(saved?'Блюдо сохранено в аккаунте':'Блюдо сохранено на устройстве');}catch(e){state.plans.push({...payload,id:'local-'+Date.now()});toast('Сохранено на устройстве; синхронизация не удалась');}localStorage.setItem('forma-plans',JSON.stringify(state.plans));state.planDate=payload.plan_date;render('menu');});
    const wf=main.querySelector('#forma-weight-form');if(wf)wf.addEventListener('submit',async e=>{e.preventDefault();state.weight=main.querySelector('#forma-weight').value;localStorage.setItem('forma-weight',state.weight);const measured_at=localDate(new Date());state.weights=state.weights.filter(x=>x.measured_at!==measured_at);state.weights.unshift({measured_at,weight_kg:Number(state.weight)});localStorage.setItem('forma-weights',JSON.stringify(state.weights));try{const saved=await api('save_weight',{weight_kg:Number(state.weight),measured_at});if(saved)toast('Измерение сохранено в аккаунте');else toast('Измерение сохранено на устройстве');}catch(err){toast('Сохранено на устройстве; синхронизация не удалась');}render('body');});
    const cf=main.querySelector('#forma-chat-form');if(cf)cf.addEventListener('submit',e=>{e.preventDefault();const v=new FormData(cf).get('message').trim();if(v){state.chat.push(v);render('chat');}});
    const foodSearch=main.querySelector('#forma-food-search');
    if(foodSearch)foodSearch.addEventListener('submit',async e=>{
      e.preventDefault();
      const query=String(new FormData(foodSearch).get('query')||'').trim();
      const results=main.querySelector('#forma-food-results'),button=foodSearch.querySelector('button');
      if(!query||query.length<2)return;
      if(Date.now()-lastFoodSearchAt<6000){toast('Подожди несколько секунд перед следующим поиском');return;}
      lastFoodSearchAt=Date.now();
      button.disabled=true;button.textContent='Ищем…';results.innerHTML='<p class="forma-footnote">Ищем продукты в базе…</p>';
      try{
        const data=await api('search_food',{query});
        if(!data?.products){results.innerHTML='<p class="forma-footnote">Поиск доступен при запуске приложения через Telegram. Ниже можно внести продукт вручную.</p>';return;}
        state.foodSearchResults=data.products;
        results.innerHTML=data.products.length?'<div class="forma-food-results">'+data.products.map((p,i)=>`<button type="button" class="forma-food-result" data-food-pick="${i}"><span><b>${esc(p.name)}</b>${p.brand?`<small>${esc(p.brand)}</small>`:''}<small>На 100 г · ${fmt(p.kcal)} ккал · Б ${fmt(p.p)} · Ж ${fmt(p.f)} · У ${fmt(p.c)}</small></span><i>Выбрать</i></button>`).join('')+'</div>':'<p class="forma-footnote">Ничего не найдено с заполненными КБЖУ. Попробуй другое название или внеси данные вручную.</p>';
      }catch(err){results.innerHTML='<p class="forma-footnote">Не удалось выполнить поиск. Попробуй ещё раз или заполни форму вручную.</p>';}
      finally{button.disabled=false;button.textContent='Найти';}
    });
    const foodResults=main.querySelector('#forma-food-results');
    if(foodResults)foodResults.addEventListener('click',e=>{
      const b=e.target.closest?.('[data-food-pick]');if(!b)return;
      const p=state.foodSearchResults[Number(b.dataset.foodPick)],form=main.querySelector('#forma-product-form');if(!p||!form)return;
      form.elements.name.value=p.name+(p.brand?' — '+p.brand:'');form.elements.kcal.value=p.kcal;form.elements.p.value=p.p;form.elements.f.value=p.f;form.elements.c.value=p.c;form.elements.state.value='label';
      form.scrollIntoView({behavior:'smooth',block:'start'});toast('Данные перенесены в форму. Проверь их перед сохранением.');
    });
    const pfm=main.querySelector('#forma-product-form');if(pfm)pfm.addEventListener('submit',async e=>{e.preventDefault();const d=new FormData(pfm);const grams=Number(d.get('grams')),factor=grams/100;const item={name:d.get('name'),type:d.get('type'),grams,kcal:Number(d.get('kcal'))*factor,p:Number(d.get('p'))*factor,f:Number(d.get('f'))*factor,c:Number(d.get('c'))*factor,weight_state:d.get('state')||'label',eaten_at:new Date(state.diaryDate+'T12:00:00').toISOString(),date:state.diaryDate};state.meals.push(item);localStorage.setItem('forma-meals',JSON.stringify(state.meals));render('diary');toast('Продукт добавлен в дневник');try{const saved=await api('save_entry',{food_name:item.name,meal_type:mealTypeToDb(item.type),grams:item.grams,kcal:item.kcal,protein_g:item.p,fat_g:item.f,carbs_g:item.c,weight_state:item.weight_state,source:'manual',eaten_at:item.eaten_at});if(saved?.entry){item.id=saved.entry.id;localStorage.setItem('forma-meals',JSON.stringify(state.meals));toast('Запись синхронизирована с аккаунтом');}}catch(err){toast('Запись сохранена на устройстве; синхронизация не удалась');}});
  }
  function action(a) {
    if(a==='diary'){render('diary');return;} if(a==='chat'){render('chat');return;}
    if(a==='add-product'){productForm();return;} if(a==='add-plan'){planForm();return;}
    if(a==='settings-goals'){goalsEditor();return;} if(a==='settings-food'){preferencesEditor();return;}
    if(a==='shopping'){shoppingList();return;} if(a==='recipes'){recipesPage();return;} if(a==='add-recipe'){recipeForm();return;} if(a==='shopping-clear'){state.shopping=state.shopping.filter(x=>!x.done);localStorage.setItem('forma-shopping',JSON.stringify(state.shopping));shoppingList();return;}
    if(a==='setting-subscription'){toast('Подписку подключим после готовности основных функций');return;}
    if(a==='photo'||a==='barcode'){toast('Эта функция запланирована для следующего этапа');return;}
    toast('Этот экран добавим следующим этапом');
  }
  function planForm() {
    main.innerHTML=`<section class="forma-page-intro"><button class="forma-back" id="forma-back">← План</button><p class="eyebrow">ПЛАНИРОВАНИЕ</p><h1>Добавить блюдо</h1><p class="muted">Запиши блюдо и примерную пищевую ценность порции.</p></section>
    <form id="forma-plan-form" class="forma-card forma-product-form"><label>Дата<input name="plan_date" type="date" value="${state.planDate}" required></label><label>Приём пищи<select name="meal_type"><option value="breakfast">Завтрак</option><option value="lunch">Обед</option><option value="snack">Перекус</option><option value="dinner">Ужин</option></select></label><label>Название блюда<input name="title" placeholder="Например, омлет с овощами" maxlength="160" required></label><label>Комментарий / состав<textarea name="description" rows="3" placeholder="Ингредиенты или заметка"></textarea></label><div class="forma-form-divider">Пищевая ценность порции</div><div class="forma-nutrient-grid"><label>Ккал<input name="kcal" type="number" min="0" step="1" value="0"></label><label>Белки, г<input name="protein_g" type="number" min="0" step="0.1" value="0"></label><label>Жиры, г<input name="fat_g" type="number" min="0" step="0.1" value="0"></label><label>Углеводы, г<input name="carbs_g" type="number" min="0" step="0.1" value="0"></label></div><button class="forma-primary">Сохранить в план <span>→</span></button></form>`;
    main.querySelector('#forma-back').onclick=()=>render('menu');bindPage();
  }
  let lastFoodSearchAt = 0;
  function productForm() {
    state.foodSearchResults=[];
    main.innerHTML=`<section class="forma-page-intro"><button class="forma-back" id="forma-back">← Дневник</button><p class="eyebrow">ПОДРОБНАЯ ЗАПИСЬ</p><h1>Добавить продукт</h1><p class="muted">Найди продукт в базе или внеси данные с упаковки вручную.</p></section>
    <section class="forma-card forma-food-search"><form id="forma-food-search"><label for="forma-food-query">Поиск по продуктам</label><div class="forma-food-search-line"><input id="forma-food-query" name="query" minlength="2" maxlength="80" placeholder="Например, творог 5%, банан, йогурт..." required><button class="forma-primary">Найти</button></div></form><div id="forma-food-results" aria-live="polite"><p class="forma-footnote">Данные Open Food Facts (ODbL). Значения могут быть неполными — сверяй их с упаковкой.</p></div></section>
    <form id="forma-product-form" class="forma-card forma-product-form"><div class="forma-card-head"><div><p class="eyebrow">РУЧНОЙ ВВОД</p><h2>Добавить самостоятельно</h2></div></div><label>Название продукта<input name="name" placeholder="Например, куриное филе" required></label><label>Приём пищи<select name="type"><option>Завтрак</option><option>Обед</option><option>Перекус</option><option>Ужин</option></select></label><label>Вес порции, г<input name="grams" type="number" min="1" max="5000" value="150" required></label><div class="forma-form-divider">Пищевая ценность на 100 г</div><div class="forma-nutrient-grid"><label>Калории, ккал<input name="kcal" type="number" min="0" step="0.1" placeholder="165" required></label><label>Белки, г<input name="p" type="number" min="0" step="0.1" placeholder="31" required></label><label>Жиры, г<input name="f" type="number" min="0" step="0.1" placeholder="3.6" required></label><label>Углеводы, г<input name="c" type="number" min="0" step="0.1" placeholder="0" required></label></div><label>Состояние продукта<select name="state"><option value="raw">Сырой вес</option><option value="cooked">Готовый вес</option><option value="label">Указано на упаковке</option></select></label><button class="forma-primary">Добавить в дневник <span>→</span></button><p class="forma-footnote">Пищевая ценность будет рассчитана пропорционально указанному весу.</p></form>`;
    main.querySelector('#forma-back').onclick=()=>render('diary');bindPage();
  }
  document.addEventListener('click',e=>{const b=e.target.closest('.nav-item');if(b){e.preventDefault();e.stopImmediatePropagation();render(b.dataset.tab);}},true);
  async function hydrate() {
    if (!initData) { render(state.tab); return; }
    try {
      const data = await api('bootstrap');
      state.profile = data.profile; state.goals = data.goals || state.goals; state.preferences = data.preferences || state.preferences; state.weights = (data.weights && data.weights.length) ? data.weights : state.weights; localStorage.setItem('forma-weights',JSON.stringify(state.weights)); state.plans = (data.plans && data.plans.length) ? data.plans : state.plans; if(state.goals){applyGoals(state.goals);localStorage.setItem('forma-goals',JSON.stringify(state.goals));} if(state.preferences)localStorage.setItem('forma-preferences',JSON.stringify(state.preferences)); localStorage.setItem('forma-plans',JSON.stringify(state.plans));
      state.meals = (data.entries || []).map(row => ({
        id: row.id, eaten_at: row.eaten_at, date: row.eaten_at ? localDate(row.eaten_at) : localDate(new Date()), name: row.food_name, type: mealTypeFromDb(row.meal_type), grams: Number(row.grams),
        kcal: Number(row.kcal), p: Number(row.protein_g), f: Number(row.fat_g), c: Number(row.carbs_g)
      }));
      if (state.weights.length) state.weight = String(state.weights[0].weight_kg);
      localStorage.setItem('forma-meals', JSON.stringify(state.meals));
      if (state.weight) localStorage.setItem('forma-weight', state.weight);
      render(state.tab);
    } catch (err) {
      toast('Не удалось подключиться к аккаунту. Проверь запуск через Telegram.');
    }
  }
  render('home');
  hydrate();
}
