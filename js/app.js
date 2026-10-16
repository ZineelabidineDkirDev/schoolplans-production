const SUPA_URL='https://kgttekpnmkjgkzauekso.supabase.co',SUPA_KEY='sb_publishable_4aOkK0OlfbjiO_F38YD_8g_yPL4BXR4'; // clé publique : sans risque dans un site web
const sb=supabase.createClient(SUPA_URL,SUPA_KEY);
const IC={inbox:'<path d="M4 13l2-8h12l2 8M4 13v6h16v-6M4 13h5a3 3 0 0 0 6 0h5"/>',award:'<circle cx="12" cy="9" r="6"/><path d="M8.5 14L7 22l5-3 5 3-1.5-8"/>',check:'<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>',user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',book:'<path d="M4 5a2 2 0 0 1 2-2h13v17H6a2 2 0 0 0-2 2z"/><path d="M8 7h7"/>',globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',cpu:'<rect x="7" y="7" width="10" height="10" rx="1"/><path d="M9 3v4M15 3v4M9 17v4M15 17v4M3 9h4M3 15h4M17 9h4M17 15h4"/>',pen:'<path d="M4 20l4-1 11-11-3-3L5 16z"/>',cal:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',list:'<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',door:'<path d="M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17M4 21h16M14 12h.01"/>',users:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',home:'<path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z"/>',plus:'<path d="M12 5v14M5 12h14"/>',cube:'<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/>',msg:'<path d="M4 5h16v11H9l-5 4z"/>',calc:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h2M14 12h2M8 16h2M14 16h2"/>',sheet:'<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 10h16M4 15h16M10 4v16"/>',doc:'<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4M10 12h5M10 16h5"/>',code:'<path d="M9 8l-5 4 5 4M15 8l5 4-5 4"/>',chart:'<path d="M4 20V4M4 20h16M8 16v-5M12 16V8M16 16v-3"/>',db:'<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v12c0 1.7 3 3 7 3s7-1.3 7-3V6M5 12c0 1.7 3 3 7 3s7-1.3 7-3"/>'};
const ic=k=>`<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${IC[k]||IC.book}</svg>`;
const POLE={lang:['Langues','--lang'],bur:['Bureautique','--bur'],data:['Data & IT','--data'],math:['Mathématiques','--math']};
const S={fr:['Français','lang','msg',/francais/],en:['Anglais','lang','msg',/anglais/],es:['Espagnol','lang','msg',/espagnol/],de:['Allemand','lang','msg',/allemand/],it:['Italien','lang','msg',/italien/],ma:['Mathématiques','math','calc',/math/],xl:['Excel','bur','sheet',/excel/],wd:['Word','bur','doc',/\bword\b/],py:['Python','data','code',/python/],bi:['Power BI','data','chart',/power ?bi/],sq:['SQL','data','db',/\bsql\b/]};
const T=[];
const DAYS=['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'],ROOMS=[],RI={},H0=8,HR=56;
let C=[];
let nid=100,me=null;

let CURRENT_CENTRE_ID=null;
let CURRENT_CENTRE_NAME='';
let SUPER_CENTRES=[];




let CENTRE_DROITS={};

async function loadCentreDroits(){

  CENTRE_DROITS={};

  if(!me || me.sup || !me.centreId)
    return;

  const r=await sb
    .from('centres')
    .select('droits')
    .eq('id',me.centreId)
    .maybeSingle();

  if(
    !r.error &&
    r.data &&
    r.data.droits &&
    typeof r.data.droits==='object'
  ){
    CENTRE_DROITS=r.data.droits;
  }
}

function droitActif(key){

  if(me && me.sup)
    return true;

  return CENTRE_DROITS[key]!==false;
}

function appliquerDroitsCentre(){

  const droitsOnglets={
    vcal:'planning',
    vl:'cours',
    vr:'salles',
    vk:'supports',
    vf:'formateurs',
    vp:'presences',
    vs:'etudiants',
    vc:'certificats',
    vd:'statistiques'
  };

  Object.entries(droitsOnglets).forEach(
    ([tabId,droit])=>{

      const btn=document.querySelector(
        `.tabs button[data-v="${tabId}"]`
      );

      if(!btn)return;

      btn.classList.toggle(
        'hidden',
        !droitActif(droit)
      );
    }
  );
}



const ctr=()=>me&&me.sup&&CURRENT_CENTRE_ID
  ?{centre_id:CURRENT_CENTRE_ID}
  :{};

const $=id=>document.getElementById(id);
const fmt=h=>Math.floor(h)+'h'+(h%1?'30':'');
const norm=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const clash=(c,ex)=>C.find(o=>o.d===c.d&&o.s<c.e&&c.s<o.e&&(o.r===c.r||o.t===c.t));
const free=(c,key,val)=>!C.some(o=>o.id!==c.id&&o.d===c.d&&o.s<c.e&&c.s<o.e&&o[key]===val);

$('poles').innerHTML=Object.values(POLE).map(p=>`<span>${p[0]}</span>`).join('');
const show=id=>{['landing','login','app','pend'].forEach(x=>$(x).classList.toggle('hidden',x!==id));if(id==='landing'){document.querySelectorAll('.lpn [data-go]').forEach(b=>b.textContent=me?'Retour à mon espace':'Se connecter');scrollTo(0,0)}};
document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>{if(me)show('app');else{show('login');$('u').focus()}});
document.querySelector('[data-back]').onclick=()=>show('landing');
$('lo').onclick=async()=>{await sb.auth.signOut();me=null;show('landing');$('p').value=''};
$('th').onclick=()=>{const r=document.documentElement,d=r.dataset.theme==='dark'||(!r.dataset.theme&&matchMedia('(prefers-color-scheme:dark)').matches);r.dataset.theme=d?'light':'dark'};

function opts(el,arr){el.innerHTML=arr.map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}
function start(){

  $('wn').textContent=me.name;
  $('wr').textContent=me.role;
    opts($('fp'),[['','Tous les pôles'],...Object.entries(POLE).map(([k,v])=>[k,v[0]])]);

  
  opts($('fp'),[['','Tous les pôles'],...Object.entries(POLE).map(([k,v])=>[k,v[0]])]);
  opts($('ft'),[['','Tous les formateurs'],...T.map((t,i)=>[i,t.n])]);
  opts($('fr'),[['','Toutes les salles'],...ROOMS.map(r=>[r,sn(r)+' · '+RI[r][0]])]);
  if(me.tid!==undefined){$('ft').value=me.tid;$('ft').disabled=true}else $('ft').disabled=false;
  $('lg').innerHTML=Object.values(POLE).map(p=>`<span><i style="background:var(${p[1]})"></i>${p[0]}</span>`).join('');
  initForm();setHH();document.body.classList.toggle('isadm',me.role==='Admin'||me.role==='Formateur');
  document.querySelectorAll('.adm').forEach(e=>e.classList.toggle('hidden',me.role!=='Admin'));
  document.querySelectorAll('.fm').forEach(e=>e.classList.toggle('hidden',me.role!=='Admin'&&me.role!=='Formateur'));
  document.querySelectorAll('.stu').forEach(e=>e.classList.toggle('hidden',me.role!=='Étudiant'));
  document.querySelectorAll('.fo').forEach(e=>e.classList.toggle('hidden',me.role!=='Formateur'));
  document.querySelectorAll('.sup').forEach(e=>e.classList.toggle('hidden',!me.sup));

 if(me.role==='Formateur'){

  const menuFormateur=[
    'vcal',
    'vd',
    'vl',
    'vr',
    'vk',
    'vn'
  ];

  document.querySelectorAll('.tabs button').forEach(btn=>{

    const visible=menuFormateur.includes(btn.dataset.v);

    if(visible){
      btn.classList.remove('hidden');
      btn.style.removeProperty('display');
    }else{
      btn.classList.add('hidden');
      btn.style.setProperty('display','none','important');
    }

  });

}

  if(!$('tabs').querySelector('svg')){$('tabs').querySelectorAll('button').forEach(b=>b.insertAdjacentHTML('afterbegin',ic(b.dataset.i)));$('bc').insertAdjacentHTML('afterbegin',ic('plus'));$('bm').insertAdjacentHTML('afterbegin',ic('cube'));$('bf').insertAdjacentHTML('afterbegin',ic('users'));$('bx').insertAdjacentHTML('afterbegin',ic('cal'))}
  
  appliquerDroitsCentre();

document.querySelector('.tabs button:not(.hidden)')?.click();

  
  render();
}
['fp','ft','fr'].forEach(i=>$(i).onchange=render);






function render(){wkLabel();
  const fp=$('fp').value,ft=$('ft').value,fr=$('fr').value;
  const L=C.filter(c=>(!fp||S[c.k][1]===fp)&&(ft===''||c.t==ft)&&(!fr||c.r==fr)&&mine(c));
  const LG=L.concat(XC.filter(c=>(!fp||S[c.k][1]===fp)&&(ft===''||c.t==ft)&&(!fr||c.r==fr)&&mine(c)));
  let h='<div class="dh"></div>'+DAYS.map((d,i)=>`<div class="dh${wdate(i)===iso(new Date())?' tdy':''}${FERM[wdate(i)]?' clo':''}">${d}<small>${wdate(i).slice(8)}/${wdate(i).slice(5,7)}</small></div>`).join('');
  h+='<div class="times">'+Array.from({length:11},(_,i)=>`<div>${H0+i}h</div>`).join('')+'</div>';
  DAYS.forEach((_,d)=>{
    h+=`<div class="col${me.role==='Admin'?' adm2':''}${FERM[wdate(d)]?' clo':''}" data-d="${d}" data-lb="${esc(FERM[wdate(d)]||'')}">`+LG.filter(c=>c.d===d).map(c=>{const s=S[c.k];
      return `<div class="card${c.x?' xc':''}" data-id="${c.id}" data-date="${c.date}" style="--c:var(${POLE[s[1]][1]});top:${(c.s-H0)*HR}px;height:${(c.e-c.s)*HR-3}px">
      ${me.role==='Admin'?`<button class="x" data-del="${c.id}" aria-label="Supprimer ce cours">×</button>`:''}
      <div class="t">${ic(s[2])}<span>${s[0]}</span></div><small>${fmt(c.s)} – ${fmt(c.e)}</small><small>${T[c.t].n} · ${sn(c.r)}</small></div>`}).join('')+'</div>';
  });
  $('grid').innerHTML=h;renderRooms();renderList(L);renderTrainers();renderAgenda(L);
}
$('grid').onclick=e=>{if(!me||(me.role!=='Admin'&&me.role!=='Formateur'))return;
  const del=e.target.closest('[data-del]');if(del){if(confirm('Supprimer ce cours ?'))sb.from('cours').delete().eq('id',del.dataset.del).then(async()=>{await load();render()});return}
  const card=e.target.closest('.card');if(card){
    if(card.classList.contains('xc')){if(confirm('Rétablir cette séance ?'))sb.from('annulations').delete().eq('cours_id',card.dataset.id).eq('date',card.dataset.date).then(async()=>{await load();render()});return}
    const oc=C.find(c=>c.id==card.dataset.id&&c.date===card.dataset.date);if(oc)openCours(oc);return}
  const col=e.target.closest('.col');if(col&&!col.classList.contains('clo')){const y=e.clientY-col.getBoundingClientRect().top,h=Math.min(H0+Math.floor(y/HR*2)/2,18.5);openCours({d:+col.dataset.d,date:wdate(+col.dataset.d),s:h,e:Math.min(h+2,19),r:+$('fr').value||undefined})}};

function slots(r,d){
  const o=C.filter(c=>c.r===r&&c.d===d).sort((a,b)=>a.s-b.s),f=[];let t=H0;
  o.forEach(c=>{if(c.s>t)f.push(fmt(t)+'–'+fmt(c.s));t=Math.max(t,c.e)});
  if(t<19)f.push(fmt(t)+'–19h');return f}
function renderList(L){
  const R=[...L].sort((a,b)=>a.d-b.d||a.s-b.s);
  $('tb').innerHTML='<thead><tr><th>Cours</th><th>Horaire</th><th>Formateur</th><th>Domaine</th><th>Salle</th><th>Disponibilité de la salle</th></tr></thead><tbody>'+
  (R.length?R.map(c=>{const s=S[c.k],v=`var(${POLE[s[1]][1]})`,f=slots(c.r,c.d);
    return `<tr style="--c:${v}"><td><div class="cn"><b>${ic(s[2])}</b>${s[0]}</div></td><td>${DAYS[c.d]}<br><small style="color:var(--mute)">${fmt(c.s)} – ${fmt(c.e)}</small></td><td>${T[c.t].n}</td><td><span class="dm">${POLE[s[1]][0]}</span></td><td>${sn(c.r)}<br><small style="color:var(--mute)">${RI[c.r][0]}</small></td><td class="av ${f.length?'':'n'}">${f.length?'Libre '+DAYS[c.d].toLowerCase()+' : '+f.join(' · '):'Complète ce jour-là'}</td></tr>`}).join(''):'<tr><td colspan="6" style="color:var(--mute)">Aucun cours ne correspond à ces filtres.</td></tr>')+'</tbody>';
}
function renderRooms(){
  const n=new Date(),cw=iso(monday(n))===iso(WK),dn=cw?(n.getDay()+6)%7:-1,hn=n.getHours()+n.getMinutes()/60;
  $('rooms').innerHTML=ROOMS.map(r=>{
    const L=C.filter(c=>c.r===r),cur=L.find(c=>c.d===dn&&c.s<=hn&&hn<c.e),nx=L.filter(c=>c.d===dn&&c.s>hn).sort((a,b)=>a.s-b.s)[0];
    const busy=L.reduce((a,c)=>a+c.e-c.s,0),tot=66;
    const st=dn<0?['c','Autre semaine']:cur?['b',`Occupée jusqu'à ${fmt(cur.e)}`]:(dn>5||hn<8||hn>=19)?['c','Fermée actuellement']:nx?['f',`Libre jusqu'à ${fmt(nx.s)}`]:['f','Libre jusqu\'à la fermeture'];
    const strip=DAYS.map((d,di)=>`<div class="sr"><span>${d.slice(0,3)}</span>`+Array.from({length:11},(_,i)=>{const c=L.find(c=>c.d===di&&c.s<H0+i+1&&c.e>H0+i);return `<i class="${c?'o':''}" data-r="${r}" data-d="${di}" data-h="${H0+i}" data-id="${c?c.id:''}" title="${c?S[c.k][0]+' · '+T[c.t].n:'Libre'}"></i>`}).join('')+'</div>').join('');
    return `<div class="rc"><h4>${sn(r)}<span class="st ${st[0]}" style="margin:0">${st[1]}</span></h4><div class="m">${RI[r][0]} · ${RI[r][1]} places</div>${strip}<div class="k"><span>Occupée ${busy} h / ${tot} h</span><span>Libre ${tot-busy} h</span></div><button class="btn ghost" data-see="${r}" style="margin-top:10px;padding:7px 12px">Voir dans le planning</button></div>`}).join('');
}
function refreshT(){opts($('ft'),[['','Tous les formateurs'],...T.map((t,i)=>[i,t.n])]);$('ft').value=me.tid!==undefined?me.tid:''}
function renderTrainers(){
  $('tr').innerHTML=T.map((t,i)=>{const L=C.filter(c=>c.t===i),h=L.reduce((a,c)=>a+c.e-c.s,0),lock=L.length;
    const ini=t.n.replace(/^(M\.|Mme|Mlle)\s*/i,'').split(/\s+/).slice(0,2).map(w=>w[0]).join('').toUpperCase();
    return `<div class="rc"><h4><span style="display:flex;align-items:center;gap:10px"><b class="av2">${ini}</b>${t.n}</span></h4><div class="m" style="margin-top:10px">${L.length} cours · ${h} h / semaine</div><div>${t.s.map(k=>`<span class="dm" style="--c:var(${POLE[S[k][1]][1]});margin:0 6px 6px 0">${S[k][0]}</span>`).join('')}</div><div class="m" style="margin:4px 0 6px">${t.pid?'Accès actif':'Pas d\'accès'}${t.mail?' · '+esc(t.mail):''}</div><button class="btn ghost" data-ac="${i}" style="margin:8px 8px 0 0;padding:7px 12px">${t.pid?'Réinitialiser le mot de passe':'Créer l\'accès'}</button><button class="btn ghost" data-rm="${i}" style="margin-top:8px;padding:7px 12px" ${lock?'disabled title="Impossible : ce formateur a des cours"':''}>Supprimer</button></div>`}).join('');
}
$('tr').onclick=async e=>{const ac=e.target.closest('[data-ac]');
  if(ac){const t=T[+ac.dataset.ac];if(!t.mail){alert('Ce formateur n\'a pas d\'e-mail. Supprimez-le puis recréez-le avec son e-mail.');return}
    const reset=!!t.pid;if(reset&&!confirm('Générer un nouveau mot de passe pour '+t.n+' ? L\'ancien ne fonctionnera plus.'))return;
    
    const a=await callAdmin(
  reset
    ? {action:'reset_password',email:t.mail}
    : {
        action:'create_user',
        email:t.mail,
        full_name:t.n,
        role:'formateur',
        formateur_id:t.id,
        ...ctr()
      }
);
   
    if(a.error){alert('Erreur : '+a.error);return}await load();renderTrainers();showAcc(a.data,t.n);return}
  const b=e.target.closest('[data-rm]');if(!b||b.disabled)return;
  const tt=T[+b.dataset.rm],r=await sb.from('formateurs').delete().eq('id',tt.id);
  if(r.error){alert('Suppression impossible : '+r.error.message);return}
  if(tt.pid&&tt.mail)await callAdmin({action:'delete_user',email:tt.mail});
  await load();refreshT();trOpts();render()};
