'use strict';
const {renderWireframeMarkup}=require('../../../engine/screenshots/renderer');
module.exports=function appearanceFixture(){return renderWireframeMarkup({
 roots:[{id:'main',kind:'container',nodes:[
 {id:'title',component:'heading',props:{text:'Website appearance'}},
 {id:'colour',component:'input',props:{label:'Colour',inputType:'color',value:'#0b172a'},stateBindings:{value:'{{state.colour}}'}},
 {id:'label_input',component:'input',props:{label:'Button text',value:'{{state.label}}'}},
 {id:'sizes',component:'segmented',props:{options:['Small','Medium','Large'],value:'Medium'},selection:{scope:'page',stateKey:'size'}},
 {id:'sizes_mirror',component:'segmented',props:{options:['Small','Medium','Large'],value:'Medium'},selection:{scope:'page',stateKey:'size'}},
 {id:'local_sizes',component:'segmented',props:{options:['Left','Right'],value:'Right'}},
 {id:'preview_tabs',component:'tab_bar',props:{tabs:[{label:'Bubble',active:true},{label:'First screen'},{label:'Conversation'},{label:'Settings',route:'settings'}]},selection:{scope:'page',stateKey:'preview'}},
 ...['Bubble','First screen','Conversation'].map((label,i)=>({id:'panel_'+i,component:'card',props:{title:label+' preview'},visibility:{condition:{type:'state_equals',scope:'page',key:'preview',equals:label}},children:[{id:'panel_text_'+i,component:'paragraph',props:{text:'Preview content for '+label}}]})),
 {id:'launcher',component:'button',props:{label:'{{state.label}}',icon:'comment'},interaction:[{type:'open_overlay',targetOverlay:'dialog'}]},
 {id:'refresh',component:'button',props:{label:'Refresh unrelated state'},interaction:[{type:'set_state',scope:'page',stateKey:'unrelated',value:true}]},
 {id:'disabled_colour',component:'input',props:{label:'Disabled colour',inputType:'color',value:'#123456',disabled:true}}
 ]},{id:'dialog',kind:'overlay',type:'modal',trigger:'launcher',props:{title:'Contact'},dismissOn:['outside','escape'],nodes:[{id:'message',component:'paragraph',props:{text:'Your message'}}]}],
 pageViewport:{device:'web',width:1280,height:900},pageRouteId:'home',routeTable:{home:'#home',settings:'#settings'},pageStateDefaults:{colour:'#0b172a',label:'Ask us anything',size:'Medium',preview:'Bubble'},rendering:{mode:'card'},deviceChrome:false
});};
