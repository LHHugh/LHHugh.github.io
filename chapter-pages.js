(()=>{'use strict';
const reduce=matchMedia('(prefers-reduced-motion: reduce)'),coarse=matchMedia('(pointer:coarse)');
const ids=['about','research','projects','contact'],names=['关于','研究','项目','联系'];
const story=document.querySelector('.scroll-story'),pin=story.querySelector('.story-pin');
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),ease=v=>{v=clamp(v);return v*v*(3-2*v)};
let deck,space,items=[],extras=[],enabled=false,raf=0,start=0,total=0,h=0,entry=0,hold=0;
let displayY=0,lastFrame=0,previousActive=-1,resizeTimer,settleTimer,touching=false,lastScroll=scrollY,direction=1,navigatingUntil=0;
function pauseMedia(item){item.body.querySelectorAll('video').forEach(v=>{if(!v.paused)v.pause()})}
function enable(){
 if(enabled||reduce.matches)return;enabled=true;document.documentElement.classList.add('chapter-mode');
 space=document.createElement('div');space.className='chapter-scroll-space';space.setAttribute('aria-hidden','true');document.querySelector('#about').before(space);
 deck=document.createElement('div');deck.className='chapter-deck';
 items=ids.map((id,i)=>{const el=document.getElementById(id),marker=document.createComment('chapter '+id);el.before(marker);
  const screen=document.createElement('div');screen.className='chapter-screen';screen.style.zIndex=i+1;
  const body=document.createElement('div');body.className='chapter-body';body.append(el);screen.append(body);deck.append(screen);
  return{id,el,screen,body,marker,offset:0,travel:0,length:0,reveals:[]};});
 extras=[...document.querySelectorAll('main>footer,main>.version-note')].map(el=>{const marker=document.createComment('chapter footer');el.before(marker);items[3].body.append(el);return{el,marker}});
 const nav=document.createElement('nav');nav.className='chapter-pages-nav';nav.setAttribute('aria-label','内容章节');
 nav.innerHTML=ids.map((id,i)=>'<a href="#'+id+'"><span>0'+(i+1)+' / '+names[i]+'</span><i aria-hidden="true"></i></a>').join('');deck.append(nav);
 const indicator=document.createElement('div');indicator.className='chapter-position';indicator.setAttribute('aria-hidden','true');deck.append(indicator);document.body.append(deck);
 measure();if(ids.includes(location.hash.slice(1)))jump(location.hash.slice(1),false);
}
function resetOutro(){pin.style.transform='';story.classList.remove('chapter-outro');story.style.removeProperty('--outro');}
function disable(){
 if(!enabled)return;enabled=false;cancelAnimationFrame(raf);clearTimeout(settleTimer);raf=0;previousActive=-1;resetOutro();
 extras.forEach(({el,marker})=>marker.replaceWith(el));
 items.forEach(item=>{item.marker.replaceWith(item.el);item.el.style.transform='';item.el.querySelectorAll('.reveal').forEach(el=>{el.style.transform='';el.style.opacity='';delete el.dataset.offset})});
 deck.remove();space.remove();document.documentElement.classList.remove('chapter-mode');dispatchEvent(new Event('resize'));
}
function measure(){
 if(!enabled)return;h=innerHeight;entry=h*.8;hold=h*.18;space.style.marginTop=-h+'px';start=space.getBoundingClientRect().top+scrollY;let offset=0;
 items.forEach(item=>{item.screen.hidden=false;item.screen.style.transform='none';item.body.style.transform='none';
  const els=[...item.body.querySelectorAll('.reveal')];els.forEach(el=>{el.style.transform='none';el.dataset.offset='0'});
  const base=item.body.getBoundingClientRect().top;item.reveals=els.map(el=>({el,top:el.getBoundingClientRect().top-base}));
  item.travel=Math.max(0,item.body.offsetHeight-h);item.offset=offset;item.length=entry+item.travel+hold;offset+=item.length;
 });
 total=offset;space.style.height=(total+h)+'px';displayY=scrollY-start;lastFrame=0;wake();
}
function renderOutro(y){
 const p=ease(y/(entry*.65));story.classList.toggle('chapter-outro',y>0);story.style.setProperty('--outro',String(p));
 // Keep the final scene in place while its objects separate; individual CSS transforms preserve the original choreography.
 pin.style.transform=y>0?'translate3d(0,'+clamp(scrollY-start,0,entry)+'px,0)':'';
}
function update(now){
 raf=0;if(!enabled)return;const targetY=scrollY-start,dt=Math.min(48,now-(lastFrame||now-16));lastFrame=now;
 displayY+=(targetY-displayY)*(1-Math.exp(-dt/(coarse.matches?38:65)));if(Math.abs(targetY-displayY)<.15)displayY=targetY;
 const y=displayY;renderOutro(y);deck.classList.toggle('is-active',y>=0);deck.inert=y<0;
 if(y<0){items.forEach(item=>{item.screen.inert=true;pauseMedia(item)});if(y!==targetY)wake();return;}
 let active=0;for(let i=1;i<items.length;i++)if(y>=items[i].offset)active=i;
 const current=items[active],t=clamp((y-current.offset)/entry),e=ease(t);
 deck.style.setProperty('--chrome-opacity',String(ease((y/entry-.35)/.5)));
 if(previousActive!==active){items.forEach((item,i)=>{if(i!==active)pauseMedia(item)});previousActive=active;}
 items.forEach((item,i)=>{
  const visible=i===active||(i===active-1&&t<1);item.screen.hidden=!visible;item.screen.inert=i!==active||t<.98;item.screen.setAttribute('aria-hidden',String(i!==active));if(!visible)return;
  const local=y-item.offset,scroll=clamp(local-entry,0,item.travel),enter=ease(local/entry);
  item.body.style.transform='translate3d(0,'+(-scroll)+'px,0)';item.screen.style.setProperty('--edge-alpha',String(i===active?1-e:0));
  item.screen.style.filter=i<active?'brightness('+(1-.22*e)+')':'none';
  if(i===0){
   const fade=ease((local/entry-.3)/.7);item.screen.style.opacity=String(fade);item.screen.style.transform='translate3d(0,'+((1-enter)*h*.045)+'px,0) scale('+(.95+.05*enter)+')';item.screen.style.borderRadius='0';
  }else{
   item.screen.style.opacity='1';item.screen.style.transform='translate3d(0,'+(i===active?(1-e)*h:0)+'px,0)';
   item.screen.style.borderRadius=i===active?((1-e)*20)+'px '+((1-e)*20)+'px 0 0':'0';
  }
  item.reveals.forEach(({el,top})=>{const endReveal=item.travel>0?ease((scroll-item.travel+120)/120):1;const v=item.id==='contact'?1:Math.max(ease((h-(top-scroll))/(h*.48)),endReveal),offset=(1-v)*36;el.dataset.offset=String(offset);el.style.opacity=String(.08+.92*v);el.style.transform='translate3d(0,'+offset+'px,0)';});
 });
 const reading=clamp((y-current.offset-entry)/Math.max(1,current.travel));
 deck.querySelectorAll('.chapter-pages-nav a').forEach((a,i)=>{if(i===active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');a.style.setProperty('--read',String(i<active?1:i===active?reading:0))});
 deck.querySelector('.chapter-position').textContent='0'+(active+1)+' / 04 · '+(t<1?'切换章节':y-current.offset<entry+current.travel?'向下浏览 ↓':active<3?'继续下滑 · '+names[active+1]:'感谢浏览');
 if(y!==targetY)wake();
}
function wake(){if(enabled&&!raf)raf=requestAnimationFrame(update)}
// Settle only in the transition zone. Reading, media controls and long chapters retain native scrolling.
function settle(){
 if(!enabled||touching||performance.now()<navigatingUntil)return;
 const y=scrollY-start,item=items.find(x=>y>x.offset+.5&&y<x.offset+entry-.5);if(!item)return;
 const destination=direction>0?item.offset+entry:item.offset-1;
 navigatingUntil=performance.now()+950;scrollTo({top:start+destination,behavior:'smooth'});
}
function onScroll(){const delta=scrollY-lastScroll;if(Math.abs(delta)>.5)direction=Math.sign(delta);lastScroll=scrollY;wake();clearTimeout(settleTimer);settleTimer=setTimeout(settle,180)}
function jump(id,smooth=true){
 const item=items.find(x=>x.id===id);if(!enabled||!item)return;navigatingUntil=performance.now()+1400;clearTimeout(settleTimer);
 const top=start+item.offset+entry;if(!smooth){displayY=top-start;lastFrame=0;}scrollTo({top,behavior:smooth?'smooth':'instant'});wake();
}
document.addEventListener('click',e=>{const a=e.target.closest('a[href^="#"]');if(!a||!enabled||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;
 const id=a.getAttribute('href').slice(1);if(id==='home'){navigatingUntil=performance.now()+1600;return;}if(!ids.includes(id))return;
 e.preventDefault();history.pushState(null,'','#'+id);jump(id);
});
addEventListener('popstate',()=>{if(enabled)jump(location.hash.slice(1),false)});addEventListener('hashchange',()=>{if(enabled)jump(location.hash.slice(1),false)});
addEventListener('scroll',onScroll,{passive:true});addEventListener('wheel',()=>{navigatingUntil=0},{passive:true});
addEventListener('touchstart',()=>{touching=true;navigatingUntil=0;clearTimeout(settleTimer)},{passive:true});
addEventListener('touchend',()=>{touching=false;clearTimeout(settleTimer);settleTimer=setTimeout(settle,200)},{passive:true});
addEventListener('touchcancel',()=>{touching=false},{passive:true});
document.addEventListener('visibilitychange',()=>{if(document.hidden)items.forEach(pauseMedia);else wake()});
addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(measure,120)});
reduce.addEventListener('change',()=>reduce.matches?disable():enable());
enable();if(document.fonts)document.fonts.ready.then(measure);addEventListener('load',measure);document.querySelectorAll('img').forEach(img=>img.addEventListener('load',()=>{if(enabled)measure()}));
})();
