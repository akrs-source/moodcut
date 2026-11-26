const storeKey='forma-demo-v1';
const defaults={goals:{kcal:1650,protein:110,fat:55,carbs:145},meals:[],weights:[],measurements:[],profile:{name:'',age:'',height:'',startWeight:'',goal:'Снижение веса',activity:'Умеренная'}};
let state;
try{state={...defaults,...JSON.parse(localStorage.getItem(storeKey)||'{}')};state.goals={...defaults.goals,...state.goals};state.profile={...defaults.profile,...state.profile};state.meals=state.meals||[];state.weights=state.weights||[];state.measurements=state.measurements||[]}catch{state=structuredClone(defaults)}
let activeTab='home';
const $=s=>document.querySelector(s);
const format=n=>Math.round(Number(n)||0).toLocaleString('ru-RU');
const today=()=>new Date().toLocaleDateString('ru-RU',{day:'numeric',month:'long'});
function save(){localStorage.setItem(storeKey,JSON.stringify(state))}
function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function totals(){return state.meals.reduce((a,m)=>({kcal:a.kcal+m.kcal,protein:a.protein+m.protein,fat:a.fat+m.fat,carbs:a.carbs+m.carbs}),{kcal:0,protein:0,fat:0,carbs:0})}
function mealCard(m){return '<article class="meal-card"><div class="meal-symbol">✳</div><div class="meal-info"><b>'+escapeHtml(m.name)+'</b><span>'+escapeHtml(m.type)+' · '+format(m.kcal)+' ккал</span></div><small>Б '+format(m.protein)+' · Ж '+format(m.fat)+' · У '+format(m.carbs)+'</small><button class="delete-entry" data-delete-meal="'+m.id+'" aria-label="Удалить">×</button></article>'}
function renderHome(){
 const t=totals(),g=state.goals;
 $('#eaten').innerHTML=format(t.kcal)+' <small>/ '+format(g.kcal)+'</small>';
 $('#remaining').textContent=format(Math.max(0,g.kcal-t.kcal));
 $('#calorie-ring').style.setProperty('--progress',Math.min(100,t.kcal/Math.max(1,g.kcal)*100)+'%');
 [['protein',g.protein],['fat',g.fat],['carbs',g.carbs]].forEach(([key,goal])=>{const id=key==='carbs'?'carb':key;$('#'+id+'-value').textContent=format(t[key])+' / '+goal+' г';$('#'+id+'-bar').style.width=Math.min(100,t[key]/Math.max(1,goal)*100)+'%'});
 const preview=$('#meal-preview');preview.innerHTML=state.meals.length?state.meals.slice(-3).reverse().map(mealCard).join(''):'<div class="meal-empty"><span>＋</span><div><b>Пока ничего не записано</b><p>Добавь первый приём пищи — баланс обновится автоматически.</p></div><button data-action="add-meal">Добавить</button></div>';
 const latest=state.weights.at(-1);if(latest){$('.weight-row strong').innerHTML=format(latest.value)+' <small>кг</small>';$('.weight-row .muted').textContent='Последнее измерение · '+latest.date;$('.weight-change').textContent=state.weights.length>1?(Number(latest.value)-Number(state.weights[0].value)).toFixed(1).replace('.',',')+' кг':'Первое измерение'}
 bindDynamic();
}
function setTab(tab){activeTab=tab;document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));if(tab==='home'){$('.shell').innerHTML=homeMarkup;renderHome()}else renderPage(tab)}
const homeMarkup=$('.shell').innerHTML;
function pageHead(kicker,title,sub=''){return '<div class="page-heading"><p class="eyebrow">'+kicker+'</p><h1>'+title+'</h1>'+(sub?'<p class="muted">'+sub+'</p>':'')+'</div>'}
function renderPage(tab){
 const shell=$('.shell');
 if(tab==='diary'){
 const t=totals(),g=state.goals;
 shell.innerHTML=pageHead('ТВОЁ ПИТАНИЕ · '+today().toUpperCase(),'Дневник питания','Записывай приёмы пищи и наблюдай за балансом дня.')+
 '<section class="panel diary-summary"><div><span>Съедено</span><strong>'+format(t.kcal)+' <small>/ '+format(g.kcal)+' ккал</small></strong></div><div><span>Осталось</span><strong>'+format(Math.max(0,g.kcal-t.kcal))+' ккал</strong></div><div><span>Белки</span><strong>'+format(t.protein)+' / '+g.protein+' г</strong></div><div><span>Жиры</span><strong>'+format(t.fat)+' / '+g.fat+' г</strong></div><div><span>Углеводы</span><strong>'+format(t.carbs)+' / '+g.carbs+' г</strong></div></section>'+
 '<div class="section-row"><div><p class="eyebrow">СЕГОДНЯ</p><h2>Приёмы пищи</h2></div><button class="primary-btn compact" data-action="add-meal">+ Добавить</button></div>'+
 (state.meals.length?'<section class="meals">'+state.meals.slice().reverse().map(mealCard).join('')+'</section>':'<section class="empty-state"><span>▤</span><b>Дневник пока пуст</b><p>Добавь завтрак, обед или любой перекус.</p><button class="primary-btn compact" data-action="add-meal">Добавить первый приём</button></section>')+
 '<p class="form-note page-note">Записи сохраняются на этом устройстве. Синхронизация между устройствами пока не подключена.</p>';
 }else if(tab==='menu'){
 const days=[['ПОНЕДЕЛЬНИК','Овсянка с ягодами','Курица с рисом и овощами','Запечённая рыба с картофелем'],['ВТОРНИК','Омлет и тост','Гречка с индейкой','Тёплый салат с креветками'],['СРЕДА','Сырники и йогурт','Гнёзда с курицей','Лаваш с творожным сыром и овощами'],['ЧЕТВЕРГ','Творог с фруктами','Рыба и булгур','Куриные котлеты с пюре'],['ПЯТНИЦА','Сэндвич с яйцом','Паста с курицей','Салат с тунцом'],['СУББОТА','Блины с творогом','Рис с говядиной','Овощи и запечённая индейка'],['ВОСКРЕСЕНЬЕ','Йогурт-боул','Домашняя шаурма','Лосось с овощами']];
 shell.innerHTML=pageHead('ПЛАНИРОВАНИЕ','Меню на неделю','Идеи для питания без строгих запретов. Можно заменить любое блюдо под себя.')+
 '<div class="menu-note"><span>✳</span><div><b>Твой ориентир — '+format(state.goals.kcal)+' ккал в день</b><p>Это пример меню, а не обязательный план. Порции и КБЖУ можно будет настроить под твою цель.</p></div></div>'+
 days.map((d,i)=>'<section class="panel day-card"><div class="day-title"><span>0'+(i+1)+'</span><b>'+d[0]+'</b></div><div class="day-meals">'+['Завтрак','Обед','Ужин'].map((type,j)=>'<div class="planned-meal"><small>'+type+'</small><b>'+d[j+1]+'</b><button data-add-plan="'+escapeHtml(d[j+1])+'" data-meal-type="'+type+'">+ В дневник</button></div>').join('')+'</div></section>').join('');
 }else if(tab==='body'){
 const latest=state.weights.at(-1),first=state.weights[0],diff=latest&&first?(Number(latest.value)-Number(first.value)):null;
 shell.innerHTML=pageHead('ДИНАМИКА И САМОЧУВСТВИЕ','Моё тело','Отслеживай изменения спокойно — важна тенденция, а не цифра за один день.')+
 '<section class="panel body-current"><div><span>Текущий вес</span><strong>'+(latest?format(latest.value)+' <small>кг</small>':'— <small>кг</small>')+'</strong><p class="muted">'+(latest?'Последняя запись · '+latest.date:'Добавь первое измерение')+'</p></div><div class="body-diff">'+(diff===null?'Пока нет динамики':(diff>0?'+':'')+diff.toFixed(1).replace('.',',')+' кг от старта')+'</div></section>'+
 '<section class="panel"><div class="panel-head"><div><p class="eyebrow">НОВАЯ ЗАПИСЬ</p><h2>Вес и замеры</h2></div></div><form id="body-form" class="body-form"><label>Вес, кг<input name="weight" type="number" min="20" max="350" step="0.1" placeholder="Например, 78.5"></label><label>Талия, см<input name="waist" type="number" min="30" max="250" step="0.5" placeholder="Необязательно"></label><label>Бёдра, см<input name="hips" type="number" min="30" max="250" step="0.5" placeholder="Необязательно"></label><label>Грудь, см<input name="chest" type="number" min="30" max="250" step="0.5" placeholder="Необязательно"></label><button class="primary-btn" type="submit">Сохранить измерение</button></form></section>'+
 '<div class="section-row"><div><p class="eyebrow">ИСТОРИЯ</p><h2>Предыдущие измерения</h2></div></div>'+
 (state.measurements.length?'<section class="measures-list">'+state.measurements.slice().reverse().map(w=>'<div class="measure-row"><div><b>'+(w.value?format(w.value)+' кг':'Замеры')+'</b><small>'+w.date+'</small></div><span>'+[w.waist?'Талия '+w.waist+' см':'',w.hips?'Бёдра '+w.hips+' см':'',w.chest?'Грудь '+w.chest+' см':''].filter(Boolean).join(' · ')+'</span></div>').join('')+'</section>':'<div class="empty-state"><span>⌁</span><b>История появится здесь</b><p>Добавь первое измерение, чтобы начать отслеживать динамику.</p></div>');
 }else if(tab==='profile'){
 const p=state.profile,g=state.goals;
 shell.innerHTML=pageHead('ЛИЧНЫЕ НАСТРОЙКИ','Профиль','Твои данные и ориентиры питания.')+
 '<section class="panel"><div class="panel-head"><div><p class="eyebrow">О ТЕБЕ</p><h2>Личные данные</h2></div></div><form id="profile-form" class="profile-form"><label>Как к тебе обращаться<input name="name" value="'+escapeHtml(p.name)+'" placeholder="Имя"></label><div class="form-grid"><label>Возраст<input name="age" type="number" min="14" max="100" value="'+escapeHtml(p.age)+'" placeholder="25"></label><label>Рост, см<input name="height" type="number" min="100" max="230" value="'+escapeHtml(p.height)+'" placeholder="170"></label></div><label>Текущий вес, кг<input name="startWeight" type="number" min="30" max="300" step="0.1" value="'+escapeHtml(p.startWeight)+'" placeholder="80"></label><label>Цель<select name="goal">'+['Снижение веса','Поддержание','Набор мышечной массы','Рекомпозиция'].map(x=>'<option '+(p.goal===x?'selected':'')+'>'+x+'</option>').join('')+'</select></label><label>Активность<select name="activity">'+['Низкая','Умеренная','Высокая'].map(x=>'<option '+(p.activity===x?'selected':'')+'>'+x+'</option>').join('')+'</select></label><button class="primary-btn" type="submit">Сохранить профиль</button></form></section>'+
 '<section class="panel goal-panel"><div class="panel-head"><div><p class="eyebrow">ТВОЙ ДНЕВНОЙ ОРИЕНТИР</p><h2>Калории и КБЖУ</h2></div></div><form id="goals-form" class="goals-form"><label>Калории, ккал<input name="kcal" type="number" min="800" max="6000" value="'+g.kcal+'"></label><label>Белки, г<input name="protein" type="number" min="0" max="400" value="'+g.protein+'"></label><label>Жиры, г<input name="fat" type="number" min="0" max="300" value="'+g.fat+'"></label><label>Углеводы, г<input name="carbs" type="number" min="0" max="800" value="'+g.carbs+'"></label><button class="primary-btn" type="submit">Обновить ориентиры</button></form><p class="form-note">Пока значения задаются вручную. Персональный расчёт КБЖУ и рекомендации с подтверждением добавим отдельным этапом.</p></section>'+
 '<div class="profile-foot">FORMA · ТВОЙ РИТМ, ТВОИ ПРАВИЛА</div>';
 }
 bindDynamic();
}
function openMealDialog(prefill={}){const form=$('#meal-form');form.reset();if(prefill.name)form.elements.name.value=prefill.name;if(prefill.type)form.elements.type.value=prefill.type;$('#meal-dialog').showModal()}
function showToast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('visible');clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>t.classList.remove('visible'),2200)}
function bindDynamic(){
 document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>setTab(b.dataset.go));
 document.querySelectorAll('[data-action="add-meal"]').forEach(b=>b.onclick=()=>openMealDialog());
 document.querySelectorAll('[data-delete-meal]').forEach(b=>b.onclick=()=>{state.meals=state.meals.filter(m=>m.id!==b.dataset.deleteMeal);save();refresh();showToast('Запись удалена')});
 document.querySelectorAll('[data-add-plan]').forEach(b=>b.onclick=()=>openMealDialog({name:b.dataset.addPlan,type:b.dataset.mealType}));
 const body=$('#body-form');if(body)body.onsubmit=e=>{e.preventDefault();const d=new FormData(body),weight=Number(d.get('weight')),waist=d.get('waist'),hips=d.get('hips'),chest=d.get('chest');if(!weight&&!waist&&!hips&&!chest){showToast('Заполни хотя бы одно поле');return}const record={id:Date.now().toString(),value:weight||null,waist,hips,chest,date:today()};if(weight)state.weights.push(record);state.measurements.push(record);save();renderPage('body');showToast('Измерение сохранено')};
 const profile=$('#profile-form');if(profile)profile.onsubmit=e=>{e.preventDefault();const d=new FormData(profile);state.profile=Object.fromEntries(d.entries());save();showToast('Профиль сохранён')};
 const goals=$('#goals-form');if(goals)goals.onsubmit=e=>{e.preventDefault();const d=new FormData(goals);state.goals={kcal:Number(d.get('kcal')),protein:Number(d.get('protein')),fat:Number(d.get('fat')),carbs:Number(d.get('carbs'))};save();refresh();showToast('Ориентиры обновлены')};
}
function refresh(){if(activeTab==='home'){renderHome()}else renderPage(activeTab)}
document.querySelectorAll('.nav-item').forEach(b=>b.addEventListener('click',()=>setTab(b.dataset.tab)));
$('#close-dialog').addEventListener('click',()=>$('#meal-dialog').close());
$('#meal-form').addEventListener('submit',e=>{e.preventDefault();const d=new FormData(e.currentTarget);state.meals.push({id:Date.now().toString(),name:String(d.get('name')).trim(),type:d.get('type'),kcal:Number(d.get('kcal'))||0,protein:Number(d.get('protein'))||0,fat:Number(d.get('fat'))||0,carbs:Number(d.get('carbs'))||0});save();e.currentTarget.reset();$('#meal-dialog').close();refresh();showToast('Запись добавлена')});
$('#app .avatar').addEventListener('click',()=>setTab('profile'));
renderHome();