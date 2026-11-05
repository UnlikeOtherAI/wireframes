'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const fixture=require('./helpers/appearance-fixture');
const {renderWireframeMarkup}=require('../../engine/screenshots/renderer');
const pageFor=(nodes,extra={})=>renderWireframeMarkup({roots:[{id:'main',kind:'container',nodes}],pageViewport:{device:'web',width:1280,height:900},rendering:{mode:'card'},deviceChrome:false,...extra});
for(const touch of [false,true]) test('appearance controls update real previews with '+(touch?'touch':'mouse'),async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:900},hasTouch:touch,isMobile:touch});
  await page.setContent(fixture());
  const activate=async locator=>touch?locator.tap():locator.click();
  const pressed=id=>page.locator('#'+id+' [aria-pressed=true]').allTextContents();
  assert.deepEqual(await pressed('sizes'),['Medium']);
  for(const label of ['Small','Large','Medium']){
   await activate(page.locator('#sizes').getByRole('button',{name:label,exact:true}));
   assert.deepEqual(await pressed('sizes'),[label]);assert.deepEqual(await pressed('sizes_mirror'),[label]);
  }
  await activate(page.locator('#local_sizes').getByRole('button',{name:'Left',exact:true}));
  assert.deepEqual(await pressed('local_sizes'),['Left']);
  for(const [label,index] of [['Conversation',2],['First screen',1],['Bubble',0]]){
   await activate(page.locator('#preview_tabs').getByRole('button',{name:label,exact:true}));
   assert.deepEqual(await pressed('preview_tabs'),[label]);
   for(let i=0;i<3;i++)assert.equal(await page.locator('#panel_'+i).isVisible(),i===index);
  }
  const hex=page.getByRole('textbox',{name:'Colour hex',exact:true}),picker=page.getByLabel('Colour picker',{exact:true});
  assert.equal(await hex.inputValue(),'#0b172a');assert.equal(await picker.inputValue(),'#0b172a');
  await hex.fill('#A1B2C3');assert.equal(await hex.inputValue(),'#A1B2C3');assert.equal(await picker.inputValue(),'#a1b2c3');
  await hex.fill('#f');await activate(page.getByRole('button',{name:'Refresh unrelated state',exact:true}));
  assert.equal(await hex.inputValue(),'#f');assert.equal(await hex.getAttribute('aria-invalid'),'true');assert.equal(await picker.inputValue(),'#a1b2c3');
  await hex.fill('#ff0000');assert.equal(await hex.getAttribute('aria-invalid'),'false');
  await picker.fill('#123456');await picker.dispatchEvent('input');
  assert.equal(await hex.inputValue(),'#123456');
  await page.getByRole('textbox',{name:'Button text',exact:true}).fill('Talk to us');
  const launcher=page.locator('#launcher').getByRole('button',{name:'Talk to us',exact:true});
  assert.equal(await launcher.count(),1);assert.equal(await launcher.locator('.wf-icon-glyph').count(),1);
  await activate(launcher);assert.equal(await page.locator('#dialog').isVisible(),true);
  await activate(page.getByRole('button',{name:'Close',exact:true}));assert.equal(await page.locator('#dialog').isVisible(),false);
  assert.equal(await page.getByLabel('Disabled colour picker',{exact:true}).isDisabled(),true);
  assert.equal(await page.getByRole('textbox',{name:'Disabled colour hex',exact:true}).isDisabled(),true);
  if(touch){
   const rects=await page.locator('#sizes button,#preview_tabs button,#colour input').evaluateAll(es=>es.map(e=>({w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height})));
   assert.ok(rects.every(r=>r.w>=44&&r.h>=44),JSON.stringify(rects));
  }
  await page.locator('#sizes').getByRole('button',{name:'Large',exact:true}).focus();await page.keyboard.press('Space');
  assert.deepEqual(await pressed('sizes'),['Large']);
  await page.locator('#preview_tabs').getByRole('button',{name:'Conversation',exact:true}).focus();await page.keyboard.press('Enter');
  assert.equal(await page.locator('#panel_2').isVisible(),true);
  await activate(page.locator('#preview_tabs').getByRole('link',{name:'Settings',exact:true}));
  assert.ok(page.url().endsWith('#settings'));
 }finally{await browser.close();}
});
test('control selection restores app state and does not trigger selectable ancestors',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const context=await browser.newContext();await context.route('https://prototype.test/**',r=>r.fulfill({body:'<html></html>',contentType:'text/html'}));
  const page=await context.newPage();await page.goto('https://prototype.test/');
  const html=pageFor([{id:'parent',component:'card',selection:{scope:'page',stateKey:'parent'},interaction:[{type:'navigation',targetRoute:'wrong'}],children:[
   {id:'choices',component:'segmented',selection:{scope:'app',stateKey:'size'},props:{options:['Small','Large'],value:'Small'}}
  ]}],{routeTable:{wrong:'#wrong'}});
  await page.setContent(html);await page.locator('#choices').getByRole('button',{name:'Large'}).click();
  assert.equal(page.url(),'https://prototype.test/');assert.equal(await page.locator('#parent').evaluate(e=>e.classList.contains('wf-selected')),false);
  await page.setContent(html);assert.deepEqual(await page.locator('#choices [aria-pressed=true]').allTextContents(),['Large']);
 }finally{await browser.close();}
});
test('bound colour disabling, hostile values, empty choices and unresolved routes stay safe',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage();await page.setContent(pageFor([
   {id:'colour',component:'input',props:{label:'Colour',inputType:'color',value:'"><img src=x onerror=alert(1)>'},stateBindings:{disabled:'{{state.locked}}'}},
   {id:'lock',component:'button',props:{label:'Lock'},interaction:[{type:'set_state',scope:'page',stateKey:'locked',value:true}]},
   {id:'empty',component:'segmented',props:{options:['']}},
   {id:'tabs',component:'tab_bar',props:{tabs:[{label:'Missing route',route:'absent'},{label:'Local',active:true}]}},
   {id:'literal',component:'segmented',props:{options:['<img src=x onerror=alert(1)>'],value:'<img src=x onerror=alert(1)>'}}
  ]));
  assert.equal(await page.locator('img').count(),0);
  assert.equal(await page.getByRole('textbox',{name:'Colour hex'}).inputValue(),'"><img src=x onerror=alert(1)>');
  assert.equal(await page.getByRole('button',{name:'Empty option'}).isDisabled(),true);
  assert.equal(await page.getByRole('button',{name:'Missing route'}).count(),0);
  await page.getByRole('button',{name:'Lock'}).click();
  assert.equal(await page.getByLabel('Colour picker',{exact:true}).isDisabled(),true);assert.equal(await page.getByRole('textbox',{name:'Colour hex'}).isDisabled(),true);
 }finally{await browser.close();}
});
