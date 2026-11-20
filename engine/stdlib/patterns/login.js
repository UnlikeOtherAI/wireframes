'use strict';

module.exports = {
  placement: 'screen',
  summary: 'Centred sign-in card: email, password, remember me, forgot link, single sign-on and a sign-up prompt.',
  source: `
propDefaults:
  title: Sign in
  description: Use your work account to continue.
  emailLabel: Email
  emailPlaceholder: you@example.com
  passwordLabel: Password
  remember: Remember me
  forgot: Forgot password?
  submit: Sign in
  sso: Continue with single sign-on
  prompt: No account yet?
  promptAction: Create an account
propHints:
  title: Card title
  description: Line under the title
  emailLabel: Label of the email field
  emailPlaceholder: Placeholder of the email field
  passwordLabel: Label of the password field
  remember: Label of the remember-me checkbox
  forgot: Label of the forgot-password link
  submit: Submit button label
  sso: Label of the single sign-on button (the alternatives slot fallback)
  prompt: Text before the sign-up action (the footer slot fallback)
  promptAction: Label of the sign-up action
  forgotRoute: Route id the forgot-password link opens
  promptRoute: Route id the sign-up action opens
root:
  id: login
  component: stack
  props: { align: center }
  children:
    - id: card
      component: card
      size: { width: "100%", maxWidth: 420 }
      props:
        title: "{{props.title}}"
        description: "{{props.description}}"
      children:
        - id: form
          component: form
          props: { submit: "{{props.submit}}" }
          children:
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
            - id: fields
              slot: fields
              children: []
            - id: options
              component: row
              props: { gap: 8, align: center }
              children:
                - id: remember
                  component: checkbox
                  props: { label: "{{props.remember}}" }
                - id: options_gap
                  component: spacer
                  props: { size: 100% }
                - id: forgot
                  component: button
                  props:
                    label: "{{props.forgot}}"
                    variant: link
                    route: "{{props.forgotRoute}}"
        - id: alternatives
          slot: alternatives
          children:
            - id: or
              component: divider
              props: { label: or }
            - id: sso_row
              component: row
              props: { justify: center }
              children:
                - id: sso
                  component: button
                  props: { label: "{{props.sso}}", icon: key }
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
