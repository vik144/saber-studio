const $=id=>document.getElementById(id);
const number=id=>String(id).padStart(2,'0');
const defaultPath=Array.from({length:121},(_,i)=>{const x=i/120;return [(x-.5)*1360,135*Math.sin((x*2.2-.32)*Math.PI)*Math.sin(x*Math.PI)]});
const state={
  preset:presets[1],color:presets[1].color,shape:'Ring',width:1,intensity:1,spread:1,distortion:1,speed:1,
  time:1.25,center:[0,0],radius:332,ends:[-710,0,710,0],text:'SABER',path:defaultPath,
};
const thumbs=/* THUMBNAILS */{};
const controls=[
  ['width','Core size',.2,4,.05,v=>(v*state.preset.p[0]).toFixed(1)+' px'],
  ['intensity','Intensity',0,3,.01,v=>Math.round(v*100)+'%'],
  ['spread','Spread',.1,3,.01,v=>Math.round(v*100)+'%'],
  ['distortion','Distortion',0,2.5,.01,v=>Math.round(v*100)+'%'],
  ['speed','Speed',.25,3,.05,v=>v.toFixed(2).replace(/0$/,'')+'×'],
];
let renderer,thumbRenderer,playing=!matchMedia('(prefers-reduced-motion: reduce)').matches,editing=false,dirty=true,mask=null,exporting=false,cancelExport=false;
let lastTick=0,lastPaint=0,toastTimer=0,textTimer=0,hasGpu=true;
function notify(message){
  $('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>$('toast').hidden=true,2300);
}
function rangeFill(el){el.style.setProperty('--fill',((el.value-el.min)/(el.max-el.min)*100)+'%')}
function frameBox(){
  const r=$('stage').getBoundingClientRect();
  const w=Math.min(r.width,r.height*16/9),h=w*9/16;
  return {w,h,left:(r.width-w)/2,top:(r.height-h)/2};
}
function updateMask(){
  if(!hasGpu)return;
  if(state.shape==='Text') mask=textDistance(state.text);
  else if(state.shape==='Path') mask=pathDistance(state.path);
  else return;
  renderer.setMask(mask);dirty=true;
}
function drawFrame(){
  if(!hasGpu)return;
  const box=frameBox(),dpr=Math.min(devicePixelRatio||1,1.5);
  const w=Math.max(16,Math.round(Math.min(1920,box.w*dpr)/16)*16);
  renderer.render(state,w,w*9/16);dirty=false;
}
function syncClock(){
  $('timeline').value=state.time;rangeFill($('timeline'));
  $('clock').textContent='00:'+state.time.toFixed(2).padStart(5,'0');
}
function tick(now){
  const dt=lastTick?Math.min((now-lastTick)/1000,.2):0;lastTick=now;
  if(playing&&!document.hidden&&!exporting){state.time=(state.time+dt*state.speed)%8;dirty=true}
  if(dirty&&now-lastPaint>=(1000/30)-1&&!document.hidden){drawFrame();syncClock();lastPaint=now}
  requestAnimationFrame(tick);
}
function syncPlay(){
  $('play').innerHTML=icon(playing?'pause':'play');
  $('play').setAttribute('aria-label',playing?'Pause animation':'Play animation');
  $('stage').classList.toggle('paused',!playing);$('live-label').textContent=playing?'LIVE':'PAUSED';
}
function togglePlay(){playing=!playing;syncPlay()}
function setPlaying(value){playing=value;syncPlay()}
function makeControls(){
  for(const [key,label,min,max,step,format] of controls){
    const box=$(key+'-control');box.className='control';
    box.innerHTML='<div class="control-top"><label for="'+key+'">'+label+'</label><output for="'+key+'"></output></div><input type="range" id="'+key+'" min="'+min+'" max="'+max+'" step="'+step+'">';
    $(key).oninput=()=>{state[key]=Number($(key).value);box.querySelector('output').textContent=format(state[key]);rangeFill($(key));dirty=true};
  }
  for(const name of ['Line','Ring','Text','Path']){
    const b=document.createElement('button');b.innerHTML=icon(name.toLowerCase())+name;b.dataset.shape=name;
    b.onclick=()=>{state.shape=name;editing=false;updateMask();syncControls();dirty=true};$('shapes').append(b);
  }
}
function syncControls(){
  for(const [key,,,,,format] of controls){
    $(key).value=state[key];rangeFill($(key));$(key+'-control').querySelector('output').textContent=format(state[key]);
  }
  $('color').value=state.color;$('hex').textContent=state.color.toUpperCase();
  $('active-name').textContent=state.preset.name;$('preset-id').textContent='PRESET / '+number(state.preset.id);
  $('shapes').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.shape===state.shape)));
  $('text-row').hidden=state.shape!=='Text';$('geometry-row').hidden=state.shape==='Text';
  $('text-input').value=state.text;
  document.querySelectorAll('.preset-card').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.id)===state.preset.id)));
  syncGeometry();
}
function applyPreset(p){
  state.preset=p;state.color=p.color;
  for(const [key] of controls) state[key]=1;
  dirty=true;syncControls();
}
function thumbnail(p){
  if(thumbs[p.id])return thumbs[p.id];
  if(!hasGpu)return '';
  if(!thumbRenderer)thumbRenderer=new SaberRenderer(document.createElement('canvas'));
  const s={...state,preset:p,color:p.color,time:1.25,width:1,intensity:1,spread:1,distortion:1};
  thumbRenderer.render(s,420,156,true);
  return thumbs[p.id]=thumbRenderer.canvas.toDataURL('image/webp',.95);
}
function card(p){
  const b=document.createElement('button');b.className='preset-card';b.dataset.id=p.id;
  b.setAttribute('aria-pressed',String(p.id===state.preset.id));
  b.setAttribute('aria-label','Apply '+p.name+' preset');
  b.innerHTML='<img class="thumb" alt=""><span class="selected-dot">'+icon('check')+'</span><span class="card-label"><span class="card-number">'+number(p.id)+'</span><span class="card-name">'+p.name+'</span></span>';
  const src=thumbnail(p);if(src)b.querySelector('img').src=src;
  b.onclick=()=>{applyPreset(p);if($('library-dialog').open)$('library-dialog').close();refreshFeatured()};
  return b;
}
function refreshFeatured(){
  const ids=[...featured];if(!ids.includes(state.preset.id))ids[0]=state.preset.id;
  $('featured').replaceChildren(...ids.map(id=>card(presets[id-1])));
}
function showResults(){
  const query=$('search').value.toLowerCase().trim();
  const matches=presets.filter(p=>(!$('family').value||p.family===$('family').value)&&(p.name.toLowerCase().includes(query)||number(p.id)===query));
  $('results').replaceChildren(...matches.map(card));$('empty').hidden=matches.length>0;$('results').scrollTop=0;
}
const familyNames={clean:'Clean',arc:'Electric',ember:'Ember',cloud:'Cloud',plasma:'Plasma',flame:'Flame',mist:'Mist',wave:'Wave'};
for(const [value,label] of Object.entries(familyNames))$('family').add(new Option(label,value));
$('browse').onclick=()=>{$('library-dialog').showModal();$('search').value='';$('family').value='';showResults();$('search').focus()};
$('search').oninput=showResults;$('family').onchange=showResults;
$('color').oninput=()=>{state.color=$('color').value;$('hex').textContent=state.color.toUpperCase();dirty=true};
$('text-input').oninput=()=>{state.text=$('text-input').value;clearTimeout(textTimer);textTimer=setTimeout(updateMask,75)};
$('play').onclick=togglePlay;$('restart').onclick=()=>{state.time=0;dirty=true;syncClock()};
$('timeline').oninput=()=>{setPlaying(false);state.time=Number($('timeline').value);dirty=true;syncClock()};
$('guide-toggle').onclick=()=>{const el=document.querySelector('.guides');el.hidden=!el.hidden;$('guide-toggle').setAttribute('aria-pressed',String(!el.hidden))};
$('fullscreen').onclick=async()=>{
  try{if(document.fullscreenElement)await document.exitFullscreen();else await $('full-view').requestFullscreen()}
  catch{notify('Fullscreen is unavailable in this browser.')}
};
$('reset').onclick=()=>{applyPreset(state.preset);notify('Preset controls reset')};
$('edit-geo').onclick=()=>{editing=!editing;syncGeometry();if(editing&&state.shape==='Path')notify('Drag on the canvas to draw a path')};
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&editing){editing=false;syncGeometry()}
  if(e.code==='Space'&&!e.repeat&&!document.querySelector('dialog[open]')&&!['INPUT','SELECT','BUTTON','TEXTAREA'].includes(document.activeElement.tagName)){e.preventDefault();togglePlay()}
});
document.querySelectorAll('dialog').forEach(dialog=>{
  const close=()=>{if(exporting&&dialog.id==='export-dialog'){cancelExport=true;return}dialog.close()};
  dialog.querySelector('.close').onclick=close;
  dialog.addEventListener('cancel',e=>{if(exporting&&dialog.id==='export-dialog'){e.preventDefault();cancelExport=true}});
  dialog.onclick=e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close()}};
});
function pointForEvent(e){
  const rect=$('stage').getBoundingClientRect(),b=frameBox();
  return [Math.max(-960,Math.min(960,((e.clientX-rect.left-b.left)/b.w-.5)*1920)),Math.max(-540,Math.min(540,(.5-(e.clientY-rect.top-b.top)/b.h)*1080))];
}
function positionPoint(el,point){
  const b=frameBox();el.style.left=(b.left+(.5+point[0]/1920)*b.w)+'px';el.style.top=(b.top+(.5-point[1]/1080)*b.h)+'px';
}
function geometryPoints(){return state.shape==='Ring'?[state.center,[state.center[0]+state.radius,state.center[1]]]:[state.ends.slice(0,2),state.ends.slice(2)]}
function movePoint(index,point){
  if(state.shape==='Line'){
    const other=state.ends.slice(index?0:2,index?2:4);
    if(Math.hypot(point[0]-other[0],point[1]-other[1])<5)return;
    state.ends.splice(index*2,2,...point);
  } else if(index===0){state.center=[Math.min(940-state.radius,point[0]),point[1]]}
  else {state.radius=Math.max(15,Math.min(940-state.center[0],Math.hypot(point[0]-state.center[0],point[1]-state.center[1])))}
  geometryPoints().forEach((p,i)=>positionPoint($('point-layer').children[i],p));dirty=true;
}
function syncGeometry(){
  const stage=$('stage');stage.classList.toggle('is-editing',editing);stage.classList.toggle('is-drawing',editing&&state.shape==='Path');
  $('edit-geo').querySelector('span').textContent=editing?'Done editing':state.shape==='Path'?'Draw path':'Edit geometry';
  $('edit-geo').setAttribute('aria-pressed',String(editing));$('point-layer').replaceChildren();
  if(!editing||!['Line','Ring'].includes(state.shape))return;
  geometryPoints().forEach((point,i)=>{
    const b=document.createElement('button');b.className='geometry-point';
    b.setAttribute('aria-label',(state.shape==='Line'?['Start point','End point']:['Center','Radius'])[i]);
    positionPoint(b,point);$('point-layer').append(b);
    b.onpointerdown=e=>{b.setPointerCapture(e.pointerId);e.preventDefault()};
    b.onpointermove=e=>{if(b.hasPointerCapture(e.pointerId))movePoint(i,pointForEvent(e))};
    b.onkeydown=e=>{
      const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,1],ArrowDown:[0,-1]}[e.key];if(!delta)return;
      e.preventDefault();const cur=geometryPoints()[i];movePoint(i,cur.map((v,j)=>v+delta[j]*(e.shiftKey?20:3)));
    };
  });
}
let stroke=null,trace=null;
$('stage').addEventListener('pointerdown',e=>{
  if(!editing||state.shape!=='Path'||e.target.closest('button'))return;
  e.preventDefault();$('stage').setPointerCapture(e.pointerId);stroke=[pointForEvent(e)];
  trace=document.createElement('canvas');trace.className='points-overlay';trace.width=1920;trace.height=1080;$('stage').append(trace);
});
$('stage').addEventListener('pointermove',e=>{
  if(!stroke)return;const p=pointForEvent(e),last=stroke[stroke.length-1];
  if(Math.hypot(p[0]-last[0],p[1]-last[1])<5)return;
  const ctx=trace.getContext('2d');ctx.lineWidth=3;ctx.strokeStyle='#b7c9ff';ctx.beginPath();ctx.moveTo(last[0]+960,540-last[1]);ctx.lineTo(p[0]+960,540-p[1]);ctx.stroke();stroke.push(p);
});
function finishStroke(e){
  if(!stroke)return;
  if(e.type!=='pointercancel'&&stroke.length>1){state.path=stroke;updateMask()}
  stroke=null;trace.remove();trace=null;
}
$('stage').addEventListener('pointerup',finishStroke);$('stage').addEventListener('pointercancel',finishStroke);
new ResizeObserver(()=>{dirty=true;if(editing&&!stroke)syncGeometry()}).observe($('stage'));
function videoFormat(){
  if(!window.MediaRecorder||!HTMLCanvasElement.prototype.captureStream)return null;
  return ['video/webm;codecs=vp9','video/webm;codecs=vp8','video/mp4;codecs=avc1.42E01E','video/mp4'].find(t=>MediaRecorder.isTypeSupported(t));
}
function syncExport(){
  const video=$('export-type').value==='video';$('alpha-row').hidden=video;
  $('save').querySelector('span').textContent=video?'Save loop':'Save frame';
  $('export-note').textContent=video?'Records one '+(8/state.speed).toFixed(1)+' s loop. Keep this tab visible during export.':'';
}
$('export-open').onclick=()=>{if(!hasGpu)return;$('export-type').querySelector('[value=video]').disabled=!videoFormat();syncExport();$('export-dialog').showModal()};
$('export-type').onchange=syncExport;
function download(blob,ext){
  const link=document.createElement('a'),url=URL.createObjectURL(blob);
  const name=($('project-name').value.trim()||'Saber').replace(/[^a-z0-9_-]+/gi,'-');
  link.download=name+'-'+state.preset.name.replaceAll(' ','-')+'.'+ext;link.href=url;document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
}
let exportRenderer;
async function recordLoop(r,w,h){
  const mime=videoFormat();if(!mime)throw new Error('Video export is unavailable in this browser.');
  r.render({...state,time:0},w,h);
  const stream=r.canvas.captureStream(30),rec=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:w>=3840?36000000:18000000}),parts=[];
  const done=new Promise((resolve,reject)=>{rec.ondataavailable=e=>{if(e.data.size)parts.push(e.data)};rec.onstop=()=>resolve(new Blob(parts,{type:mime}));rec.onerror=e=>reject(e.error||new Error('Video recording failed.'))});
  let timer;
  try{
    rec.start(250);
    const start=performance.now(),duration=8000/state.speed;
    timer=setInterval(()=>{
      const t=(performance.now()-start)/duration;
      if(document.hidden)cancelExport=true;
      if(t>=1||cancelExport){clearInterval(timer);if(rec.state==='recording')rec.stop();return}
      r.render({...state,time:t*8},w,h);$('export-note').textContent='Recording loop · '+Math.floor(t*100)+'%';
    },1000/30);
    const blob=await done;if(!cancelExport)download(blob,mime.includes('mp4')?'mp4':'webm');
  } finally {clearInterval(timer);stream.getTracks().forEach(t=>t.stop())}
}
$('export-form').onsubmit=async e=>{
  e.preventDefault();if(exporting)return;
  exporting=true;cancelExport=false;const btn=$('save');btn.disabled=true;$('export-form').setAttribute('aria-busy','true');
  for(const el of [$('alpha'),$('export-type'),$('export-size')])el.disabled=true;
  try{
    const w=Number($('export-size').value),h=w*9/16;
    if(!exportRenderer)exportRenderer=new SaberRenderer(document.createElement('canvas'));
    if(mask)exportRenderer.setMask(mask);
    if($('export-type').value==='video')await recordLoop(exportRenderer,w,h);
    else{
      exportRenderer.render(state,w,h,false,$('alpha').checked);
      const blob=await new Promise(resolve=>exportRenderer.canvas.toBlob(resolve,'image/png'));
      if(!blob)throw new Error('The browser could not save this frame.');
      if(!cancelExport)download(blob,'png');
    }
    $('export-dialog').close();notify(cancelExport?'Export canceled':'Export saved');
  }catch(err){$('export-note').textContent=err.message}
  finally{exporting=false;btn.disabled=false;$('export-form').removeAttribute('aria-busy');for(const el of [$('alpha'),$('export-type'),$('export-size')])el.disabled=false}
};
try{renderer=new SaberRenderer($('preview'))}catch(e){
  hasGpu=false;const el=document.querySelector('.stage-error');el.hidden=false;el.textContent=e.message;$('export-open').disabled=true;
}
makeControls();syncControls();syncPlay();syncClock();refreshFeatured();drawFrame();
document.fonts.ready.then(()=>{if(state.shape==='Text')updateMask()});
requestAnimationFrame(tick);
