# Missing Wireframe Pages — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add all missing pages across the three wireframe projects (web_wireframes, admin_wireframes) to create a complete clickable SaaS product prototype — marketing site through login/SSO to dashboard and all admin flows.

**Architecture:** Each wireframe project is a self-contained YAML project consumed by the `wf` CLI. Pages reference templates, use slots/injectables, and wire navigation via `targetRoute` referencing sitemap route IDs. All pages use the schema v1.1 format. Card rendering mode is the default. No billing pages — billing is handled elsewhere.

**Tech Stack:** YAML (wireframe schema v1.1), `wf` CLI (validate, serve, build, screenshots), Playwright for visual verification.

---

## Inventory

### Current State

| Project | Pages | Status |
|---------|-------|--------|
| web_wireframes | `home` (barebones "Welcome" stub) | Needs complete rewrite + new pages |
| admin_wireframes | `login`, `dashboard`, `account`, `project_editor`, `project_settings`, `project_members`, `project_preview` (7 pages) | Needs 5 new pages |
| wireframe_studio | `editor_focus`, `editor_map`, `project_admin`, `add_page` (4 pages) | Complete for its scope |

### Pages to Add

| # | Project | Page | Purpose |
|---|---------|------|---------|
| 1 | web_wireframes | Rewrite `templates.yaml` | Proper marketing header with Login CTA + footer |
| 2 | web_wireframes | Rewrite `home.yaml` | Full marketing landing page |
| 3 | admin_wireframes | `accept_invite.yaml` | Accept/decline invite from email link |
| 4 | admin_wireframes | `onboarding.yaml` | First-time user welcome after SSO |
| 5 | admin_wireframes | `activity.yaml` | Global activity feed across projects |
| 6 | admin_wireframes | `templates_gallery.yaml` | Browse starter templates for new projects |
| 7 | admin_wireframes | `api_keys.yaml` | Developer API key management |
| 8 | All projects | Cleanup | Remove redundant `rendering: mode: card` (now default) |

---

### Task 1: Rewrite web_wireframes templates.yaml

The current `public_template` has a broken image logo and no navigation. Replace it with a proper marketing site template that has a header with logo, nav links, login CTA, a main content slot, and a footer.

**Files:**
- Modify: `web_wireframes/templates.yaml`

**Step 1: Replace templates.yaml content**

```yaml
documentType: templates
specVersion: "1.1"
id: templates
templates:
  public_template:
    layout:
      type: stack
    regions:
      - id: site_header
        kind: persistent
        sticky: top
        layout:
          type: row
          padding: 16
          gap: 16
          align: center
        children:
          - id: logo_icon
            component: icon
            props:
              name: vector-square
              size: lg
          - id: logo_text
            component: heading
            props:
              label: Wireframes
              level: 4
          - id: nav_features
            component: button
            props:
              label: "Features"
          - id: nav_docs
            component: button
            props:
              label: "Docs"
          - id: header_spacer
            component: spacer
            size:
              width: "100%"
          - id: login_btn
            component: button
            props:
              label: "Sign In"
              icon: right-to-bracket
            interaction:
              - type: navigation
                targetRoute: login
      - id: main
        kind: slot
      - id: site_footer
        kind: persistent
        layout:
          type: row
          padding: 24
          gap: 24
          align: center
        children:
          - id: footer_copy
            component: text
            props:
              label: "2026 Wireframes. All rights reserved."
          - id: footer_spacer
            component: spacer
            size:
              width: "100%"
          - id: footer_terms
            component: button
            props:
              label: "Terms"
          - id: footer_privacy
            component: button
            props:
              label: "Privacy"
```

**Step 2: Update sitemap.yaml to add login route**

The marketing site needs a `login` route that navigates to the admin login. For wireframing purposes, this is a local redirect page.

```yaml
documentType: sitemap
specVersion: "1.1"
id: sitemap
defaultTemplate: public_template
routes:
  - id: home
    path: /
    page: home
    template: public_template
  - id: login
    path: /login
    page: login
    template: login_template
```

**Step 3: Add login_template and login page to templates.yaml**

Append `login_template` to the templates file (centered auth layout, same pattern as admin_wireframes auth_template):

```yaml
  login_template:
    layout:
      type: stack
      align: center
      justify: center
    regions:
      - id: login_content
        kind: slot
```

**Step 4: Create web_wireframes/pages/login.yaml**

```yaml
documentType: page
specVersion: "1.1"
id: login
page:
  id: login
  template: login_template
  viewport:
    device: web
  wireframeStyle:
    border:
      style: solid
  slots:
    - slotId: login_content
      content:
        - id: login_card
          component: section
          layout:
            type: stack
            gap: 24
            padding: 48
            align: center
          size:
            width: 420
          children:
            - id: wf_login_logo
              component: icon
              props:
                name: vector-square
                size: 2xl
            - id: wf_login_heading
              component: heading
              props:
                label: Wireframes
                level: 1
            - id: wf_login_tagline
              component: paragraph
              props:
                label: "Design clickable wireframe prototypes"
            - id: wf_login_divider
              component: divider
            - id: wf_login_prompt
              component: text
              props:
                label: "Sign in to get started"
            - id: wf_login_sso_btn
              component: button
              props:
                label: "Sign in with SSO"
                icon: right-to-bracket
              size:
                width: "100%"
              interaction:
                - type: navigation
                  targetRoute: home
            - id: wf_login_sso_note
              component: text
              props:
                label: "Authenticates via authenticator.unlikeother.ai"
            - id: wf_login_terms
              component: paragraph
              props:
                label: "By signing in, you agree to our Terms of Service."
```

Note: The SSO button navigates back to `home` in the web project. In reality it would redirect to the admin app's dashboard via SSO. Within the wireframe, this demonstrates the flow.

**Step 5: Validate**

```bash
cd web_wireframes && npx wf validate
```

Expected: 0 errors.

**Step 6: Commit**

```bash
git add web_wireframes/templates.yaml web_wireframes/sitemap.yaml web_wireframes/pages/login.yaml
git commit -m "feat(web): add proper marketing template with login CTA and login page"
```

---

### Task 2: Rewrite web_wireframes home.yaml — Full Marketing Landing