$('tf').onsubmit=async e=>{e.preventDefault();const m=$('tm'),ko=t=>{m.className='msg ko';m.textContent=t},n=$('tn').value.trim(),ks=[...document.querySelectorAll('#tfs input:checked')].map(x=>x.value);
  if(!n)return ko('Saisissez le nom du formateur.');
  if(!ks.length)return ko('Choisissez au moins une matière.');
  if($('tacc').checked&&!$('tmail').value.trim())return ko('Saisissez l\'e-mail de connexion du formateur.');
  if(T.some(t=>norm(t.n)===norm(n)))return ko('Ce formateur existe déjà.');
  const r1=await sb.from('formateurs').insert({nom:n,email:$('tmail').value.trim()||null,...ctr()}).select('id').single();
  if(r1.error)return ko('Erreur : '+r1.error.message);
  const r2=await sb.from('formateur_matieres').insert(ks.map(k=>({formateur_id:r1.data.id,matiere_id:MID[k]})));
  if(r2.error)return ko('Erreur : '+r2.error.message);
  let acc=null;
  if($('tacc').checked){
    
    const a=await callAdmin({
  action:'create_user',
  email:$('tmail').value.trim(),
  full_name:n,
  role:'formateur',
  formateur_id:r1.data.id,
  ...ctr()
});

    if(a.error){await load();return ko('Formateur ajouté, mais l\'accès n\'a pas pu être créé : '+a.error)}acc=a.data}
  await load();m.className='msg ok';m.textContent=`Formateur ajouté : ${n}.`;$('dtf').close();$('tmail').value='';if(acc)showAcc(acc,n);
  $('tn').value='';document.querySelectorAll('#tfs input').forEach(x=>x.checked=false);refreshT();trOpts();render()};
const sn=r=>RNM[r]||('Salle '+r);
$('sla').onclick=()=>{$('slm').textContent='';$('slm').className='msg';$('sln').value='';$('slt').value='';$('slc').value='';
  $('slt-l').innerHTML=[...new Set(ROOMS.map(r=>RI[r][0]).filter(Boolean))].map(x=>`<option value="${esc(x)}">`).join('');$('dsl').showModal()};
$('slf').onsubmit=async e=>{e.preventDefault();const m=$('slm'),b=e.submitter,ko=x=>{m.className='msg ko';m.textContent=x},
  n=$('sln').value.trim().replace(/\s+/g,' '),ty=$('slt').value.trim(),c=parseInt($('slc').value,10),dg=+n.replace(/\D/g,'');
  if(!me||me.role!=='Admin')return ko('Action réservée aux administrateurs.');
  if(!n)return ko('Saisissez le nom de la salle.');
  if(!ty)return ko('Saisissez le type de salle.');
  if(!(c>0&&c<=500))return ko('Saisissez une capacité valide (1 à 500).');
  if(ROOMS.some(r=>norm(sn(r))===norm(n))||(dg&&SID[dg]))return ko('Cette salle existe déjà.');
  if(b)b.disabled=true;
  const r=await sb.from('salles').insert({nom:n,type:ty,capacite:c,...ctr()});
  if(b)b.disabled=false;
  if(r.error)return ko('Erreur : '+r.error.message);
  await load();initForm();const fv=$('fr').value;opts($('fr'),[['','Toutes les salles'],...ROOMS.map(x=>[x,sn(x)+' · '+RI[x][0]])]);$('fr').value=fv;render();
  m.className='msg ok';m.textContent=`Salle ajoutée : ${n}.`;setTimeout(()=>$('dsl').close(),600)};

/* ---------- Gérer les centres (SUPER_ADMIN) ---------- */
const DROITS=[['etudiants','Étudiants'],['formateurs','Formateurs'],['cours','Cours'],['planning','Planning'],['salles','Salles'],['presences','Présences'],['certificats','Certificats'],['supports','Supports'],['documents','Documents'],['statistiques','Statistiques'],['rapports','Rapports'],['import_excel','Import Excel'],['export_excel','Export Excel']];
let CEN=[],CENSUB=false,ZID=null;
const zfd=d=>d?d.split('-').reverse().join('/'):'',zvide='<span style="color:var(--mute)">Non défini</span>',
  zdr=c=>DROITS.filter(([k])=>!c.droits||c.droits[k]!==false).length;
async function loadCentres(){
  if(!me||!me.sup)return;
  const r=await sb.from('centres').select('*').order('created_at');
  if(r.error){$('zt').innerHTML='';$('znote').textContent='Erreur : '+r.error.message;return}
  CEN=r.data||[];
  CENSUB=!(await sb.from('centres').select('type_abonnement,statut_abonnement,date_debut,date_expiration,droits').limit(1)).error;
  const P=await zprof();
  CEN.forEach(c=>{if(!P){c._n=null;c._u=null;return}const u={director:0,admin:0,super_admin:0,formateur:0,etudiant:0};P.filter(x=>x.centre_id===c.id).forEach(x=>{if(x.role in u)u[x.role]++});c._u=u;c._n=P.filter(x=>x.centre_id===c.id).length});
  renderCentres();loadBandeau()}
async function zprof(){let a=[],i=0;for(;;){const r=await sb.from('profiles').select('centre_id,role').range(i,i+999);if(r.error)return null;a=a.concat(r.data||[]);if((r.data||[]).length<1000)return a;i+=1000}}
const zud=c=>c._u?'Directeurs : '+c._u.director+' · Formateurs : '+c._u.formateur+' · Étudiants : '+c._u.etudiant+(c._u.admin?' · Administrateurs : '+c._u.admin:'')+(c._u.super_admin?' · Super administrateurs : '+c._u.super_admin:''):'';
function renderCentres(){
  $('znote').textContent=CENSUB?'':"Les colonnes d'abonnement (type, statut, dates, droits) n'existent pas encore dans la table centres : elles s'afficheront après la migration SQL du Jalon 6.";
  const qv=norm($('zq').value.trim()),L=CEN.filter(c=>!qv||norm(c.nom).includes(qv)||norm(c.slug).includes(qv));
  $('zt').innerHTML='<thead><tr><th>Centre</th><th>Statut centre</th>'+(CENSUB?'<th>Abonnement</th><th>Statut abonnement</th><th>Début</th><th>Expiration</th><th>Jours restants</th>':'')+'<th>Utilisateurs</th>'+(CENSUB?'<th>Droits</th>':'')+'<th>Actions</th></tr></thead><tbody>'+
   (L.length?L.map(c=>{
    const today=iso(new Date()),none=!c.type_abonnement&&!c.statut_abonnement&&!c.date_debut&&!c.date_expiration,v=none?'—':zvide,
      j=c.date_expiration?Math.round((new Date(c.date_expiration+'T12:00')-new Date(today+'T12:00'))/864e5):null,
      jt=j===null?v:j<0?`<span class="st b" style="margin:0">Expiré depuis ${-j} jour${-j>1?'s':''}</span>`:j===0?`<span class="st b" style="margin:0">Expire aujourd'hui</span>`:`<span class="st ${j>30?'f':'b'}" style="margin:0">${j} jour${j>1?'s':''} restant${j>1?'s':''}</span>`,
      dr=DROITS.filter(([k])=>!c.droits||c.droits[k]!==false).map(x=>x[1]).join(', ');
    return `<tr><td><b>${esc(c.nom)}</b><br><small style="color:var(--mute)">${esc(c.slug)}</small></td><td><span class="st ${c.actif?'f':'b'}" style="margin:0">${c.actif?'🟢 Actif':'🔴 Suspendu'}</span></td>`+
     (CENSUB?`<td>${none?'<span style="color:var(--mute)">Abonnement non défini</span>':c.type_abonnement?'<b style="text-transform:uppercase">'+esc(c.type_abonnement)+'</b>':zvide}</td><td>${none?'—':c.statut_abonnement?esc(c.statut_abonnement):zvide}</td><td>${c.date_debut?zfd(c.date_debut):v}</td><td>${c.date_expiration?zfd(c.date_expiration):v}</td><td>${jt}</td>`:'')+
     `<td title="${esc(zud(c))}">${c._n===null||c._n===undefined?'—':c._n+' utilisateur'+(c._n>1?'s':'')}</td>`+
     (CENSUB?`<td title="${esc(dr)}">${zdr(c)} / ${DROITS.length} fonctionnalités</td>`:'')+
     `<td><div style="display:flex;flex-direction:column;gap:6px;align-items:stretch"><button class="btn ghost" data-zed="${c.id}" style="padding:7px 12px">Modifier</button><button class="btn ghost" data-ztg="${c.id}" style="padding:7px 12px;white-space:nowrap">${c.actif?'Suspendre':'Réactiver'}</button></div></td></tr>`}).join(''):`<tr><td colspan="10" style="color:var(--mute)">${CEN.length?'Aucun centre ne correspond à la recherche.':'Aucun centre.'}</td></tr>`)+'</tbody>'}
$('zq').oninput=renderCentres;
function openCentre(c){ZID=c?c.id:null;$('zh').textContent=c?'Modifier le centre':'Ajouter un centre';
$('zm').textContent='';$('zm').className='msg';

  $('znewdir').classList.toggle('hidden', !!c);
  $('zdfull').value='';
  $('zdmail').value='';
  $('zdpass').value='';
  $('zdpass2').value='';
  $('zn').value=c?c.nom:'';$('zs').value=c?c.slug:'';$('za').value=c&&!c.actif?'0':'1';
  $('zus').textContent=c&&c._u?'Utilisateurs de ce centre — '+zud(c):'';
  $('zdir').classList.toggle('hidden',!(c&&me&&me.sup));if(c&&me&&me.sup)zdirLoad(c);
  $('zsub').classList.toggle('hidden',!CENSUB);
  $('zty').value=(c&&c.type_abonnement)||'';$('zst').value=(c&&c.statut_abonnement)||'';$('zd1').value=(c&&c.date_debut)||'';$('zd2').value=(c&&c.date_expiration)||'';
  document.querySelectorAll('#zf [data-dr]').forEach(i=>i.checked=!c||!c.droits||c.droits[i.dataset.dr]!==false);
  $('dz').showModal()}
$('zadd').onclick=()=>openCentre(null);

// ---------- Calcul automatique des dates d'abonnement ----------
$('zf').onsubmit=async e=>{
  e.preventDefault();

  const m=$('zm'),
        b=e.submitter,
        ko=x=>{
          m.className='msg ko';
          m.textContent=x;
        };

  const nom=$('zn').value.trim();
  const slug=$('zs').value.trim().toLowerCase();
  const d1=$('zd1').value;
  const d2=$('zd2').value;

  if(!me||!me.sup)
    return ko('Action réservée au super administrateur.');

  if(!nom)
    return ko('Saisissez le nom du centre.');

  if(!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug))
    return ko('Slug invalide : lettres minuscules, chiffres et tirets uniquement.');

  if(CEN.some(c=>c.slug===slug&&c.id!==ZID))
    return ko('Ce slug est déjà utilisé.');

  if(CENSUB&&d1&&d2&&d2<d1)
    return ko("La date d'expiration doit suivre la date de début.");

  const p={
    nom,
    slug,
    actif:$('za').value==='1'
  };

  if(CENSUB){

    p.type_abonnement=$('zty').value.trim()||null;

    p.statut_abonnement=$('zst').value.trim()||null;

    p.date_debut=d1||null;

    p.date_expiration=d2||null;

    p.droits={};

    document.querySelectorAll('#zf [data-dr]').forEach(i=>{
      p.droits[i.dataset.dr]=i.checked;
    });
  }

  if(b)b.disabled=true;

  /*
   * NOUVEAU CENTRE
   *
   * Le centre ET son directeur sont créés
   * ensemble via l'Edge Function.
   */
  if(!ZID){

    const fullName=$('zdfull').value.trim();
    const email=$('zdmail').value.trim().toLowerCase();
    const password=$('zdpass').value;
    const password2=$('zdpass2').value;

    if(!fullName){
      if(b)b.disabled=false;
      return ko('Saisissez le nom complet du directeur.');
    }

    if(!email){
      if(b)b.disabled=false;
      return ko("Saisissez l'e-mail du directeur.");
    }

    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
      if(b)b.disabled=false;
      return ko("L'adresse e-mail du directeur est invalide.");
    }

    if(password.length<10||password.length>72){
      if(b)b.disabled=false;
      return ko('Le mot de passe du directeur doit contenir entre 10 et 72 caractères.');
    }

    if(password!==password2){
      if(b)b.disabled=false;
      return ko('Les deux mots de passe du directeur ne correspondent pas.');
    }

    const r=await zcall({
      action:'create_centre',

      centre:p,

      director:{
        full_name:fullName,
        email:email,
        password:password
      }
    });

    if(b)b.disabled=false;

    if(r.error)
      return ko(r.error);

    await loadCentres();

    m.className='msg ok';
    m.textContent='Centre et directeur créés avec succès.';

    setTimeout(()=>{
      $('dz').close();
    },700);

    return;
  }

  /*
   * MODIFICATION D'UN CENTRE EXISTANT
   *
   * On conserve le fonctionnement actuel.
   */
  const r=await sb
    .from('centres')
    .update(p)
    .eq('id',ZID)
    .select('id');

  if(b)b.disabled=false;

  if(r.error)
    return ko(
      r.error.message.includes('duplicate')
        ? 'Ce slug est déjà utilisé.'
        : 'Erreur : '+r.error.message
    );

  if(!(r.data||[]).length)
    return ko('Enregistrement refusé.');

  await loadCentres();

  m.className='msg ok';
  m.textContent='Centre modifié.';

  setTimeout(()=>{
    $('dz').close();
  },700);
};
// $('zty').onchange = function(){

//   const plan = this.value;

//   if(!plan) return;

//   const start = new Date();

//   $('zd1').value = iso(start);

//   const end = new Date(start);

//   end.setFullYear(end.getFullYear() + 1);

//   $('zd2').value = iso(end);

//   // Lorsqu'un plan annuel est choisi,
//   // on considère l'abonnement comme actif.
//   $('zst').value = 'ACTIF';
// };

// $('zst').onchange = function(){

//   const statut = this.value;

//   if(statut === 'TRIAL'){

//     const start = new Date();

//     $('zd1').value = iso(start);

//     const end = new Date(start);

//     end.setDate(end.getDate() + 14);

//     $('zd2').value = iso(end);

//     return;
//   }


//   if(statut === 'ACTIF' && $('zty').value){

//     const start = new Date();

//     $('zd1').value = iso(start);

//     const end = new Date(start);

//     end.setFullYear(end.getFullYear() + 1);

//     $('zd2').value = iso(end);
//   }

// };

// $('zt').onclick=async e=>{const ed=e.target.closest('[data-zed]'),tg=e.target.closest('[data-ztg]');if(!me||!me.sup)return;
//   if(ed)return openCentre(CEN.find(c=>c.id==ed.dataset.zed));
//   if(tg){const c=CEN.find(x=>x.id==tg.dataset.ztg);if(!c)return;
//     if(!confirm(c.actif?`Suspendre « ${c.nom} » ? Ses utilisateurs (hors super administrateur) perdront l'accès.`:`Réactiver « ${c.nom} » ?`))return;
//     const r=await sb.from('centres').update({actif:!c.actif}).eq('id',c.id).select('id');
//     if(r.error||!(r.data||[]).length){alert('Modification refusée'+(r.error?' : '+r.error.message:'.'));return}
//     loadCentres()}};
// $('zn').oninput=()=>{if(!ZID&&!$('zs').dataset.t)$('zs').value=norm($('zn').value).replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,40)};
// $('zs').oninput=()=>{$('zs').dataset.t='1'};
// $('zf').onsubmit=async e=>{e.preventDefault();const m=$('zm'),b=e.submitter,
// ko=x=>{m.className='msg ko';m.textContent=x},
//   nom=$('zn').value.trim(),slug=$('zs').value.trim().toLowerCase(),d1=$('zd1').value,d2=$('zd2').value;
//   if(!me||!me.sup)return ko('Action réservée au super administrateur.');
//   if(!nom)return ko('Saisissez le nom du centre.');
//   if(!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug))return
//    ko('Slug invalide : lettres minuscules, chiffres et tirets uniquement.');
//   if(CEN.some(c=>c.slug===slug&&c.id!==ZID))return ko('Ce slug est déjà utilisé.');
//   if(CENSUB&&d1&&d2&&d2<d1)return ko("La date d'expiration doit suivre la date de début.");
//   const p={nom,slug,actif:$('za').value==='1'};
//   if(CENSUB){
    
//   //   p.type_abonnement=$('zty').value.trim()||null;p.statut_abonnement=$('zst')
//   // .value.trim()||null;p.date_debut=d1||null;p.date_expiration=d2||null;
//   //   p.droits={};document.querySelectorAll('#zf [data-dr]')
//   //   .forEach(i=>p.droits[i.dataset.dr]=i.checked)
//    const plan = $('zty').value.trim().toUpperCase();

//   const rawStatus = $('zst').value.trim();

//   const statusMap = {
//     'Actif':'ACTIF',
//     'Essai':'TRIAL',
//     'Expiré':'EXPIRE',
//     'Expire':'EXPIRE',
//     'Suspendu':'SUSPENDU'
//   };

//   const statut = statusMap[rawStatus] || rawStatus.toUpperCase();

//   p.type_abonnement = plan || null;
//   p.statut_abonnement = statut || null;
//   p.date_debut = d1 || null;
//   p.date_expiration = d2 || null;

//   p.droits = {};

//   document.querySelectorAll('#zf [data-dr]').forEach(
//     i => p.droits[i.dataset.dr] = i.checked
//   );
  
//   }
//   if(b)b.disabled=true;
//   const r=ZID?await sb.from('centres').update(p).eq('id',ZID).select('id'):await sb.from('centres').insert(p).select('id');
//   if(b)b.disabled=false;
//   if(r.error)return ko(r.error.message.includes('duplicate')?'Ce slug est déjà utilisé.':'Erreur : '+r.error.message);
//   if(!(r.data||[]).length)return ko('Enregistrement refusé.');
//   await loadCentres();m.className='msg ok';m.textContent=ZID?'Centre modifié.':
//   'Centre ajouté. Son directeur se crée séparément.';setTimeout(()=>$('dz').close(),700)};





