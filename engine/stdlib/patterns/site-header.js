'use strict';

module.exports = {
  summary: 'Marketing site header: logo, a top navigation menu (nav variant top) and an actions slot.',
  source: `
propDefaults:
  brand: Acme
  items:
    - label: Product
      items:
        - { label: Analytics, icon: chart-line, description: Dashboards and reports for every team. }
        - { label: Automation, icon: bolt, description: Workflows that run on a schedule. }
        - { label: Integrations, icon: plug, description: Connect the tools you already use. }
    - label: Solutions
      items: [Startups, Enterprise, Agencies]
    - Pricing
    - Docs
  open: ""
  signIn: Sign in
  cta: Get started
propHints:
  brand: Company name, used as the logo's text
  items: Top-level menu items; an item with items opens a panel; [] leaves the menu out
  open: Label of the menu item whose panel is drawn open
  signIn: Label of the secondary action; blank leaves it out
  cta: Label of the primary action; blank leaves it out
  signInRoute: Route id the secondary action opens
  ctaRoute: Route id the primary action opens
root:
  id: site_header
  component: row
  props: { gap: 32, align: center, justify: space-between }
  children:
    - id: brand
      component: row
      props: { gap: 32, align: center }
      children:
        - id: logo
          component: image
          # No width: without a skin logo the box fits the brand on one line.
          props: { kind: logo, slot: logo_1, alt: "{{props.brand}}", height: 40 }
        # The header is the bar, so its menu draws no bar of its own; an empty
        # items list leaves the menu out.
        - id: menu
          component: nav
          when: "{{props.items}}"
          surface: false
          props:
            variant: top
            items: "{{props.items}}"
            open: "{{props.open}}"
    - id: actions
      slot: actions
      children:
        - id: action_row
          component: row
          props: { gap: 8, align: center }
          children:
            - id: sign_in
              component: button
              when: "{{props.signIn}}"
              props:
                label: "{{props.signIn}}"
                variant: ghost
                route: "{{props.signInRoute}}"
            - id: cta
              component: button
              when: "{{props.cta}}"
              props:
                label: "{{props.cta}}"
                variant: primary
                route: "{{props.ctaRoute}}"
`,
};