The current home page is a stub ("Welcome" / "Your starter page is ready"). Replace with a full marketing landing page: hero, features grid, how-it-works, social proof, bottom CTA.

**Files:**
- Modify: `web_wireframes/pages/home.yaml`

**Step 1: Replace home.yaml content**

```yaml
documentType: page
specVersion: "1.1"
id: home
page:
  id: home
  template: public_template
  viewport:
    device: web
  wireframeStyle:
    border:
      style: solid
    corner:
      style: rounded
      radius: 8
  slots:
    - slotId: main
      content:
        # Hero
        - id: hero
          component: section
          layout:
            type: stack
            gap: 16
            padding: 48
            align: center
          children:
            - id: hero_badge
              component: text
              props:
                label: "AI-Powered Wireframing"
            - id: hero_heading
              component: heading
              props:
                label: "Design clickable wireframes with AI"
                level: 1
            - id: hero_subheading
              component: paragraph
              props:
                label: "Describe what you want to build. The AI generates production-quality wireframe prototypes you can click through, share with stakeholders, and iterate on in seconds."
            - id: hero_actions
              component: section
              layout:
                type: row
                gap: 12
                align: center
                justify: center
              children:
                - id: hero_cta
                  component: button
                  props:
                    label: "Get Started Free"
                    icon: rocket
                  interaction:
                    - type: navigation
                      targetRoute: login
                - id: hero_demo
                  component: button
                  props:
                    label: "Watch Demo"
                    icon: circle-play

        - id: hero_divider
          component: divider

        # Features
        - id: features_section
          component: section
          layout:
            type: stack
            gap: 24
            padding: 48
            align: center
          children:
            - id: features_heading
              component: heading
              props:
                label: "Everything you need to wireframe fast"
                level: 2
            - id: features_grid
              component: section
              layout:
                type: grid
                columns: 3
                gap: 24
              children:
                - id: feat_ai
                  component: section
                  layout:
                    type: stack
                    gap: 8
                    padding: 24
                    align: center
                  children:
                    - id: feat_ai_icon
                      component: icon
                      props:
                        name: wand-magic-sparkles
                        size: xl
                    - id: feat_ai_title
                      component: heading
                      props:
                        label: "AI Generation"
                        level: 3
                    - id: feat_ai_desc
                      component: paragraph
                      props:
                        label: "Describe your page in plain English. The AI builds the wireframe structure, layout, and interactions automatically."

                - id: feat_click
                  component: section
                  layout:
                    type: stack
                    gap: 8
                    padding: 24
                    align: center
                  children:
                    - id: feat_click_icon
                      component: icon
                      props:
                        name: hand-pointer
                        size: xl
                    - id: feat_click_title
                      component: heading
                      props:
                        label: "Clickable Prototypes"
                        level: 3
                    - id: feat_click_desc
                      component: paragraph
                      props:
                        label: "Every button, link, and menu works. Navigate between pages, open modals, toggle states — all from YAML definitions."

                - id: feat_collab
                  component: section
                  layout:
                    type: stack
                    gap: 8
                    padding: 24
                    align: center
                  children:
                    - id: feat_collab_icon
                      component: icon
                      props:
                        name: users
                        size: xl
                    - id: feat_collab_title
                      component: heading
                      props:
                        label: "Team Collaboration"
                        level: 3
                    - id: feat_collab_desc
                      component: paragraph
                      props:
                        label: "Invite editors and viewers. Share published previews with stakeholders via link, password, or SSO-restricted access."

                - id: feat_devices
                  component: section
                  layout:
                    type: stack
                    gap: 8
                    padding: 24
                    align: center
                  children:
                    - id: feat_devices_icon
                      component: icon
                      props:
                        name: display
                        size: xl
                    - id: feat_devices_title
                      component: heading
                      props:
                        label: "Multi-Device Preview"
                        level: 3
                    - id: feat_devices_desc
                      component: paragraph
                      props:
                        label: "Preview wireframes on desktop, tablet, and mobile viewports. Layouts adapt automatically based on device presets."

                - id: feat_templates
                  component: section
                  layout:
                    type: stack
                    gap: 8
                    padding: 24
                    align: center
                  children:
                    - id: feat_templates_icon
                      component: icon
                      props:
                        name: layer-group
                        size: xl
                    - id: feat_templates_title
                      component: heading
                      props:
                        label: "Templates & Components"
                        level: 3
                    - id: feat_templates_desc
                      component: paragraph
                      props:
                        label: "Reuse layouts with templates. Build once, slot content per page. Create reusable components for consistent patterns."

                - id: feat_export
                  component: section
                  layout:
                    type: stack
                    gap: 8
                    padding: 24
                    align: center
                  children:
                    - id: feat_export_icon
                      component: icon
                      props:
                        name: file-export
                        size: xl
                    - id: feat_export_title
                      component: heading
                      props:
                        label: "Export & Share"
                        level: 3
                    - id: feat_export_desc
                      component: paragraph
                      props:
                        label: "Export as static HTML or download YAML source. Publish to a shareable preview URL with configurable access controls."

        - id: features_divider
          component: divider

        # How It Works
        - id: how_section
          component: section
          layout:
            type: stack
            gap: 24
            padding: 48
            align: center
          children:
            - id: how_heading
              component: heading
              props:
                label: "How it works"
                level: 2
            - id: how_steps
              component: section
              layout:
                type: row
                gap: 32
              children:
                - id: step_1
                  component: section
                  layout:
                    type: stack
                    gap: 8
                    padding: 16
                    align: center
                  children:
                    - id: step_1_num
                      component: heading
                      props:
                        label: "1"
                        level: 2
                    - id: step_1_title
                      component: heading
                      props:
                        label: "Describe"
                        level: 4
                    - id: step_1_text
                      component: paragraph
                      props:
                        label: "Tell the AI what you want. A dashboard with a sidebar, a settings page with forms, a checkout flow."
                - id: step_2
                  component: section
                  layout:
                    type: stack
                    gap: 8
                    padding: 16
                    align: center
                  children:
                    - id: step_2_num
                      component: heading
                      props:
                        label: "2"
                        level: 2
                    - id: step_2_title
                      component: heading
                      props:
                        label: "Generate"
                        level: 4
                    - id: step_2_text
                      component: paragraph
                      props:
                        label: "The AI builds the full wireframe structure — pages, templates, components, navigation, and state interactions."
                - id: step_3
                  component: section
                  layout:
                    type: stack
                    gap: 8
                    padding: 16
                    align: center
                  children:
                    - id: step_3_num
                      component: heading
                      props:
                        label: "3"
                        level: 2
                    - id: step_3_title
                      component: heading
                      props:
                        label: "Iterate & Share"
                        level: 4
                    - id: step_3_text
                      component: paragraph
                      props:
                        label: "Refine with natural language. Click through the prototype. Share with your team and stakeholders for feedback."

        - id: how_divider
          component: divider

        # Social Proof
        - id: proof_section
          component: section
          layout:
            type: stack
            gap: 24
            padding: 48
            align: center
          children:
            - id: proof_heading
              component: heading
              props:
                label: "Trusted by product teams"
                level: 2
            - id: proof_stats
              component: section
              layout:
                type: row
                gap: 32
                justify: center
              children:
                - id: stat_projects
                  component: section
                  layout:
                    type: stack
                    gap: 4
                    align: center
                  children:
                    - id: stat_projects_num
                      component: heading
                      props:
                        label: "2,400+"
                        level: 2
                    - id: stat_projects_label
                      component: text
                      props:
                        label: "Projects Created"
                - id: stat_pages
                  component: section
                  layout:
                    type: stack
                    gap: 4
                    align: center
                  children:
                    - id: stat_pages_num
                      component: heading
                      props:
                        label: "18,000+"
                        level: 2
                    - id: stat_pages_label
                      component: text
                      props:
                        label: "Pages Designed"
                - id: stat_teams
                  component: section
                  layout:
                    type: stack
                    gap: 4
                    align: center
                  children:
                    - id: stat_teams_num
                      component: heading
                      props:
                        label: "350+"
                        level: 2
                    - id: stat_teams_label
                      component: text
                      props:
                        label: "Teams"

        - id: proof_divider
          component: divider

        # Bottom CTA
        - id: bottom_cta
          component: section
          layout:
            type: stack
            gap: 16
            padding: 48
            align: center
          children:
            - id: cta_heading
              component: heading
              props:
                label: "Start wireframing in seconds"
                level: 2
            - id: cta_text
              component: paragraph
              props:
                label: "No credit card required. Sign in with SSO and create your first project."
            - id: cta_btn
              component: button
              props:
                label: "Get Started Free"
                icon: rocket
              interaction:
                - type: navigation
                  targetRoute: login
```

