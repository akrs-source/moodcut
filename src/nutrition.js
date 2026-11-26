const goals = { kcal: 1650, protein: 110, fat: 55, carbs: 145 };
const meals = [];
const $ = (s) => document.querySelector(s);
const format = (n) => Math.round(n).toLocaleString('ru-RU');
function totals() {
  return meals.reduce((a, m) => ({ kcal:a.kcal+m.kcal, protein:a.protein+m.protein, fat:a.fat+m.fat, carbs:a.carbs+m.carbs }), {kcal:0,protein:0,fat:0,carbs:0});
}
function render() {
  const t = totals();
  $('#eaten').innerHTML = format(t.kcal) + ' <small>/ ' + format(goals.kcal) + '</small>';
  $('#remaining').textContent = format(Math.max(0, goals.kcal-t.kcal));
  $('#calorie-ring').style.setProperty('--progress', Math.min(100,t.kcal/goals.kcal*100)+'%');
  [['protein',goals.protein],['fat',goals.fat],['carbs',goals.carbs]].forEach(([key,goal]) => {
    const value=t[key]; const label=key==='protein'?'Белки':key==='fat'?'Жиры':'Углеводы';
    const id=key==='carbs'?'carb':key;
    $('#'+id+'-value').textContent = format(value)+' / '+goal+' г';
    $('#'+id+'-bar').style.width = Math.min(100,value/goal*100)+'%';
  });
  const preview=$('#meal-preview');
  if (!meals.length) {
    preview.innerHTML='<div class="meal-empty"><span>＋</span><div><b>Пока ничего не записано</b><p>Добавь первый приём пищи — баланс обновится автоматически.</p></div><button data-go="diary">Добавить</button></div>';
  } else {
    preview.innerHTML=meals.map(m=>'<article class="meal-card"><div class="meal-symbol">✳</div><div class="meal-info"><b>'+escapeHtml(m.name)+'</b><span>'+escapeHtml(m.type)+' · '+format(m.kcal)+' ккал</span></div><small>Б '+format(m.protein)+' · Ж '+format(m.fat)+' · У '+format(m.carbs)+'</small></article>').join('');
  }
  bindGo();
}
function escapeHtml(s){return s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function bindGo(){document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>openTab(b.dataset.go));}
function openTab(tab){
  document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
  if(tab==='diary'){ $('#meal-dialog').showModal(); return; }
  const messages={home:'Ты уже на главной.',menu:'Раздел меню будет следующим этапом.',body:'Раздел веса и замеров будет следующим этапом.',profile:'Настройки профиля появятся следующим этапом.'};
  showToast(messages[tab]||'Раздел скоро появится.');
}
function showToast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('visible');clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>t.classList.remove('visible'),2300);}
document.querySelectorAll('.nav-item').forEach(b=>b.addEventListener('click',()=>openTab(b.dataset.tab)));
bindGo();
$('#close-dialog').addEventListener('click',()=>$('#meal-dialog').close());
$('#meal-form').addEventListener('submit',e=>{
  e.preventDefault();const d=new FormData(e.currentTarget);
  meals.push({name:String(d.get('name')).trim(),type:d.get('type'),kcal:Number(d.get('kcal'))||0,protein:Number(d.get('protein'))||0,fat:Number(d.get('fat'))||0,carbs:Number(d.get('carbs'))||0});
  e.currentTarget.reset();$('#meal-dialog').close();render();showToast('Запись добавлена');
});
render();