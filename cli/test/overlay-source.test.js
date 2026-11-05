const test = require('node:test');
const assert = require('node:assert/strict');
const {skinProject} = require('./fixtures/skin-project');
const {stampDocumentSources} = require('../../engine/build/source-stamps');
const {renderPage} = require('../../engine/build');
test('page and shared-template overlay padding retains its exact owner for selection',()=>{
 const p=skinProject(),page=p.pages.get('home').page;
 page.overlays=[{id:'page_dialog',type:'modal',props:{title:'Local dialog'},dismissOn:['outside','escape'],content:[],__source:'page:wrong#spoof'}];
 p.templates.templates.main_template.overlays=[{id:'shared_dialog',type:'modal',props:{title:'Shared dialog'},content:[]}];
 const rendered=renderPage(p,'home',{annotateSource:true,deviceChrome:false});
 assert.equal(rendered.ok,true,rendered.error);
 assert.match(rendered.html,/id="page_dialog"[^>]*data-wf-source="page:home#page_dialog"/);
 assert.match(rendered.html,/id="shared_dialog"[^>]*data-wf-source="template:main_template#shared_dialog"/);
 assert.equal(page.overlays[0].__source,'page:wrong#spoof','the authored input is not mutated');
 page.state={metadata:{id:'not_a_node',content:[]}};
 const stamped=stampDocumentSources(p);
 assert.equal(stamped.pages.get('home').page.state.metadata.__source,undefined);
});