**Step 2: Validate**

```bash
cd web_wireframes && npx wf validate
```

Expected: 0 errors.

**Step 3: Commit**

```bash
git add web_wireframes/pages/home.yaml
git commit -m "feat(web): rewrite home page with full marketing landing content"
```

---

### Task 3: admin_wireframes — Add accept_invite.yaml

When a user receives an invite email and clicks the link, they land on this page. It shows the project name, who invited them, what role they're being offered, and accept/decline buttons. Uses the centered `auth_template`.

**Files:**
- Create: `admin_wireframes/pages/accept_invite.yaml`
- Modify: `admin_wireframes/sitemap.yaml` (add route)

**Step 1: Create accept_invite.yaml**

```yaml
documentType: page
specVersion: "1.1"
id: accept_invite
page:
  id: accept_invite
  template: auth_template
  viewport:
    device: web
  wireframeStyle:
    border:
      style: solid
  pageState:
    invite_accepted: false
    invite_declined: false
  slots:
    - slotId: auth_content
      content:
        - id: invite_card
          component: section
          layout:
            type: stack
            gap: 24
            padding: 48
            align: center
          size:
            width: 480
          children:
            - id: invite_logo_icon
              component: icon
              props:
                name: vector-square
                size: 2xl
            - id: invite_heading
              component: heading
              props:
                label: "You've been invited"
                level: 2
            - id: invite_divider
              component: divider

            - id: invite_details
              component: section
              layout:
                type: stack
                gap: 12
                padding: 16
              children:
                - id: invite_project_row
                  component: section
                  layout:
                    type: row
                    gap: 8
                    align: center
                  children:
                    - id: invite_project_icon
                      component: icon
                      props:
                        name: pen-ruler
                        size: lg
                    - id: invite_project_info
                      component: section
                      layout:
                        type: stack
                        gap: 2
                      children:
                        - id: invite_project_name
                          component: heading
                          props:
                            label: "Acme Dashboard"
                            level: 3
                        - id: invite_project_desc
                          component: text
                          props:
                            label: "A wireframe project with 12 pages"
                - id: invite_from
                  component: section
                  layout:
                    type: row
                    gap: 8
                    align: center
                  children:
                    - id: invite_from_icon
                      component: icon
                      props:
                        name: circle-user
                        size: sm
                    - id: invite_from_text
                      component: text
                      props:
                        label: "Invited by alice@acme.com"
                - id: invite_role_row
                  component: section
                  layout:
                    type: row
                    gap: 8
                    align: center
                  children:
                    - id: invite_role_icon
                      component: icon
                      props:
                        name: pen
                        size: sm
                    - id: invite_role_text
                      component: text
                      props:
                        label: "Role: Editor"
                - id: invite_role_desc
                  component: paragraph
                  props:
                    label: "As an Editor you can view the project, edit pages, templates, and components, build previews, and publish."

            - id: invite_divider_2
              component: divider

            # Accept state
            - id: invite_accepted_msg
              component: section
              visibility:
                condition:
                  type: state_equals
                  scope: page
                  key: invite_accepted
                  equals: true
              layout:
                type: stack
                gap: 12
                align: center
              children:
                - id: accepted_icon
                  component: icon
                  props:
                    name: circle-check
                    size: xl
                - id: accepted_text
                  component: heading
                  props:
                    label: "Invite accepted!"
                    level: 3
                - id: accepted_go
                  component: button
                  props:
                    label: "Open Project"
                    icon: arrow-right
                  interaction:
                    - type: navigation
                      targetRoute: dashboard

            # Declined state
            - id: invite_declined_msg
              component: section
              visibility:
                condition:
                  type: state_equals
                  scope: page
                  key: invite_declined
                  equals: true
              layout:
                type: stack
                gap: 12
                align: center
              children:
                - id: declined_icon
                  component: icon
                  props:
                    name: circle-xmark
                    size: xl
                - id: declined_text
                  component: heading
                  props:
                    label: "Invite declined"
                    level: 3
                - id: declined_note
                  component: paragraph
                  props:
                    label: "You can ask the project owner to send a new invite if you change your mind."
                - id: declined_go
                  component: button
                  props:
                    label: "Go to Dashboard"
                    icon: arrow-left
                  interaction:
                    - type: navigation
                      targetRoute: dashboard

            # Actions (visible when neither accepted nor declined)
            - id: invite_actions
              component: section
              visibility:
                condition:
                  type: and
                  conditions:
                    - type: state_equals
                      scope: page
                      key: invite_accepted
                      equals: false
                    - type: state_equals
                      scope: page
                      key: invite_declined
                      equals: false
              layout:
                type: row
                gap: 12
                justify: center
              children:
                - id: invite_decline_btn
                  component: button
                  props:
                    label: "Decline"
                    icon: xmark
                  interaction:
                    - type: set_state
                      stateKey: invite_declined
                      value: true
                      scope: page
                - id: invite_accept_btn
                  component: button
                  props:
                    label: "Accept Invite"
                    icon: check
                  interaction:
                    - type: set_state
                      stateKey: invite_accepted
                      value: true
                      scope: page

            - id: invite_sso_note
              component: text
              props:
                label: "You will be authenticated via SSO to join this project."
```