async function loadBandeau(){const el=$('cbar');

  if(me && me.sup){
    return;
  }
el.classList.add('hidden');
  try{if(!me||me.role!=='Admin')return;
    const pr=await sb.from('profiles').select('centre_id').eq('id',me.uid).maybeSingle(),cid=pr.data&&pr.data.centre_id;if(!cid)return;
    const c=(await sb.from('centres').select('*').eq('id',cid).maybeSingle()).data;if(!c)return;
    const j=c.date_expiration?Math.round((new Date(c.date_expiration+'T12:00')-new Date(iso(new Date())+'T12:00'))/864e5):null,
      jt=j===null?'':j<0?`<span class="st b" style="margin:0">Expiré depuis ${-j} j</span>`:j===0?`<span class="st b" style="margin:0">Expire aujourd'hui</span>`:`<span class="st ${j>30?'f':'b'}" style="margin:0">${j} jour${j>1?'s':''} restant${j>1?'s':''}</span>`;
    const any=c.type_abonnement||c.statut_abonnement||c.date_expiration;
    el.innerHTML=`<b>${esc(c.nom)}</b>`+(any?(c.type_abonnement?`<span>Abonnement : <b>${esc(c.type_abonnement)}</b></span>`:'')+(c.statut_abonnement?`<span>Statut : <b>${esc(c.statut_abonnement)}</b></span>`:'')+(c.date_expiration?`<span>Expiration : <b>${zfd(c.date_expiration)}</b></span>`+jt:''):'<span>Abonnement : non défini</span>');
    el.classList.remove('hidden')}catch(e){}}

/* ---------- Accès du directeur (SUPER_ADMIN) ---------- */
let ZUID=null;
async function zcall(body){
  const {data:{session}}=await sb.auth.getSession();

  if(!session)
    return {error:'Session expirée. Reconnectez-vous.'};

  const r=await sb.functions.invoke(
    'centre-director-access',
    {
      body,
      headers:{
        Authorization:'Bearer '+session.access_token
      }
    }
  );

  if(r.error){
    let m=r.error.message;
    try{
      const j=await r.error.context.json();
      m=j.error||j.message||m;
    }catch(e){}
    return {error:m};
  }

  return r.data&&r.data.error
    ? {error:r.data.error}
    : {data:r.data};
}
async function zdirLoad(c){const box=$('zdl');box.textContent='Chargement…';const r=await zcall({action:'list',centre_id:c.id});
  if(ZID!==c.id)return;
  if(r.error){box.textContent=r.error;return}
  box.innerHTML=r.data.directors.length?r.data.directors.map(d=>`<div style="margin-bottom:10px"><div>Directeur : <b>${esc(d.full_name||'—')}</b></div><div>E-mail : ${esc(d.email||'—')}</div><button type="button" class="btn ghost" data-zrp="${esc(d.user_id)}" style="margin-top:6px;padding:7px 12px">Réinitialiser le mot de passe</button></div>`).join(''):`<span style="color:var(--mute)">Aucun directeur n'est rattaché à ce centre.</span>`}
$('zdl').onclick=e=>{const b=e.target.closest('[data-zrp]');if(!b||!me||!me.sup)return;ZUID=b.dataset.zrp;$('zp1').value='';$('zp2').value='';$('zpm').textContent='';$('zpm').className='msg';$('dzp').showModal()};
$('zpf').onsubmit=async e=>{e.preventDefault();const m=$('zpm'),b=e.submitter,ko=x=>{m.className='msg ko';m.textContent=x},a=$('zp1').value;
  if(!me||!me.sup)return ko('Action réservée au super administrateur.');
  if(a.length<10)return ko('Le mot de passe doit contenir au moins 10 caractères.');
  if(a.length>72)return ko('Le mot de passe ne doit pas dépasser 72 caractères.');
  if(a!==$('zp2').value)return ko('Les deux mots de passe ne correspondent pas.');
  if(b)b.disabled=true;const r=await zcall({action:'reset',centre_id:ZID,user_id:ZUID,password:a});if(b)b.disabled=false;
  if(r.error)return ko(r.error);
  $('zp1').value='';$('zp2').value='';m.className='msg ok';m.textContent='Mot de passe réinitialisé. Le directeur devra en choisir un nouveau à sa prochaine connexion.';setTimeout(()=>$('dzp').close(),1400)};
function initForm(){initMod();
  $('tfs').innerHTML=Object.entries(POLE).map(([p,v])=>`<div style="margin:8px 0 4px;font-size:12px;color:var(--mute);font-weight:700">${v[0]}</div>`+Object.entries(S).filter(([,x])=>x[1]===p).map(([k,x])=>`<label class="cb"><input type="checkbox" value="${k}">${x[0]}</label>`).join('')).join('');
  const tv=Array.from({length:23},(_,i)=>H0+i*.5);
  opts($('fh'),tv.slice(0,22).map(h=>[h,fmt(h)]));opts($('fe'),tv.slice(1).map(h=>[h,fmt(h)]));
  $('fh').value=9;$('fe').value=11;
  $('fs').innerHTML='<option value="">Choisir une matière…</option>'+Object.entries(POLE).map(([p,v])=>`<optgroup label="${v[0]}">`+Object.entries(S).filter(([,x])=>x[1]===p).map(([k,x])=>`<option value="${k}">${x[0]}</option>`).join('')+'</optgroup>').join('');
  opts($('fsr'),[['','Automatique (première salle libre)'],...ROOMS.map(r=>[r,sn(r)+' · '+RI[r][0]+' · '+RI[r][1]+' pl.'])]);
  $('fd').value=new Date().toISOString().slice(0,10);
  fsOpts();
}
function trOpts(){
  const k=$('fs').value;
  const cur=$('ftr').value;

  opts(
    $('ftr'),
    [['','Automatique'],...T
      .map((t,i)=>[i,t.n])
      .filter(([i])=>!k||T[i].s.includes(k))]
  );

  if([...$('ftr').options].some(o=>o.value===cur))
    $('ftr').value=cur;
  else
    $('ftr').value='';
}

function trOpts(){
  const k = $('fs').value;
  const current = $('ftr').value;

  let list = T.map((t,i)=>[i,t.n]);

  // Si c'est un formateur connecté, uniquement lui-même
  if(me.role==='Formateur' && me.tid!==undefined){
    list = [[me.tid,T[me.tid].n]];
  }
  // Sinon, si une matière est choisie,
  // seulement les formateurs qui maîtrisent cette matière
  else if(k){
    list = list.filter(([i])=>T[i].s.includes(k));
  }

  opts($('ftr'),[['','Automatique'],...list]);

  if([...$('ftr').options].some(o=>o.value===current))
    $('ftr').value=current;
  else if(me.role==='Formateur' && me.tid!==undefined)
    $('ftr').value=me.tid;
  else
    $('ftr').value='';
}

$('fs').onchange=()=>{
  trOpts();
};

$('ftr').onchange=()=>{
  fsOpts();
};



function fsOpts(){
  const ti=$('ftr').value;
  const current=$('fs').value;

  let items=Object.entries(S);

  // Formateur sélectionné :
  // uniquement ses matières maîtrisées.
  if(ti!==''){
    const t=T[+ti];
    const allowed=t ? t.s : [];
    items=items.filter(([k])=>allowed.includes(k));
  }

  // Formateur connecté :
  // uniquement ses propres matières.
  if(me.role==='Formateur' && me.tid!==undefined){
    const t=T[me.tid];
    const allowed=t ? t.s : [];
    items=items.filter(([k])=>allowed.includes(k));
  }

  const html=Object.entries(POLE).map(([p,v])=>{
    const list=items.filter(([,x])=>x[1]===p);

    if(!list.length) return '';

    return `<optgroup label="${v[0]}">`+
      list.map(([k,x])=>`<option value="${k}">${x[0]}</option>`).join('')+
      `</optgroup>`;
  }).join('');

  $('fs').innerHTML='<option value="">Choisir une matière…</option>'+html;

  if([...$('fs').options].some(o=>o.value===current))
    $('fs').value=current;
  else
    $('fs').value='';

  trOpts();
}

$('af').onsubmit=async e=>{e.preventDefault();const m=$('am'),ko=t=>{m.className='msg ko';m.textContent=t};
  const k=$('fs').value,g=new Date($('fd').value+'T12:00').getDay(),d=(g+6)%7,st=+$('fh').value,en=+$('fe').value;
  if(!k)return ko('Choisissez une matière ou un module.');
  if(isNaN(g))return ko('Choisissez une date.');
  if(d>5)return ko('Le centre est fermé le dimanche. Choisissez un autre jour.');
  if(en<=st)return ko("L'heure de fin doit être après l'heure de début.");
  const c={id:EID||-1,d,s:st,e:en,k},rv=$('fsr').value,tv=me.role==='Formateur'?String(me.tid):$('ftr').value;
  if(rv){c.r=+rv;if(!free(c,'r',c.r))return ko(`Conflit : la salle ${c.r} est déjà occupée ${DAYS[d].toLowerCase()} entre ${fmt(st)} et ${fmt(en)}.`)}
  else{c.r=ROOMS.find(r=>free(c,'r',r));if(!c.r)return ko('Aucune salle libre sur ce créneau.')}
  if(tv!==''){c.t=+tv;if(!free(c,'t',c.t))return ko(`Conflit : ${T[c.t].n} a déjà un cours sur ce créneau.`)}
  else{c.t=T.findIndex((t,i)=>t.s.includes(k)&&free(c,'t',i));if(c.t<0)return ko('Aucun formateur disponible pour cette matière sur ce créneau.')}
  const row={matiere_id:MID[k],formateur_id:T[c.t].id,salle_id:SID[c.r],jour:d,debut:tt(st),fin:tt(en)};const dt=$('fd').value,wk2=$('fty').value==='w';if(!EID){row.valable_du=dt;row.valable_au=wk2?'2999-12-31':dt}else if(!wk2){row.valable_du=dt;row.valable_au=dt}else if(EONCE){row.valable_du=dt;row.valable_au='2999-12-31'}
  // const ins=EID?await sb.from('cours').update(row).eq('id',EID):await sb.from('cours').insert(row).select('id').single();
  const ins=EID
  ? await sb.from('cours').update(row).eq('id',EID)
  : await sb.from('cours').insert({...row,...ctr()}).select('id').single();
  if(ins.error)return ko(ins.error.code==='23P01'?'Conflit : ce créneau est déjà occupé (salle ou formateur).':'Erreur : '+ins.error.message);
  const cid=EID||(ins.data&&ins.data.id);
  if(cid){const want=[...document.querySelectorAll('#cst input:checked')].map(x=>+x.value),have=ENR.filter(n=>n.cours_id===cid).map(n=>n.etudiant_id),add=want.filter(x=>!have.includes(x)),del=have.filter(x=>!want.includes(x));
    if(add.length)await sb.from('inscriptions').insert(add.map(x=>({etudiant_id:x,cours_id:cid})));
    if(del.length)await sb.from('inscriptions').delete().eq('cours_id',cid).in('etudiant_id',del);
    await refreshEtu()}
  WK=monday(new Date($('fd').value+'T12:00'));await load();m.className='msg ok';
  m.textContent=`${EID?'Cours modifié':'Cours ajouté'} : ${S[k][0]}, ${new Date($('fd').value+'T12:00').toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'})}, ${fmt(st)}–${fmt(en)}, salle ${c.r}, ${T[c.t].n}.`;
  render();setTimeout(()=>$('dc').close(),500)};
document.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>{document.querySelectorAll('.tabs button').forEach(x=>x.classList.toggle('on',x===b));['vcal','vl','vr','vf','vh','vp','vs','vd','vc','vm','vq','vk','vi','vn','vz'].forEach(v=>$(v).classList.toggle('hidden',v!==b.dataset.v));$('tl').classList.toggle('hidden',['vr','vf','vh','vp','vs','vd','vc','vm','vq','vk','vi','vn','vz'].includes(b.dataset.v));$('fab').classList.toggle('mhide',b.dataset.v!=='vcal');if(b.dataset.v==='vh')loadHist();if(b.dataset.v==='vz')loadCentres();if(b.dataset.v==='vp')loadPres();if(b.dataset.v==='vs')loadEtu();if(b.dataset.v==='vd')loadDash();if(b.dataset.v==='vc')loadCert();if(b.dataset.v==='vk')loadDocs();if(b.dataset.v==='vi')loadDem();if(b.dataset.v==='vn')loadMyStu();if(b.dataset.v==='vm')renderMine();if(b.dataset.v==='vq')renderMyPres();scrollTo(0,0)});

/* ---------- Connexion à Supabase ---------- */
const hh=t=>{const [a,b]=t.split(':');return +a+ +b/60},tt=h=>String(Math.floor(h)).padStart(2,'0')+':'+(h%1?'30':'00');
let MID={},CODE={},SID={},RN={},DID={},RNM={};const POLEK={'Langues':'lang','Bureautique':'bur','Data & IT':'data','Mathématiques':'math'};
// async function load(){
  
//   const q=await Promise.all([sb.from('matieres').select('id,code,nom,icone,domaine_id'),sb.from('salles').select('id,nom,type,capacite').order('nom'),sb.from('formateurs').select('id,nom,profile_id,email').order('id'),sb.from('formateur_matieres').select('formateur_id,matiere_id'),sb.from('cours').select('*'),sb.from('domaines').select('id,nom'),sb.from('annulations').select('cours_id,date'),sb.from('fermetures').select('*')]);
  
