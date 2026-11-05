'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { renderNode } = require('../../engine/renderer/primitives');
const options = { routeTable: { destination: '/destination.html' } };
const button = { id:'back', component:'button', props:{label:'Back',icon:'arrow-left',iconPosition:'center'}, interaction:[{type:'navigation',targetRoute:'destination'}] };
test('a disabled routed icon button keeps its name and native disabled semantics without an href',()=>{
 const disabled=renderNode({...button,props:{...button.props,disabled:true}},options);
 assert.match(disabled, /<button disabled aria-label="Back">/);
 assert.doesNotMatch(disabled, /<a |href=|data-wf-route-target=/);
 assert.match(disabled,/wf-button-disabled/);
 const enabled=renderNode(button,options);
 assert.match(enabled,/<a class="wf-button-link" aria-label="Back"/);
 assert.match(enabled,/data-wf-route-target="destination"/);
 assert.doesNotMatch(enabled,/<button disabled/);
});