**Step 2: Add route to sitemap.yaml**

Add after the `project_preview` route:

```yaml
  - id: accept_invite
    path: /invite/accept
    page: accept_invite
    template: auth_template
```

**Step 3: Validate**

```bash
cd admin_wireframes && npx wf validate
```

Expected: 0 errors.

**Step 4: Commit**

```bash
git add admin_wireframes/pages/accept_invite.yaml admin_wireframes/sitemap.yaml
git commit -m "feat(admin): add accept invite page for email invite flow"
```

---

### Task 4: admin_wireframes — Add onboarding.yaml

First-time user experience after SSO login. Shows a welcome screen with two paths: create first project or browse starter templates. Uses `auth_template` for centered layout.

**Files:**
- Create: `admin_wireframes/pages/onboarding.yaml`
- Modify: `admin_wireframes/sitemap.yaml` (add route)

**Step 1: Create onboarding.yaml**

```yaml
documentType: page
specVersion: "1.1"
id: onboarding
page:
  id: onboarding
  template: auth_template
  viewport:
    device: web
  wireframeStyle:
    border:
      style: solid
  slots:
    - slotId: auth_content
      content:
        - id: welcome_card
          component: section
          layout:
            type: stack
            gap: 24
            padding: 48
            align: center
          size:
            width: 560
          children:
            - id: welcome_icon
              component: icon
              props:
                name: wand-magic-sparkles
                size: 2xl
            - id: welcome_heading
              component: heading
              props:
                label: "Welcome to Wireframes"
                level: 1
            - id: welcome_text
              component: paragraph
              props:
                label: "You're all set. Create your first project from scratch, or start with a template to get going faster."
            - id: welcome_divider
              component: divider

            - id: welcome_options
              component: section
              layout:
                type: row
                gap: 24
              children:
                - id: option_scratch
                  component: section
                  layout:
                    type: stack
                    gap: 12
                    padding: 24
                    align: center
                  size:
                    width: "50%"
                    height: 240
                  children:
                    - id: scratch_icon
                      component: icon
                      props:
                        name: plus
                        size: 2xl
                    - id: scratch_title
                      component: heading
                      props:
                        label: "Start from Scratch"
                        level: 3
                    - id: scratch_desc
                      component: paragraph
                      props:
                        label: "Create a blank project and describe what you want to build with AI."
                    - id: scratch_spacer
                      component: spacer
                      size:
                        height: "100%"
                    - id: scratch_btn
                      component: button
                      props:
                        label: "Create Project"
                        icon: plus
                      size:
                        width: "100%"
                      interaction:
                        - type: navigation
                          targetRoute: dashboard

                - id: option_template
                  component: section
                  layout:
                    type: stack
                    gap: 12
                    padding: 24
                    align: center
                  size:
                    width: "50%"
                    height: 240
                  children:
                    - id: template_icon
                      component: icon
                      props:
                        name: layer-group
                        size: 2xl
                    - id: template_title
                      component: heading
                      props:
                        label: "Use a Template"
                        level: 3
                    - id: template_desc
                      component: paragraph
                      props:
                        label: "Pick a pre-built wireframe kit — SaaS dashboard, e-commerce, marketing site, and more."
                    - id: template_spacer
                      component: spacer
                      size:
                        height: "100%"
                    - id: template_btn
                      component: button
                      props:
                        label: "Browse Templates"
                        icon: layer-group
                      size:
                        width: "100%"
                      interaction:
                        - type: navigation
                          targetRoute: templates_gallery

            - id: welcome_skip
              component: button
              props:
                label: "Skip — take me to my dashboard"
                icon: arrow-right
              interaction:
                - type: navigation
                  targetRoute: dashboard
```

**Step 2: Add route to sitemap.yaml**

```yaml
  - id: onboarding
    path: /welcome
    page: onboarding
    template: auth_template
```

**Step 3: Validate**

```bash
cd admin_wireframes && npx wf validate
```

Expected: 0 errors.

**Step 4: Commit**

```bash
git add admin_wireframes/pages/onboarding.yaml admin_wireframes/sitemap.yaml
git commit -m "feat(admin): add onboarding welcome page for new users"
```

---

### Task 5: admin_wireframes — Add activity.yaml

Global activity feed showing recent actions across all projects the user has access to. Uses `app_template` (standard authenticated layout).

**Files:**
- Create: `admin_wireframes/pages/activity.yaml`
- Modify: `admin_wireframes/sitemap.yaml` (add route)
- Modify: `admin_wireframes/templates.yaml` (add activity nav link to top_bar)

**Step 1: Create activity.yaml**