//   q.slice(0,6).forEach(x=>{if(x.error)throw x.error});
//   const [m,s,f,fm,c,dm,an,fe]=q.map(x=>x.data||[]);
//   MID={};CODE={};m.forEach(x=>{MID[x.code]=x.id;CODE[x.id]=x.code});
//   DID={};const DN={};dm.forEach(x=>{DID[x.nom]=x.id;DN[x.id]=x.nom});
//   Object.keys(S).forEach(k=>delete S[k]);m.forEach(x=>{S[x.code]=[x.nom,POLEK[DN[x.domaine_id]]||'lang',x.icone,null]});
//   SID={};RN={};RNM={};ROOMS.length=0;
//   s.forEach(x=>{let n=+x.nom.replace(/\D/g,'');const ch=!n||SID[n];if(ch){n=1000;while(SID[n])n++;RNM[n]=x.nom}SID[n]=x.id;RN[x.id]=n;ROOMS.push(n);RI[n]=[x.type,x.capacite]});
//   ROOMS.sort((a,b)=>a-b);
//   T.splice(0,T.length,...f.map(x=>({id:x.id,pid:x.profile_id,mail:x.email,n:x.nom,s:fm.filter(y=>y.formateur_id===x.id).map(y=>CODE[y.matiere_id])})));
//   RAW=c;ANN=new Set(an.map(x=>x.cours_id+'|'+x.date));FERM={};fe.forEach(x=>{FERM[x.date]=x.libelle||'Fermé'});buildWeek();
// }
async function load(){

  const cq=(table,columns)=>{
    let q=sb.from(table).select(columns);

    if(CURRENT_CENTRE_ID){
      q=q.eq('centre_id',CURRENT_CENTRE_ID);
    }

    return q;
  };

  const q=await Promise.all([

    sb.from('matieres')
      .select('id,code,nom,icone,domaine_id'),

    cq('salles','id,nom,type,capacite')
      .order('nom'),

    cq('formateurs','id,nom,profile_id,email')
      .order('id'),

    sb.from('formateur_matieres')
      .select('formateur_id,matiere_id'),

    cq('cours','*'),

    sb.from('domaines')
      .select('id,nom'),

    cq('annulations','cours_id,date'),

    cq('fermetures','*')

  ]);

  q.slice(0,6).forEach(x=>{
    if(x.error) throw x.error;
  });

  const [m,s,f,fm,c,dm,an,fe]=q.map(x=>x.data||[]);

  MID={};
  CODE={};

  m.forEach(x=>{
    MID[x.code]=x.id;
    CODE[x.id]=x.code;
  });

  DID={};

  const DN={};

  dm.forEach(x=>{
    DID[x.nom]=x.id;
    DN[x.id]=x.nom;
  });

  Object.keys(S).forEach(k=>delete S[k]);

  m.forEach(x=>{
    S[x.code]=[
      x.nom,
      POLEK[DN[x.domaine_id]]||'lang',
      x.icone,
      null
    ];
  });

  SID={};
  RN={};
  RNM={};
  ROOMS.length=0;

  s.forEach(x=>{
    let n=+x.nom.replace(/\D/g,'');

    const ch=!n||SID[n];

    if(ch){
      n=1000;
      while(SID[n]) n++;
      RNM[n]=x.nom;
    }

    SID[n]=x.id;
    RN[x.id]=n;
    ROOMS.push(n);
    RI[n]=[x.type,x.capacite];
  });

  ROOMS.sort((a,b)=>a-b);

  T.splice(
    0,
    T.length,
    ...f.map(x=>({
      id:x.id,
      pid:x.profile_id,
      mail:x.email,
      n:x.nom,
      s:fm
        .filter(y=>y.formateur_id===x.id)
        .map(y=>CODE[y.matiere_id])
    }))
  );

  RAW=c;

  ANN=new Set(
    an.map(x=>x.cours_id+'|'+x.date)
  );

  FERM={};

  fe.forEach(x=>{
    FERM[x.date]=x.libelle||'Fermé';
  });

  buildWeek();
}
function renderSuperCentreSelector(){

  const el = $('cbar');

  if(!el) return;

  if(!me || !me.sup){
    el.classList.add('hidden');
    return;
  }

  if(!SUPER_CENTRES || !SUPER_CENTRES.length){
    el.innerHTML = '<b>Centre actif :</b> Aucun centre disponible';
    el.classList.remove('hidden');
    return;
  }

  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
      <b>Centre actif :</b>

      <select id="superCentreSelect"
              style="width:auto;min-width:220px;padding:6px 10px;">
        ${SUPER_CENTRES.map(c => `
          <option value="${esc(c.id)}"
            ${c.id === CURRENT_CENTRE_ID ? 'selected' : ''}>
            ${esc(c.nom)}
          </option>
        `).join('')}
      </select>
    </div>
  `;

  el.classList.remove('hidden');

  const select = $('superCentreSelect');

  if(!select) return;

  select.onchange = async function(){

    const centre = SUPER_CENTRES.find(
      c => c.id === this.value
    );

    if(!centre) return;

    CURRENT_CENTRE_ID = centre.id;
    CURRENT_CENTRE_NAME = centre.nom;

    localStorage.setItem(
      'schoolplans_current_centre',
      centre.id
    );

    await load();
    const activeTab = document.querySelector('.tabs button.on');
    
if(activeTab){

  const v = activeTab.dataset.v;

  if(v === 'vs') await loadEtu();
  if(v === 'vp') await loadPres();
  if(v === 'vc') await loadCert();
  if(v === 'vk') await loadDocs();
  if(v === 'vd') await loadDash();
  if(v === 'vi') await loadDem();
}

refreshBadge();

    render();
  };
}


async function enter(session){
  try{
    
    const u=session.user,
      p=(await sb.from('profiles')
        .select('full_name,role,statut,centre_id')
        .eq('id',u.id)
        .maybeSingle()).data;
    if(p&&p.role!=='super_admin'){const cc=await sb.from('centres').select('actif').maybeSingle();if(cc.data&&cc.data.actif===false){await sb.auth.signOut();me=null;show('login');$('err').textContent="Ce centre est suspendu. Contactez l'administration.";return}}
    if(p&&p.role==='etudiant'&&p.statut==='en_attente'){await pendingFlow(session);return}
    if(u.user_metadata&&u.user_metadata.must_change)await forcePw();
    // await load();
    if(p&&p.role==='admin'&&!isPwd(session)){await sb.auth.signOut();me=null;show('login');$('err').textContent="Le compte administrateur ne peut pas se connecter avec Google. Utilisez l'e-mail et le mot de passe.";return}
    
    const role={
      admin:'Admin',
      director:'Admin',
      super_admin:'Admin',
      formateur:'Formateur',
      etudiant:'Étudiant'
    }[p&&p.role]||'Étudiant';

    me={role,
      name:(p&&p.full_name)||u.email,
      uid:u.id,
      sup:!!(p&&p.role==='super_admin'),
      centreId:p&&p.centre_id?p.centre_id:null
    };
  
    /* Centre courant */
if(me.sup){

  const cr=await sb
    .from('centres')
    .select('id,nom,actif')
    .eq('actif',true)
    .order('nom');

  SUPER_CENTRES=cr.data||[];

  const savedCentre=localStorage.getItem('schoolplans_current_centre');

  let selected=SUPER_CENTRES.find(c=>c.id===savedCentre);

  if(!selected){
    selected=SUPER_CENTRES[0]||null;
  }

  if(selected){
    CURRENT_CENTRE_ID=selected.id;
    CURRENT_CENTRE_NAME=selected.nom;
    localStorage.setItem('schoolplans_current_centre',selected.id);
  }else{
    CURRENT_CENTRE_ID=null;
    CURRENT_CENTRE_NAME='';
  }

}else{

  CURRENT_CENTRE_ID=me.centreId||null;

  const cc=SUPER_CENTRES.find(c=>c.id===CURRENT_CENTRE_ID);

  CURRENT_CENTRE_NAME=cc?cc.nom:'';

}

/* Maintenant seulement on charge les données */

await load();
    const lk='lg'+u.id;if(!sessionStorage.getItem(lk)){sessionStorage.setItem(lk,'1');sb.from('connexions').insert({user_id:u.id,email:u.email,full_name:me.name,role:(p&&p.role)||'etudiant',methode:isPwd(session)?'E-mail':'Google'}).then(()=>{})}
    let lien=true;ENRSET=new Set();MYPRES=[];ME_STU=null;
    if(role==='Étudiant'){const q=await Promise.all([sb.from('etudiants').select('id').limit(1),sb.from('inscriptions').select('cours_id'),sb.from('presences').select('*')]);ME_STU=(q[0].data||[])[0]||null;ENRSET=new Set((q[1].data||[]).map(x=>x.cours_id));MYPRES=q[2].data||[]}else{await refreshEtu()}
    if(role==='Formateur'){
      me.tid=T.findIndex(t=>t.pid===u.id||(t.mail&&u.email&&t.mail
      .toLowerCase()===u.email.toLowerCase()));
      if(me.tid<0){lien=false;me.tid=undefined;C=[]

      }}
      await loadCentreDroits();
    show('app');
    start();
    studentNote();
    loadBandeau();
    
    if(me.sup){
  renderSuperCentreSelector();
}

if(role==='Admin'){refreshBadge();clearInterval(BT);BT=setInterval(refreshBadge,60000)}
    if(!lien)$('wr').textContent='Formateur (compte pas encore lié à une fiche)';
  }catch(err){show('login');$('err').textContent='Erreur de chargement : '+(err.message||err)}
}
$('lf').onsubmit=async e=>{e.preventDefault();
  const r=await sb.auth.signInWithPassword({email:$('u').value.trim(),password:$('p').value});
  if(r.error){$('err').textContent=/invalid/i.test(r.error.message)?'Adresse e-mail ou mot de passe incorrect.':r.error.message;return}
  $('err').textContent='';enter(r.data.session)};
$('su').onclick=async()=>{const em=$('u').value.trim(),pw=$('p').value;
  if(!em||pw.length<6){$('err').textContent='Saisissez un e-mail et un mot de passe de 6 caractères minimum.';return}
  const r=await sb.auth.signUp({email:em,password:pw,options:{emailRedirectTo:location.origin+location.pathname}});
  if(r.error){$('err').textContent=r.error.message;return}
  if(r.data.session)enter(r.data.session);else $('err').textContent='Compte créé. Vérifiez votre boîte e-mail pour le confirmer, puis connectez-vous.'};
$('gb').onclick=()=>sb.auth.signInWithOAuth({
  provider:'google',
  options:{
    redirectTo:location.origin+location.pathname,
    queryParams:{
      prompt:'select_account'
    }
  }
});
sb.auth.getSession().then(({data})=>{if(data.session)enter(data.session)});
sb.auth.onAuthStateChange((ev)=>{if(ev==='SIGNED_OUT'&&me){me=null;show('landing')}});

/* ---------- Nouveautés v2 ---------- */
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const amr=s=>{try{return JSON.parse(atob(s.access_token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).amr||[]}catch(e){return[]}};
const isPwd=s=>amr(s).some(a=>a.method==='password');
let EID=0,AD=Math.min((new Date().getDay()+6)%7,5);
const dOf=d=>{const n=new Date(),cur=(n.getDay()+6)%7,dd=d===undefined?(cur>5?0:cur):d;n.setDate(n.getDate()+((dd-cur+7)%7));return n.toLocaleDateString('sv-SE')};
function openCours(o){
  o=o||{};

  if(me.role==='Formateur' && me.tid===undefined){
    alert("Votre compte n'est pas encore relié à une fiche formateur. Contactez l'administration.");
    return;
  }

  if(me.role==='Formateur' && o.id && o.t!==me.tid)
    return;

  EID=o.id||0;

  $('dct').textContent=EID?'Modifier le cours':'Ajouter un cours';

  // Formateur
  $('ftr').disabled=me.role==='Formateur';

  if(me.role==='Formateur'){
    $('ftr').value=me.tid;
  }else{
    $('ftr').value=(o.t!==undefined && o.t>=0)?o.t:'';
  }

  // Matière
  $('fs').value=o.k||'';

  // Recalcul bidirectionnel
  fsOpts();

  $('fd').value=o.date||dOf(o.d);
  $('fty').value=o.once?'o':'w';
  EONCE=!!o.once;
  ECDATE=o.date||'';

  $('fcan').classList.toggle('hidden',!(EID&&!o.once));

  $('fh').value=o.s||9;
  $('fe').value=o.e||(o.s?Math.min(o.s+2,19):11);
  $('fsr').value=o.r||'';

  $('cst').innerHTML=ETU.length
    ?ETU.map(x=>
      `<label class="cb">
        <input type="checkbox" value="${x.id}"${
          EID&&ENR.some(n=>n.cours_id===EID&&n.etudiant_id===x.id)
          ?' checked':''
        }>
        ${esc(stuName(x))}
      </label>`
    ).join('')
    :'<span class="m">Aucun étudiant enregistré pour le moment.</span>';

  $('fdel').classList.toggle('hidden',!EID);
  $('am').textContent='';

  $('dc').showModal();
}


$('fdel').onclick=async()=>{if(!EID||!confirm('Supprimer ce cours ?'))return;await sb.from('cours').delete().eq('id',EID);await load();render();$('dc').close()};
$('bc').onclick=()=>openCours({d:AD,date:wdate(AD),r:+$('fr').value||undefined});
$('fab').onclick=()=>openCours({d:AD,date:wdate(AD)});
$('bm').onclick=()=>{$('mm').textContent='';$('mn').value='';$('dm').showModal()};
$('bf').onclick=()=>{$('tm').textContent='';$('dtf').showModal()};
document.addEventListener('click',e=>{const b=e.target.closest('[data-close]');if(b)b.closest('dialog').close()});
function initMod(){opts($('md'),Object.values(POLE).map(v=>[v[0],v[0]]));
  $('mi').innerHTML=['book','globe','msg','sheet','doc','code','db','chart','cpu','calc','pen','cube'].map((k,i)=>`<label class="cb"><input type="radio" name="mic" value="${k}"${i?'':' checked'}>${ic(k)}</label>`).join('')}
$('mf').onsubmit=async e=>{e.preventDefault();const m=$('mm'),ko=t=>{m.className='msg ko';m.textContent=t},n=$('mn').value.trim(),ik=document.querySelector('#mi input:checked');
  if(!n)return ko('Saisissez le nom du module.');
  if(Object.values(S).some(x=>norm(x[0])===norm(n)))return ko('Ce module existe déjà.');
  const code=norm(n).replace(/[^a-z0-9]+/g,'-').slice(0,14)+'-'+Math.random().toString(36).slice(2,5);
  const r=await sb.from('matieres').insert({code,nom:n,domaine_id:DID[$('md').value],icone:ik?ik.value:'book'});
  if(r.error)return ko('Erreur : '+r.error.message);
  await load();initForm();render();m.className='msg ok';m.textContent=`Module ajouté : ${n}.`;setTimeout(()=>$('dm').close(),600)};
function renderAgenda(L){
  const ch=DAYS.map((d,i)=>`<button class="dchip${i===AD?' on':''}" data-ad="${i}">${d.slice(0,3)} ${wdate(i).slice(8)}</button>`).join('');
  const R=L.filter(c=>c.d===AD).sort((a,b)=>a.s-b.s);
  $('agenda').innerHTML=`<div class="dchips">${ch}</div>`+(R.length?R.map(c=>{const s=S[c.k];return `<div class="ag" data-id="${c.id}" style="--c:var(${POLE[s[1]][1]})"><div class="agt">${fmt(c.s)}<small>${fmt(c.e)}</small></div><div><div class="t">${ic(s[2])}<span>${s[0]}</span></div><small>${T[c.t]?T[c.t].n:''} · ${sn(c.r)}</small></div></div>`}).join(''):`<div class="empty">Aucun cours ${DAYS[AD].toLowerCase()}.${me&&me.role==='Admin'?' Touchez + pour en ajouter un.':''}</div>`)}
$('agenda').onclick=e=>{const b=e.target.closest('[data-ad]');if(b){AD=+b.dataset.ad;render();return}const a=e.target.closest('.ag');if(a&&(me.role==='Admin'||me.role==='Formateur'))openCours(C.find(c=>c.id==a.dataset.id))};
$('rooms').onclick=e=>{const b=e.target.closest('[data-see]');
  if(b){$('fr').value=b.dataset.see;document.querySelector('[data-v="vcal"]').click();render();return}
  const i=e.target.closest('i[data-r]');if(!i||!me||(me.role!=='Admin'&&me.role!=='Formateur'))return;
  if(i.dataset.id)openCours(C.find(c=>c.id==i.dataset.id));else{const h=+i.dataset.h;openCours({d:+i.dataset.d,date:wdate(+i.dataset.d),s:h,e:Math.min(h+2,19),r:+i.dataset.r})}};
async function loadHist(){let q=sb.from('connexions').select('*').order('created_at',{ascending:false}).limit(200);if($('hr').value)q=q.eq('role',$('hr').value);
  const {data,error}=await q;
  $('ht').innerHTML='<thead><tr><th>Date</th><th>Utilisateur</th><th>Profil</th><th>Méthode</th></tr></thead><tbody>'+(error?`<tr><td colspan="4">Erreur : ${esc(error.message)}</td></tr>`:data.length?data.map(x=>`<tr><td>${new Date(x.created_at).toLocaleString('fr-FR')}</td><td>${esc(x.full_name)}<br><small style="color:var(--mute)">${esc(x.email)}</small></td><td><span class="dm" style="--c:var(--brand)">${esc(x.role)}</span></td><td>${esc(x.methode)}</td></tr>`).join(''):'<tr><td colspan="4" style="color:var(--mute)">Aucune connexion enregistrée pour le moment.</td></tr>')+'</tbody>'}
$('hr').onchange=$('hre').onclick=loadHist;
$('home').onclick=$('home2').onclick=()=>show('landing');
$('home').onkeydown=e=>{if(e.key==='Enter')show('landing')};
const io=new IntersectionObserver(es=>es.forEach(x=>{if(x.isIntersecting){x.target.classList.add('in');io.unobserve(x.target)}}),{threshold:.12});
document.querySelectorAll('.rv').forEach(el=>io.observe(el));
addEventListener('scroll',()=>$('lpn').classList.toggle('sc',scrollY>40),{passive:true});

/* ---------- Calendrier daté, jours fermés, étudiants, présences ---------- */
let RAW=[],ANN=new Set(),FERM={},XC=[],ETU=[],ENR=[],PR=[],EONCE=false,ECDATE='';
const iso=d=>d.toLocaleDateString('sv-SE');
const monday=d=>{const x=new Date(d);x.setHours(12,0,0,0);x.setDate(x.getDate()-((x.getDay()+6)%7));return x};
const addD=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x};
let WK=monday(new Date());
const wdate=i=>iso(addD(WK,i));
function buildWeek(){C=[];XC=[];
  RAW.forEach(r=>{const i=r.jour,ds=wdate(i);if(i>5||FERM[ds]||ds<r.valable_du||ds>r.valable_au)return;
    const o={id:r.id,d:i,s:hh(r.debut),e:hh(r.fin),k:CODE[r.matiere_id],t:T.findIndex(t=>t.id===r.formateur_id),r:RN[r.salle_id],date:ds,once:!!r.valable_du&&r.valable_du===r.valable_au};
    if(ANN.has(r.id+'|'+ds)){o.x=1;XC.push(o)}else C.push(o)});
  if(me&&me.role==='Formateur'&&me.tid===undefined){C=[];XC=[]}}
function wkLabel(){const b=addD(WK,5),f=d=>d.toLocaleDateString('fr-FR',{day:'numeric',month:'long'});$('wl').textContent='Semaine du '+f(WK)+' au '+f(b)+' '+b.getFullYear()}
$('wp').onclick=()=>{WK=addD(WK,-7);buildWeek();render()};
$('wnx').onclick=()=>{WK=addD(WK,7);buildWeek();render()};
$('wt').onclick=()=>{WK=monday(new Date());buildWeek();render()};
$('fcan').onclick=async()=>{if(!EID||!ECDATE||!confirm('Annuler la séance du '+ECDATE.split('-').reverse().join('/')+' ?'))return;
  // const r=await sb.from('annulations').insert({cours_id:EID,date:ECDATE});
  const r=await sb.from('annulations').insert({
  cours_id:EID,
  date:ECDATE,
  ...ctr()
});
  if(r.error){$('am').className='msg ko';$('am').textContent='Erreur : '+r.error.message;return}
  await load();render();$('dc').close()};
/* jours fermés */
function renderFer(){const ks=Object.keys(FERM).sort();
  $('fl').innerHTML=ks.length?ks.map(k=>`<div class="pr2"><span><b>${k.split('-').reverse().join('/')}</b> · ${esc(FERM[k])}</span><button class="btn ghost" data-fd="${k}" style="padding:4px 10px" aria-label="Retirer">✕</button></div>`).join(''):'<div class="empty">Aucun jour fermé.</div>'}
$('bx').onclick=()=>{$('fm2').textContent='';renderFer();$('dfe').showModal()};
$('ff').onsubmit=async e=>{e.preventDefault();const m=$('fm2');
  // const r=await sb.from('fermetures').upsert({date:$('fdt').value,libelle:$('flb').value.trim()||'Fermé'});
const r=await sb.from('fermetures').upsert({
  date:$('fdt').value,
  libelle:$('flb').value.trim()||'Fermé',
  ...ctr()
},{onConflict:'centre_id,date'});
  if(r.error){m.className='msg ko';m.textContent='Erreur : '+r.error.message;return}
  $('fdt').value='';$('flb').value='';await load();render();renderFer();m.className='msg ok';m.textContent='Jour fermé ajouté.'};
$('fl').onclick=async e=>{const b=e.target.closest('[data-fd]');if(!b)return;await sb.from('fermetures').delete().eq('date',b.dataset.fd);await load();render();renderFer()};
/* étudiants */
let ESID=0;const NIV=['Maternelle','Primaire','Collège','Lycée','Supérieur','Cadre / Salarié','Autre'];
const stuName=x=>((x.prenom||'')+' '+(x.nom||'')).trim();
const crsLabel=r=>{const s=S[CODE[r.matiere_id]]||['?'],tr=T.find(t=>t.id===r.formateur_id),once=r.valable_du&&r.valable_du===r.valable_au;
  return s[0]+' · '+(once?r.valable_du.split('-').reverse().join('/'):DAYS[r.jour])+' '+fmt(hh(r.debut))+'–'+fmt(hh(r.fin))+(tr?' · '+tr.n:'')};
async function loadEtu(){
  let qe = sb
    .from('etudiants')
    .select('*')
    .order('nom');

  let qi = sb
    .from('inscriptions')
    .select('*');

  if(CURRENT_CENTRE_ID){
    qe = qe.eq('centre_id',CURRENT_CENTRE_ID);
    qi = qi.eq('centre_id',CURRENT_CENTRE_ID);
  }

  const q = await Promise.all([qe,qi]);
  ETU=q[0].data||[];ENR=q[1].data||[];renderEtu(q[0].error?q[0].error.message:'')}
function renderEtu(err){const f=norm($('sq').value||''),L=ETU.filter(x=>!f||norm([x.prenom,x.nom,x.email,x.ville,x.telephone,x.adresse].join(' ')).includes(f));
  $('et').innerHTML='<thead><tr><th>Étudiant</th><th>Téléphone</th><th>E-mail</th><th>Ville</th><th>Cours inscrits</th></tr></thead><tbody>'+(err?`<tr><td colspan="5">Erreur : ${esc(err)}</td></tr>`:L.length?L.map(x=>{
    const cs=ENR.filter(n=>n.etudiant_id===x.id).map(n=>RAW.find(r=>r.id===n.cours_id)).filter(Boolean);
    return `<tr data-es="${x.id}" style="cursor:pointer"><td><b>${esc(stuName(x))}</b></td><td>${esc(x.telephone)}</td><td>${esc(x.email)}</td><td>${esc(x.ville)}</td><td>${cs.length?cs.map(r=>{const s=S[CODE[r.matiere_id]]||['?','lang'];return `<span class="dm" style="--c:var(${POLE[s[1]][1]});margin:0 4px 4px 0">${esc(s[0])}</span>`}).join(''):'<span style="color:var(--mute)">Aucun</span>'}</td></tr>`}).join(''):'<tr><td colspan="5" style="color:var(--mute)">Aucun étudiant pour le moment.</td></tr>')+'</tbody>'}
function openStu(x){ESID=x?x.id:0;$('stt').textContent=x?'Modifier l\'étudiant':'Ajouter un étudiant';
  $('ep').value=x&&x.prenom||'';$('en').value=x&&x.nom||'';$('et2').value=x&&x.telephone||'';$('ee').value=x&&x.email||'';$('ev').value=x&&x.ville||'';$('ea').value=x&&x.adresse||'';opts($('eniv'),[['','-'],...NIV.map(v=>[v,v])]);$('eniv').value=x&&x.niveau_etudes||'';
  $('ec').innerHTML=RAW.length?RAW.slice().sort((a,b)=>a.jour-b.jour||(a.debut<b.debut?-1:1)).map(r=>`<label class="cb"><input type="checkbox" value="${r.id}"${ESID&&ENR.some(n=>n.etudiant_id===ESID&&n.cours_id===r.id)?' checked':''}>${esc(crsLabel(r))}</label>`).join(''):'<span class="m">Aucun cours n\'est encore créé.</span>';
  $('edel').classList.toggle('hidden',!ESID);$('eacc').classList.toggle('hidden',!(x&&x.email));$('em').textContent='';$('dstu').showModal()}
$('sadd').onclick=()=>openStu(null);
$('sq').oninput=()=>renderEtu('');
$('et').onclick=e=>{const tr=e.target.closest('[data-es]');if(tr)openStu(ETU.find(x=>x.id==tr.dataset.es))};
$('ef').onsubmit=async e=>{e.preventDefault();const m=$('em'),ko=t=>{m.className='msg ko';m.textContent=t},ee=er=>er.code==='23505'?'Cet e-mail existe déjà.':'Erreur : '+er.message;
  const row={prenom:$('ep').value.trim(),nom:$('en').value.trim(),telephone:$('et2').value.trim()||null,email:$('ee').value.trim()||null,ville:$('ev').value.trim()||null,adresse:$('ea').value.trim()||null,niveau_etudes:$('eniv').value||null};
  if(!row.prenom||!row.nom)return ko('Le prénom et le nom sont obligatoires.');
  let id=ESID;
  if(id){const r=await sb.from('etudiants').update(row).eq('id',id);if(r.error)return ko(ee(r.error))}
  else{const r=await sb.from('etudiants').insert({...row,...ctr()}).select('id').single();if(r.error)return ko(ee(r.error));id=r.data.id}
  const want=[...document.querySelectorAll('#ec input:checked')].map(x=>+x.value),have=ENR.filter(n=>n.etudiant_id===id).map(n=>n.cours_id);
  const add=want.filter(c=>!have.includes(c)),del=have.filter(c=>!want.includes(c));
  if(add.length){const r=await sb.from('inscriptions').insert(add.map(c=>({etudiant_id:id,cours_id:c,...ctr()})));if(r.error)return ko('Erreur : '+r.error.message)}
  if(del.length){const r=await sb.from('inscriptions').delete().eq('etudiant_id',id).in('cours_id',del);if(r.error)return ko('Erreur : '+r.error.message)}
  await loadEtu();m.className='msg ok';m.textContent='Étudiant enregistré.';setTimeout(()=>$('dstu').close(),500)};
$('edel').onclick=async()=>{if(!ESID||!confirm('Supprimer cet étudiant et ses présences ?'))return;await sb.from('etudiants').delete().eq('id',ESID);await loadEtu();$('dstu').close()};
/* présences */
const ST={present:'Présent',retard:'Retard',absent:'Absent'};
const occOn=ds=>{const i=(new Date(ds+'T12:00').getDay()+6)%7;if(i>5||FERM[ds])return[];
  return RAW.filter(r=>r.jour===i&&ds>=r.valable_du&&ds<=r.valable_au&&!ANN.has(r.id+'|'+ds)&&(!me||me.role!=='Formateur'||(me.tid!==undefined&&T[me.tid]&&T[me.tid].id===r.formateur_id))).sort((a,b)=>a.debut<b.debut?-1:1)};
async function loadPres(){
  // if(!$('pd').value)$('pd').value=iso(new Date());const ds=$('pd').value;
  // const q=await Promise.all([sb.from(etuSrc()).select('*').order('nom'),sb.from('inscriptions').select('*'),sb.from('presences').select('*').eq('date',ds)]);
  // ETU=q[0].data||[];ENR=q[1].data||[];PR=q[2].data||[];renderPres(q.find(x=>x.error))
  if(!$('pd').value)$('pd').value=iso(new Date());

  const ds=$('pd').value;

  let qe = sb
    .from(etuSrc())
    .select('*')
    .order('nom');

  let qi = sb
    .from('inscriptions')
    .select('*');

  let qp = sb
    .from('presences')
    .select('*')
    .eq('date',ds);

  if(CURRENT_CENTRE_ID){

    qe = qe.eq('centre_id',CURRENT_CENTRE_ID);

    qi = qi.eq('centre_id',CURRENT_CENTRE_ID);

    qp = qp.eq('centre_id',CURRENT_CENTRE_ID);

  }

  const q = await Promise.all([
    qe,
    qi,
    qp
  ]);

  ETU = q[0].data || [];
  ENR = q[1].data || [];
  PR  = q[2].data || [];

  renderPres(q.find(x=>x.error));  
}
function renderPres(err){const ds=$('pd').value,R=occOn(ds),adm=me&&me.role==='Admin';
  if(err){$('pl').innerHTML=`<div class="empty">Erreur : ${esc(err.error.message)}. Le script SQL « présences » a-t-il été lancé ?</div>`;return}
  $('pl').innerHTML=R.length?'<div class="rooms">'+R.map(r=>{const s=S[CODE[r.matiere_id]]||['?','lang','book'],ins=ENR.filter(x=>x.cours_id===r.id).map(x=>ETU.find(e=>e.id===x.etudiant_id)).filter(Boolean);
    const stt=e=>{const q=PR.find(p=>p.cours_id===r.id&&p.etudiant_id===e.id);return q?q.statut:''};
    const here=ins.filter(e=>stt(e)==='present'||stt(e)==='retard').length,libres=ETU.filter(e=>!ins.some(i=>i.id===e.id));
    return `<div class="rc"><h4><span style="display:flex;align-items:center;gap:8px;color:var(${POLE[s[1]][1]})">${ic(s[2])}<span style="color:var(--ink)">${esc(s[0])}</span></span><span class="st ${ins.length&&here===ins.length?'f':'c'}" style="margin:0">${here} / ${ins.length} présents</span></h4><div class="m">${fmt(hh(r.debut))} – ${fmt(hh(r.fin))} · ${sn(RN[r.salle_id])} · ${esc((T.find(t=>t.id===r.formateur_id)||{}).n||'')}</div>`+
    (ins.length?ins.map(e=>`<div class="pr2"><span>${esc(stuName(e))}</span><span class="sg">${Object.keys(ST).map(v=>`<button data-c="${r.id}" data-e="${e.id}" data-s="${v}" class="${stt(e)===v?'on':''}">${ST[v]}</button>`).join('')}${adm?`<button class="x2" data-un="${r.id}|${e.id}" aria-label="Retirer de ce cours">✕</button>`:''}</span></div>`).join(''):'<div class="m">Aucun étudiant inscrit à ce cours.</div>')+
    (adm?`<select data-add="${r.id}" style="margin-top:10px"><option value="">Inscrire un étudiant…</option>${libres.map(e=>`<option value="${e.id}">${esc(stuName(e))}</option>`).join('')}</select>`:'')+'</div>'}).join('')+'</div>':`<div class="empty">Aucun cours ce jour-là${FERM[ds]?' ('+esc(FERM[ds])+')':''}.</div>`}
$('pd').onchange=loadPres;
$('pl').onclick=async e=>{const b=e.target.closest('[data-s]');
  if(b){const row={cours_id:+b.dataset.c,date:$('pd').value,etudiant_id:+b.dataset.e,statut:b.dataset.s,...ctr()};
    const r=await sb.from('presences').upsert(row,{onConflict:'cours_id,date,etudiant_id'});
    if(r.error){alert('Erreur : '+r.error.message);return}
    PR=PR.filter(p=>!(p.cours_id===row.cours_id&&p.etudiant_id===row.etudiant_id));PR.push(row);renderPres();return}
  const u=e.target.closest('[data-un]');
  if(u){const a=u.dataset.un.split('|');await sb.from('inscriptions').delete().eq('cours_id',a[0]).eq('etudiant_id',a[1]);ENR=ENR.filter(x=>!(x.cours_id==a[0]&&x.etudiant_id==a[1]));renderPres()}};
$('pl').onchange=async e=>{const s=e.target.closest('[data-add]');if(!s||!s.value)return;
  const r=await sb.from('inscriptions').insert({cours_id:+s.dataset.add,etudiant_id:+s.value,...ctr()});
  if(r.error){alert('Erreur : '+r.error.message);return}ENR.push({cours_id:+s.dataset.add,etudiant_id:+s.value});renderPres()};

/* ---------- Tableau de bord ---------- */
let DPA=[],DERR=null,DDM=[],SDM='line',SDP='m';




function renderDashFormateur(){

  const formateurId =
    me &&
    me.tid!==undefined &&
    T[me.tid]
      ? T[me.tid].id
      : null;

  if(!formateurId){
    $('kp').innerHTML='<div class="empty">Votre compte formateur n’est pas encore lié à une fiche formateur.</div>';
    $('sdc').innerHTML='';
    $('sdr').innerHTML='';
    $('dg').innerHTML='';
    return;
  }

  /* Mes cours uniquement */
  const mesCours=RAW.filter(
    r=>r.formateur_id===formateurId
  );

  const mesCoursIds=new Set(
    mesCours.map(r=>r.id)
  );

  /* Mes inscriptions uniquement */
  const mesInscriptions=ENR.filter(
    x=>mesCoursIds.has(x.cours_id)
  );

  const mesEtudiants=new Set(
    mesInscriptions.map(x=>x.etudiant_id)
  );

  /* Mes présences uniquement */
  const mesPresences=DPA.filter(
    x=>mesCoursIds.has(x.cours_id)
  );

  const totalPresences=mesPresences.length;

  const presents=mesPresences.filter(
    x=>x.statut==='present'||x.statut==='retard'
  ).length;

  const taux=totalPresences
    ?Math.round(presents/totalPresences*100)
    :0;

  /* Prochains cours */
  const maintenant=new Date();

  const prochains=mesCours
    .map(r=>{
      const prochain=new Date();
      const aujourd=(prochain.getDay()+6)%7;
      let delta=r.jour-aujourd;

      if(delta<0)delta+=7;

      prochain.setDate(
        prochain.getDate()+delta
      );

      prochain.setHours(
        Math.floor(hh(r.debut)),
        hh(r.debut)%1?30:0,
        0,
        0
      );

      return {r,date:prochain};
    })
    .filter(x=>x.date>=maintenant)
    .sort((a,b)=>a.date-b.date)
    .slice(0,5);

  $('kp').innerHTML=

    `<div class="sdcard sdkp">
      <span class="sdic">${ic('book')}</span>
      <div>
        <b>Mes cours</b>
        <small>Cours qui me sont attribués</small>
        <strong>${mesCours.length}</strong>
      </div>
    </div>`+

    `<div class="sdcard sdkp">
      <span class="sdic">${ic('users')}</span>
      <div>
        <b>Mes étudiants</b>
        <small>Étudiants inscrits à mes cours</small>
        <strong>${mesEtudiants.size}</strong>
      </div>
    </div>`+

    `<div class="sdcard sdkp">
      <span class="sdic">${ic('check')}</span>
      <div>
        <b>Taux de présence</b>
        <small>Sur mes cours</small>
        <strong>${taux}%</strong>
      </div>
    </div>`+

    `<div class="sdcard sdkp">
      <span class="sdic">${ic('clock')}</span>
      <div>
        <b>Présences enregistrées</b>
        <small>Sur mes cours</small>
        <strong>${totalPresences}</strong>
      </div>
    </div>`;

  $('sdc').innerHTML=
    `<div class="sdcard">
      <h3>Mes prochains cours</h3>
      ${
        prochains.length
        ? prochains.map(x=>{
            const r=x.r;
            const s=S[CODE[r.matiere_id]]||['?','lang','book'];
            return `
              <div class="pr" style="--c:var(${POLE[s[1]][1]});margin-top:10px">
                <span>${ic(s[2])}</span>
                <div>
                  <b>${esc(s[0])}</b>
                  <small>
                    ${x.date.toLocaleDateString('fr-FR',{
                      weekday:'long',
                      day:'numeric',
                      month:'long'
                    })}
                    · ${fmt(hh(r.debut))} – ${fmt(hh(r.fin))}
                    · ${esc(sn(RN[r.salle_id]))}
                  </small>
                </div>
              </div>
            `;
          }).join('')
        : '<div class="empty" style="margin-top:12px">Aucun prochain cours.</div>'
      }
    </div>`;

  $('sdr').innerHTML=
    `<div class="sdcard">
      <h3>Mon activité</h3>
      <p style="color:var(--mute);margin:8px 0 0">
        Vous êtes responsable de ${mesCours.length} cours
        et de ${mesEtudiants.size} étudiant(s).
      </p>
    </div>`;

  $('dg').innerHTML=
    `<div class="sdcard">
      <div class="sdth">
        <h3>Mes cours</h3>
      </div>
      <table class="sdtb">
        <thead>
          <tr>
            <th>Cours</th>
            <th>Jour</th>
            <th>Horaire</th>
            <th>Étudiants</th>
          </tr>
        </thead>
        <tbody>
          ${
            mesCours.length
            ? mesCours.map(r=>{
                const s=S[CODE[r.matiere_id]]||['?','lang','book'];
                const nb=mesInscriptions.filter(
                  x=>x.cours_id===r.id
                ).length;

                return `
                  <tr>
                    <td>
                      <div class="sdn">
                        <i style="--c:var(${POLE[s[1]][1]})">
                          ${ic(s[2])}
                        </i>
                        ${esc(s[0])}
                      </div>
                    </td>
                    <td>${DAYS[r.jour]}</td>
                    <td>${fmt(hh(r.debut))} – ${fmt(hh(r.fin))}</td>
                    <td>${nb}</td>
                  </tr>
                `;
              }).join('')
            : '<tr><td colspan="4">Aucun cours attribué.</td></tr>'
          }
        </tbody>
      </table>
    </div>`;

  /* Le formateur n'utilise pas les filtres du dashboard général */
  $('sdfp').classList.add('hidden');

}


function renderDashFormateur(){

  const fid =
    me &&
    me.tid!==undefined &&
    T[me.tid]
      ? T[me.tid].id
      : null;

  if(!fid){
    $('kp').innerHTML =
      '<div class="empty">Votre compte formateur n’est pas encore lié à une fiche formateur.</div>';

    $('sdc').innerHTML='';
    $('sdr').innerHTML='';
    $('dg').innerHTML='';
    return;
  }

  /* =========================
     COURS DU FORMATEUR
     ========================= */

  const mesCours=RAW.filter(
    r=>r.formateur_id===fid
  );

  const mesCoursIds=new Set(
    mesCours.map(r=>r.id)
  );

  /* =========================
     ÉTUDIANTS INSCRITS
     ========================= */

  const mesInscriptions=ENR.filter(
    x=>mesCoursIds.has(x.cours_id)
  );

  const mesEtudiants=new Set(
    mesInscriptions.map(x=>x.etudiant_id)
  );

  /* =========================
     PRÉSENCES
     ========================= */

  const mesPresences=DPA.filter(
    x=>mesCoursIds.has(x.cours_id)
  );

  const presents=mesPresences.filter(
    x=>x.statut==='present'||x.statut==='retard'
  ).length;

  const tauxPresence=mesPresences.length
    ?Math.round(presents/mesPresences.length*100)
    :0;

  /* =========================
     ÉVOLUTION DES INSCRIPTIONS
     ========================= */

  const evolution=[];

  for(let i=5;i>=0;i--){

    const d=new Date(
      new Date().getFullYear(),
      new Date().getMonth()-i,
      1
    );

    const key=
      d.getFullYear()+
      '-'+
      String(d.getMonth()+1).padStart(2,'0');

    const total=mesInscriptions.filter(x=>
      x.created_at &&
      x.created_at.slice(0,7)===key
    ).length;

    evolution.push([
      d.toLocaleDateString('fr-FR',{month:'short'}),
      total
    ]);
  }

  /* =========================
     PROCHAINS COURS
     ========================= */

  const maintenant=new Date();
  const prochains=[];

  mesCours.forEach(r=>{

    const debut=new Date();
    const jourActuel=(debut.getDay()+6)%7;

    let delta=r.jour-jourActuel;

    if(delta<0)delta+=7;

    debut.setDate(
      debut.getDate()+delta
    );

    debut.setHours(
      Math.floor(hh(r.debut)),
      hh(r.debut)%1?30:0,
      0,
      0
    );

    if(
      r.valable_du &&
      iso(debut)<r.valable_du
    ){
      debut.setDate(
        debut.getDate()+
        ((new Date(r.valable_du+'T12:00').getDay()+6)%7
        -r.jour+7)%7
      );
    }

    if(
      r.valable_au &&
      iso(debut)>r.valable_au
    ){
      return;
    }

    prochains.push({
      r,
      date:debut
    });

  });

  prochains.sort(
    (a,b)=>a.date-b.date
  );

  const topProchains=prochains.slice(0,5);

  /* =========================
     TITRE
     ========================= */

  const titre=document.querySelector('#vd .sdh h2');
  const sousTitre=document.querySelector('#vd .sdh p');

  if(titre)
    titre.textContent='Mon tableau de bord';

  if(sousTitre)
    sousTitre.textContent='Votre activité pédagogique';

  /* Pas de filtres Directeur pour le Formateur */
  $('sdfp').classList.add('hidden');

  /* =========================
     KPIs
     ========================= */

  $('kp').innerHTML=

    `<div class="sdcard sdkp">
      <span class="sdic">${ic('book')}</span>
      <div>
        <b>Mes cours</b>
        <small>Cours attribués</small>
        <strong>${mesCours.length}</strong>
      </div>
    </div>`+

    `<div class="sdcard sdkp">
      <span class="sdic">${ic('users')}</span>
      <div>
        <b>Mes étudiants</b>
        <small>Étudiants inscrits à mes cours</small>
        <strong>${mesEtudiants.size}</strong>
      </div>
    </div>`+

    `<div class="sdcard sdkp">
      <span class="sdic">${ic('check')}</span>
      <div>
        <b>Taux de présence</b>
        <small>Sur mes cours</small>
        <strong>${tauxPresence}%</strong>
      </div>
    </div>`+

    `<div class="sdcard sdkp">
      <span class="sdic">${ic('clock')}</span>
      <div>
        <b>Présences enregistrées</b>
        <small>Total</small>
        <strong>${mesPresences.length}</strong>
      </div>
    </div>`;

  /* =========================
     GRAPHIQUE
     ========================= */

  const ancienSDM=SDM;
  SDM='line';

  $('sdc').innerHTML=
    `<div class="sdcard">
      <div class="sdch">
        <!--h3>Évolution de mes inscriptions</!--h3>
      </div>
      ${chart(evolution)}
    </div>`;

  SDM=ancienSDM;

  /* =========================
     PROCHAINS COURS
     ========================= */

  $('sdr').innerHTML=
    `<div class="sdcard">
      <h3>Mes prochains cours</h3>

      ${
        topProchains.length

        ?topProchains.map(x=>{

          const r=x.r;
          const s=
            S[CODE[r.matiere_id]]
            ||['?','lang','book'];

          return `
            <div class="pr"
                 style="--c:var(${POLE[s[1]][1]});margin-top:10px">

              <span>${ic(s[2])}</span>

              <div>

                <b>${esc(s[0])}</b>

                <small>
                  ${x.date.toLocaleDateString(
                    'fr-FR',
                    {
                      weekday:'long',
                      day:'numeric',
                      month:'long'
                    }
                  )}

                  · ${fmt(hh(r.debut))}
                  – ${fmt(hh(r.fin))}

                  · ${esc(sn(RN[r.salle_id]))}
                </small>

              </div>

            </div>
          `;

        }).join('')

        :'<div class="empty" style="margin-top:12px">Aucun prochain cours.</div>'
      }

    </div>`;

  /* =========================
     TABLEAU DES COURS
     ========================= */

  $('dg').innerHTML=
    `<div class="sdcard">

      <div class="sdth">
        <h3>Mes cours</h3>
      </div>

      <table class="sdtb">

        <thead>
          <tr>
            <th>Cours</th>
            <th>Jour</th>
            <th>Horaire</th>
            <th>Étudiants</th>
          </tr>
        </thead>

        <tbody>

          ${
            mesCours.length

            ?mesCours.map(r=>{

              const s=
                S[CODE[r.matiere_id]]
                ||['?','lang','book'];

              const nb=
                mesInscriptions.filter(
                  x=>x.cours_id===r.id
                ).length;

              return `
                <tr>

                  <td>
                    <div class="sdn">
                      <i style="--c:var(${POLE[s[1]][1]})">
                        ${ic(s[2])}
                      </i>
                      ${esc(s[0])}
                    </div>
                  </td>

                  <td>${DAYS[r.jour]}</td>

                  <td>
                    ${fmt(hh(r.debut))}
                    –
                    ${fmt(hh(r.fin))}
                  </td>

                  <td>${nb}</td>

                </tr>
              `;

            }).join('')

            :`
              <tr>
                <td colspan="4">
                  Aucun cours attribué.
                </td>
              </tr>
            `
          }

        </tbody>

      </table>

    </div>`;
}

async function loadDash(){


  // const q=await Promise.all([sb.from('etudiants').select('*'),sb.from('inscriptions').select('*'),sb.from('presences').select('cours_id,date,etudiant_id,statut').limit(10000),sb.from('demandes_inscription').select('statut,created_at')]);
  // ETU=q[0].data||[];ENR=q[1].data||[];DPA=q[2].data||[];DDM=q[3].data||[];
  // DERR=q.slice(0,3).find(x=>x.error)||null;dashInit();renderDash()


  let qe = sb
    .from('etudiants')
    .select('*');

  let qi = sb
    .from('inscriptions')
    .select('*');

  let qp = sb
    .from('presences')
    .select('cours_id,date,etudiant_id,statut')
    .limit(10000);

  let qd = sb
    .from('demandes_inscription')
    .select('statut,created_at');

  if(CURRENT_CENTRE_ID){

    qe = qe.eq('centre_id',CURRENT_CENTRE_ID);

    qi = qi.eq('centre_id',CURRENT_CENTRE_ID);

    qp = qp.eq('centre_id',CURRENT_CENTRE_ID);

    qd = qd.eq('centre_id',CURRENT_CENTRE_ID);
  }

  const q = await Promise.all([
    qe,
    qi,
    qp,
    qd
  ]);

  ETU = q[0].data || [];
  ENR = q[1].data || [];
  DPA = q[2].data || [];
  DDM = q[3].data || [];

  DERR = q.slice(0,3).find(x=>x.error) || null;

  
if(me && me.role==='Formateur'){
  renderDashFormateur();
  return;
}

  dashInit();
  renderDash();


}

  function rng(p){const n=new Date(),y=n.getFullYear(),m=n.getMonth();let a=n,b=n;if(p==='w'){a=monday(n);b=addD(a,5)}else if(p==='m'){a=new Date(y,m,1);b=new Date(y,m+1,0)}else if(p==='y'){a=new Date(y,0,1);b=new Date(y,11,31)}
  $('ddu').value=iso(a);$('dda').value=iso(b);SDP=p}
function dashInit(){const fm=$('dfm').value,fc=$('dfc').value;
  opts($('dfm'),[['','Tous les formateurs'],...T.map(t=>[t.id,t.n])]);opts($('dfc'),[['','Tous les cours'],...Object.entries(S).map(([k,x])=>[k,x[0]])]);
  $('dfm').value=fm;$('dfc').value=fc;if(!$('ddu').value)rng('m')}
$('dfm').onchange=$('dfc').onchange=()=>renderDash();
$('ddu').onchange=$('dda').onchange=()=>{SDP='';renderDash()};
$('dfr').onclick=()=>loadDash();
$('vd').onclick=e=>{const p=e.target.closest('#sdp [data-p]');if(p){rng(p.dataset.p);renderDash();return}
  const m=e.target.closest('[data-m]');if(m){
    SDM=m.dataset.m;
    
    if(me && me.role==='Formateur'){
    renderDashFormateur();
  }else{
    renderDash();
  }
    
    return
  
  }
  if(e.target.closest('#sdf')){$('sdfp').classList.toggle('hidden');return}
  const g=e.target.closest('[data-tab]');if(g)document.querySelector('.tabs [data-v="'+g.dataset.tab+'"]').click()};
function occRange(du,da,fm,fc){const out=[],a=new Date(du+'T12:00'),b=new Date(da+'T12:00');let days=0;
  if(!isNaN(a)&&!isNaN(b)&&b>=a){let n=0;for(let d=new Date(a);d<=b&&n<400;d=addD(d,1),n++){const ds=iso(d),i=(d.getDay()+6)%7;if(i>5||FERM[ds])continue;days++;
    RAW.forEach(r=>{if(r.jour!==i||ds<r.valable_du||ds>r.valable_au||ANN.has(r.id+'|'+ds))return;if(fm&&r.formateur_id!=fm)return;const k=CODE[r.matiere_id];if(fc&&k!==fc)return;
      out.push({id:r.id,d:i,s:hh(r.debut),e:hh(r.fin),k,t:T.findIndex(t=>t.id===r.formateur_id),r:RN[r.salle_id],date:ds})})}}
  out.days=days;return out}
const pc=v=>(Math.round(v*10)/10+'').replace('.',',')+'%',dts=()=>{for(const a of [ENR,ETU,DDM]){const d=a.filter(x=>x.created_at).map(x=>x.created_at.slice(0,10));if(d.length)return d}return[]};
function series(du,da){const a=new Date(du+'T12:00'),b=new Date(da+'T12:00');if(isNaN(a)||isNaN(b)||b<a)return[];const mo=(b-a)/864e5>62,m=new Map();
  for(let d=new Date(a),n=0;d<=b&&n<800;d=mo?new Date(d.getFullYear(),d.getMonth()+1,1,12):addD(d,1),n++)m.set(mo?iso(d).slice(0,7):iso(d),0);
  dts().forEach(s=>{const k=mo?s.slice(0,7):s;if(m.has(k))m.set(k,m.get(k)+1)});return[...m].map(([k,v])=>[k.split('-').reverse().join('/'),v])}
function chart(s){if(!s.length)return'<div class="m">Choisissez une période valide.</div>';
  let v=s.map(x=>x[1]);if(SDM==='cum'){let c=0;v=v.map(x=>c+=x)}
  const mx=Math.max(1,...v),st=[1,2,5,10,20,25,50,100,200,500,1000].find(x=>mx/x<=5)||1000,top=Math.ceil(mx/st)*st,W=760,H=250,L=40,R=16,T0=12,B=30,pw=W-L-R,ph=H-T0-B,X=i=>L+(s.length>1?i/(s.length-1)*pw:pw/2),Y=y=>T0+ph-y/top*ph;
  let g='';for(let y=0;y<=top;y+=st)g+=`<line x1="${L}" x2="${W-R}" y1="${Y(y)}" y2="${Y(y)}" class="gl"/><text x="${L-8}" y="${Y(y)+4}" text-anchor="end">${y}</text>`;
  const ti=s.length<=6?s.map((_,i)=>i):[0,1,2,3,4,5].map(k=>Math.round(k*(s.length-1)/5));
  g+=ti.map((i,k)=>`<text x="${X(i)}" y="${H-8}" text-anchor="${s.length<2?'middle':k===0?'start':k===ti.length-1?'end':'middle'}">${s[i][0]}</text>`).join('');
  let body;if(SDM==='bar'){const bw=Math.max(3,Math.min(26,pw/s.length*.6));body=v.map((y,i)=>`<rect x="${X(i)-bw/2}" y="${Y(y)}" width="${bw}" height="${T0+ph-Y(y)}" rx="3" fill="var(--brand)"/>`).join('')}
  else{const P=v.map((y,i)=>[X(i),Y(y)]);let d='M'+P[0];for(let i=0;i<P.length-1;i++){const p0=P[i-1]||P[i],p1=P[i],p2=P[i+1],p3=P[i+2]||p2;d+=`C${p1[0]+(p2[0]-p0[0])/6},${Math.min(T0+ph,p1[1]+(p2[1]-p0[1])/6)} ${p2[0]-(p3[0]-p1[0])/6},${Math.min(T0+ph,p2[1]-(p3[1]-p1[1])/6)} ${p2}`}
    body=`<path d="${d}L${P[P.length-1][0]},${T0+ph}L${P[0][0]},${T0+ph}Z" fill="url(#sdg)"/><path d="${d}" fill="none" stroke="var(--brand)" stroke-width="2.5"/>`+(P.length===1?`<circle cx="${P[0][0]}" cy="${P[0][1]}" r="4" fill="var(--brand)"/>`:'')}
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Évolution des inscriptions"><defs><linearGradient id="sdg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--brand)" stop-opacity=".22"/><stop offset="1" stop-color="var(--brand)" stop-opacity="0"/></linearGradient></defs>${g}${body}</svg>`}
const dn=(p,lab)=>{const t=p.reduce((a,x)=>a+x[1],0);if(!t)return'<div class="m">Pas encore de données.</div>';const r=62,c=2*Math.PI*r;let o=0;
  return `<div class="sddn"><svg viewBox="0 0 160 160" role="img" aria-label="${lab}"><g transform="rotate(-90 80 80)" fill="none" stroke-width="26">${p.map(x=>{const l=x[1]/t*c,s=`<circle cx="80" cy="80" r="${r}" style="stroke:${x[2]}" stroke-dasharray="${l} ${c-l}" stroke-dashoffset="${-o}"/>`;o+=l;return s}).join('')}</g><text x="80" y="76" text-anchor="middle" class="dl1">${lab}</text><text x="80" y="98" text-anchor="middle" class="dl2">${t}</text></svg><ul>${p.map(x=>`<li><span><i class="sdsw" style="--c:${x[2]}"></i>${esc(x[0])}</span><span>${x[1]} (${pc(x[1]/t*100)})</span></li>`).join('')}</ul></div>`};
