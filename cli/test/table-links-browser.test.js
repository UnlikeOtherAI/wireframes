'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright');
const {renderWireframeMarkup} = require('../../engine/screenshots/renderer');
function fixture(mode = 'card', routes = {detail: '/detail', home: '/home'}, overlay = false, cell = {text:'Device A',route:' detail '}) {
 const table = {id:'devices',component:'table',props:{columns:[
  {key:'name',label:'Device',kind:'link'}, {key:'status',label:'Status'}
 ],rows:[
  {name:cell,status:'Online'},
  [{text:'Device B',route:'detail'},'Offline'],
  {name:'Unlinked legacy cell',status:'Waiting'},
  {name:{text:'Unknown detail',route:'missing'},status:'Waiting'}
 ]}};
 return renderWireframeMarkup({roots:[{id:'main',kind:'container',nodes:overlay
  ?[{id:'open',component:'button',props:{label:'Devices'},interaction:[{type:'open_overlay',targetOverlay:'device_dialog'}]}]
  :[table]}],overlays:overlay?[{id:'device_dialog',type:'modal',trigger:'open',props:{title:'Devices'},content:[table]}]:[],
  routeTable:routes,rendering:{mode},pageViewport:{device:'web',width:1280,height:800},deviceChrome:false});
}
test('table link objects navigate with mouse, keyboard and touch; scalar and unknown cells remain inert',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const touch of [false,true]) for(const mode of ['line','card']){
   const context=await browser.newContext({viewport:touch?{width:768,height:1024}:{width:1280,height:800},hasTouch:touch});
   await context.route('https://prototype.test/**',r=>r.fulfill({body:new URL(r.request().url()).pathname==='/detail'
    ?'<h1>Device A detail</h1><a href="/home">Back to devices</a>':fixture(mode),contentType:'text/html'}));
   const page=await context.newPage();await page.goto('https://prototype.test/home');
   assert.equal(await page.getByRole('link',{name:'Device A',exact:true}).count(),1);
   assert.equal(await page.getByRole('link',{name:'Device B',exact:true}).count(),1);
   assert.equal(await page.getByRole('link',{name:'Unlinked legacy cell'}).count(),0);
   assert.equal(await page.getByRole('link',{name:'Unknown detail'}).count(),0);
   assert.equal(await page.locator('a a').count(),0);
   const link=page.getByRole('link',{name:'Device A',exact:true});
   assert.equal(await link.getAttribute('data-wf-route-target'),'detail');
   if(touch){const box=await link.boundingBox();assert.ok(box.height>=44&&box.width>=44);await link.tap();}
   else {await link.focus();await page.keyboard.press('Enter');}
   await page.waitForURL('**/detail');assert.equal(await page.getByRole('heading',{name:'Device A detail'}).count(),1);
   await page.getByRole('link',{name:'Back to devices'}).click();await page.waitForURL('**/home');
   await page.getByRole('link',{name:'Device B',exact:true}).click();await page.waitForURL('**/detail');
   await context.close();
  }
 }finally{await browser.close();}
});
test('hostile route tables and labels cannot inject executable links or markup',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage();
  for(const href of ['javascript:alert(1)','data:text/html,x','//evil.test','/\\evil.test',' /detail','foo:bar','/de\ttail','/de\ntail']){
   await page.setContent(fixture('card',{detail:href}));assert.equal(await page.locator('.wf-table-link').count(),0,href);
  }
  const inherited=Object.create({detail:'/detail'});
  await page.setContent(fixture('card',inherited));assert.equal(await page.locator('.wf-table-link').count(),0);
  const routes=Object.create(null);routes.detail='/detail%20safe';
  await page.setContent(fixture('card',routes));assert.equal(await page.locator('.wf-table-link').first().getAttribute('href'),'/detail%20safe');
  const html=fixture('card',{detail:'/detail'},false,{text:'<img src=x onerror=alert(1)>',route:'detail'});
  await page.setContent(html);assert.equal(await page.locator('#devices img').count(),0);
  assert.ok((await page.locator('.wf-table-link').first().textContent()).includes('<img'));
 }finally{await browser.close();}
});
test('table links use existing route attributes inside overlays',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage();await page.setContent(fixture('card',{detail:'#detail'},true));
  await page.getByRole('button',{name:'Devices',exact:true}).click();
  assert.equal(await page.locator('#device_dialog').isVisible(),true);
  assert.equal(await page.locator('#device_dialog').getByRole('link',{name:'Device A',exact:true}).getAttribute('href'),'#detail');
  await page.keyboard.press('Escape');assert.equal(await page.locator('#device_dialog').isVisible(),false);
 }finally{await browser.close();}
});
if(process.env.TABLE_LINK_SCREENSHOTS){
 test('capture the changed link-cell state at matching viewports',async()=>{
  const browser=await chromium.launch({headless:true});
  try{for(const [label,width,height,touch]of [['desktop',1280,800,false],['touch',768,1024,true]]){
   const page=await browser.newPage({viewport:{width,height},hasTouch:touch});await page.setContent(fixture());
   fs.mkdirSync(process.env.TABLE_LINK_SCREENSHOTS,{recursive:true});
   await page.screenshot({path:path.join(process.env.TABLE_LINK_SCREENSHOTS,label+'.png')});await page.close();
  }}finally{await browser.close();}
 });
}