```yaml
documentType: page
specVersion: "1.1"
id: activity
page:
  id: activity
  template: app_template
  viewport:
    device: web
  wireframeStyle:
    border:
      style: solid
  slots:
    - slotId: main_content
      content:
        - id: activity_header
          component: section
          layout:
            type: row
            gap: 16
            align: center
            padding: 8
          children:
            - id: activity_back
              component: button
              props:
                label: "Back"
                icon: arrow-left
              interaction:
                - type: navigation
                  targetRoute: dashboard
            - id: activity_title
              component: heading
              props:
                label: "Activity"
                level: 2
            - id: activity_spacer
              component: spacer
              size:
                width: "100%"
            - id: activity_filter
              component: select
              props:
                placeholder: "All Projects"
                options:
                  - { value: all, label: "All Projects" }
                  - { value: p1, label: "My App Wireframe" }
                  - { value: p2, label: "Client Portal" }
                  - { value: p3, label: "E-commerce Checkout" }

        - id: activity_content
          component: section
          layout:
            type: stack
            gap: 16
            padding: 16
          size:
            maxWidth: 800
          children:
            - id: today_section
              component: section
              props:
                title: "Today"
              layout:
                type: stack
                gap: 8
                padding: 8
              children:
                - id: act_1
                  component: section
                  layout:
                    type: row
                    gap: 12
                    align: center
                    padding: 8
                  children:
                    - id: act_1_icon
                      component: icon
                      props:
                        name: pen
                        size: sm
                    - id: act_1_info
                      component: section
                      layout:
                        type: stack
                        gap: 2
                      children:
                        - id: act_1_text
                          component: text
                          props:
                            label: "You edited page 'dashboard' in My App Wireframe"
                        - id: act_1_time
                          component: text
                          props:
                            label: "2 minutes ago"
                - id: act_2
                  component: section
                  layout:
                    type: row
                    gap: 12
                    align: center
                    padding: 8
                  children:
                    - id: act_2_icon
                      component: icon
                      props:
                        name: user-plus
                        size: sm
                    - id: act_2_info
                      component: section
                      layout:
                        type: stack
                        gap: 2
                      children:
                        - id: act_2_text
                          component: text
                          props:
                            label: "Alice Chen accepted your invite to Client Portal"
                        - id: act_2_time
                          component: text
                          props:
                            label: "1 hour ago"
                - id: act_3
                  component: section
                  layout:
                    type: row
                    gap: 12
                    align: center
                    padding: 8
                  children:
                    - id: act_3_icon
                      component: icon
                      props:
                        name: rocket
                        size: sm
                    - id: act_3_info
                      component: section
                      layout:
                        type: stack
                        gap: 2
                      children:
                        - id: act_3_text
                          component: text
                          props:
                            label: "You published a preview of E-commerce Checkout"
                        - id: act_3_time
                          component: text
                          props:
                            label: "3 hours ago"
                - id: act_4
                  component: section
                  layout:
                    type: row
                    gap: 12
                    align: center
                    padding: 8
                  children:
                    - id: act_4_icon
                      component: icon
                      props:
                        name: plus
                        size: sm
                    - id: act_4_info
                      component: section
                      layout:
                        type: stack
                        gap: 2
                      children:
                        - id: act_4_text
                          component: text
                          props:
                            label: "You created page 'checkout_confirm' in E-commerce Checkout"
                        - id: act_4_time
                          component: text
                          props:
                            label: "4 hours ago"

            - id: yesterday_section
              component: section
              props:
                title: "Yesterday"
              layout:
                type: stack
                gap: 8
                padding: 8
              children:
                - id: act_5
                  component: section
                  layout:
                    type: row
                    gap: 12
                    align: center
                    padding: 8
                  children:
                    - id: act_5_icon
                      component: icon
                      props:
                        name: paper-plane
                        size: sm
                    - id: act_5_info
                      component: section
                      layout:
                        type: stack
                        gap: 2
                      children:
                        - id: act_5_text
                          component: text
                          props:
                            label: "You sent an invite to designer@agency.com for My App Wireframe"
                        - id: act_5_time
                          component: text
                          props:
                            label: "Yesterday at 4:30 PM"
                - id: act_6
                  component: section
                  layout:
                    type: row
                    gap: 12
                    align: center
                    padding: 8
                  children:
                    - id: act_6_icon
                      component: icon
                      props:
                        name: pen
                        size: sm
                    - id: act_6_info
                      component: section
                      layout:
                        type: stack
                        gap: 2
                      children:
                        - id: act_6_text
                          component: text
                          props:
                            label: "Bob Smith edited page 'settings' in Client Portal"
                        - id: act_6_time
                          component: text
                          props:
                            label: "Yesterday at 2:15 PM"
                - id: act_7
                  component: section
                  layout:
                    type: row
                    gap: 12
                    align: center
                    padding: 8
                  children:
                    - id: act_7_icon
                      component: icon
                      props:
                        name: trash
                        size: sm
                    - id: act_7_info
                      component: section
                      layout:
                        type: stack
                        gap: 2
                      children:
                        - id: act_7_text
                          component: text
                          props:
                            label: "You removed page 'old_landing' from My App Wireframe"
                        - id: act_7_time
                          component: text
                          props:
                            label: "Yesterday at 11:00 AM"

            - id: load_more
              component: button
              props:
                label: "Load More Activity"
                icon: clock-rotate-left
```

**Step 2: Add route to sitemap.yaml**

```yaml
  - id: activity
    path: /activity
    page: activity
```

**Step 3: Add activity link to top_bar in templates.yaml**

In `admin_wireframes/templates.yaml`, add an activity button to the `top_bar` region, before the `nav_spacer`:

After `app_logo` heading, add:

```yaml
          - id: nav_activity
            component: button
            props:
              label: "Activity"
              icon: clock-rotate-left
            interaction:
              - type: navigation
                targetRoute: activity
```

**Step 4: Validate**

```bash
cd admin_wireframes && npx wf validate
```

Expected: 0 errors.

**Step 5: Commit**

```bash
git add admin_wireframes/pages/activity.yaml admin_wireframes/sitemap.yaml admin_wireframes/templates.yaml
git commit -m "feat(admin): add global activity feed page with nav link"
```

---

### Task 6: admin_wireframes — Add templates_gallery.yaml

Browse starter templates when creating a new project. Grid of template cards with description, page count, and a "Use Template" CTA. Linked from the onboarding page and could be linked from the dashboard's "New Project" modal.

