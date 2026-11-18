'use strict';

module.exports = {
  summary: 'Marketing site footer: logo and tagline, link columns (the columns slot), copyright and social links.',
  source: `
propDefaults:
  brand: Acme
  tagline: Tools for teams that ship.
  productLinks: [{ type: heading, label: Product }, Features, Pricing, Changelog]
  companyLinks: [{ type: heading, label: Company }, About, Careers, Contact]
  resourceLinks: [{ type: heading, label: Resources }, Docs, Guides, Status]
  copyright: © Acme Inc. All rights reserved.
propHints:
  brand: Company name, used as the logo's text
  tagline: Line under the logo
  productLinks: First link column (nav items; a heading item titles the column)
  companyLinks: Second link column
  resourceLinks: Third link column
  copyright: Copyright line at the bottom
root:
  id: site_footer
  component: stack
  props: { gap: 24 }
  children:
    - id: top
      component: row
      props: { gap: 48, align: start, justify: space-between }
      children:
        - id: brand
          component: stack
          size: { width: 240 }
          props: { gap: 8 }
          children:
            - id: logo
              component: image
              props: { kind: logo, slot: logo_1, alt: "{{props.brand}}", width: 112, height: 32 }
            - id: tagline
              component: text
              props: { text: "{{props.tagline}}", variant: meta }
        - id: link_columns
          component: row
          props: { gap: 32, align: start }
          children:
            - id: columns
              slot: columns
              children:
                - id: product
                  component: nav
                  size: { width: 160 }
                  props: { items: "{{props.productLinks}}" }
                - id: company
                  component: nav
                  size: { width: 160 }
                  props: { items: "{{props.companyLinks}}" }
                - id: resources
                  component: nav
                  size: { width: 160 }
                  props: { items: "{{props.resourceLinks}}" }
    - id: rule
      component: divider
    - id: bottom
      component: row
      props: { gap: 16, align: center, justify: space-between }
      children:
        - id: copyright
          component: text
          props: { text: "{{props.copyright}}", variant: meta }
        - id: social
          slot: social
          children:
            - id: social_row
              component: row
              props: { gap: 4, align: center }
              children:
                - { id: social_github, component: button, props: { label: GitHub, icon: github, iconStyle: brands, iconOnly: true, variant: ghost } }
                - { id: social_x, component: button, props: { label: X, icon: x-twitter, iconStyle: brands, iconOnly: true, variant: ghost } }
                - { id: social_linkedin, component: button, props: { label: LinkedIn, icon: linkedin, iconStyle: brands, iconOnly: true, variant: ghost } }
`,
};
