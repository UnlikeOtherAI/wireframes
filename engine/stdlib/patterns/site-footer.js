'use strict';

module.exports = {
  placement: 'bottom',
  summary: 'Marketing site footer across the full width: logo and tagline, link columns (the columns slot), copyright and social links. A blank tagline, an empty link list or social: [] is left out.',
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
  tagline: Line under the logo; blank leaves it out
  productLinks: First link column (nav items; a heading item titles the column); [] leaves it out
  companyLinks: Second link column; [] leaves it out
  resourceLinks: Third link column; [] leaves it out
  copyright: Copyright line at the bottom
# A section, so at the top of a page the footer is one full-width panel; in a
# framed footer region it is plain and the region draws the frame.
root:
  id: site_footer
  component: section
  layout: { type: stack, gap: 24 }
  children:
    - id: top
      component: row
      props: { gap: 48, align: start, justify: space-between }
      children:
        # The brand column follows the brand box, 240 to 384 px (24rem), and
        # the tagline wraps to it.
        - id: brand
          component: stack
          size: { width: min-content, minWidth: 240, maxWidth: 384 }
          props: { gap: 8 }
          children:
            # No width: without a skin logo the box fits the brand on one line.
            - id: logo
              component: image
              props: { kind: logo, slot: logo_1, alt: "{{props.brand}}", height: 40 }
            - id: tagline
              component: text
              when: "{{props.tagline}}"
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
                  when: "{{props.productLinks}}"
                  size: { width: 160 }
                  props: { items: "{{props.productLinks}}" }
                - id: company
                  component: nav
                  when: "{{props.companyLinks}}"
                  size: { width: 160 }
                  props: { items: "{{props.companyLinks}}" }
                - id: resources
                  component: nav
                  when: "{{props.resourceLinks}}"
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
          when: "{{props.copyright}}"
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