**Files:**
- Create: `admin_wireframes/pages/templates_gallery.yaml`
- Modify: `admin_wireframes/sitemap.yaml` (add route)

**Step 1: Create templates_gallery.yaml**

```yaml
documentType: page
specVersion: "1.1"
id: templates_gallery
page:
  id: templates_gallery
  template: app_template
  viewport:
    device: web
  wireframeStyle:
    border:
      style: solid
  slots:
    - slotId: main_content
      content:
        - id: gallery_header
          component: section
          layout:
            type: row
            gap: 16
            align: center
            padding: 8
          children:
            - id: gallery_back
              component: button
              props:
                label: "Back"
                icon: arrow-left
              interaction:
                - type: navigation
                  targetRoute: dashboard
            - id: gallery_title
              component: heading
              props:
                label: "Starter Templates"
                level: 2
            - id: gallery_spacer
              component: spacer
              size:
                width: "100%"
            - id: gallery_search
              component: input
              props:
                placeholder: "Search templates..."
              size:
                width: 280
            - id: gallery_filter
              component: select
              props:
                placeholder: "All Categories"
                options:
                  - { value: all, label: "All Categories" }
                  - { value: saas, label: "SaaS" }
                  - { value: ecommerce, label: "E-Commerce" }
                  - { value: marketing, label: "Marketing" }
                  - { value: mobile, label: "Mobile App" }
                  - { value: admin, label: "Admin Panel" }

        - id: gallery_grid
          component: section
          layout:
            type: grid
            columns: 3
            gap: 16
            padding: 8
          children:
            - id: tpl_saas
              component: section
              layout:
                type: stack
                gap: 8
                padding: 16
              size:
                height: 300
              children:
                - id: tpl_saas_preview
                  component: section
                  layout:
                    type: stack
                    padding: 16
                    align: center
                    justify: center
                  size:
                    height: 120
                  children:
                    - id: tpl_saas_thumb
                      component: icon
                      props:
                        name: chart-line
                        size: 2xl
                - id: tpl_saas_name
                  component: heading
                  props:
                    label: "SaaS Dashboard"
                    level: 3
                - id: tpl_saas_desc
                  component: text
                  props:
                    label: "Sidebar nav, KPI cards, charts, data tables. 6 pages."
                - id: tpl_saas_spacer
                  component: spacer
                  size:
                    height: "100%"
                - id: tpl_saas_btn
                  component: button
                  props:
                    label: "Use Template"
                    icon: plus
                  size:
                    width: "100%"
                  interaction:
                    - type: navigation
                      targetRoute: project_editor

            - id: tpl_ecom
              component: section
              layout:
                type: stack
                gap: 8
                padding: 16
              size:
                height: 300
              children:
                - id: tpl_ecom_preview
                  component: section
                  layout:
                    type: stack
                    padding: 16
                    align: center
                    justify: center
                  size:
                    height: 120
                  children:
                    - id: tpl_ecom_thumb
                      component: icon
                      props:
                        name: cart-shopping
                        size: 2xl
                - id: tpl_ecom_name
                  component: heading
                  props:
                    label: "E-Commerce Store"
                    level: 3
                - id: tpl_ecom_desc
                  component: text
                  props:
                    label: "Product grid, cart, checkout flow, order confirmation. 8 pages."
                - id: tpl_ecom_spacer
                  component: spacer
                  size:
                    height: "100%"
                - id: tpl_ecom_btn
                  component: button
                  props:
                    label: "Use Template"
                    icon: plus
                  size:
                    width: "100%"
                  interaction:
                    - type: navigation
                      targetRoute: project_editor

            - id: tpl_marketing
              component: section
              layout:
                type: stack
                gap: 8
                padding: 16
              size:
                height: 300
              children:
                - id: tpl_marketing_preview
                  component: section
                  layout:
                    type: stack
                    padding: 16
                    align: center
                    justify: center
                  size:
                    height: 120
                  children:
                    - id: tpl_marketing_thumb
                      component: icon
                      props:
                        name: bullhorn
                        size: 2xl
                - id: tpl_marketing_name
                  component: heading
                  props:
                    label: "Marketing Site"
                    level: 3
                - id: tpl_marketing_desc
                  component: text
                  props:
                    label: "Hero, features, testimonials, pricing, footer. 4 pages."
                - id: tpl_marketing_spacer
                  component: spacer
                  size:
                    height: "100%"
                - id: tpl_marketing_btn
                  component: button
                  props:
                    label: "Use Template"
                    icon: plus
                  size:
                    width: "100%"
                  interaction:
                    - type: navigation
                      targetRoute: project_editor

            - id: tpl_mobile
              component: section
              layout:
                type: stack
                gap: 8
                padding: 16
              size:
                height: 300
              children:
                - id: tpl_mobile_preview
                  component: section
                  layout:
                    type: stack
                    padding: 16
                    align: center
                    justify: center
                  size:
                    height: 120
                  children:
                    - id: tpl_mobile_thumb
                      component: icon
                      props:
                        name: mobile-screen
                        size: 2xl
                - id: tpl_mobile_name
                  component: heading
                  props:
                    label: "Mobile App"
                    level: 3
                - id: tpl_mobile_desc
                  component: text
                  props:
                    label: "Tab navigation, feed, profile, settings. Mobile viewport. 5 pages."
                - id: tpl_mobile_spacer
                  component: spacer
                  size:
                    height: "100%"
                - id: tpl_mobile_btn
                  component: button
                  props:
                    label: "Use Template"
                    icon: plus
                  size:
                    width: "100%"
                  interaction:
                    - type: navigation
                      targetRoute: project_editor

            - id: tpl_admin
              component: section
              layout:
                type: stack
                gap: 8
                padding: 16
              size:
                height: 300
              children:
                - id: tpl_admin_preview
                  component: section
                  layout:
                    type: stack
                    padding: 16
                    align: center
                    justify: center
                  size:
                    height: 120
                  children:
                    - id: tpl_admin_thumb
                      component: icon
                      props:
                        name: table-columns
                        size: 2xl
                - id: tpl_admin_name
                  component: heading
                  props:
                    label: "Admin Panel"
                    level: 3
                - id: tpl_admin_desc
                  component: text
                  props:
                    label: "User management, roles, settings, audit log. 7 pages."
                - id: tpl_admin_spacer
                  component: spacer
                  size:
                    height: "100%"
                - id: tpl_admin_btn
                  component: button
                  props:
                    label: "Use Template"
                    icon: plus
                  size:
                    width: "100%"
                  interaction:
                    - type: navigation
                      targetRoute: project_editor

            - id: tpl_blank
              component: section
              layout:
                type: stack
                gap: 8
                padding: 16
                align: center
                justify: center
              size:
                height: 300
              children:
                - id: tpl_blank_icon
                  component: icon
                  props:
                    name: plus
                    size: 2xl
                - id: tpl_blank_name
                  component: heading
                  props:
                    label: "Blank Project"
                    level: 3
                - id: tpl_blank_desc
                  component: text
                  props:
                    label: "Start fresh with an empty project."
              interaction:
                - type: navigation
                  targetRoute: dashboard
```

