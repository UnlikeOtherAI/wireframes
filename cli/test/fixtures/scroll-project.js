'use strict';
const {skinProject}=require('./skin-project');
function scrollProject(enabled=true){
 const map=skinProject();
 const row=i=>({id:'record_'+i,component:'row',layout:{type:'row',gap:8,padding:8,align:'center'},
  size:{height:52,minHeight:52},children:[{id:'name_'+i,component:'text',props:{text:'Record '+i}},
   {id:'open_'+i,component:'button',props:{label:'Open '+i,route:'details'}}]});
 map.pages.get('home').page.viewport={device:'web'};
 map.pages.get('home').page.slots[0].content=[
 {id:'outside_header',component:'heading',props:{text:'Records',level:2}},
 {id:'records',component:'stack',scroll:enabled,accessibility:{label:'Records list'},
  size:{height:240},layout:{type:'stack',gap:0},children:[
   {id:'column_heading',component:'row',sticky:'top',surface:true,size:{height:36,minHeight:36},
    layout:{type:'row',gap:0,padding:8},children:[{id:'column_label',component:'text',props:{text:'NAME'}}]},
   ...Array.from({length:15},(_,i)=>row(i+1))]},
 {id:'outside_footer',component:'row',layout:{type:'row',gap:12},children:[
  {id:'summary',component:'text',props:{text:'1–15 of 15'}},
  {id:'page_size',component:'button',props:{label:'15 items',icon:'chevron-down'}}]},
 {id:'below',component:'spacer',size:{height:1000}}
 ];
 return map;
}
module.exports={scrollProject};
