const test=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {renderWireframeMarkup}=require('../../engine/screenshots/renderer');
const nav=(id,variant)=>({id,component:'nav',props:{variant,items:[{label:'Home',route:'next'},{label:'Projects',route:'next'},{label:'Settings',route:'next'}]}});
function fixture(){return renderWireframeMarkup({
 roots:[{id:'main',kind:'container',nodes:[
  {id:'bar',component:'app_bar',children:[{id:'burger',component:'button',props:{label:'Menu',icon:'bars',iconPosition:'center'},interaction:[{type:'open_overlay',targetOverlay:'dialog'}]}]},
  {id:'small',component:'button',props:{label:'Small action',size:'sm'}},
  {id:'title',component:'heading',props:{text:'Navigation and touch controls'}},
  {id:'columns',component:'row',children:[nav('rail','rail'),nav('sidebar','sidebar')]},
  {id:'disabled',component:'button',props:{label:'Disabled route',disabled:true},stateBindings:{disabled:'{{state.locked}}'},interaction:[{type:'navigation',targetRoute:'next'}]},
  {id:'unlock',component:'button',props:{label:'Enable route'},interaction:[{type:'set_state',stateKey:'locked',scope:'page',value:false}]},
  {id:'open',component:'button',props:{label:'Open dialog'},interaction:[{type:'open_overlay',targetOverlay:'dialog'}]}
 ]},{id:'dialog',kind:'overlay',type:'modal',trigger:'open',props:{title:'Dialog actions'},dismissOn:['outside','escape'],nodes:[{id:'message',component:'paragraph',props:{text:'Dialog body'}}]}],
 pageViewport:{device:'web',width:1280,height:800},pageRouteId:'home',routeTable:{home:'#home',next:'#next'},pageStateDefaults:{locked:true},rendering:{mode:'card'},deviceChrome:false
});}
for(const touch of [false,true]) test('real '+(touch?'touch':'mouse')+' controls preserve disabled navigation and close the dialog',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1280,height:800},hasTouch:touch,isMobile:touch});
  const page=await context.newPage();await page.setContent(fixture());
  const tap=async(x,y)=>touch?page.touchscreen.tap(x,y):page.mouse.click(x,y);
  for(const [name,minimum] of [['Menu',touch?44:36],['Small action',touch?44:32]]) {
   const box=await page.getByRole('button',{name,exact:true}).boundingBox();
   assert.ok(box.width>=minimum&&box.height>=minimum,JSON.stringify({touch,name,box}));
  }
  const initial=page.url(),disabled=page.getByRole('button',{name:'Disabled route',exact:true});
  assert.equal(await disabled.isDisabled(),true);
  const rect=await page.locator('#disabled').boundingBox();await tap(rect.x+1,rect.y+1);
  assert.equal(page.url(),initial,'the wrapper edge must not activate a disabled route');
  for(let i=0;i<9;i++){
   await page.keyboard.press('Tab');
   assert.equal(await page.evaluate(()=>!!document.activeElement.closest('#disabled')),false,'keyboard focus skips the disabled button');
  }
  const heights=await page.locator('#sidebar .wf-nav-item').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().height));
  assert.ok(heights.every(h=>h===(touch?44:36)),JSON.stringify(heights));
  assert.ok((await page.locator('#rail .wf-nav-item').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().height))).every(h=>h>=64));
  for(let i=0;i<2;i++){
   await page.getByRole('button',{name:'Open dialog',exact:true}).click();
   await page.getByText('Dialog body',{exact:true}).click();
   assert.equal(await page.locator('#dialog').isVisible(),true,'inside clicks keep the dialog open');
   const close=await page.locator('.wf-overlay-close').boundingBox();
   if(touch) assert.ok(close.width>=44&&close.height>=44,JSON.stringify(close));
   await tap(close.x+close.width-2,close.y+close.height-2);
   await page.locator('#dialog').waitFor({state:'hidden'});
  }
  await page.getByRole('button',{name:'Open dialog',exact:true}).click();await tap(2,2);
  await page.locator('#dialog').waitFor({state:'hidden'});
  await page.getByRole('button',{name:'Open dialog',exact:true}).click();await page.keyboard.press('Escape');
  await page.locator('#dialog').waitFor({state:'hidden'});
  await page.getByRole('button',{name:'Enable route',exact:true}).click();
  assert.equal(await disabled.isEnabled(),true);
  assert.equal(await page.locator('#disabled').evaluate(e=>e.classList.contains('wf-button-disabled')),false);
  await disabled.click();assert.ok(page.url().endsWith('#next'),'state-bound re-enabling keeps the original route');
 }finally{await browser.close();}
});