**Step 2: Add route to sitemap.yaml**

```yaml
  - id: templates_gallery
    path: /templates
    page: templates_gallery
```

**Step 3: Validate**

```bash
cd admin_wireframes && npx wf validate
```

Expected: 0 errors.

**Step 4: Commit**

```bash
git add admin_wireframes/pages/templates_gallery.yaml admin_wireframes/sitemap.yaml
git commit -m "feat(admin): add starter templates gallery page"
```

---

### Task 7: admin_wireframes — Add api_keys.yaml

Developer settings page for API key management. Create, copy, revoke keys. Shows key name, prefix, created date, last used. Uses `app_template` with same sidebar pattern as other project-level pages.

**Files:**
- Create: `admin_wireframes/pages/api_keys.yaml`
- Modify: `admin_wireframes/sitemap.yaml` (add route)

**Step 1: Create api_keys.yaml**

```yaml
documentType: page
specVersion: "1.1"
id: api_keys
page:
  id: api_keys
  template: app_template
  viewport:
    device: web
  wireframeStyle:
    border:
      style: solid
  pageState:
    key_created: false
    key_copied: false
    key_revoked: false
  overlays:
    - id: create_key_modal
      type: modal
      content:
        - id: ck_card
          component: section
          layout:
            type: stack
            gap: 16
            padding: 24
          size:
            width: 480
          children:
            - id: ck_heading
              component: heading
              props:
                label: "Create API Key"
                level: 3
            - id: ck_note
              component: paragraph
              props:
                label: "API keys allow programmatic access to your projects. Keep your keys secret — they grant the same access as your account."
            - id: ck_name
              component: input
              props:
                label: "Key Name"
                placeholder: "e.g. CI Pipeline, Local Dev"
            - id: ck_scope
              component: select
              props:
                label: "Scope"
                options:
                  - { value: read, label: "Read Only" }
                  - { value: readwrite, label: "Read & Write" }
            - id: ck_actions
              component: section
              layout:
                type: row
                gap: 8
                justify: flex-end
              children:
                - id: ck_cancel
                  component: button
                  props:
                    label: "Cancel"
                  interaction:
                    - type: close_overlay
                      targetOverlay: create_key_modal
                - id: ck_create
                  component: button
                  props:
                    label: "Create Key"
                    icon: key
                  interaction:
                    - type: set_state
                      stateKey: key_created
                      value: true
                      scope: page

    - id: revoke_key_modal
      type: modal
      content:
        - id: rk_card
          component: section
          layout:
            type: stack
            gap: 16
            padding: 24
          size:
            width: 420
          children:
            - id: rk_icon
              component: icon
              props:
                name: triangle-exclamation
                size: xl
            - id: rk_heading
              component: heading
              props:
                label: "Revoke API Key?"
                level: 3
            - id: rk_text
              component: paragraph
              props:
                label: "This will immediately invalidate the key 'CI Pipeline' (wf_sk_abc1...). Any integrations using this key will stop working."
            - id: rk_actions
              component: section
              layout:
                type: row
                gap: 8
                justify: flex-end
              children:
                - id: rk_cancel
                  component: button
                  props:
                    label: "Cancel"
                  interaction:
                    - type: close_overlay
                      targetOverlay: revoke_key_modal
                - id: rk_confirm
                  component: button
                  props:
                    label: "Revoke Key"
                    icon: trash
                  interaction:
                    - type: set_state
                      stateKey: key_revoked
                      value: true
                      scope: page

  slots:
    - slotId: main_content
      content:
        - id: keys_header
          component: section
          layout:
            type: row
            gap: 16
            align: center
            padding: 8
          children:
            - id: keys_back
              component: button
              props:
                label: "Back"
                icon: arrow-left
              interaction:
                - type: navigation
                  targetRoute: account
            - id: keys_title
              component: heading
              props:
                label: "API Keys"
                level: 2
            - id: keys_spacer
              component: spacer
              size:
                width: "100%"
            - id: keys_create_btn
              component: button
              props:
                label: "Create Key"
                icon: plus
              interaction:
                - type: open_overlay
                  targetOverlay: create_key_modal

        - id: keys_content
          component: section
          layout:
            type: stack
            gap: 24
            padding: 16
          size:
            maxWidth: 800
          children:
            - id: keys_notice
              component: section
              layout:
                type: row
                gap: 8
                align: center
                padding: 12
              children:
                - id: keys_notice_icon
                  component: icon
                  props:
                    name: circle-info
                    size: sm
                - id: keys_notice_text
                  component: paragraph
                  props:
                    label: "API keys grant access to all projects you own or have edit access to. Use scoped keys (read-only) for CI pipelines and integrations that only need to read project data."

            # New key created banner
            - id: new_key_banner
              component: section
              visibility:
                condition:
                  type: state_equals
                  scope: page
                  key: key_created
                  equals: true
              layout:
                type: stack
                gap: 8
                padding: 16
              children:
                - id: new_key_label
                  component: heading
                  props:
                    label: "New Key Created"
                    level: 4
                - id: new_key_warning
                  component: paragraph
                  props:
                    label: "Copy this key now. You will not be able to see it again."
                - id: new_key_value
                  component: input
                  props:
                    placeholder: "wf_sk_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
                  size:
                    width: "100%"
                - id: new_key_copy
                  component: button
                  props:
                    label: "Copy to Clipboard"
                    icon: copy
                  interaction:
                    - type: set_state
                      stateKey: key_copied
                      value: true
                      scope: page

            - id: keys_table_section
              component: section
              props:
                title: "Active Keys"
              layout:
                type: stack
                gap: 8
                padding: 16
              children:
                - id: keys_table
                  component: table
                  props:
                    columns:
                      - { key: name, label: "Name" }
                      - { key: prefix, label: "Key Prefix" }
                      - { key: scope, label: "Scope" }
                      - { key: created, label: "Created" }
                      - { key: last_used, label: "Last Used" }
                      - { key: actions, label: "" }
                    rows:
                      - { name: "CI Pipeline", prefix: "wf_sk_abc1...", scope: "Read Only", created: "Mar 1, 2026", last_used: "2 hours ago", actions: "Revoke" }
                      - { name: "Local Dev", prefix: "wf_sk_xyz9...", scope: "Read & Write", created: "Feb 15, 2026", last_used: "5 days ago", actions: "Revoke" }

            - id: revoked_section
              component: section
              props:
                title: "Revoked Keys"
              layout:
                type: stack
                gap: 8
                padding: 16
              children:
                - id: revoked_table
                  component: table
                  props:
                    columns:
                      - { key: name, label: "Name" }
                      - { key: prefix, label: "Key Prefix" }
                      - { key: revoked, label: "Revoked" }
                    rows:
                      - { name: "Old Deploy Key", prefix: "wf_sk_old1...", revoked: "Jan 20, 2026" }

            - id: keys_docs
              component: section
              props:
                title: "API Documentation"
              layout:
                type: stack
                gap: 8
                padding: 16
              children:
                - id: docs_text
                  component: paragraph
                  props:
                    label: "Use the API to programmatically manage projects, trigger builds, and retrieve wireframe data. All endpoints require an API key in the Authorization header."
                - id: docs_example
                  component: section
                  layout:
                    type: stack
                    padding: 12
                  children:
                    - id: docs_code
                      component: text
                      props:
                        label: "curl -H 'Authorization: Bearer wf_sk_...' https://api.wireframes.app/projects"
                - id: docs_link
                  component: button
                  props:
                    label: "View Full API Docs"
                    icon: book
```