function renderDash(){
  const fm=$('dfm').value,fc=$('dfc').value,du=$('ddu').value,da=$('dda').value,sc=!!(fm||fc);
  document.querySelectorAll('#sdp [data-p]').forEach(b=>b.classList.toggle('on',b.dataset.p===SDP));
  document.querySelectorAll('#sdt [data-m]').forEach(b=>b.classList.toggle('on',b.dataset.m===SDM));
  const A=new Date(du+'T12:00'),nd=Math.round((new Date(da+'T12:00')-A)/864e5)+1||1,pa=iso(addD(A,-1)),pu=iso(addD(A,-nd));
  const O=occRange(du,da,fm,fc),P=occRange(pu,pa,fm,fc),ids=new Set(O.map(o=>o.id)),pids=new Set(P.map(o=>o.id));
  const rate=(a,b,s)=>{const L=DPA.filter(p=>p.date>=a&&p.date<=b&&(!sc||s.has(p.cours_id)));return L.length?L.filter(p=>p.statut!=='absent').length/L.length*100:null};
  const sid=new Set(ENR.filter(n=>!sc||ids.has(n.cours_id)).map(n=>n.etudiant_id)),E=sc?ETU.filter(e=>sid.has(e.id)):ETU,D=dts(),cn=(a,b)=>D.filter(d=>d>=a&&d<=b).length;
  const nf=a=>new Set(a.map(o=>o.t)).size,tr=(c,p)=>{const v=p?Math.round((c-p)/p*100):(c?100:0);return `<em class="${v<0?'dn':'up'}">${v<0?'↓':'↑'} ${v>0?'+':''}${v}%</em>`};
  const kc=(i,t,s,v,e,i2)=>`<div class="sdcard sdkp"><span class="sdic">${ic(i)}</span><div><b>${t}</b><small>${s}</small><strong>${v}</strong>${e}</div><span class="sdic sm">${ic(i2)}</span></div>`;
  $('kp').innerHTML=kc('users','Total des étudiants','Inscrits et actifs',E.length,tr(cn(du,da),cn(pu,pa)),'users')+kc('book','Total des cours','Cette période',O.length,tr(O.length,P.length),'book')+kc('user','Formateurs','Actifs',nf(O),tr(nf(O),nf(P)),'user')+kc('door','Salles','Disponibles',ROOMS.length,'<em class="up">↑ 0%</em>','user');
  $('sdc').innerHTML=chart(series(du,da));
  const r1=rate(du,da,ids),r0=rate(pu,pa,pids),dl=r1!=null&&r0!=null?r1-r0:0,pend=DDM.filter(x=>x.statut==='en_attente').length;
  $('sdr').innerHTML=`<div class="sdcard sdkp"><span class="sdic">${ic('users')}</span><div><b>Taux de présence</b><small>Période choisie</small><strong>${r1==null?'—':pc(r1)}</strong><em class="${dl<0?'dn':'up'}">${dl<0?'↓':'↑'} ${dl>0?'+':''}${pc(dl)}</em></div><span class="sdic sm">${ic('users')}</span></div>`+
    `<div class="sdcard sdkp go" data-tab="vi" role="button" tabindex="0"><span class="sdic">${ic('inbox')}</span><div><b>Demandes d'inscription</b><small>En attente de validation</small><strong>${pend}</strong></div><span class="sdic sm">${ic('check')}</span></div>`;
  const PA=DPA.filter(p=>p.date>=du&&p.date<=da),gp={};
  RAW.filter(r=>ids.has(r.id)).forEach(r=>{const k=r.matiere_id+'|'+r.formateur_id,o=gp[k]||(gp[k]={k:CODE[r.matiere_id],f:r.formateur_id,s:new Set(),p:0});ENR.filter(n=>n.cours_id===r.id).forEach(n=>o.s.add(n.etudiant_id));o.p+=PA.filter(p=>p.cours_id===r.id&&p.statut!=='absent').length});
  const top=Object.values(gp).sort((a,b)=>b.s.size-a.s.size).slice(0,5);
  const pop=top.length?top.map(o=>{const s=S[o.k]||['?','lang','book'],tt=T.find(t=>t.id===o.f);return `<tr><td><div class="sdn"><i style="--c:var(${POLE[s[1]][1]})">${ic(s[2])}</i>${esc(s[0])}</div></td><td>${esc(tt?tt.n:'')}</td><td>${o.s.size}</td><td>${o.p}</td></tr>`}).join(''):'<tr><td colspan="4" style="color:var(--mute)">Aucun cours sur cette période.</td></tr>';
  const st=['en_attente','approuvee','refusee'].map(k=>DDM.filter(x=>x.statut===k).length),tt=st[0]+st[1]+st[2],sl=[['En attente','--bur'],['Approuvées','--lang'],['Refusées','--math']];
  const dom=Object.entries(POLE).map(([k,v])=>[v[0],O.filter(c=>S[c.k]&&S[c.k][1]===k).length,`var(${v[1]})`]).filter(x=>x[1]>0).sort((a,b)=>b[1]-a[1]);
  const hd=(t,tab)=>`<div class="sdth"><h3>${t}</h3>${tab?`<button class="sdlk" data-tab="${tab}">Voir tous</button>`:''}</div>`;
  $('dg').innerHTML=`<div class="sdcard">${hd('Cours les plus populaires','vl')}<table class="sdtb"><thead><tr><th>Cours</th><th>Formateur</th><th>Inscrits</th><th>Présences</th></tr></thead><tbody>${pop}</tbody></table>${DERR?'<div class="m">Erreur : '+esc(DERR.error.message)+'</div>':''}</div>`+
    `<div class="sdcard">${hd('Inscriptions par statut','vi')}<table class="sdtb"><thead><tr><th>Statut</th><th>Nombre</th><th>Pourcentage</th></tr></thead><tbody>${sl.map((x,i)=>`<tr><td><i class="sdsw" style="--c:var(${x[1]})"></i>${x[0]}</td><td>${st[i]}</td><td>${tt?pc(st[i]/tt*100):'0%'}</td></tr>`).join('')}<tr class="tot"><td>Total</td><td>${tt}</td><td>${tt?'100%':'0%'}</td></tr></tbody></table></div>`+
    `<div class="sdcard">${hd('Répartition par domaine')}${dn(dom,'Cours')}</div>`}

