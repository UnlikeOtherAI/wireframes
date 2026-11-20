# Built-in screen patterns (`std`)

The engine ships eight screen patterns. Each one is an ordinary reusable
component (props, prop defaults, slots) that every project can use without
writing a components document:

```yaml
- id: customers
  use: std.data_page
```

They work the same in `wf build`, `wf serve`, the API and the browser bundle,
including a `.wf` file with no components document.

| Pattern | What it draws | Placement |
|---|---|---|
| [`std.login`](#stdlogin) | Centred sign-in card | `screen` |
| [`std.signup`](#stdsignup) | Centred sign-up card | `screen` |
| [`std.settings_page`](#stdsettings_page) | Page header, section nav and setting cards | `screen` |
| [`std.data_page`](#stddata_page) | Page header, filters, table and pagination | `screen` |
| [`std.site_header`](#stdsite_header) | Logo, top navigation menu and actions | `top` |
| [`std.hero`](#stdhero) | Headline, intro, calls to action and media | `section` |
| [`std.site_footer`](#stdsite_footer) | Logo, link columns, copyright and social links | `bottom` |
| [`std.not_found`](#stdnot_found) | 404 state with a way home | `screen` |

`wf component list --std` lists them, `wf component show std.<name>` prints a
pattern's props, slots and outline, and the element catalogue
(`wf catalogue`, [docs/catalogue](../catalogue/index.html)) draws each one with
its defaults. `wf llm` lists them for agents.

Placement says where a pattern belongs, so a tool that adds one (the mobile
app's chat, for example) can put it there without guessing:
`builtinComponentPlacement(id)` in `engine/stdlib` returns `screen` (a page of
its own), `top` or `bottom` (the start or end of the page's main content), or
`section` (anywhere the author chooses). It is a hint for tools; the engine
renders a pattern wherever it is used.

## Using a pattern

A pattern is used like any component (schema brief §3.3):

* `props` override its `propDefaults`. A prop without a default (the `*Route`
  props) is empty until you set it, so the button it feeds is not a link.
* A prop you set to a blank string or an empty list leaves out what it feeds:
  no skeleton bar, empty column or label-less button. This applies to the
  header's menu and actions, the hero's badge, title, intro and calls to
  action, and the footer's tagline, link columns and copyright. Each part
  carries `when: "{{props.<name>}}"`, which works in your own components too
  ([schema.md §4](schema.md)). A prop you leave out keeps its default.
* `slots.<name>` replaces a slot's fallback with your nodes. Instance
  `children` fill the `default` slot. Leave a fill out to keep the fallback;
  `slots.<name>: []` leaves that slot empty.
* The pattern's own nodes are renamed `<instance id>__<node id>`, so the same
  pattern can appear twice on a page. Your fills keep the ids you gave them.

```yaml
- id: sign_in
  use: std.login
  props:
    title: Welcome back
    forgotRoute: reset_password
    promptRoute: signup
  slots:
    alternatives: []                       # no single sign-on
    fields:
      - { id: workspace, component: input, props: { label: Workspace, suffix: .acme.app } }
```

## Your components come first

A component id resolves to the project's own definition first, and to a
built-in `std.<name>` only when the project has none. That includes components
imported under an alias named `std`: nothing is reserved, and old projects that
use that alias keep working. `wf validate` reports `STD_ALIAS_SHADOWED` (info)
for such an import and names the built-ins it hides; other `std.<name>` ids
still resolve to the built-ins. Rename the alias to use both.

The same holds inside an imported components document. When `kit.yaml`
imports its own `std` alias, a `std.<name>` in its definitions is that alias's
component if it defines one, and the built-in otherwise.

Built-ins are looked up when a page uses them and never join the project's
registry: `wf component list`, `wf stats` and `UNUSED_COMPONENT` only see your
own components.

## Copy one to change it

Built-ins are read-only. To change a pattern's structure, copy it into the
project and edit the copy:

```bash
wf component copy std.not_found                       # → components.yaml as not_found
wf component copy std.hero --as landing_hero          # pick the id
wf component copy std.login --file components/auth.yaml
```

The copy is the pattern's full definition (props, hints, slots and root) under
the new id. `components.yaml` is created when missing; `--file` takes an
existing components document inside the project (a path or link that leads
outside it is refused). An existing document keeps its comments and
formatting: the copy is added after its last component. An id the document
already has is refused, and nothing is written unless the result validates.
The command prints the id to use (`use: landing_hero`, or `use: auth.login`
when `components.yaml` imports that file as `auth`). From then on it is an
ordinary local component: edit it, build it, `wf component remove` it.

While the project has no component of that id, `wf component remove
std.<name>` and `wf node` writes to a `wf://component/std.<name>` address fail
with the same pointer to `wf component copy`. `wf inspect` and
`wf tree component std.<name>` read them. A `std.<name>` your `std` alias
defines is yours: those commands read and edit it in its own file.

---

## std.login

Centred sign-in card: email, password, remember me, forgot link, single sign-on
and a sign-up prompt. The card is at most 420px wide and centres itself.

| Prop | Default | Sets |
|---|---|---|
| `title` | Sign in | Card title |
| `description` | Use your work account to continue. | Line under the title |
| `emailLabel` | Email | Label of the email field |
| `emailPlaceholder` | you@example.com | Placeholder of the email field |
| `passwordLabel` | Password | Label of the password field |
| `remember` | Remember me | Label of the remember-me checkbox |
| `forgot` | Forgot password? | Label of the forgot-password link |
| `submit` | Sign in | Submit button label |
| `sso` | Continue with single sign-on | Label of the single sign-on button |
| `prompt` | No account yet? | Text before the sign-up action |
| `promptAction` | Create an account | Label of the sign-up action |
| `forgotRoute` | — | Route id the forgot-password link opens |
| `promptRoute` | — | Route id the sign-up action opens |

| Slot | Fallback |
|---|---|
| `fields` | empty: extra fields after the password |
| `alternatives` | an "or" divider and the single sign-on button |
| `footer` | the sign-up prompt |

```yaml
- id: sign_in
  use: std.login
  props: { promptRoute: signup }
```

## std.signup

Centred sign-up card: name, email, password with a hint, terms consent, a
social sign-up and a sign-in prompt. At most 440px wide.

| Prop | Default | Sets |
|---|---|---|
| `title` | Create your account | Card title |
| `description` | Start your free 14-day trial. No card needed. | Line under the title |
| `nameLabel` | Full name | Label of the name field |
| `emailLabel` | Work email | Label of the email field |
| `emailPlaceholder` | you@example.com | Placeholder of the email field |
| `passwordLabel` | Password | Label of the password field |
| `passwordHelp` | At least 8 characters. | Help text under the password field |
| `terms` | I agree to the Terms of Service and Privacy Policy | Label of the terms checkbox |
| `submit` | Create account | Submit button label |
| `social` | Sign up with Google | Label of the social sign-up button |
| `socialIcon` | google | Font Awesome brands icon for the social button |
| `prompt` | Already have an account? | Text before the sign-in action |
| `promptAction` | Sign in | Label of the sign-in action |
| `promptRoute` | — | Route id the sign-in action opens |

| Slot | Fallback |
|---|---|
| `fields` | empty: extra fields before the terms checkbox |
| `alternatives` | an "or" divider and the social sign-up button |
| `footer` | the sign-in prompt |

```yaml
- id: join
  use: std.signup
  props: { social: Sign up with GitHub, socialIcon: github, promptRoute: login }
  slots:
    fields:
      - { id: company, component: input, props: { label: Company } }
```

## std.settings_page

Settings screen: a page header, a section nav on the left and setting cards on
the right.

| Prop | Default | Sets |
|---|---|---|
| `title` | Settings | Page title |
| `subtitle` | Manage your profile, notifications and security. | Line under the title |
| `sections` | Profile (current), Notifications, Security, Billing | Nav items for the left column, in the shared item shape |

| Slot | Fallback |
|---|---|
| `default` | a Profile card with a two-column form and a Notifications card with three toggles |

```yaml
- id: settings
  use: std.settings_page
  props:
    sections: [Profile, { label: Billing, current: true }, Team]
  children:                                # fills default
    - id: plan
      component: card
      props: { title: Plan, description: "Pro, billed yearly" }
```

## std.data_page

List screen: a page header with actions, filters, a data table and pagination
with a result count.

| Prop | Default | Sets |
|---|---|---|
| `title` | Customers | Page title |
| `subtitle` | Everyone with an account in this workspace. | Line under the title |
| `actions` | Export, New customer | Page header actions (`{ label, icon, variant, route }`) |
| `columns` | Name (avatar), Email, Plan, Status (badge), Actions | Table columns (`{ key, label, kind }`) |
| `rows` | five customers | Table rows, keyed by column key |
| `state` | default | Table state: `default`, `loading` or `empty` |
| `emptyText` | No customers match these filters. | Text the empty table shows |
| `summary` | Showing 1–5 of 48 | Result count next to the pagination |
| `page` | 1 | Current page |
| `pages` | 10 | Page count |

| Slot | Fallback |
|---|---|
| `filters` | a search field and two selects (status, plan) |

The `filters` slot sits in a filter bar, a row with `role: toolbar`. The
filters you pass sit inline at their natural width and wrap as a row, on a
phone too; a filter's `size.width` still wins. `filters: []` leaves the bar
empty, and an empty bar draws nothing and adds no gap.

```yaml
- id: invoices
  use: std.data_page
  props:
    title: Invoices
    columns: [Number, Customer, { key: total, label: Total, align: end }, { key: status, label: Status, kind: badge }]
    rows: [[INV-1042, Ada Lovelace, $120.00, Paid], [INV-1043, Grace Hopper, $80.00, Due]]
    summary: Showing 2 of 2
    pages: 1
  slots:
    filters: []
```

## std.site_header

Marketing site header: a logo, a top navigation menu (`nav` with
`variant: top`) and actions. The logo is the `logo_1` company logo slot, so a
project with a manifest logo shows it. Without one, the logo box fits the brand on one
line, up to 24rem, and wraps only beyond that.

| Prop | Default | Sets |
|---|---|---|
| `brand` | Acme | Company name, used as the logo's text |
| `items` | Product (with a panel), Solutions (with a panel), Pricing, Docs | Top-level menu items; an item with `items` opens a panel |
| `open` | "" | Label of the menu item whose panel is drawn open |
| `signIn` | Sign in | Label of the secondary action |
| `cta` | Get started | Label of the primary action |
| `signInRoute` | — | Route id the secondary action opens |
| `ctaRoute` | — | Route id the primary action opens |

| Slot | Fallback |
|---|---|
| `actions` | the Sign in and Get started buttons |

```yaml
- id: top
  use: std.site_header
  props: { brand: Northwind, open: Product, ctaRoute: signup }
```

## std.hero

Landing hero: an eyebrow badge, a headline, an intro, two calls to action and
media, side by side.

| Prop | Default | Sets |
|---|---|---|
| `eyebrow` | New in 2.0 | Small badge above the headline |
| `title` | Wireframes your whole team can click through | Headline |
| `text` | Describe each screen in YAML, … | Intro paragraph |
| `primaryAction` | Get started | Label of the primary call to action |
| `secondaryAction` | Watch the demo | Label of the secondary call to action |
| `mediaAlt` | Product screenshot of the dashboard | Describes the fallback image |
| `primaryRoute` | — | Route id the primary call to action opens |
| `secondaryRoute` | — | Route id the secondary call to action opens |

| Slot | Fallback |
|---|---|
| `actions` | the two call-to-action buttons |
| `media` | a 16:10 image placeholder described by `mediaAlt` |

```yaml
- id: promo
  use: std.hero
  props: { title: Plan every launch in one place }
  slots:
    media:
      - { id: promo_chart, component: chart, props: { chartType: area } }
```

## std.site_footer

Marketing site footer: logo and tagline, three link columns, a copyright line
and social links. At the top of a page it is one full-width panel; inside a
framed footer region the region draws the frame. A blank `tagline`, an empty
link list or `social: []` is left out, so a brand and a copyright line alone
still make a full-width footer. Without a manifest logo the logo box fits the
brand on one line, up to 24rem; the brand column follows it, from 240 to 384
pixels, and the tagline wraps to that width.

| Prop | Default | Sets |
|---|---|---|
| `brand` | Acme | Company name, used as the logo's text |
| `tagline` | Tools for teams that ship. | Line under the logo |
| `productLinks` | Product: Features, Pricing, Changelog | First link column (nav items; a `type: heading` item titles the column) |
| `companyLinks` | Company: About, Careers, Contact | Second link column |
| `resourceLinks` | Resources: Docs, Guides, Status | Third link column |
| `copyright` | © Acme Inc. All rights reserved. | Copyright line at the bottom |

| Slot | Fallback |
|---|---|
| `columns` | the three link columns |
| `social` | GitHub, X and LinkedIn icon buttons |

```yaml
- id: bottom
  use: std.site_footer
  props:
    brand: Northwind
    companyLinks: [{ type: heading, label: Company }, { label: About, route: about }, Jobs]
  slots:
    social: []
```

## std.not_found

Not-found screen: a 404 empty state with a way home and a support link.

| Prop | Default | Sets |
|---|---|---|
| `title` | Page not found | Heading of the empty state |
| `text` | The page you are looking for was moved, renamed or never existed. | Explanation under the heading |
| `homeAction` | Back to home | Label of the primary action |
| `supportAction` | Contact support | Label of the secondary action |
| `homeRoute` | — | Route id the primary action opens |
| `supportRoute` | — | Route id the secondary action opens |

| Slot | Fallback |
|---|---|
| `actions` | the Back to home and Contact support buttons |

```yaml
- id: lost
  use: std.not_found
  props: { homeRoute: home }
```