**Step 2: Add route to sitemap.yaml**

```yaml
  - id: api_keys
    path: /api-keys
    page: api_keys
```

**Step 3: Validate**

```bash
cd admin_wireframes && npx wf validate
```

Expected: 0 errors.

**Step 4: Commit**

```bash
git add admin_wireframes/pages/api_keys.yaml admin_wireframes/sitemap.yaml
git commit -m "feat(admin): add API keys management page"
```

---

### Task 8: Cleanup — Remove redundant rendering mode declarations

Card mode is now the engine default (commit `b36a5c9`). Remove explicit `rendering: mode: card` from all page YAMLs across all three projects.

**Files to modify:**
- `admin_wireframes/pages/login.yaml` — remove lines 12-13
- `admin_wireframes/pages/dashboard.yaml` — remove lines 12-13
- `admin_wireframes/pages/account.yaml` — remove lines 12-13
- `admin_wireframes/pages/project_editor.yaml` — remove lines 12-13
- `admin_wireframes/pages/project_settings.yaml` — remove lines 12-13
- `admin_wireframes/pages/project_members.yaml` — remove lines 12-13
- `admin_wireframes/pages/project_preview.yaml` — remove lines 12-13

**Step 1: Remove rendering blocks**

For each file listed above, remove the two-line block:

```yaml
  rendering:
    mode: card
```

This is safe because card is now the default. Any page that wants line mode can still opt in with `rendering: mode: line`.

**Step 2: Validate all projects**

```bash
cd admin_wireframes && npx wf validate
cd ../web_wireframes && npx wf validate
cd ../wireframe_studio && npx wf validate
```

Expected: 0 errors in all three.

**Step 3: Commit**

```bash
git add admin_wireframes/pages/*.yaml
git commit -m "chore: remove redundant rendering mode declarations (card is default)"
```

---

### Task 9: Serve and Playwright-verify all three projects

Build and serve all three projects to verify the new pages render correctly.

**Step 1: Serve admin_wireframes**

```bash
cd admin_wireframes && npx wf serve --platform all --port 8081
```

Manually verify in browser:
- `/login` — centered SSO login card
- `/` — dashboard with project grid
- `/invite/accept` — centered invite card with accept/decline
- `/welcome` — onboarding with two option cards
- `/activity` — activity feed with today/yesterday sections
- `/templates` — 6-card template gallery grid
- `/api-keys` — API keys table with create/revoke modals

**Step 2: Serve web_wireframes**

```bash
cd web_wireframes && npx wf serve --platform all --port 8082
```

Manually verify:
- `/` — full marketing landing (hero, features, how-it-works, social proof, CTA)
- `/login` — centered SSO login card
- Header has "Sign In" button
- Footer has copyright and links

**Step 3: Take screenshots for all new pages**

```bash
cd admin_wireframes && npx wf screenshots --platform all
cd ../web_wireframes && npx wf screenshots --platform all
```

**Step 4: Commit screenshots**

```bash
git add admin_wireframes/ web_wireframes/
git commit -m "feat: add all missing wireframe pages — marketing, invite, onboarding, activity, templates, API keys"
```

---

## Summary

After completing all tasks:

| Project | Before | After |
|---------|--------|-------|
| web_wireframes | 1 stub page | 2 pages (full landing + login) |
| admin_wireframes | 7 pages | 12 pages (+accept_invite, onboarding, activity, templates_gallery, api_keys) |
| wireframe_studio | 4 pages | 4 pages (unchanged, already complete) |
| **Total** | **12 pages** | **18 pages** |

New navigation flows enabled:
- **Marketing → Login → Dashboard**: web home → sign in → admin login → SSO → dashboard
- **Email invite → Accept → Dashboard**: invite email link → accept invite page → project
- **First-time user → Onboarding → Project**: SSO → onboarding → create/template → editor
- **Dashboard → Activity**: global activity feed across projects
- **Dashboard → Templates Gallery**: browse and pick starter templates
- **Account → API Keys**: developer key management