/* ---------- Landing : contact, diaporama, compteurs ---------- */
const CT={adresse:'Votre adresse, Ville, Maroc',tel:'+212 6 00 00 00 00',email:'contact@isli-formation.ma',horaires:'Lundi - Samedi : 9h - 19h',wa:'212600000000'}; // <-- à remplacer par vos vraies coordonnées
document.querySelectorAll('[data-ct]').forEach(el=>{const k=el.dataset.ct,v=CT[k];if(k==='wa'){el.href='https://wa.me/'+v;return}el.textContent=v;if(k==='email')el.href='mailto:'+v;if(k==='tel')el.href='tel:'+v.replace(/\s/g,'')});
$('lcf').onsubmit=e=>{e.preventDefault();const b='Nom : '+$('lcn').value+'\nTéléphone : '+$('lct').value+'\nFormation : '+$('lcs').value+'\n\n'+$('lcm').value;
  location.href='mailto:'+CT.email+'?subject='+encodeURIComponent('Demande d\'information - '+$('lcs').value)+'&body='+encodeURIComponent(b)};
(function(){const sl=[...document.querySelectorAll('.hs .sl')],dots=$('hsd'),hs=document.querySelector('.hs');let i=0,t;
  dots.innerHTML=sl.map((_,k)=>`<button aria-label="Diapositive ${k+1}" data-k="${k}"></button>`).join('');
  const go=n=>{i=(n+sl.length)%sl.length;sl.forEach((s,k)=>s.classList.toggle('on',k===i));[...dots.children].forEach((d,k)=>d.classList.toggle('on',k===i))};
  const play=()=>{clearInterval(t);if(!matchMedia('(prefers-reduced-motion:reduce)').matches)t=setInterval(()=>go(i+1),6500)};
  $('hsp').onclick=()=>{go(i-1);play()};$('hsn').onclick=()=>{go(i+1);play()};
  dots.onclick=e=>{const b=e.target.closest('[data-k]');if(b){go(+b.dataset.k);play()}};
  hs.onmouseenter=()=>clearInterval(t);hs.onmouseleave=play;go(0);play()})();
