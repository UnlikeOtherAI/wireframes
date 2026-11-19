'use strict';

module.exports = {
  summary: 'Not-found screen: a 404 empty state with a way home and a support link.',
  source: `
propDefaults:
  title: Page not found
  text: The page you are looking for was moved, renamed or never existed.
  homeAction: Back to home
  supportAction: Contact support
propHints:
  title: Heading of the empty state
  text: Explanation under the heading
  homeAction: Label of the primary action
  supportAction: Label of the secondary action
  homeRoute: Route id the primary action opens
  supportRoute: Route id the secondary action opens
root:
  id: not_found
  component: stack
  props: { gap: 16, align: center }
  children:
    - id: state
      component: empty_state
      surface: false
      props:
        variant: "404"
        icon: compass
        title: "{{props.title}}"
        text: "{{props.text}}"
    - id: actions
      slot: actions
      children:
        - id: action_row
          component: row
          props: { gap: 8, justify: center, align: center }
          children:
            - id: home
              component: button
              props:
                label: "{{props.homeAction}}"
                variant: primary
                icon: house
                route: "{{props.homeRoute}}"
            - id: support
              component: button
              props:
                label: "{{props.supportAction}}"
                variant: ghost
                route: "{{props.supportRoute}}"
`,
};
