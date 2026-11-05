'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {skinProject}=require('./fixtures/skin-project');
const {renderPage}=require('../../engine/build');

function fixture(colors,mode){
 const map=skinProject();
 map.manifest.specVersion='1.2';map.manifest.manifest.schemaVersion='1.2';
 map.manifest.manifest.designSystem={activeSkin:'company',skins:{company:{name:'Company',roles:{nav:{colors}}}}};
 map.pages.get('home').page.rendering={mode};
 map.pages.get('home').page.slots[0].content=[{
  id:'navs',component:'row',layout:{type:'row',gap:16},
  children:['default','sidebar','rail'].map(variant=>({id:variant,component:'nav',props:{...(variant==='default'?{}:{variant}),items:[
   {label:'Home',route:'home',icon:'house'},{label:'Settings',route:'settings',icon:'gear'}
  ]}}))
 }];
 return map;
}
const rgb=hex=>'rgb('+[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)).join(', ')+')';
function luminance(value){
 return value.match(/\d+/g).slice(0,3).map(Number).map(v=>v/255)
  .map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4)
  .reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
}
function contrast(a,b){const values=[luminance(a),luminance(b)].sort((x,y)=>y-x);return(values[0]+.05)/(values[1]+.05);}

for(const[palette,colors]of Object.entries({
 dark:{background:'#232646',text:'#FFFFFF'},
 light:{background:'#F4F5F7',text:'#172033'},
 accent:{background:'#232646',text:'#FFFFFF',accent:'#1457D9'},
})){
 test('selected '+palette+' navigation preserves readable colours and a selection cue',async()=>{
  const browser=await chromium.launch({headless:true});
  try{
   for(const mode of['line','card'])for(const width of[1280,390]){
    const page=await browser.newPage({viewport:{width,height:600},hasTouch:width===390});
    const result=renderPage(fixture(colors,mode),'home',{deviceChrome:false,routeTable:{home:'#home',settings:'#settings'},
     viewportOverride:{device:'web',width,height:600}});
    assert.equal(result.ok,true,result.error);await page.setContent(result.html);
    for(const variant of['default','sidebar','rail']){
     const selected=page.locator('#'+variant+' .wf-nav-on');
     const paint=variant==='rail'?selected.locator('.wf-ico'):selected;
     const foreground=variant==='rail'?selected.locator('.wf-icon-glyph'):selected.locator('.wf-nav-label');
     const background=await paint.evaluate(n=>getComputedStyle(n).backgroundColor);
     const text=await foreground.evaluate(n=>getComputedStyle(n).color);
     assert.equal(background,rgb(colors.accent||colors.background));
     assert.equal(text,rgb(colors.text));assert.ok(contrast(text,background)>=4.5,palette+' '+variant);
     assert.equal(await selected.evaluate(n=>getComputedStyle(n).fontWeight),'600');
     if(!colors.accent)assert.match(await paint.evaluate(n=>getComputedStyle(n).boxShadow),/inset/);
     const link=page.locator('#'+variant).getByRole('link',{name:'Settings',exact:true});
     if(width===390)await link.tap();else await link.click();
     assert.equal(await page.evaluate(()=>location.hash),'#settings');
     await page.evaluate(()=>location.hash='#home');
    }
    await page.close();
   }
  }finally{await browser.close();}
 });
}
