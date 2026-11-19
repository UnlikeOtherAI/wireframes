'use strict';

// A project that exercises component slots: an imported module (`kit`) whose
// `checkout` forwards its own placeholders into the slots of `panel`, with
// props tokens in both layers, a locally imported `ui.badge` inside the
// forwarded content, and a submit whose formId is scoped to the component.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const yaml = require('js-yaml');
const { initProject } = require('../../../engine/init');

const KIT = {
  documentType: 'components',
  specVersion: '1.1',
  id: 'kit',
  imports: { ui: './ui.yaml' },
  components: {
    panel: {
      propDefaults: { title: 'Details' },
      propHints: { title: 'Card heading' },
      root: {
        id: 'panel',
        component: 'card',
        props: { title: '{{props.title}}' },
        children: [
          { id: 'body', slot: 'default' },
          {
            id: 'footer',
            slot: 'footer',
            children: [{ id: 'close', component: 'button', props: { label: 'Close' } }],
          },
        ],
      },
    },
    checkout: {
      propDefaults: { heading: 'Checkout', note: 'Review your order' },
      root: {
        id: 'checkout',
        component: 'stack',
        children: [
          {
            id: 'pay_form',
            component: 'stack',
            children: [{ id: 'card_number', component: 'input', props: { label: 'Card number' } }],
          },
          {
            id: 'pay_panel',
            use: 'panel',
            props: { title: '{{props.heading}}' },
            children: [
              { id: 'note', component: 'text', props: { text: '{{props.note}}' } },
              { id: 'trust', use: 'ui.badge' },
              { id: 'checkout_body', slot: 'default' },
            ],
            slots: {
              footer: [
                {
                  id: 'pay',
                  component: 'button',
                  props: { label: 'Pay {{props.heading}}' },
                  interaction: [{ type: 'submit', formId: 'pay_form' }],
                },
                { id: 'checkout_actions', slot: 'actions' },
              ],
            },
          },
        ],
      },
    },
  },
};

const UI = {
  documentType: 'components',
  specVersion: '1.1',
  id: 'ui',
  components: {
    badge: { root: { id: 'badge', component: 'badge', props: { text: 'Secure' } } },
  },
};

function pageContent() {
  return [
    {
      id: 'first_checkout',
      use: 'kit.checkout',
      props: { heading: 'Order' },
      children: [{ id: 'page_summary', component: 'text', props: { text: 'Two items' } }],
      slots: {
        actions: [{ id: 'first_extra', component: 'button', props: { label: 'Save for later' } }],
      },
    },
    {
      id: 'second_checkout',
      use: 'kit.checkout',
      props: { heading: 'Gift' },
      slots: { actions: [] },
    },
    { id: 'plain_panel', use: 'kit.panel' },
  ];
}

function writeYaml(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, yaml.dump(value), 'utf8');
}

function readYaml(filePath) {
  return yaml.load(fs.readFileSync(filePath, 'utf8'));
}

/** Creates the slots project on disk. `mutate` may edit { kit, ui, components, page } before writing. */
function createSlotsProject(mutate) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'wireframe-slots-'));
  const projectPath = path.join(base, 'project');
  initProject({ projectName: 'Slots', projectPath });

  const components = readYaml(path.join(projectPath, 'components.yaml'));
  components.imports = { kit: 'components/kit.yaml' };
  const page = readYaml(path.join(projectPath, 'pages', 'home.yaml'));
  page.page.slots = [{ slotId: 'main', content: pageContent() }];

  const docs = { kit: structuredClone(KIT), ui: structuredClone(UI), components, page };
  if (typeof mutate === 'function') mutate(docs);

  writeYaml(path.join(projectPath, 'components', 'kit.yaml'), docs.kit);
  writeYaml(path.join(projectPath, 'components', 'ui.yaml'), docs.ui);
  writeYaml(path.join(projectPath, 'components.yaml'), docs.components);
  writeYaml(path.join(projectPath, 'pages', 'home.yaml'), docs.page);
  return projectPath;
}

module.exports = { KIT, UI, createSlotsProject, pageContent, readYaml, writeYaml };
