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
  const state = { tab: 'home', meals: JSON.parse(localStorage.getItem('forma-meals') || '[]'), weight: localStorage.getItem('forma-weight') || '', chat: [], profile: null, goals: JSON.parse(localStorage.getItem('forma-goals') || 'null'), preferences: JSON.parse(localStorage.getItem('forma-preferences') || 'null'), weights: [], plans: [] };
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
  const totals = () => state.meals.reduce((a,m) => ({kcal:a.kcal+m.kcal,p:a.p+m.p,f:a.f+m.f,c:a.c+m.c}),{kcal:0,p:0,f:0,c:0});
  const esc = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const nav = [...app.querySelectorAll('.nav-item')];
  const navLabels = {home:['⌂','Сегодня'],diary:['◫','Питание'],menu:['▦','План'],body:['↗','Прогресс'],profile:['○','Профиль']};
  nav.forEach(b=>{const pair=navLabels[b.dataset.tab];if(pair)b.innerHTML='<span>'+pair[0]+'</span><small>'+pair[1]+'</small>';});
  const mealsHTML = () => state.meals.length ? state.meals.map((m,i)=>`<article class="forma-food-row"><div class="forma-food-icon">✳</div><div class="forma-food-main"><b>${esc(m.name)}</b><span>${esc(m.type)} · ${m.grams} г · ${fmt(m.kcal)} ккал</span><small>Б ${m.p} г · Ж ${m.f} г · У ${m.c} г</small></div><button class="forma-remove" data-remove="${i}" aria-label="Удалить">×</button></article>`).join('') : '<div class="forma-empty"><span>＋</span><b>Дневник пока пуст</b><p>Добавь первый продукт или блюдо — показатели обновятся автоматически.</p></div>';
  function home() {
    const t=totals(), left=Math.max(0,targets.kcal-t.kcal), pct=Math.min(100,t.kcal/targets.kcal*100);
    return `<section class="forma-greeting"><div><p class="eyebrow">ЧЕТВЕРГ · ТВОЙ РИТМ</p><h1>День начинается<br>с заботы о себе.</h1><p class="muted">Не идеальный план. Подходящий именно тебе.</p></div><span class="forma-date">26 НОЯБРЯ</span></section>
    <section class="forma-home-grid"><article class="forma-card forma-energy"><div class="forma-card-head"><div><p class="eyebrow">ТВОЙ БАЛАНС</p><h2>Питание сегодня</h2></div><span class="forma-tag">Демо-пример</span></div><div class="forma-energy-line"><div class="forma-donut" style="--pct:${pct}%"><div><b>${fmt(left)}</b><span>ккал осталось</span></div></div><div class="forma-energy-numbers"><span>Уже съедено</span><b>${fmt(t.kcal)} <small>/ ${fmt(targets.kcal)} ккал</small></b><span>Пример цели на день</span><b>${fmt(targets.kcal)} ккал</b></div></div><div class="forma-macros">${[['Белки','p',targets.protein,'#7c9273'],['Жиры','f',targets.fat,'#c7a783'],['Углеводы','c',targets.carbs,'#9ba9b4']].map(([n,k,g,col])=>`<div><div><span>${n}</span><b>${fmt(t[k])} / ${g} г</b></div><i><em style="width:${Math.min(100,t[k]/g*100)}%;background:${col}"></em></i></div>`).join('')}</div><p class="forma-footnote">Показатели здесь демонстрационные. После онбординга FORMA рассчитает персональные цели.</p><button class="forma-primary" data-action="diary">Добавить еду <span>＋</span></button></article>
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
    const history=[...state.weights].filter(x=>Number.isFinite(Number(x.weight_kg))).sort((a,b)=>String(a.measured_at).localeCompare(String(b.measured_at)));
    const recent=history.slice(-8), vals=recent.map(x=>Number(x.weight_kg));
    const min=vals.length?Math.min(...vals)-1:0, max=vals.length?Math.max(...vals)+1:1;
    const points=vals.map((v,i)=>{const x=12+(recent.length<2?i*10:i*276/(recent.length-1));const y=92-(v-min)/(max-min||1)*70;return `${x},${y}`;}).join(' ');
    const first=history[0],last=history[history.length-1],diff=first&&last?Number(last.weight_kg)-Number(first.weight_kg):0;
    const dateLabel=v=>v?new Date(v+'T12:00:00').toLocaleDateString('ru-RU',{day:'numeric',month:'short'}):'';
    return `<section class="forma-page-intro"><p class="eyebrow">ИЗМЕНЕНИЯ ВО ВРЕМЕНИ</p><h1>Прогресс</h1><p class="muted">Смотрим на тенденции, а не на отдельные цифры.</p></section>
    <section class="forma-card forma-weight-card"><p class="eyebrow">ТЕКУЩИЙ ВЕС</p><div class="forma-weight-value">${state.weight?esc(state.weight)+' <small>кг</small>':'— <small>кг</small>'}</div><p class="muted">Последнее записанное значение</p><form id="forma-weight-form"><label for="forma-weight">Добавить измерение</label><div><input id="forma-weight" type="number" min="20" max="400" step="0.1" placeholder="Например, 72.5" required><button class="forma-primary">Сохранить</button></div></form></section>
    <section class="forma-card forma-progress-chart"><div class="forma-card-head"><div><p class="eyebrow">ДИНАМИКА</p><h2>Изменения веса</h2></div><span class="forma-tag">${history.length} измерений</span></div>
      ${recent.length>1?`<svg viewBox="0 0 300 110" role="img" aria-label="График изменения веса" preserveAspectRatio="none"><line x1="0" y1="92" x2="300" y2="92" stroke="#eee5da"/><line x1="0" y1="57" x2="300" y2="57" stroke="#eee5da"/><line x1="0" y1="22" x2="300" y2="22" stroke="#eee5da"/><polyline points="${points}" fill="none" stroke="#a47b55" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>${recent.map((v,i)=>{const [x,y]=points.split(' ')[i].split(',');return `<circle cx="${x}" cy="${y}" r="3.5" fill="#a47b55"/>`;}).join('')}</svg><div class="forma-chart-labels"><span>${dateLabel(recent[0].measured_at)}</span><span>${dateLabel(recent[recent.length-1].measured_at)}</span></div><p class="forma-chart-change">${diff===0?'Пока без изменений':(diff<0?'Изменение за период: ':'Изменение за период: +')+`${Math.abs(diff).toFixed(1)} кг`}</p>`:`<div class="forma-chart-empty"><span>↗</span><b>Добавь ещё измерения</b><small>Когда появятся хотя бы две записи, здесь отобразится динамика.</small></div>`}
    </section>
    <section class="forma-card forma-history"><div class="forma-section-head"><div><p class="eyebrow">ИСТОРИЯ</p><h2>Последние измерения</h2></div></div>${history.length?history.slice(-8).reverse().map(x=>`<div class="forma-history-row"><span>${dateLabel(x.measured_at)}</span><b>${Number(x.weight_kg).toFixed(1).replace('.',',')} кг</b></div>`).join(''):'<p class="muted">Пока нет сохранённых измерений.</p>'}</section>`;
  }

