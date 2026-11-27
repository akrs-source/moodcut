import './forma-shell.css';

const app = document.querySelector('#app');
const main = app?.querySelector('main');
if (app && main) {
  const initialHome = main.innerHTML;
  const tg = window.Telegram?.WebApp;
  tg?.ready?.();
  tg?.expand?.();
  const initData = tg?.initData || '';
  // Telegram ID is used only to separate browser storage; server authorization still verifies initData.
  const storageUserId = String(tg?.initDataUnsafe?.user?.id || 'guest').replace(/[^0-9a-z_-]/gi, '');
  const storagePrefix = 'forma:v2:' + (storageUserId || 'guest') + ':';
  const storage = {
    getItem(key) { try { return localStorage.getItem(storagePrefix + key); } catch { return null; } },
    setItem(key, value) { try { localStorage.setItem(storagePrefix + key, value); } catch { /* storage unavailable */ } },
    removeItem(key) { try { localStorage.removeItem(storagePrefix + key); } catch { /* storage unavailable */ } }
  };
  const readJSON = (key, fallback) => {
    try { const value = storage.getItem(key); return value == null ? fallback : JSON.parse(value); }
    catch { return fallback; }
  };
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
  const state = { tab: 'home', meals: readJSON('forma-meals', []).map((m,i)=>({...m,id:m.id||'local-existing-'+i})), weight: storage.getItem('forma-weight') || '', chat: [], profile: null, isAdmin: false, goals: readJSON('forma-goals', null), preferences: readJSON('forma-preferences', null), weights: readJSON('forma-weights', []), plans: readJSON('forma-plans', []), shopping: readJSON('forma-shopping', []), recipes: readJSON('forma-recipes', []), foodSearchResults: [], planDate: '', diaryDate: localDate(new Date()) };
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
  const navLabels = {home:'Дневник',diary:'Питание',menu:'План',recipes:'Рецепты',body:'Прогресс',profile:'Профиль'};
  nav.forEach(b=>{const key=b.dataset.tab;if(navIcons[key])b.innerHTML='<span class="nav-icon">'+navIcons[key]+'</span><small>'+navLabels[key]+'</small>';});
  const mealsHTML = () => diaryMeals().length ? diaryMeals().map(m=>`<article class="forma-food-row"><div class="forma-food-icon">✳</div><div class="forma-food-main"><b>${esc(m.name)}</b><span>${esc(m.type)} · ${m.grams} г · ${fmt(m.kcal)} ккал</span><small>Б ${m.p} г · Ж ${m.f} г · У ${m.c} г</small></div><button class="forma-remove" data-remove="${esc(String(m.id || ''))}" aria-label="Удалить">×</button></article>`).join('') : '<div class="forma-empty"><span>＋</span><b>Дневник пока пуст</b><p>Добавь первый продукт или блюдо — показатели обновятся автоматически.</p></div>';
  const timeGreeting = () => { const hour = new Date().getHours(); return hour >= 5 && hour < 12 ? 'Доброе утро' : hour >= 12 && hour < 17 ? 'Добрый день' : hour >= 17 && hour < 23 ? 'Добрый вечер' : 'Доброй ночи'; };
  function home() {
    const t=totals(todayMeals()), pct=Math.min(100,targets.kcal?t.kcal/targets.kcal*100:0);
    const firstName=(tg?.initDataUnsafe?.user?.first_name || state.profile?.first_name || 'Анджелина').trim();
    const today=todayMeals(), mealOrder=['Завтрак','Обед','Перекус','Ужин'];
    const mealCards=today.length?mealOrder.map(type=>{const item=today.find(m=>m.type===type);if(!item)return '';return '<article class="forma-meal-glass"><div class="forma-meal-thumb" role="img" aria-label="Приём пищи"></div><div class="forma-meal-copy"><span>'+type+'</span><b>'+esc(item.name)+'</b><small>'+fmt(item.kcal)+' ккал · '+fmt(item.grams)+' г</small></div><span class="forma-meal-check">✓</span></article>';}).join(''):'<div class="forma-meal-empty">Твои приёмы пищи появятся здесь после первой записи.</div>';
    return '<section class="forma-greeting forma-editorial-hero"><div class="forma-greeting-copy"><p class="forma-brand-kicker">ТВОЁ ПРОСТРАНСТВО ЗАБОТЫ</p><h1>'+timeGreeting()+',<br>'+esc(firstName)+' ♡</h1></div><span class="forma-date">'+new Date().toLocaleDateString('ru-RU',{weekday:'long',day:'numeric',month:'long'})+'</span></section>' +
    '<section class="forma-card forma-glass-energy"><div class="forma-energy-ring" style="--pct:'+pct+'%"><div><b>'+fmt(t.kcal)+'</b><span>из '+fmt(targets.kcal)+' ккал</span></div></div><div class="forma-glass-macros"><div><b>'+fmt(t.p)+' г</b><span>Белки</span></div><div><b>'+fmt(t.f)+' г</b><span>Жиры</span></div><div><b>'+fmt(t.c)+' г</b><span>Углеводы</span></div></div><button class="forma-energy-open" data-action="diary" aria-label="Открыть дневник">→</button></section>' +
    '<button class="forma-plan-banner" data-action="chat"><span class="forma-banner-star">✧</span><span>Сегодня всё по плану</span><span class="forma-banner-arrow">→</span></button>' +
    '<section class="forma-editorial-meals"><div class="forma-section-head"><div><p class="eyebrow">ТВОЙ ДЕНЬ</p><h2>Приёмы пищи</h2></div><button class="forma-link" data-action="diary">Все ›</button></div><div class="forma-meal-stack">'+mealCards+'</div></section>' +
    '<button class="forma-weekly-link" data-action="weekly-plan">Открыть план питания <span>↗</span></button>';
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
  const recipeCatalog = [
    {id:'acai',title:'Асаи-боул',category:'Завтраки',kcal:350,p:12,f:9,c:52,time:'10 минут',image:'https://images.unsplash.com/photo-1511690743698-d9d85f2fbf38?auto=format&fit=crop&w=900&q=85',ingredients:[['Асаи-пюре','100 г'],['Банан','½ шт.'],['Греческий йогурт','100 г'],['Гранола','25 г'],['Ягоды','50 г']],steps:['Взбей асаи, банан и йогурт до густой кремовой текстуры.','Переложи в боул и добавь гранолу и ягоды.']},
    {id:'avocado',title:'Тост с авокадо',category:'Завтраки',kcal:410,p:17,f:23,c:35,time:'8 минут',image:'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=900&q=85',ingredients:[['Цельнозерновой хлеб','2 ломтика'],['Авокадо','½ шт.'],['Яйцо','1 шт.'],['Лимонный сок','1 ч. л.'],['Микрозелень','по вкусу']],steps:['Подсуши хлеб на сухой сковороде или в тостере.','Разомни авокадо с лимонным соком, выложи на хлеб.','Добавь яйцо и микрозелень.']},
    {id:'salmon',title:'Лосось на гриле',category:'Ужины',kcal:480,p:39,f:25,c:24,time:'20 минут',image:'https://images.unsplash.com/photo-1466637574441-749b8f19452f?auto=format&fit=crop&w=900&q=85',ingredients:[['Филе лосося','140 г'],['Брокколи','150 г'],['Лимон','¼ шт.'],['Оливковое масло','1 ч. л.'],['Специи','по вкусу']],steps:['Приправь лосось и сбрызни лимоном.','Обжарь на гриле по 4–5 минут с каждой стороны.','Подай с приготовленной на пару брокколи.']},
    {id:'quinoa',title:'Киноа-боул',category:'Обеды',kcal:370,p:18,f:13,c:46,time:'25 минут',image:'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=85',ingredients:[['Киноа (сухая)','50 г'],['Нут','70 г'],['Огурец','70 г'],['Томаты черри','80 г'],['Фета','25 г']],steps:['Промой киноа и отвари до готовности.','Нарежь овощи, нут промой и обсуши.','Собери боул, добавь фету и заправку по вкусу.']},
    {id:'syrniki',title:'Сырники с ягодами',category:'Завтраки',kcal:390,p:27,f:12,c:40,time:'20 минут',image:'https://images.unsplash.com/photo-1560008581-09826d1de69e?auto=format&fit=crop&w=900&q=85',ingredients:[['Творог 5%','180 г'],['Яйцо','1 шт.'],['Рисовая мука','20 г'],['Йогурт','40 г'],['Ягоды','50 г']],steps:['Смешай творог, яйцо и муку до однородности.','Сформируй сырники влажными руками.','Обжарь на антипригарной сковороде или запеки до золотистости. Подавай с йогуртом и ягодами.']},
    {id:'salad',title:'Салат с яйцом пашот',category:'Обеды',kcal:290,p:19,f:17,c:16,time:'15 минут',image:'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=900&q=85',ingredients:[['Микс салата','70 г'],['Яйцо','1 шт.'],['Авокадо','40 г'],['Огурец','80 г'],['Оливковое масло','1 ч. л.']],steps:['Выложи салат, огурец и авокадо в тарелку.','Приготовь яйцо пашот в слабо кипящей воде 3 минуты.','Добавь яйцо и заправь оливковым маслом.']},
    {id:'chicken',title:'Курица с овощами',category:'Ужины',kcal:420,p:42,f:14,c:31,time:'25 минут',image:'https://images.unsplash.com/photo-1532550907401-a500c9a57435?auto=format&fit=crop&w=900&q=85',ingredients:[['Куриное филе','150 г'],['Кабачок','100 г'],['Перец сладкий','80 г'],['Булгур (сухой)','35 г'],['Оливковое масло','1 ч. л.']],steps:['Отвари булгур согласно инструкции.','Нарежь курицу и овощи, обжарь с маслом и специями до готовности.','Подавай курицу с овощами на подушке из булгура.']},
    {id:'yogurt',title:'Йогурт с гранолой',category:'Низкокалорийные',kcal:240,p:18,f:7,c:27,time:'5 минут',image:'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=900&q=85',ingredients:[['Греческий йогурт','170 г'],['Гранола','20 г'],['Клубника','70 г'],['Семена чиа','5 г']],steps:['Выложи йогурт в небольшую чашу.','Добавь нарезанную клубнику, гранолу и семена чиа.']},
  ];
  let recipeFilter = 'Все', recipeSearch = '', activeRecipeId = null;
  const favoriteRecipes = new Set(readJSON('forma-recipe-favorites', []));
  function recipeCardHTML(r) {
    return `<article class="forma-cook-card" data-recipe-open="${r.id}" role="button" tabindex="0" aria-label="Открыть рецепт ${esc(r.title)}" style="--recipe-image:url('${r.image}')">
      <button class="forma-cook-fav ${favoriteRecipes.has(r.id)?'is-favorite':''}" data-recipe-fav="${r.id}" aria-label="В избранное">${favoriteRecipes.has(r.id)?'♥':'♡'}</button>
      <div class="forma-cook-overlay"><span>${r.category} · ${r.time}</span><h2>${esc(r.title)}</h2><b>${r.kcal} ккал</b></div>
    </article>`;
  }
  function recipesPage() {
    recipeFilter='Все'; recipeSearch='';
    main.innerHTML=`<section class="forma-page-intro forma-recipes-intro"><p class="eyebrow">ИДЕИ ДЛЯ ТВОЕГО СТОЛА</p><h1>Рецепты</h1><p class="muted">Вкусная еда, которая вписывается в твой день.</p></section>
    <label class="forma-recipe-search"><span>⌕</span><input id="forma-recipe-search" type="search" placeholder="Найти блюдо или ингредиент..." autocomplete="off"><button type="button" id="forma-recipe-clear" aria-label="Очистить поиск">×</button></label>
    <div class="forma-recipe-filters" role="tablist" aria-label="Категории рецептов">${['Все','Завтраки','Обеды','Ужины','Низкокалорийные'].map((x,i)=>`<button type="button" role="tab" aria-selected="${i===0}" class="${i===0?'active':''}" data-recipe-filter="${x}">${x}</button>`).join('')}</div>
    <div class="forma-recipe-results-head"><span id="forma-recipe-count">8 рецептов</span><span>НА КАЖДЫЙ ДЕНЬ</span></div>
    <div class="forma-cook-grid" id="forma-cook-grid">${recipeCatalog.map(recipeCardHTML).join('')}</div>
    <p class="forma-footnote forma-recipe-note">КБЖУ указано ориентировочно на одну порцию. Фактические значения зависят от продуктов и их веса.</p>`;
    bindPage();
    const search=main.querySelector('#forma-recipe-search');
    search.addEventListener('input',()=>{recipeSearch=search.value.trim().toLocaleLowerCase('ru');updateRecipeGrid();});
    main.querySelector('#forma-recipe-clear').addEventListener('click',()=>{search.value='';recipeSearch='';updateRecipeGrid();search.focus();});
    main.querySelectorAll('[data-recipe-filter]').forEach(b=>b.addEventListener('click',()=>{recipeFilter=b.dataset.recipeFilter;main.querySelectorAll('[data-recipe-filter]').forEach(x=>{const on=x===b;x.classList.toggle('active',on);x.setAttribute('aria-selected',String(on));});updateRecipeGrid();}));
    main.querySelector('#forma-cook-grid').addEventListener('click',e=>{
      const fav=e.target.closest('[data-recipe-fav]'); if(fav){e.stopPropagation();const id=fav.dataset.recipeFav;favoriteRecipes.has(id)?favoriteRecipes.delete(id):favoriteRecipes.add(id);storage.setItem('forma-recipe-favorites',JSON.stringify([...favoriteRecipes]));fav.classList.toggle('is-favorite',favoriteRecipes.has(id));fav.textContent=favoriteRecipes.has(id)?'♥':'♡';return;}
      const card=e.target.closest('[data-recipe-open]');if(card)recipeDetail(card.dataset.recipeOpen);
    });
    main.querySelector('#forma-cook-grid').addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('[data-recipe-open]')){e.preventDefault();recipeDetail(e.target.dataset.recipeOpen);}});
  }
  function updateRecipeGrid() {
    const grid=main.querySelector('#forma-cook-grid');if(!grid)return;
    const list=recipeCatalog.filter(r=>(recipeFilter==='Все'||r.category===recipeFilter)&&( !recipeSearch||[r.title,r.category,...r.ingredients.map(x=>x.join(' '))].join(' ').toLocaleLowerCase('ru').includes(recipeSearch)));
    grid.innerHTML=list.map(recipeCardHTML).join('')||'<div class="forma-recipe-no-results"><span>⌕</span><b>Ничего не нашлось</b><p>Попробуй другое название или ингредиент.</p></div>';
    const count=main.querySelector('#forma-recipe-count');if(count)count.textContent=list.length+' '+(list.length===1?'рецепт':list.length<5?'рецепта':'рецептов');
  }
  function recipeDetail(id) {
    const r=recipeCatalog.find(x=>x.id===id);if(!r)return;activeRecipeId=id;
    main.innerHTML=`<section class="forma-recipe-detail">
      <div class="forma-recipe-detail-hero" style="--recipe-image:url('${r.image}')"><button class="forma-recipe-back" id="forma-recipe-back" aria-label="Назад к рецептам">←</button><button class="forma-cook-fav detail-fav ${favoriteRecipes.has(r.id)?'is-favorite':''}" id="forma-detail-fav" aria-label="В избранное">${favoriteRecipes.has(r.id)?'♥':'♡'}</button></div>
      <div class="forma-recipe-detail-body"><p class="eyebrow">${r.category.toUpperCase()} · ${r.time.toUpperCase()}</p><h1>${esc(r.title)}</h1><div class="forma-recipe-macros"><div><b>${r.kcal}</b><span>Ккал</span></div><div><b>${r.p} г</b><span>Белки</span></div><div><b>${r.f} г</b><span>Жиры</span></div><div><b>${r.c} г</b><span>Углеводы</span></div></div>
      <section class="forma-recipe-section"><div class="forma-section-head"><div><p class="eyebrow">ПОДГОТОВЬ ЗАРАНЕЕ</p><h2>Ингредиенты</h2></div><span class="forma-tag">${r.ingredients.length} позиций</span></div><div class="forma-recipe-ingredients">${r.ingredients.map((x,i)=>`<label><input type="checkbox" data-recipe-ingredient="${i}"><span>${esc(x[0])}</span><small>${esc(x[1])}</small></label>`).join('')}</div></section>
      <section class="forma-recipe-section"><p class="eyebrow">ПРОСТО И ПОШАГОВО</p><h2>Приготовление</h2><ol class="forma-recipe-steps">${r.steps.map(x=>`<li>${esc(x)}</li>`).join('')}</ol></section>
      <p class="forma-recipe-serving">Пищевая ценность рассчитана на одну порцию.</p></div>
      <div class="forma-recipe-bottom"><button class="forma-primary" id="forma-add-recipe-diary">Добавить в дневник за сегодня <span>→</span></button></div>
    </section>`;
    main.querySelector('#forma-recipe-back').onclick=()=>recipesPage();
    main.querySelector('#forma-detail-fav').onclick=()=>{favoriteRecipes.has(r.id)?favoriteRecipes.delete(r.id):favoriteRecipes.add(r.id);storage.setItem('forma-recipe-favorites',JSON.stringify([...favoriteRecipes]));recipeDetail(r.id);};
    main.querySelector('#forma-add-recipe-diary').onclick=async()=>{
      const type=r.category==='Завтраки'?'Завтрак':r.category==='Ужины'?'Ужин':'Обед';
      const item={name:r.title,type,grams:250,kcal:r.kcal,p:r.p,f:r.f,c:r.c,eaten_at:new Date().toISOString(),date:localDate(new Date())};
      state.meals.push(item);storage.setItem('forma-meals',JSON.stringify(state.meals));
      toast('Добавлено в дневник');
      try{const saved=await api('save_entry',{food_name:item.name,meal_type:mealTypeToDb(type),grams:250,kcal:item.kcal,protein_g:item.p,fat_g:item.f,carbs_g:item.c,weight_state:'cooked',source:'recipe',eaten_at:item.eaten_at});if(saved?.entry){item.id=saved.entry.id;storage.setItem('forma-meals',JSON.stringify(state.meals));}}catch(e){toast('Добавлено на устройстве; синхронизация не удалась');}
    };
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
    </section><p class="forma-footnote">Список покупок синхронизируется с твоим аккаунтом.</p>`;
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
      <button data-action="setting-subscription"><span><b>Подписка FORMA</b><small>Дополнительные возможности появятся позже</small></span><i>›</i></button>
    </section>${state.isAdmin?`<section class="forma-card forma-settings"><button data-action="admin"><span><b>Панель администратора</b><small>Пользователи и статистика FORMA</small></span><i>›</i></button></section>`:''}<p class="forma-footnote">Данные и ориентиры можно изменить в любой момент. Расчёт носит справочный характер.</p>`;
  }
  async function adminPage() {
    main.innerHTML = '<section class="forma-page-intro"><button class="forma-back" id="forma-admin-back">← Профиль</button><p class="eyebrow">FORMA · УПРАВЛЕНИЕ</p><h1>Администрирование</h1><p class="muted">Загружаем статистику и пользователей…</p></section>';
    main.querySelector('#forma-admin-back').onclick=()=>render('profile');
    try {
      const result = await api('admin_overview');
      if (!result || !Array.isArray(result.users)) throw new Error('admin_data_unavailable');
      const stats = result.stats || {};
      const metric = (value) => value == null ? '—' : fmt(Number(value));
      const statItems = [
        ['Пользователи', stats.total_users ?? result.total_returned ?? result.users.length],
        ['Заполнили цели', stats.users_with_goals],
        ['Записи в дневниках', stats.diary_entries],
        ['Записи веса', stats.weight_logs],
        ['Блюда в планах', stats.meal_plans],
      ];
      const availableStats = statItems.filter(([label,value]) => value != null);
      const statsHtml = '<section class="forma-admin-stats">'+availableStats.map(([label,value])=>'<article class="forma-admin-stat"><span>'+esc(label)+'</span><b>'+metric(value)+'</b></article>').join('')+'</section>';
      const usersHtml = result.users.length
        ? result.users.map(u=>{
          const fullName=[u.first_name,u.last_name].filter(Boolean).join(' ')||'Без имени';
          const searchText=[fullName,u.username,u.telegram_id].filter(Boolean).join(' ').toLowerCase();
          return '<article class="forma-history-row" data-admin-user data-search="'+esc(searchText)+'"><span><b>'+esc(fullName)+'</b>'+(u.username?' <small>@'+esc(u.username)+'</small>':'')+'<small style="display:block">ID: '+esc(u.telegram_id)+'</small></span><span class="forma-admin-user-date">'+esc((u.updated_at||'').slice(0,10)||'—')+'</span></article>';
        }).join('')
        : '<p class="muted">Пока нет пользователей.</p>';
      main.innerHTML = '<section class="forma-page-intro"><button class="forma-back" id="forma-admin-back">← Профиль</button><p class="eyebrow">FORMA · УПРАВЛЕНИЕ</p><h1>Администрирование</h1><p class="muted">Общая статистика приложения</p></section>'+statsHtml+'<section class="forma-card forma-settings forma-admin-pro-card"><button data-action="admin-subscriptions"><span><b>Подписки PRO</b><small>Выдача, продление и отключение доступа</small></span><i>›</i></button></section><section class="forma-card forma-admin-users-card"><div class="forma-card-head"><div><p class="eyebrow">АККАУНТЫ</p><h2>Пользователи</h2><p class="muted" id="forma-admin-user-count">Показаны '+fmt(result.users.length)+' аккаунтов</p></div></div><label class="forma-admin-search-label">Поиск по имени, username или Telegram ID<input id="forma-admin-search" type="search" placeholder="Начни вводить для поиска…" autocomplete="off"></label><div id="forma-admin-user-list">'+usersHtml+'</div></section><p class="forma-footnote">Список показывает последние аккаунты, загруженные из базы данных. Административный доступ проверяется сервером.</p>';
      main.querySelector('#forma-admin-back').onclick=()=>render('profile');
      main.querySelector('[data-action="admin-subscriptions"]').onclick=()=>adminSubscriptionsPage();
      const search=main.querySelector('#forma-admin-search');
      search?.addEventListener('input',()=>{
        const query=search.value.trim().toLowerCase();
        let visible=0;
        main.querySelectorAll('[data-admin-user]').forEach(row=>{
          const match=!query||row.dataset.search.includes(query);
          row.hidden=!match;
          if(match)visible++;
        });
        const count=main.querySelector('#forma-admin-user-count');
        if(count)count.textContent='Найдено '+fmt(visible)+' из '+fmt(result.users.length);
      });
    } catch (e) {
      main.innerHTML='<section class="forma-page-intro"><button class="forma-back" id="forma-admin-back">← Профиль</button><p class="eyebrow">FORMA · УПРАВЛЕНИЕ</p><h1>Не удалось загрузить</h1><p class="muted">Проверь подключение или права администратора.</p></section>';
      main.querySelector('#forma-admin-back').onclick=()=>render('profile');
    }
  }
  async function adminSubscriptionsPage() {
    main.innerHTML = '<section class="forma-page-intro forma-admin-subscriptions-intro"><button class="forma-back" id="forma-subscriptions-back">← Администрирование</button><p class="eyebrow">FORMA · PRO</p><h1>Подписки</h1><p class="muted">Загружаем аккаунты и статусы…</p></section>';
    main.querySelector('#forma-subscriptions-back').onclick=()=>adminPage();
    try {
      const result = await api('admin_subscriptions');
      if (!result || !Array.isArray(result.users) || !Array.isArray(result.subscriptions)) throw new Error('subscriptions_unavailable');
      const subs = new Map(result.subscriptions.map(s=>[String(s.telegram_id),s]));
      const statusLabel = s => {
        if(!s) return 'Нет PRO';
        if(s.status==='cancelled') return 'Отключена';
        if(new Date(s.expires_at).getTime()<=Date.now()) return 'Истекла';
        return 'Активна';
      };
      const expiryLabel = s => s?.expires_at ? new Date(s.expires_at).toLocaleDateString('ru-RU') : '—';
      const rows = result.users.map(u=>{
        const id=String(u.telegram_id);
        const s=subs.get(id);
        const fullName=[u.first_name,u.last_name].filter(Boolean).join(' ')||'Без имени';
        const search=[fullName,u.username,id,statusLabel(s)].filter(Boolean).join(' ').toLowerCase();
        const active=s&&s.status==='active'&&new Date(s.expires_at).getTime()>Date.now();
        return '<article class="forma-subscription-row" data-subscription-user data-search="'+esc(search)+'"><div class="forma-subscription-user"><b>'+esc(fullName)+'</b>'+(u.username?' <small>@'+esc(u.username)+'</small>':'')+'<small>ID: '+esc(id)+'</small></div><div class="forma-subscription-meta"><span class="forma-subscription-status '+(active?'is-active':'')+'">'+esc(statusLabel(s))+'</span><small>До: '+esc(expiryLabel(s))+'</small></div><div class="forma-subscription-actions"><button type="button" data-sub-grant="'+esc(id)+'">+30 дней</button>'+(s?'<button type="button" class="is-muted" data-sub-revoke="'+esc(id)+'">Отключить</button>':'')+'</div></article>';
      }).join('');
      main.innerHTML = '<section class="forma-page-intro forma-admin-subscriptions-intro"><button class="forma-back" id="forma-subscriptions-back">← Администрирование</button><p class="eyebrow">FORMA · PRO</p><h1>Подписки</h1><p class="muted">Ручное управление доступом PRO</p></section><section class="forma-card forma-admin-form-card"><p class="eyebrow">ВЫДАТЬ ДОСТУП</p><form id="forma-subscription-grant-form" class="forma-product-form forma-subscription-form"><label>Telegram ID пользователя<input name="telegram_id" inputmode="numeric" pattern="[0-9]{1,24}" required placeholder="Например, 123456789"></label><div class="forma-nutrient-grid forma-subscription-fields"><label>Срок, дней<input name="days" type="number" min="1" max="3650" value="30" required></label><label>Комментарий<input name="note" maxlength="300" placeholder="Необязательно"></label></div><button class="forma-primary">Выдать / продлить PRO <span>→</span></button></form></section><section class="forma-card forma-admin-users-card"><div class="forma-card-head"><div><p class="eyebrow">АККАУНТЫ</p><h2>Статусы подписок</h2><p class="muted" id="forma-subscription-count">Пользователей: '+fmt(result.users.length)+'</p></div></div><label class="forma-admin-search-label">Поиск по имени или Telegram ID<input id="forma-subscription-search" type="search" placeholder="Найти пользователя…" autocomplete="off"></label><div id="forma-subscription-list">'+(rows||'<p class="muted">Пока нет пользователей.</p>')+'</div></section><p class="forma-footnote">Подписки сейчас выдаются вручную администратором. Автоматическая оплата и проверка доступа к PRO-функциям подключаются отдельно.</p>';
      main.querySelector('#forma-subscriptions-back').onclick=()=>adminPage();
      const form=main.querySelector('#forma-subscription-grant-form');
      form.addEventListener('submit',async e=>{
        e.preventDefault();
        const data=new FormData(form);
        const button=form.querySelector('button');
        if(button)button.disabled=true;
        try {
          await api('admin_set_subscription',{operation:'grant',telegram_id:String(data.get('telegram_id')||'').trim(),days:Number(data.get('days')),note:String(data.get('note')||'')});
          toast('Подписка PRO выдана');
          await adminSubscriptionsPage();
        } catch(err) {
          toast('Не удалось выдать подписку');
          if(button)button.disabled=false;
        }
      });
      main.querySelectorAll('[data-sub-grant]').forEach(button=>button.addEventListener('click',async()=>{
        try { await api('admin_set_subscription',{operation:'grant',telegram_id:button.dataset.subGrant,days:30}); toast('Добавлено 30 дней PRO'); await adminSubscriptionsPage(); }
        catch(e){toast('Не удалось продлить подписку');}
      }));
      main.querySelectorAll('[data-sub-revoke]').forEach(button=>button.addEventListener('click',async()=>{
        if(!confirm('Отключить подписку PRO для этого пользователя?'))return;
        try { await api('admin_set_subscription',{operation:'revoke',telegram_id:button.dataset.subRevoke}); toast('Подписка отключена'); await adminSubscriptionsPage(); }
        catch(e){toast('Не удалось отключить подписку');}
      }));
      const search=main.querySelector('#forma-subscription-search');
      search?.addEventListener('input',()=>{
        const q=search.value.trim().toLowerCase();let count=0;
        main.querySelectorAll('[data-subscription-user]').forEach(row=>{const match=!q||row.dataset.search.includes(q);row.hidden=!match;if(match)count++;});
        const label=main.querySelector('#forma-subscription-count');if(label)label.textContent='Найдено '+fmt(count)+' из '+fmt(result.users.length);
      });
    } catch(e) {
      main.innerHTML='<section class="forma-page-intro forma-admin-subscriptions-intro"><button class="forma-back" id="forma-subscriptions-back">← Администрирование</button><p class="eyebrow">FORMA · PRO</p><h1>Не удалось загрузить</h1><p class="muted">Проверь подключение или права администратора.</p></section>';
      main.querySelector('#forma-subscriptions-back').onclick=()=>adminPage();
    }
  }
  function chat() {
    return `<section class="forma-page-intro"><p class="eyebrow">ТВОЙ ПЕРСОНАЛЬНЫЙ ПОМОЩНИК</p><h1>Давай разберёмся.</h1><p class="muted">Можно спросить о питании, меню или своих показателях.</p></section><section class="forma-chat-window"><div class="forma-chat-message assistant"><small>FORMA</small>Привет! Я помогу разобраться с питанием и планированием. С чего начнём?</div>${state.chat.map(m=>`<div class="forma-chat-message user">${esc(m)}</div><div class="forma-chat-message assistant"><small>FORMA</small>Я пока работаю в демонстрационном режиме. В полноценной версии смогу анализировать твои записи и предлагать решения с учётом контекста.</div>`).join('')}</section><form id="forma-chat-form" class="forma-chat-form"><input name="message" placeholder="Напиши свой вопрос..." required><button aria-label="Отправить">↑</button></form><p class="forma-footnote">Ответы помощника в этой версии демонстрационные.</p>`;
  }
  function render(tab) {
    state.tab=tab; nav.forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
    if(tab==='home' && !state.goals) { onboarding(); return; }
    if(tab==='recipes'){recipesPage();return;}
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
    main.querySelectorAll('[data-plan-remove]').forEach(b=>b.addEventListener('click',async()=>{const id=b.dataset.planRemove;state.plans=state.plans.filter(p=>String(p.id)!==String(id));storage.setItem('forma-plans',JSON.stringify(state.plans));render('menu');if(/^[0-9a-f-]{36}$/i.test(id)){try{await api('delete_plan',{id});}catch(e){toast('Не удалось синхронизировать удаление');}}}));
    main.querySelectorAll('[data-remove]').forEach(b=>b.addEventListener('click',async()=>{const item=state.meals.find(m=>String(m.id||'')===b.dataset.remove);if(!item)return;state.meals=state.meals.filter(m=>m!==item);storage.setItem('forma-meals',JSON.stringify(state.meals));render(state.tab);if(item.id&&/^[0-9a-f-]{36}$/i.test(String(item.id))){try{await api('delete_entry',{id:item.id});}catch(e){toast('Не удалось синхронизировать удаление');}}}));
    main.querySelectorAll('[data-diary-shift]').forEach(b=>b.addEventListener('click',()=>{const d=new Date(state.diaryDate+'T12:00:00');d.setDate(d.getDate()+Number(b.dataset.diaryShift));const next=localDate(d);if(next<=localDate(new Date())){state.diaryDate=next;render('diary');}}));
    const diaryDateInput=main.querySelector('#forma-diary-date');if(diaryDateInput)diaryDateInput.addEventListener('change',()=>{if(diaryDateInput.value&&diaryDateInput.value<=localDate(new Date())){state.diaryDate=diaryDateInput.value;render('diary');}});
    const rf=main.querySelector('#forma-recipe-form');if(rf)rf.addEventListener('submit',async e=>{e.preventDefault();const d=new FormData(rf),recipe={title:String(d.get('title')).trim(),ingredients:String(d.get('ingredients')||''),instructions:String(d.get('instructions')||''),kcal:Number(d.get('kcal')||0),protein_g:Number(d.get('protein_g')||0),fat_g:Number(d.get('fat_g')||0),carbs_g:Number(d.get('carbs_g')||0)};try{const saved=await api('save_recipe',recipe);if(saved?.recipe){state.recipes.unshift(saved.recipe);toast('Рецепт сохранён в аккаунте');}else{recipe.id='recipe-'+Date.now();state.recipes.unshift(recipe);toast('Рецепт сохранён на устройстве');}}catch(e){recipe.id='recipe-'+Date.now();state.recipes.unshift(recipe);toast('Сохранено на устройстве; синхронизация не удалась');}storage.setItem('forma-recipes',JSON.stringify(state.recipes));recipesPage();});
    main.querySelectorAll('[data-recipe-remove]').forEach(b=>b.addEventListener('click',async()=>{const id=b.dataset.recipeRemove;state.recipes=state.recipes.filter(x=>String(x.id)!==String(id));storage.setItem('forma-recipes',JSON.stringify(state.recipes));recipesPage();if(/^[0-9a-f-]{36}$/i.test(String(id))){try{await api('delete_recipe',{id});}catch(e){toast('Не удалось синхронизировать удаление');}}}));
    main.querySelectorAll('[data-recipe-plan]').forEach(b=>b.addEventListener('click',async()=>{const r=state.recipes.find(x=>x.id===b.dataset.recipePlan);if(!r)return;const payload={plan_date:state.planDate||localDate(new Date()),meal_type:'lunch',title:r.title,description:r.ingredients+(r.instructions?' · '+r.instructions:''),kcal:r.kcal,protein_g:r.protein_g,fat_g:r.fat_g,carbs_g:r.carbs_g};try{const saved=await api('save_plan',payload);state.plans.push(saved?.plan||{...payload,id:'local-'+Date.now()});toast(saved?'Добавлено в план':'Добавлено в план на устройстве');}catch(e){state.plans.push({...payload,id:'local-'+Date.now()});toast('Добавлено в план на устройстве');}storage.setItem('forma-plans',JSON.stringify(state.plans));render('menu');}));
    const sf=main.querySelector('#forma-shopping-form');if(sf)sf.addEventListener('submit',async e=>{e.preventDefault();const name=String(new FormData(sf).get('item')||'').trim();if(name){const item={name,done:false};try{const saved=await api('save_shopping_item',item);if(saved?.item){state.shopping.push(saved.item);toast('Добавлено в список аккаунта');}else{item.id='shop-'+Date.now();state.shopping.push(item);}}catch(err){item.id='shop-'+Date.now();state.shopping.push(item);toast('Сохранено на устройстве; синхронизация не удалась');}storage.setItem('forma-shopping',JSON.stringify(state.shopping));shoppingList();}});
    main.querySelectorAll('[data-shopping-toggle]').forEach(b=>b.addEventListener('change',async()=>{const item=state.shopping.find(x=>String(x.id)===String(b.dataset.shoppingToggle));if(item){item.done=b.checked;storage.setItem('forma-shopping',JSON.stringify(state.shopping));try{await api('save_shopping_item',item);}catch(e){toast('Изменение сохранено локально; синхронизация не удалась');}}shoppingList();}));
    main.querySelectorAll('[data-shopping-remove]').forEach(b=>b.addEventListener('click',async()=>{const id=b.dataset.shoppingRemove;state.shopping=state.shopping.filter(x=>String(x.id)!==String(id));storage.setItem('forma-shopping',JSON.stringify(state.shopping));shoppingList();if(/^[0-9a-f-]{36}$/i.test(String(id))){try{await api('delete_shopping_item',{id});}catch(e){toast('Не удалось синхронизировать удаление');}}}));
    const saveGoalForm=async form=>{const d=new FormData(form),g=Object.fromEntries(d.entries());['age','height_cm','current_weight_kg','target_weight_kg'].forEach(k=>g[k]=g[k]===''?null:Number(g[k]));Object.assign(g,calculateTargets(g));state.goals=g;applyGoals(g);storage.setItem('forma-goals',JSON.stringify(g));try{const saved=await api('save_goals',g);toast(saved?'Цели сохранены в аккаунте':'Цели сохранены на устройстве');}catch(e){toast('Сохранено на устройстве; синхронизация не удалась');}render('home');};
    const of=main.querySelector('#forma-onboarding-form');if(of)of.addEventListener('submit',e=>{e.preventDefault();saveGoalForm(of);});
    const gf=main.querySelector('#forma-goals-form');if(gf)gf.addEventListener('submit',e=>{e.preventDefault();saveGoalForm(gf);});
    const pf=main.querySelector('#forma-preferences-form');if(pf)pf.addEventListener('submit',async e=>{e.preventDefault();const d=new FormData(pf),split=k=>String(d.get(k)||'').split(',').map(x=>x.trim()).filter(Boolean);state.preferences={dietary_preferences:split('dietary_preferences'),excluded_foods:split('excluded_foods'),allergies:split('allergies'),meals_per_day:Number(d.get('meals_per_day')),budget_level:d.get('budget_level'),cooking_time:d.get('cooking_time')};storage.setItem('forma-preferences',JSON.stringify(state.preferences));try{const saved=await api('save_preferences',state.preferences);toast(saved?'Предпочтения сохранены':'Сохранено на устройстве');}catch(e){toast('Сохранено на устройстве; синхронизация не удалась');}render('profile');});
    const plf=main.querySelector('#forma-plan-form');if(plf)plf.addEventListener('submit',async e=>{e.preventDefault();const d=new FormData(plf),payload={plan_date:d.get('plan_date'),meal_type:d.get('meal_type'),title:String(d.get('title')).trim(),description:d.get('description'),kcal:Number(d.get('kcal')||0),protein_g:Number(d.get('protein_g')||0),fat_g:Number(d.get('fat_g')||0),carbs_g:Number(d.get('carbs_g')||0)};try{const saved=await api('save_plan',payload);if(saved?.plan)state.plans.push(saved.plan);else state.plans.push({...payload,id:'local-'+Date.now()});toast(saved?'Блюдо сохранено в аккаунте':'Блюдо сохранено на устройстве');}catch(e){state.plans.push({...payload,id:'local-'+Date.now()});toast('Сохранено на устройстве; синхронизация не удалась');}storage.setItem('forma-plans',JSON.stringify(state.plans));state.planDate=payload.plan_date;render('menu');});
    const wf=main.querySelector('#forma-weight-form');if(wf)wf.addEventListener('submit',async e=>{e.preventDefault();state.weight=main.querySelector('#forma-weight').value;storage.setItem('forma-weight',state.weight);const measured_at=localDate(new Date());state.weights=state.weights.filter(x=>x.measured_at!==measured_at);state.weights.unshift({measured_at,weight_kg:Number(state.weight)});storage.setItem('forma-weights',JSON.stringify(state.weights));try{const saved=await api('save_weight',{weight_kg:Number(state.weight),measured_at});if(saved)toast('Измерение сохранено в аккаунте');else toast('Измерение сохранено на устройстве');}catch(err){toast('Сохранено на устройстве; синхронизация не удалась');}render('body');});
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
        const nutrient=value=>value==null||!Number.isFinite(Number(value))?'—':fmt(Number(value));
        results.innerHTML=data.products.length?'<div class="forma-food-results">'+data.products.map((p,i)=>{const incomplete=[p.p,p.f,p.c].some(v=>v==null);return `<button type="button" class="forma-food-result" data-food-pick="${i}"><span><b>${esc(p.name)}</b>${p.brand?`<small>${esc(p.brand)}</small>`:''}${p.quantity?`<small>${esc(p.quantity)}</small>`:''}<small>На 100 г · ${nutrient(p.kcal)} ккал · Б ${nutrient(p.p)} · Ж ${nutrient(p.f)} · У ${nutrient(p.c)}</small>${incomplete?'<small>Не все значения указаны — проверь данные на упаковке</small>':''}</span><i>Выбрать</i></button>`;}).join('')+'</div>':'<p class="forma-footnote">По этому запросу ничего не нашлось. Попробуй другое название или внеси продукт вручную.</p>';
      }catch(err){results.innerHTML='<p class="forma-footnote">Не удалось выполнить поиск. Попробуй ещё раз или заполни форму вручную.</p>';}
      finally{button.disabled=false;button.textContent='Найти';}
    });
    const foodResults=main.querySelector('#forma-food-results');
    if(foodResults)foodResults.addEventListener('click',e=>{
      const b=e.target.closest?.('[data-food-pick]');if(!b)return;
      const p=state.foodSearchResults[Number(b.dataset.foodPick)],form=main.querySelector('#forma-product-form');if(!p||!form)return;
      form.elements.name.value=p.name+(p.brand?' — '+p.brand:'');form.elements.kcal.value=p.kcal??'';form.elements.p.value=p.p??'';form.elements.f.value=p.f??'';form.elements.c.value=p.c??'';form.elements.state.value='label';
      form.scrollIntoView({behavior:'smooth',block:'start'});toast([p.p,p.f,p.c].some(v=>v==null)?'Данные перенесены. Заполни пропущенные значения по упаковке.':'Данные перенесены в форму. Проверь их перед сохранением.');
    });
    const pfm=main.querySelector('#forma-product-form');if(pfm)pfm.addEventListener('submit',async e=>{e.preventDefault();const d=new FormData(pfm);const grams=Number(d.get('grams')),factor=grams/100;const item={name:d.get('name'),type:d.get('type'),grams,kcal:Number(d.get('kcal'))*factor,p:Number(d.get('p'))*factor,f:Number(d.get('f'))*factor,c:Number(d.get('c'))*factor,weight_state:d.get('state')||'label',eaten_at:new Date(state.diaryDate+'T12:00:00').toISOString(),date:state.diaryDate};state.meals.push(item);storage.setItem('forma-meals',JSON.stringify(state.meals));render('diary');toast('Продукт добавлен в дневник');try{const saved=await api('save_entry',{food_name:item.name,meal_type:mealTypeToDb(item.type),grams:item.grams,kcal:item.kcal,protein_g:item.p,fat_g:item.f,carbs_g:item.c,weight_state:item.weight_state,source:'manual',eaten_at:item.eaten_at});if(saved?.entry){item.id=saved.entry.id;storage.setItem('forma-meals',JSON.stringify(state.meals));toast('Запись синхронизирована с аккаунтом');}}catch(err){toast('Запись сохранена на устройстве; синхронизация не удалась');}});
  }
  function action(a) {
    if(a==='diary'){render('diary');return;} if(a==='chat'){render('chat');return;} if(a==='weekly-plan'){render('menu');return;}
    if(a==='add-product'){productForm();return;} if(a==='add-plan'){planForm();return;}
    if(a==='settings-goals'){goalsEditor();return;} if(a==='settings-food'){preferencesEditor();return;}
    if(a==='shopping'){shoppingList();return;} if(a==='recipes'){recipesPage();return;} if(a==='add-recipe'){recipeForm();return;} if(a==='shopping-clear'){state.shopping=state.shopping.filter(x=>!x.done);storage.setItem('forma-shopping',JSON.stringify(state.shopping));shoppingList();return;}
    if(a==='admin'){adminPage();return;}
    if(a==='admin-subscriptions'){adminSubscriptionsPage();return;}
    if(a==='setting-subscription'){toast('К подписке вернёмся после завершения основных функций');return;}
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
      state.profile = data.profile; state.isAdmin = data.is_admin === true; state.goals = data.goals || state.goals; state.preferences = data.preferences || state.preferences; state.weights = (data.weights && data.weights.length) ? data.weights : state.weights; storage.setItem('forma-weights',JSON.stringify(state.weights)); state.plans = (data.plans && data.plans.length) ? data.plans : state.plans; if(Array.isArray(data.recipes)){if(data.recipes.length){state.recipes=data.recipes;}else if(state.recipes.length){for(const r of [...state.recipes]){try{const saved=await api('save_recipe',r);if(saved?.recipe)r.id=saved.recipe.id;}catch(e){}}}} if(Array.isArray(data.shopping)){if(data.shopping.length){state.shopping=data.shopping;}else if(state.shopping.length){for(const item of [...state.shopping]){try{const saved=await api('save_shopping_item',item);if(saved?.item)item.id=saved.item.id;}catch(e){}}}} storage.setItem('forma-recipes',JSON.stringify(state.recipes)); storage.setItem('forma-shopping',JSON.stringify(state.shopping)); if(state.goals){applyGoals(state.goals);storage.setItem('forma-goals',JSON.stringify(state.goals));} if(state.preferences)storage.setItem('forma-preferences',JSON.stringify(state.preferences)); storage.setItem('forma-plans',JSON.stringify(state.plans));
      state.meals = (data.entries || []).map(row => ({
        id: row.id, eaten_at: row.eaten_at, date: row.eaten_at ? localDate(row.eaten_at) : localDate(new Date()), name: row.food_name, type: mealTypeFromDb(row.meal_type), grams: Number(row.grams),
        kcal: Number(row.kcal), p: Number(row.protein_g), f: Number(row.fat_g), c: Number(row.carbs_g)
      }));
      if (state.weights.length) state.weight = String(state.weights[0].weight_kg);
      storage.setItem('forma-meals', JSON.stringify(state.meals));
      if (state.weight) storage.setItem('forma-weight', state.weight);
      render(state.tab);
    } catch (err) {
      toast('Не удалось подключиться к аккаунту. Проверь запуск через Telegram.');
    }
  }
  render('home');
  hydrate();
}
