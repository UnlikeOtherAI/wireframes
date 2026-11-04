'use strict';

function skinProject() {
  const document = (documentType, id, content) => ({ documentType, id, specVersion: '1.1', ...content });
  const nodes = [
    { id: 'title', component: 'heading', props: { text: 'Company checkout' } },
    { id: 'card', component: 'card', props: { title: 'Details', actions: [{ label: 'Save action', variant: 'primary' }] }, children: [
      { id: 'primary', component: 'button', props: { label: 'Continue', variant: 'primary', icon: 'arrow-right' } },
      { id: 'secondary', component: 'button', props: { label: 'Back', variant: 'secondary' } },
      { id: 'local', component: 'button', props: { label: 'Local', variant: 'primary' }, wireframeStyle: { corner: { style: 'rounded', radius: 8 } } },
      { id: 'email', component: 'input', props: { label: 'Email', placeholder: 'name@example.com' } },
      { id: 'invalid', component: 'input', props: { label: 'Required', error: 'Enter an email' } },
      { id: 'danger', component: 'button', props: { label: 'Delete', variant: 'danger' } },
      { id: 'disabled', component: 'button', props: { label: 'Unavailable', disabled: true } },
      { id: 'toggle', component: 'toggle', props: { label: 'Updates', checked: true } },
      { id: 'radio', component: 'radio', props: { label: 'Monthly', checked: true } },
      { id: 'progress', component: 'progress', props: { value: 60 } },
      { id: 'status', component: 'badge', props: { text: 'Ready', tone: 'success', variant: 'dot' } },
    ] },
  ];
  return {
    manifest: document('manifest', 'manifest', { manifest: { projectId: 'skin_test', name: 'Company checkout', schemaVersion: '1.1',
      defaultWireframeStyle: { border: { style: 'solid', width: 'thin' }, corner: { style: 'rounded', radius: 8 } } } }),
    sitemap: document('sitemap', 'sitemap', { defaultTemplate: 'main_template', routes: [{ id: 'home', path: '/', page: 'home' }] }),
    templates: document('templates', 'templates', { templates: { main_template: { layout: { type: 'stack' }, regions: [{ id: 'main', kind: 'slot' }] } } }),
    components: document('components', 'components', { components: {} }),
    pages: new Map([['home', document('page', 'home', { page: { id: 'home', template: 'main_template',
      viewport: { device: 'tablet', orientation: 'portrait', platform: 'ios' }, slots: [{ slotId: 'main', content: nodes }] } })]]),
    datasets: new Map(),
  };
}

const acme = {
  name: 'Acme',
  defaults: { colors: { text: '#172033', background: '#FFFFFF', border: '#CCD3DF', accent: '#1457D9' } },
  roles: {
    card: { colors: { background: '#FAE5F2', text: '#76245F' }, corner: { style: 'rounded', radius: 24 } },
    'button.primary': { colors: { background: '#1457D9', text: '#FFFFFF', border: '#1457D9' }, corner: { style: 'pill' } },
    'button.secondary': { colors: { background: '#FFFFFF', text: '#1457D9', border: '#1457D9' }, corner: { style: 'rounded', radius: 12 } },
    input: { corner: { style: 'rounded', radius: 10 } },
  },
};

module.exports = { skinProject, acme };
