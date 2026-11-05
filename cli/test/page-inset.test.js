'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {scrollProject}=require('./fixtures/scroll-project');
const {renderPage,buildProject}=require('../../engine/build');
const {validateDocument}=require('../../engine/schema');
const {MAX_PAGE_INSET,pageInsetStyle}=require('../../engine/renderer/page-inset');
const schema=require('../../engine/schema/schema.json');
test('page inset has one bounded contract and invalid direct values cannot enter CSS',()=>{
 assert.equal(schema.$defs.PageDocument.properties.page.properties.inset.maximum,MAX_PAGE_INSET);
 for(const value of[0,12.5,4096]){const d=scrollProject().pages.get('home');d.page.inset=value;assert.doesNotThrow(()=>validateDocument(d,'inset'));}
 for(const value of[-1,4097,'0',false]){const d=scrollProject().pages.get('home');d.page.inset=value;assert.throws(()=>validateDocument(d,'inset'));assert.equal(pageInsetStyle(value),'');}
 assert.equal(pageInsetStyle(Infinity),'');assert.equal(pageInsetStyle('0;" onload="bad'),'');
 assert.equal(pageInsetStyle(-0),'padding:0px;');assert.equal(pageInsetStyle(12.5),'padding:12.5px;');
});
test('pure and build output carry page inset; omission keeps the default shell markup',()=>{
 const map=scrollProject();const old=renderPage(map,'home').html;
 assert.match(old,/class="wf-page" style="width:\d+px;min-height:\d+px;">/);
 map.pages.get('home').page.inset=0;
 assert.match(renderPage(map,'home').html,/class="wf-page" style="[^"]*padding:0px;/);
 const built=buildProject(map,{platform:'web'});assert.equal(built.ok,true,built.error);
 assert.match(built.pages.find(p=>p.pageId==='home').html,/class="wf-page" style="[^"]*padding:0px;/);
 delete map.pages.get('home').page.inset;assert.equal(renderPage(map,'home').html,old);
});
test('actual card/line/native edges obey inset with no horizontal overflow and working scroll/footer',async()=>{
 const browser=await chromium.launch({headless:true});
 try{for(const [mode,platform] of[['card','web'],['line','web'],['card','ios']])for(const width of[390,1280])for(const inset of[undefined,0,12.5]){
  const map=scrollProject(),doc=map.pages.get('home').page;
  doc.viewport={device:platform==='ios'?'tablet':'web',platform,orientation:'portrait'};doc.rendering={mode};if(inset!==undefined)doc.inset=inset;
  map.templates.templates.main_template.layout={type:'stack',padding:0,gap:0};
  map.templates.templates.main_template.regions[0].layout={type:'stack',padding:0,gap:0};
  const page=await browser.newPage({viewport:{width,height:650}});
  const result=renderPage(map,'home',{deviceChrome:false,viewportOverride:{width,height:650},routeTable:{home:'#home',details:'#details'}});
  assert.equal(result.ok,true,result.error);await page.setContent(result.html);
  const expected=inset??(mode==='card'&&platform==='web'?16:0);
  assert.equal((await page.locator('#outside_header').boundingBox()).x,expected);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  const footer=await page.locator('#outside_footer').boundingBox();
  await page.locator('#records').hover();await page.mouse.wheel(0,180);
  await page.waitForFunction(()=>document.getElementById('records').scrollTop>40);
  assert.ok(Math.abs((await page.locator('#outside_footer').boundingBox()).y-footer.y)<1);
  await page.getByRole('button',{name:'15 items'}).click();await page.locator('#size_menu').waitFor({state:'visible'});
  await page.keyboard.press('Escape');await page.close();
 }}finally{await browser.close();}
});
