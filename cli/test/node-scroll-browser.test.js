'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {scrollProject}=require('./fixtures/scroll-project');
const {renderPage}=require('../../engine/build');
const {renderNode}=require('../../engine/renderer/primitives');
const {validateDocument}=require('../../engine/schema');
test('scroll is an explicit boolean and false preserves legacy node markup',()=>{
 const node={id:'box',component:'stack',children:[]};
 assert.equal(renderNode(node,{}),renderNode({...node,scroll:false},{}));
 const doc=scrollProject().pages.get('home');assert.doesNotThrow(()=>validateDocument(doc,'scroll'));
 doc.page.slots[0].content[1].scroll='auto';assert.throws(()=>validateDocument(doc,'scroll'));
 const hostile=renderNode({...node,scroll:true,accessibility:{label:'List" onfocus="alert(1)<img>'}},{});
 assert.match(hostile,/aria-label="List&quot; onfocus=&quot;alert\(1\)&lt;img&gt;"/);
});
for(const touch of[false,true])test('native '+(touch?'touch':'wheel/keyboard')+' scrolling keeps records, sticky heading and footer bounded',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:800,height:650},hasTouch:touch});
  const result=renderPage(scrollProject(),'home',{deviceChrome:false,routeTable:{home:'#home',details:'#details'},viewportOverride:{device:'web',width:800,height:650}});
  assert.equal(result.ok,true,result.error);await page.setContent(result.html);
  const region=page.getByRole('region',{name:'Records list'}),box=await region.boundingBox();
  const footer=await page.locator('#outside_footer').boundingBox();
  assert.equal(await region.evaluate(n=>getComputedStyle(n).resize),'none');
  assert.equal(await region.evaluate(n=>n.scrollWidth<=n.clientWidth+1),true);
  assert.ok(await region.evaluate(n=>n.scrollHeight>n.clientHeight*2));
  assert.ok(Math.abs((await page.locator('#record_1').boundingBox()).height-52)<1);
  if(touch){
   const cdp=await page.context().newCDPSession(page),x=box.x+box.width/2,y=box.y+box.height-25;
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
   for(let step=1;step<=6;step++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-step*25}]});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  }else{
   await region.hover();await page.mouse.wheel(0,240);
  }
  await page.waitForFunction(()=>document.getElementById('records').scrollTop>40);
  assert.ok(Math.abs((await page.locator('#column_heading').boundingBox()).y-box.y)<2);
  assert.ok(Math.abs((await page.locator('#outside_footer').boundingBox()).y-footer.y)<1);
  assert.equal(await page.evaluate(()=>scrollY),0);
  if(!touch){await region.focus();const before=await region.evaluate(n=>n.scrollTop);await page.keyboard.press('PageDown');await page.waitForFunction(v=>document.getElementById('records').scrollTop>v,before);}
  await region.evaluate(n=>n.scrollTop=n.scrollHeight);await region.hover();await page.mouse.wheel(0,1500);
  await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>scrollY),0,'overscroll stays inside region');
  await page.locator('#open_15').click();assert.equal(await page.evaluate(()=>location.hash),'#details');
  const after=await page.locator('#outside_footer').boundingBox();assert.ok(Math.abs(after.y-footer.y)<1);
 }finally{await browser.close();}
});
test('horizontal children retain width and titled sections scroll as whole nodes',async()=>{
 const browser=await chromium.launch();
 try{
  const page=await browser.newPage({viewport:{width:600,height:500}});
  const map=scrollProject();map.pages.get('home').page.slots[0].content=[
   {id:'horizontal',component:'row',scroll:true,size:{width:240},layout:{type:'row',gap:0},children:[
    {id:'wide_input',component:'input',size:{width:200},props:{label:'Name'}},
    {id:'wide_button',component:'button',size:{width:200},props:{label:'Save'}}]},
   {id:'section',component:'section',scroll:true,size:{height:120},props:{title:'Section title'},children:[
    {id:'large',component:'spacer',size:{height:500}}]}
  ];
  await page.setContent(renderPage(map,'home',{deviceChrome:false}).html);
  assert.ok(await page.locator('#horizontal').evaluate(n=>n.scrollWidth>n.clientWidth));
  assert.ok((await page.locator('#wide_input').boundingBox()).width>=199);
  assert.ok(await page.locator('#section').evaluate(n=>n.scrollHeight>n.clientHeight));
 }finally{await browser.close();}
});
