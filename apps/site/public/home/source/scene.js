(()=>{
 const $=s=>document.querySelector(s),NS='http://www.w3.org/2000/svg',mix=(a,b,t)=>a+(b-a)*t,clamp=x=>Math.max(0,Math.min(1,x));
 function el(tag,attrs,parent){const e=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);parent.append(e);return e;}
 const modules=[{name:'MCP',x:48,index:0},{name:'Projects',x:212,index:2},{name:'Retrieve URL',x:376,index:4}].map(m=>({...m,move:0,open:0,grow:0,settle:0}));
 const data=[['app/',0,'folder'],['components/chat/',0,'folder'],['lib/ai/',0,'folder'],['plugins/',0,'folder'],['mcp/',1,'module',0],['client-plugin.ts',2,'file',0],['server-plugin.ts',2,'file',0],['projects/',1,'module',1],['client-plugin.ts',2,'file',1],['router.ts',2,'file',1],['tools/chatjs/',0,'folder'],['get-weather/',1,'folder'],['tool.ts',2,'file'],['retrieve-url/',1,'module',2],['tool.ts',2,'file',2],['renderer.tsx',2,'file',2],['chat.config.ts',0,'file']];
 $('#root-mark').innerHTML=CarbonMotion.mark();$('#root-mark').firstElementChild.setAttribute('width',22);$('#root-mark').firstElementChild.setAttribute('height',22);$('#root-mark').setAttribute('transform','translate(636 60)');
 const rows=data.map(([label,depth,type,module],index)=>{
  const x=636+depth*25,g=el('g',{},$('#rows')),guide=el('path',{class:'guide',d:depth?`M${x-14} -28V0H${x-4}`:'M624 0H632'},g),content=el('g',{},g);
  if(type==='file'){el('rect',{x,y:-9,width:13,height:17,class:'file-glyph'},content);el('path',{d:`M${x+3} -4h7m-7 4h5`,class:'file-glyph'},content);}else el('rect',{x:x+2,y:-5,width:8,height:8,class:'joint'},content);
  const text=el('text',{x:x+25,y:5,class:'row-label '+(module!==undefined?'new-label ':'')+(type==='module'?'module-label':type==='folder'?'folder-label':'')},content);text.textContent=label;
  if(type==='module'){const tag=el('text',{x:1108,y:3,class:'added','text-anchor':'end'},content);tag.textContent='ADDED';}
  return{g,guide,content,module,type,index,x,y:0,alpha:0};
 });
 const pieces=modules.map((m,i)=>{
  const clip=el('clipPath',{id:`clip-${i}`},$('defs')),clipRect=el('rect',{width:144,height:144},clip);
  const group=el('g',{},$('#pieces')),bg=el('rect',{width:144,height:144,fill:'#121211',stroke:'#404039','stroke-width':1},group),inner=el('g',{'clip-path':`url(#clip-${i})`},group);
  const wave=el('g',{},inner);wave.innerHTML=CarbonSquare.svg(m.name,'Optional',m.index);wave.firstElementChild.setAttribute('width',144);wave.firstElementChild.setAttribute('height',144);
  const outline=el('rect',{x:.5,y:.5,width:143,height:143,fill:'none',stroke:'#404039','stroke-width':1},group);
  const label=wave.querySelector('.square-name'),number=wave.querySelector('.square-meta'),shade=wave.querySelector('.square-shade'),surface=wave.querySelector('.square-surface');
  const slot=el('g',{transform:`translate(${m.x} 250)`,opacity:0},$('#slots'));
  el('rect',{width:144,height:144,fill:'#121211',stroke:'#404039'},slot);const art=el('g',{},slot);art.innerHTML=CarbonSquare.svg(m.name,'Added',m.index);art.firstElementChild.setAttribute('width',144);art.firstElementChild.setAttribute('height',144);slot.append(outline.cloneNode(true));
  return{group,bg,wave,label,number,shade,surface,slot,clipRect,outline};
 });
 const clock={t:0};
 function render(){
  const mobile=innerWidth<540,treeX=mobile?-590:0,treeY=mobile?340:0;
  $('#scene').setAttribute('viewBox',mobile?'0 0 600 1160':'0 0 1200 720');$('#tree').setAttribute('transform',`translate(${treeX} ${treeY})`);$('#library').setAttribute('transform',mobile?'translate(0 -180)':'translate(0 0)');
  let y=156;const targets=[];
  rows.forEach(row=>{row.y=y;row.g.setAttribute('transform',`translate(0 ${y.toFixed(3)})`);const m=row.module===undefined?null:modules[row.module];if(row.type==='module')targets[row.module]=row;
   const a=m?row.alpha:1;row.content.setAttribute('opacity',a);row.content.setAttribute('transform',`translate(${m?6*(1-a):0} 0)`);row.guide.setAttribute('opacity',a);y+=28*(m?m.grow:1);
   if(m&&data[row.index+1]?.[3]!==row.module)y+=12*m.grow;
  });
  $('#trunk').setAttribute('d',`M624 132V${y-28}`);
  modules.forEach((m,i)=>{const p=pieces[i],r=targets[i],x=mix(m.x,r.x-14+treeX,m.move),destY=r.y-19+treeY,y=mix(mobile?70:250,destY,m.move),w=mix(144,466,m.open),h=mix(144,91,m.open);
   p.group.setAttribute('transform',`translate(${x.toFixed(3)} ${y.toFixed(3)})`);p.outline.setAttribute('width',w-1);p.outline.setAttribute('height',h-1);p.bg.setAttribute('width',w);p.bg.setAttribute('height',h);p.bg.setAttribute('fill-opacity',1-m.open);p.bg.setAttribute('stroke',m.open>.01?'#747469':'#404039');p.clipRect.setAttribute('width',w);p.clipRect.setAttribute('height',h);
   // The square's field becomes a restrained texture inside the source outline.
   p.wave.setAttribute('transform',`scale(${w/144} ${h/144})`);p.wave.setAttribute('opacity',mix(1,.14,m.open));p.shade.setAttribute('opacity',1-m.open);p.surface.setAttribute('opacity',1-m.open);p.label.setAttribute('opacity',1-clamp(m.move*1.8));p.number.setAttribute('opacity',1-clamp(m.move*1.8));p.slot.setAttribute('opacity',m.settle);
  });
  const phase=clock.t<.65?0:clock.t<3.35?1:clock.t<6.05?2:clock.t<8.2?3:4;
  $('#status').textContent=['Add only what your app needs.','MCP becomes part of your app.','Projects finds its place.','A tool joins the same source.','Your capabilities. Your code.'][phase];
 }
 const tl=gsap.timeline({paused:true,onUpdate:render});tl.to(clock,{t:10,duration:10,ease:'none'},0);
 modules.forEach((m,i)=>{const at=.65+i*2.7;
  tl.to(m,{grow:1,duration:.55,ease:'power3.inOut'},at);
  tl.to(m,{move:1,duration:1.05,ease:'power3.inOut'},at+.12);
  tl.to(m,{open:1,duration:.62,ease:'power3.inOut'},at+.6);
  rows.filter(r=>r.module===i).forEach((r,j)=>tl.to(r,{alpha:1,duration:.3,ease:'power3.out'},at+1.06+j*.06));
  tl.to(m,{settle:1,duration:.3,ease:'power2.out'},at+1.22);
 });
 window.__timelines=window.__timelines||{};window.__timelines['source-choreography']=tl;window.MotionStudy={duration:10,seek(t){tl.seek(clamp(t/10)*10,false);render();}};addEventListener('resize',render);render();
})();

// Only the same-origin parent controls this isolated illustration timeline.
addEventListener("message", event => { if (event.source !== parent || event.origin !== new URL(document.referrer).origin || event.data?.type !== "chatjs:seek" || typeof event.data.time !== "number" || !Number.isFinite(event.data.time)) return; window.MotionStudy.seek(event.data.time); });