const co=new IntersectionObserver(es=>es.forEach(x=>{if(!x.isIntersecting)return;const el=x.target,n=+el.dataset.n;co.unobserve(el);
  if(matchMedia('(prefers-reduced-motion:reduce)').matches){el.textContent=n;return}
  let t0;const f=t=>{t0=t0||t;const p=Math.min((t-t0)/1200,1);el.textContent=Math.round(n*p);if(p<1)requestAnimationFrame(f)};requestAnimationFrame(f)}),{threshold:.5});
document.querySelectorAll('.cnt').forEach(el=>co.observe(el));

/* ---------- Certificats PDF ---------- */
let CERT=[];
const fd=d=>d?d.split('-').reverse().join('/'):'';
const cnum=c=>'ISLI-'+new Date(c.created_at).getFullYear()+'-'+String(c.id).padStart(4,'0');
async function loadCert(){
  // const q=await Promise.all([sb.from('etudiants').select('*').order('nom'),sb.from('certificats')
  // .select('*').order('created_at',{ascending:false}).limit(200)]);


  let qe = sb.from('etudiants')
    .select('*')
    .order('nom');

  let qc = sb.from('certificats')
    .select('*')
    .order('created_at',{ascending:false})
    .limit(200);

  if(CURRENT_CENTRE_ID){
    qe = qe.eq('centre_id',CURRENT_CENTRE_ID);
    qc = qc.eq('centre_id',CURRENT_CENTRE_ID);
  }

  const q = await Promise.all([qe,qc]);


  ETU=q[0].data||[];CERT=q[1].data||[];
  opts($('cs'),ETU.length?ETU.map(e=>[e.id,stuName(e)]):[['','Aucun étudiant : ajoutez-en dans l\'onglet Étudiants']]);
  opts($('cm'),Object.values(S).map(x=>[x[0],x[0]]));renderCert(q[1].error)}
function renderCert(err){$('ct').innerHTML='<thead><tr><th>N°</th><th>Étudiant</th><th>Formation</th><th>Période</th><th>Émis le</th><th></th></tr></thead><tbody>'+(err?`<tr><td colspan="6">Erreur : ${esc(err.message)}. Le script SQL « certificats » a-t-il été lancé ?</td></tr>`:CERT.length?CERT.map(c=>{const e=ETU.find(x=>x.id===c.etudiant_id);
  return `<tr><td><b>${cnum(c)}</b></td><td>${esc(e?stuName(e):'')}</td><td>${esc(c.module)}</td><td>${c.date_debut&&c.date_fin?fd(c.date_debut)+' - '+fd(c.date_fin):''}</td><td>${new Date(c.created_at).toLocaleDateString('fr-FR')}</td><td><button class="btn ghost" data-cp="${c.id}" style="padding:5px 10px">Télécharger</button></td></tr>`}).join(''):'<tr><td colspan="6" style="color:var(--mute)">Aucun certificat émis pour le moment.</td></tr>')+'</tbody>'}
function makePdf(c){const e=ETU.find(x=>x.id===c.etudiant_id)||{nom:'',prenom:''},d=new window.jspdf.jsPDF({orientation:'landscape',unit:'mm',format:'a4'}),W=297,navy=[15,45,92],gold=[184,137,43],num=cnum(c),C0=W/2;
  d.setDrawColor(...navy);d.setLineWidth(1.4);d.rect(8,8,W-16,194);d.setDrawColor(...gold);d.setLineWidth(.5);d.rect(11,11,W-22,188);
  d.setFillColor(...navy);d.roundedRect(C0-7,20,14,14,3,3,'F');d.setTextColor(255,255,255);d.setFont('helvetica','bold');d.setFontSize(18);d.text('I',C0,30.2,{align:'center'});
  d.setTextColor(...navy);d.setFontSize(11);d.setCharSpace(2);d.text('ISLI FORMATION',C0,42,{align:'center'});d.setCharSpace(0);
  d.setFont('times','bold');d.setFontSize(36);d.text('CERTIFICAT DE RÉUSSITE',C0,62,{align:'center'});
  d.setDrawColor(...gold);d.setLineWidth(.8);d.line(C0-30,67,C0+30,67);
  d.setFont('times','italic');d.setFontSize(14);d.setTextColor(90,90,90);d.text('Il est certifié que',C0,80,{align:'center'});
  d.setFont('times','bold');d.setFontSize(30);d.setTextColor(...navy);d.text(stuName(e),C0,97,{align:'center'});
  d.setLineWidth(.3);d.line(C0-70,101,C0+70,101);
  d.setFont('times','normal');d.setFontSize(14);d.setTextColor(60,60,60);d.text('a suivi avec succès la formation',C0,113,{align:'center'});
  d.setFont('times','bold');d.setFontSize(24);d.setTextColor(...navy);const mm=d.splitTextToSize(c.module,220);d.text(mm,C0,127,{align:'center'});
  let y=127+mm.length*9+2;
  d.setFont('times','normal');d.setFontSize(13);d.setTextColor(60,60,60);
  const det=[c.heures?'Durée : '+c.heures+' heures':'',c.date_debut&&c.date_fin?'Du '+fd(c.date_debut)+' au '+fd(c.date_fin):''].filter(Boolean).join('   -   ');
  if(det){d.text(det,C0,y,{align:'center'});y+=8}
  if(c.mention){d.setFont('times','bolditalic');d.text(c.mention,C0,y,{align:'center'})}
  d.setFont('times','normal');d.setFontSize(11);d.setTextColor(60,60,60);
  d.text('Délivré le '+new Date(c.created_at).toLocaleDateString('fr-FR'),45,172);
  d.setDrawColor(120,120,120);d.setLineWidth(.3);d.line(W-100,170,W-40,170);d.text('La Direction',W-70,177,{align:'center'});
  d.setDrawColor(...gold);d.setLineWidth(.8);d.circle(C0,172,12);d.circle(C0,172,9.5);d.setFont('times','bold');d.setFontSize(9);d.setTextColor(...gold);d.text('ISLI',C0,171,{align:'center'});d.setFontSize(6.5);d.text('FORMATION',C0,175,{align:'center'});
  d.setFont('helvetica','normal');d.setFontSize(8);d.setTextColor(130,130,130);d.text('N° '+num,C0,192,{align:'center'});
  d.save('Certificat-'+num+'-'+norm(stuName(e)).replace(/[^a-z0-9]+/g,'-')+'.pdf')}
$('cf').onsubmit=async e=>{e.preventDefault();const m=$('cmsg'),ko=t=>{m.className='msg ko';m.textContent=t};
  if(!window.jspdf)return ko('La bibliothèque PDF n\'est pas chargée. Vérifiez la connexion Internet puis rechargez la page.');
  const row={etudiant_id:+$('cs').value,module:$('cm').value,date_debut:$('cd1').value||null,date_fin:$('cd2').value||null,heures:+$('ch').value||null,mention:$('cn').value.trim()||null};
  if(!row.etudiant_id)return ko('Choisissez un étudiant.');
  const r=await sb.from('certificats').insert({...row,...ctr()}).select('*').single();
  if(r.error)return ko('Erreur : '+r.error.message);
  makePdf(r.data);await loadCert();m.className='msg ok';m.textContent='Certificat généré : '+cnum(r.data)+'.'};
$('ct').onclick=e=>{const b=e.target.closest('[data-cp]');if(b){const c=CERT.find(x=>x.id==b.dataset.cp);if(c)makePdf(c)}};
function setHH(){const h=document.querySelector('#app header');if(h&&h.offsetHeight)document.documentElement.style.setProperty('--hh',h.offsetHeight+'px')}
addEventListener('resize',setHH);

/* ---------- Espace étudiant ---------- */
let ENRSET=new Set(),MYPRES=[],ME_STU=null;
const mine=c=>!me||me.role!=='Étudiant'||ENRSET.has(c.id);
// const etuSrc=()=>me&&me.role==='Formateur'?'etudiants_noms':'etudiants';
const etuSrc=()=> 'etudiants';

async function refreshEtu(){

  const centreId = me?.sup
    ? CURRENT_CENTRE_ID
    : me?.centreId;

  let qe = sb
    .from(etuSrc())
    .select('*')
    .order('nom');

  let qi = sb
    .from('inscriptions')
    .select('*');

  if(centreId){
    qe = qe.eq('centre_id',centreId);
    qi = qi.eq('centre_id',centreId);
  }

  const q = await Promise.all([qe,qi]);

  ETU = q[0].data || [];
  ENR = q[1].data || [];
}

function studentNote(){const n=$('sn');if(!me||me.role!=='Étudiant'){n.classList.add('hidden');return}
  n.textContent=!ME_STU?"Votre compte n'est relié à aucun dossier étudiant. Donnez à l'administration l'adresse e-mail que vous utilisez pour vous connecter.":(ENRSET.size?'':"Vous n'êtes inscrit à aucun cours pour le moment.");n.classList.toggle('hidden',!n.textContent)}
function renderMine(){const R=RAW.filter(r=>ENRSET.has(r.id)).sort((a,b)=>a.jour-b.jour||(a.debut<b.debut?-1:1));
  $('mt').innerHTML='<thead><tr><th>Cours</th><th>Horaire</th><th>Formateur</th><th>Salle</th><th>Domaine</th></tr></thead><tbody>'+(R.length?R.map(r=>{const s=S[CODE[r.matiere_id]]||['?','lang','book'],t=T.find(x=>x.id===r.formateur_id),once=r.valable_du&&r.valable_du===r.valable_au;
    return `<tr style="--c:var(${POLE[s[1]][1]})"><td><div class="cn"><b>${ic(s[2])}</b>${esc(s[0])}</div></td><td>${once?fd(r.valable_du):DAYS[r.jour]}<br><small style="color:var(--mute)">${fmt(hh(r.debut))} - ${fmt(hh(r.fin))}</small></td><td>${esc(t?t.n:'')}</td><td>${sn(RN[r.salle_id])}</td><td><span class="dm">${POLE[s[1]][0]}</span></td></tr>`}).join(''):'<tr><td colspan="5" style="color:var(--mute)">Aucun cours pour le moment. L\'administration vous inscrira à vos cours.</td></tr>')+'</tbody>'}
function renderMyPres(){const P=MYPRES.slice().sort((a,b)=>a.date<b.date?1:-1),ok=P.filter(p=>p.statut!=='absent').length,k=(v,l)=>`<div class="kpi"><b>${v}</b><span>${l}</span></div>`;
  $('qk').innerHTML=k(P.length?Math.round(ok/P.length*100)+'%':'—','Taux de présence')+k(P.filter(p=>p.statut==='present').length,'Présences')+k(P.filter(p=>p.statut==='retard').length,'Retards')+k(P.filter(p=>p.statut==='absent').length,'Absences');
  $('pq').innerHTML='<thead><tr><th>Date</th><th>Cours</th><th>Statut</th></tr></thead><tbody>'+(P.length?P.map(p=>{const r=RAW.find(x=>x.id===p.cours_id),n=r?(S[CODE[r.matiere_id]]||['?'])[0]:'?',c={present:'var(--lang)',retard:'var(--bur)',absent:'var(--math)'}[p.statut];
    return `<tr><td>${fd(p.date)}</td><td>${esc(n)}</td><td><span class="dm" style="--c:${c}">${ST[p.statut]}</span></td></tr>`}).join(''):'<tr><td colspan="3" style="color:var(--mute)">Aucune présence enregistrée pour le moment.</td></tr>')+'</tbody>'}

/* ---------- Accès générés (Edge Function) ---------- */
const OPEN_SIGNUP=false; // true = rouvre « Créer un compte » et la connexion Google sur la page de connexion
$('su').classList.add('hidden');$('lnote').classList.remove('hidden');
async function callAdmin(body){const r=await sb.functions.invoke('admin-users',{body});
  if(r.error){let msg=r.error.message,ex=false;try{const j=await r.error.context.json();msg=j.error||msg;ex=!!j.exists}catch(e){}return{error:msg,exists:ex}}
  if(r.data&&r.data.error)return{error:r.data.error,exists:!!r.data.exists};return{data:r.data}}
function showAcc(a,name){$('accn').textContent='Accès de '+name+'. Transmettez ces informations à la personne concernée.';
  $('accu').textContent=location.origin+location.pathname;$('acce').textContent=a.email;$('accp').textContent=a.password;$('dacc').showModal()}
$('acpy').onclick=async()=>{const t='Site : '+$('accu').textContent+'\nE-mail : '+$('acce').textContent+'\nMot de passe provisoire : '+$('accp').textContent;
  try{await navigator.clipboard.writeText(t);$('acpy').textContent='Copié'}catch(e){$('acpy').textContent='Copie impossible'}setTimeout(()=>$('acpy').textContent='Copier',1800)};
