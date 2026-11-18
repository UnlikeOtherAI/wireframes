'use strict';

module.exports = {
  summary: 'Settings screen: page header, a section nav on the left and setting cards on the right (the default slot).',
  source: `
propDefaults:
  title: Settings
  subtitle: Manage your profile, notifications and security.
  sections:
    - { label: Profile, icon: user, current: true }
    - { label: Notifications, icon: bell }
    - { label: Security, icon: lock }
    - { label: Billing, icon: credit-card }
propHints:
  title: Page title
  subtitle: Line under the title
  sections: Nav items for the left column (the shared item shape; mark one current)
root:
  id: settings_page
  component: stack
  props: { gap: 24 }
  children:
    - id: header
      component: page_header
      props:
        title: "{{props.title}}"
        subtitle: "{{props.subtitle}}"
    - id: body
      component: row
      props: { gap: 24, align: start }
      children:
        - id: section_nav
          component: nav
          size: { width: 220 }
          props: { items: "{{props.sections}}" }
        - id: content
          component: stack
          size: { width: "100%" }
          props: { gap: 16 }
          children:
            - id: sections
              slot: default
              children:
                - id: profile
                  component: card
                  props:
                    title: Profile
                    description: How other people see you.
                  children:
                    - id: profile_form
                      component: form
                      props: { submit: Save changes, columns: 2 }
                      children:
                        - id: full_name
                          component: input
                          props: { label: Full name, value: Ada Lovelace }
                        - id: email
                          component: input
                          props: { label: Email, inputType: email, value: ada@example.com }
                - id: notifications
                  component: card
                  props:
                    title: Notifications
                    description: Choose what we email you about.
                  children:
                    - id: notify_updates
                      component: toggle
                      props: { label: Product updates, description: New features and improvements., checked: true }
                    - id: notify_summary
                      component: toggle
                      props: { label: Weekly summary, description: A digest of activity in your workspace. }
                    - id: notify_security
                      component: toggle
                      props: { label: Security alerts, description: Always on for every account., checked: true, disabled: true }
`,
};
