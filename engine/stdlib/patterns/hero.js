'use strict';

module.exports = {
  summary: 'Landing hero: eyebrow badge, headline, intro, two calls to action and a media slot with an image fallback.',
  source: `
propDefaults:
  eyebrow: New in 2.0
  title: Wireframes your whole team can click through
  text: Describe each screen in YAML, review it in the browser and keep every flow in sync with the brief.
  primaryAction: Get started
  secondaryAction: Watch the demo
  mediaAlt: Product screenshot of the dashboard
propHints:
  eyebrow: Small badge above the headline; blank leaves it out
  title: Headline
  text: Intro paragraph; blank leaves it out
  primaryAction: Label of the primary call to action; blank leaves it out
  secondaryAction: Label of the secondary call to action; blank leaves it out
  primaryRoute: Route id the primary call to action opens
  secondaryRoute: Route id the secondary call to action opens
  mediaAlt: Describes the fallback image
root:
  id: hero
  component: row
  props: { gap: 48, align: center }
  children:
    - id: copy
      component: stack
      size: { width: "50%" }
      props: { gap: 16, align: start }
      children:
        - id: eyebrow
          component: badge
          when: "{{props.eyebrow}}"
          props: { text: "{{props.eyebrow}}", variant: outline }
        - id: title
          component: heading
          when: "{{props.title}}"
          props: { text: "{{props.title}}", level: 1 }
        - id: text
          component: paragraph
          when: "{{props.text}}"
          props: { text: "{{props.text}}" }
        - id: actions
          slot: actions
          children:
            - id: action_row
              component: row
              props: { gap: 8, align: center }
              children:
                - id: primary
                  component: button
                  when: "{{props.primaryAction}}"
                  props:
                    label: "{{props.primaryAction}}"
                    variant: primary
                    size: lg
                    route: "{{props.primaryRoute}}"
                - id: secondary
                  component: button
                  when: "{{props.secondaryAction}}"
                  props:
                    label: "{{props.secondaryAction}}"
                    variant: secondary
                    size: lg
                    icon: circle-play
                    route: "{{props.secondaryRoute}}"
    - id: media_frame
      component: stack
      size: { width: "50%" }
      children:
        - id: media
          slot: media
          children:
            - id: media_image
              component: image
              props: { alt: "{{props.mediaAlt}}", ratio: "16:10" }
`,
};