$('aprt').onclick=()=>{const w=window.open('','_blank');if(!w){alert('Autorisez les fenêtres pop-up pour imprimer.');return}
  w.document.write('<html><head><title>Accès Isli Formation</title><style>body{font-family:Arial,sans-serif;max-width:520px;margin:40px auto;padding:0 20px;color:#14213d}h1{color:#0f2d5c}.b{border:1px solid #ccc;border-radius:10px;padding:12px 14px;margin:10px 0}small{color:#667}b{font-size:18px}.m{font-family:monospace;letter-spacing:.05em}</style></head><body><h1>Isli Formation</h1><p>'+esc($('accn').textContent)+'</p><div class="b"><small>Site</small><br><b>'+esc($('accu').textContent)+'</b></div><div class="b"><small>E-mail (identifiant)</small><br><b>'+esc($('acce').textContent)+'</b></div><div class="b"><small>Mot de passe provisoire</small><br><b class="m">'+esc($('accp').textContent)+'</b></div><p>Changez ce mot de passe à votre première connexion et ne le partagez avec personne.</p></body></html>');
  w.document.close();w.focus();w.print()};
$('eacc').onclick=async()=>{const x=ETU.find(s=>s.id===ESID);if(!x||!x.email)return;const m=$('em');
 let a=await callAdmin({
  action:'create_user',
  email:x.email,
  full_name:stuName(x),
  role:'etudiant',
  ...ctr()
});
  if(a.error&&a.exists){if(!confirm('Un compte existe déjà pour cet e-mail. Générer un nouveau mot de passe ?'))return;a=await callAdmin({action:'reset_password',email:x.email})}
  if(a.error){m.className='msg ko';m.textContent='Erreur : '+a.error;return}showAcc(a.data,stuName(x))};
function forcePw(){return new Promise(res=>{const d=$('dpw'),m=$('pwm');$('pw1').value='';$('pw2').value='';m.textContent='';d.oncancel=e=>e.preventDefault();
  $('pwf').onsubmit=async e=>{e.preventDefault();const a=$('pw1').value,b=$('pw2').value,ko=t=>{m.className='msg ko';m.textContent=t};
    if(a.length<10)return ko('Le mot de passe doit contenir au moins 10 caractères.');if(a!==b)return ko('Les deux mots de passe ne correspondent pas.');
    const r=await sb.auth.updateUser({password:a,data:{must_change:false}});if(r.error)return ko(r.error.message);d.close();res()};
  d.showModal()})}

/* ---------- Supports de cours ---------- */
let DOCS=[];
const fsz=n=>n>1048576?(n/1048576).toFixed(1)+' Mo':Math.max(1,Math.round(n/1024))+' Ko';
const canManage=()=>!!me&&me.role==='Formateur';
async function loadDocs()
{
   $('kw').classList.toggle('hidden',!canManage());

  if(canManage()){

    const my=RAW
      .filter(r =>
        me.role==='Admin' ||
        (
          me.tid!==undefined &&
          T[me.tid] &&
          r.formateur_id===T[me.tid].id
        )
      )
      .sort((a,b)=>
        a.jour-b.jour ||
        (a.debut<b.debut?-1:1)
      );

    opts(
      $('kc'),
      my.length
        ? my.map(r=>[r.id,crsLabel(r)])
        : [['','Aucun cours : créez d\'abord un cours']]
    );
  }

  let q=sb
    .from('documents')
    .select('*')
    .order('created_at',{ascending:false});

  if(CURRENT_CENTRE_ID){
    q=q.eq('centre_id',CURRENT_CENTRE_ID);
  }

  const r=await q;

  DOCS=r.data||[];

  renderDocs(r.error);

}


function renderDocs(err){$('dt').innerHTML='<thead><tr><th>Document</th><th>Cours</th><th>Fichier</th><th>Ajouté le</th><th></th></tr></thead><tbody>'+(err?`<tr><td colspan="5">Erreur : ${esc(err.message)}. Le script SQL « supports de cours » a-t-il été lancé ?</td></tr>`:DOCS.length?DOCS.map(d=>{const r=RAW.find(x=>x.id===d.cours_id);
  return `<tr><td><b>${esc(d.titre)}</b>${d.description?`<br><small style="color:var(--mute)">${esc(d.description)}</small>`:''}</td><td>${esc(r?crsLabel(r):'')}</td><td>${esc(d.nom_fichier)}<br><small style="color:var(--mute)">${fsz(d.taille||0)}</small></td><td>${new Date(d.created_at).toLocaleDateString('fr-FR')}</td><td style="white-space:nowrap"><button class="btn ghost" data-dv="${d.id}" style="padding:5px 10px">Voir</button> <button class="btn ghost" data-dd="${d.id}" style="padding:5px 10px">Télécharger</button>${canManage()?` <button class="btn ghost" data-dx="${d.id}" style="padding:5px 10px">Supprimer</button>`:''}</td></tr>`}).join(''):'<tr><td colspan="5" style="color:var(--mute)">Aucun support de cours pour le moment.</td></tr>')+'</tbody>'}
$('dt').onclick=async e=>{const b=e.target.closest('[data-dv],[data-dd],[data-dx]');if(!b)return;
  const d=DOCS.find(x=>x.id==(b.dataset.dv||b.dataset.dd||b.dataset.dx));if(!d)return;
  if(b.dataset.dx!==undefined){if(!confirm('Supprimer ce document ?'))return;await sb.storage.from('supports').remove([d.fichier_path]);
    const r=await sb.from('documents').delete().eq('id',d.id);if(r.error){alert('Erreur : '+r.error.message);return}loadDocs();return}
  const dl=b.dataset.dd!==undefined,r=await sb.storage.from('supports').createSignedUrl(d.fichier_path,120,dl?{download:d.nom_fichier}:undefined);
  if(r.error){alert('Erreur : '+r.error.message);return}
  if(dl){const a=document.createElement('a');a.href=r.data.signedUrl;a.download=d.nom_fichier;document.body.appendChild(a);a.click();a.remove()}
  else window.open(r.data.signedUrl,'_blank','noopener')};
$('kf').onsubmit=async e=>{e.preventDefault();const m=$('km'),ko=t=>{m.className='msg ko';m.textContent=t},f=$('kfile').files[0],cid=+$('kc').value,titre=$('kt').value.trim();
  if(!cid)return ko('Choisissez un cours.');if(!titre)return ko('Donnez un titre au document.');if(!f)return ko('Choisissez un fichier.');
  if(f.size>20*1048576)return ko('Fichier trop volumineux (20 Mo maximum).');
  m.className='msg';m.textContent='Envoi en cours...';
  const path=cid+'/'+Date.now()+'-'+norm(f.name).replace(/[^a-z0-9._-]+/g,'-');
  const up=await sb.storage.from('supports').upload(path,f,{contentType:f.type||'application/octet-stream'});
  if(up.error)return ko('Erreur d\'envoi : '+up.error.message);
  const ins=await sb.from('documents').insert({
    cours_id:cid,titre,description:$('kd').value.trim()||null,
    fichier_path:path,nom_fichier:f.name,taille:f.size,type_mime:f.type||null,...ctr()
  }).select('*').single();
  if(ins.error){await sb.storage.from('supports').remove([path]);return ko('Erreur : '+ins.error.message)}
  $('kt').value='';$('kd').value='';$('kfile').value='';m.className='msg ok';m.textContent='Document importé : les étudiants inscrits à ce cours peuvent le voir et le télécharger.';loadDocs()};

/* ---------- Inscription des étudiants par Google + approbation ---------- */
let BT=null,DEMSEQ=0,BADSEQ=0;
async function refreshBadge(){
  
  
if(!me||me.role!=='Admin')return;
  const bseq=++BADSEQ,bcid=CURRENT_CENTRE_ID;

  let q=sb
    .from('demandes_inscription')
    .select('id',{count:'exact',head:true})
    .eq('statut','en_attente');

  if(CURRENT_CENTRE_ID){
    q=q.eq('centre_id',CURRENT_CENTRE_ID);
  }

  const r=await q;
  if(bseq!==BADSEQ||bcid!==CURRENT_CENTRE_ID)return;
  const n=r.count||0;

  $('bn').textContent=n;
  $('bn').classList.toggle('hidden',!n);
  $('tbi').textContent=n;
  $('tbi').classList.toggle('hidden',!n);
  $('bell').title=n
    ? n+' demande(s) d\'inscription en attente'
    : 'Aucune demande en attente';
}
$('bell').onclick=()=>document.querySelector('[data-v="vi"]').click();
async function loadDem(){
  const dseq=++DEMSEQ,dcid=CURRENT_CENTRE_ID;
  let q=sb.from('demandes_inscription').select('*').order('created_at',{ascending:false}

  ).limit(200);
  if(CURRENT_CENTRE_ID){
    q=q.eq('centre_id',CURRENT_CENTRE_ID);
  }
  if($('ifl').value)q=q.eq('statut',$('ifl').value);
  const r=await q;
  if(dseq!==DEMSEQ||dcid!==CURRENT_CENTRE_ID)return;
  const L=r.data||[];
  $('idt').innerHTML='<thead><tr><th>Date</th><th>Étudiant</th><th>Contact</th><th>Adresse</th><th>Niveau</th><th></th></tr></thead><tbody>'+(r.error?`<tr><td colspan="6">Erreur : ${esc(r.error.message)}. Le script SQL « inscriptions Google » a-t-il été lancé ?</td></tr>`:L.length?L.map(d=>`<tr><td>${new Date(d.created_at).toLocaleDateString('fr-FR')}</td><td><b>${esc(d.prenom+' '+d.nom)}</b></td><td>${esc(d.email)}<br><small style="color:var(--mute)">${esc(d.telephone)}</small></td><td>${esc(d.adresse)}<br><small style="color:var(--mute)">${esc(d.ville)}</small></td><td>${esc(d.niveau_etudes)}</td><td style="white-space:nowrap">${d.statut==='en_attente'?`<button class="btn" data-ok="${d.id}" style="padding:5px 12px">Approuver</button> <button class="btn ghost" data-no="${d.id}" style="padding:5px 12px">Refuser</button>`:`<span class="dm" style="--c:${d.statut==='approuvee'?'var(--lang)':'var(--math)'}">${d.statut==='approuvee'?'Approuvée':'Refusée'}</span>`}</td></tr>`).join(''):'<tr><td colspan="6" style="color:var(--mute)">Aucune demande.</td></tr>')+'</tbody>';
  refreshBadge()}
$('ifl').onchange=loadDem;
$('idt').onclick=async e=>{const ok=e.target.closest('[data-ok]'),no=e.target.closest('[data-no]');if(!ok&&!no)return;
  if(ok){const r=await sb.rpc('approuver_demande',{did:+ok.dataset.ok});if(r.error){alert('Erreur : '+r.error.message);return}}
  else{const mo=prompt('Motif du refus (facultatif) :');if(mo===null)return;const r=await sb.rpc('refuser_demande',{did:+no.dataset.no,motif:mo||null});if(r.error){alert('Erreur : '+r.error.message);return}}
  loadDem()};
function askInscription(u){
  return new Promise(async res=>{
    const d=$('dins'),
      nm=((u.user_metadata&&(u.user_metadata.full_name||u.user_metadata.name))||'')
        .trim()
        .split(/\s+/);

    // Charger les centres actifs
    const cr=await sb.from('centres')
      .select('id,nom')
      .eq('actif',true)
      .order('nom');

    if(cr.error){
      $('imsg').className='msg ko';
      $('imsg').textContent='Impossible de charger les centres de formation.';
      return;
    }

    $('iprn').value=nm[0]||'';
    $('inom').value=nm.slice(1).join(' ');
    $('imail').value=u.email||'';

    // Niveau d'études
    opts(
      $('iniv'),
      [['','Choisir...'],...NIV.map(x=>[x,x])]
    );

    // Centre de formation
    opts(
      $('icentre'),
      [
        ['','Choisir votre centre...'],
        ...(cr.data||[]).map(c=>[c.id,c.nom])
      ]
    );

    d.oncancel=e=>e.preventDefault();

    $('insf').onsubmit=async e=>{
      e.preventDefault();

      const m=$('imsg'),
        ko=t=>{
          m.className='msg ko';
          m.textContent=t;
        };

      const centreId=$('icentre').value;

      const row = {
      user_id: u.id,
      email: u.email,
      prenom: $('iprn').value.trim(),
      nom: $('inom').value.trim(),
      telephone: $('itel').value.trim() || null,
      adresse: $('iadr').value.trim() || null,
      ville: $('iville').value.trim(),
      niveau_etudes: $('iniv').value,
      centre_id: centreId
    };

      if(!row.prenom||!row.nom||!row.ville||!row.niveau_etudes)
        return ko('Complétez tous les champs obligatoires.');

      if(!centreId)
        return ko('Veuillez sélectionner votre centre de formation.');

      const r=await sb
        .from('demandes_inscription')
        .insert(row);

      if(r.error)
        return ko('Erreur : '+r.error.message);

      d.close();
      res();
    };

    d.showModal();
  });
}
function showPend(d){const m=$('pendm'),t=$('pendt');
  if(d&&d.statut==='refusee'){t.textContent='Demande non acceptée';m.textContent='Votre demande n\'a pas été acceptée.'+(d.motif?' Motif : '+d.motif+'.':'')+' Contactez l\'administration du centre pour plus d\'informations.'}
  else{t.textContent='Demande en cours d\'examen';m.textContent='Merci ! Votre demande a bien été envoyée. Vous aurez accès à votre espace dès qu\'elle sera approuvée par l\'administration.'}
  show('pend')}
async function pendingFlow(session){const u=session.user;let r=await sb.from('demandes_inscription').select('*').eq('user_id',u.id).maybeSingle();
  if(!r.data){await askInscription(u);r=await sb.from('demandes_inscription').select('*').eq('user_id',u.id).maybeSingle()}showPend(r.data)}
$('pendr').onclick=async()=>{const x=await sb.auth.getSession();if(x.data.session)enter(x.data.session)};
$('pendl').onclick=async()=>{await sb.auth.signOut();me=null;show('landing')};

/* ---------- Mes étudiants (formateur) : nom, prénom, e-mail, téléphone ---------- */

// async function loadMyStu(){const q=await Promise.all([sb.from('etudiants').select('*').eq('centre_id',me.centreId).order('nom'),sb.from('inscriptions').select('*').eq('centre_id',me.centreId)]),L=q[0].data||[];if(q[1].data)ENR=q[1].data;


/* ---------- Mes étudiants (formateur) : nom, prénom, e-mail, téléphone ---------- */
async function loadMyStu(){
  const centreId = me && me.centreId;

  
  const q=await Promise.all([
    sb.from('etudiants')
      .select('*')
      .eq('centre_id',me.centreId)
      .order('nom'),

    sb.from('inscriptions')
      .select('*')
      .eq('centre_id',me.centreId)
  ]),
  L=q[0].data||[];

  if(q[1].data)ENR=q[1].data;

  $('nt').innerHTML='<thead><tr><th>Nom</th><th>Prénom</th><th>E-mail</th><th>Téléphone</th><th>Mes cours</th></tr></thead><tbody>'+(q[0].error?`<tr><td colspan="5">Erreur : ${esc(q[0].error.message)}. Le script SQL « correctifs formateur » a-t-il été lancé ?</td></tr>`:L.length?L.map(x=>{
    const cs=ENR.filter(n=>n.etudiant_id===x.id).map(n=>RAW.find(r=>r.id===n.cours_id)).filter(Boolean);
    return `<tr><td><b>${esc(x.nom)}</b></td><td>${esc(x.prenom)}</td><td>${x.email?`<a href="mailto:${esc(x.email)}" 
      style="color:inherit">${esc(x.email)}</a>`:''}</td><td>${x.telephone?`<a href="tel:${esc(x.telephone)}"
         style="color:inherit">${esc(x.telephone)}</a>`:''}</td><td>${cs.map(r=>{const s=S[CODE[r.matiere_id]]||['?','lang'];
          return `<span class="dm" style="--c:var(${POLE[s[1]][1]});margin:0 4px 4px 0">${esc(s[0])}
            </span>`}).join('')}</td></tr>`}).join(''):'<tr><td colspan="5" style="color:var(--mute)"> Aucun étudiant inscrit à vos cours pour le moment.</td></tr>')+'</tbody>'}
    

document.addEventListener('click',async function(e){

  if(!me||!me.sup)return;

  /* =========================
     MODIFIER
     ========================= */

  const editBtn=e.target.closest('#zt [data-zed]');

  if(editBtn){

    const centre=CEN.find(
      c=>c.id===editBtn.dataset.zed
    );

    if(!centre){
      console.error(
        'Centre introuvable :',
        editBtn.dataset.zed
      );
      return;
    }

    openCentre(centre);
    return;
  }

  /* =========================
     SUSPENDRE / RÉACTIVER
     ========================= */

  const toggleBtn=e.target.closest('#zt [data-ztg]');

  if(toggleBtn){

    const centre=CEN.find(
      c=>c.id===toggleBtn.dataset.ztg
    );

    if(!centre){
      console.error(
        'Centre introuvable :',
        toggleBtn.dataset.ztg
      );
      return;
    }

    const message=centre.actif
      ? `Suspendre « ${centre.nom} » ? Ses utilisateurs (hors super administrateur) perdront l'accès.`
      : `Réactiver « ${centre.nom} » ?`;

    if(!confirm(message))return;

    const r=await sb
      .from('centres')
      .update({
        actif:!centre.actif
      })
      .eq('id',centre.id)
      .select('id');

    if(
      r.error||
      !(r.data||[]).length
    ){

      alert(
        'Modification refusée'+
        (
          r.error
            ? ' : '+r.error.message
            : '.'
        )
      );

      return;
    }

    await loadCentres();
    return;
  }

});
