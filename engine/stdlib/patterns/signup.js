'use strict';

module.exports = {
  placement: 'screen',
  summary: 'Centred sign-up card: name, email, password with a hint, terms consent, a social sign-up and a sign-in prompt.',
  source: `
propDefaults:
  title: Create your account
  description: Start your free 14-day trial. No card needed.
  nameLabel: Full name
  emailLabel: Work email
  emailPlaceholder: you@example.com
  passwordLabel: Password
  passwordHelp: At least 8 characters.
  terms: I agree to the Terms of Service and Privacy Policy
  submit: Create account
  social: Sign up with Google
  socialIcon: google
  prompt: Already have an account?
  promptAction: Sign in
propHints:
  title: Card title
  description: Line under the title
  nameLabel: Label of the name field
  emailLabel: Label of the email field
  emailPlaceholder: Placeholder of the email field
  passwordLabel: Label of the password field
  passwordHelp: Help text under the password field
  terms: Label of the terms checkbox
  submit: Submit button label
  social: Label of the social sign-up button
  socialIcon: Font Awesome brands icon for the social button
  prompt: Text before the sign-in action (the footer slot fallback)
  promptAction: Label of the sign-in action
  promptRoute: Route id the sign-in action opens
root:
  id: signup
  component: stack
  props: { align: center }
  children:
    - id: card
      component: card
      size: { width: "100%", maxWidth: 440 }
      props:
        title: "{{props.title}}"
        description: "{{props.description}}"
      children:
        - id: form
          component: form
          props: { submit: "{{props.submit}}" }
          children:
            - id: name
              component: input
              props: { label: "{{props.nameLabel}}" }
            - id: email
              component: input
              props:
                label: "{{props.emailLabel}}"
                inputType: email
                placeholder: "{{props.emailPlaceholder}}"
            - id: password
              component: input
              props:
                label: "{{props.passwordLabel}}"
                inputType: password
                help: "{{props.passwordHelp}}"
            - id: fields
              slot: fields
              children: []
            - id: terms
              component: checkbox
              props: { label: "{{props.terms}}" }
        - id: alternatives
          slot: alternatives
          children:
            - id: or
              component: divider
              props: { label: or }
            - id: social_row
              component: row
              props: { justify: center }
              children:
                - id: social
                  component: button
                  props:
                    label: "{{props.social}}"
                    icon: "{{props.socialIcon}}"
                    iconStyle: brands
        - id: footer
          slot: footer
          children:
            - id: prompt
              component: row
              props: { gap: 4, justify: center, align: center }
              children:
                - id: prompt_text
                  component: text
                  props: { text: "{{props.prompt}}", variant: meta }
                - id: prompt_action
                  component: button
                  props:
                    label: "{{props.promptAction}}"
                    variant: link
                    route: "{{props.promptRoute}}"
`,
};
