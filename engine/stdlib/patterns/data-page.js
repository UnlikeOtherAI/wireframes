'use strict';

module.exports = {
  summary: 'List screen: page header with actions, a filters slot, a data table and pagination with a result count.',
  source: `
propDefaults:
  title: Customers
  subtitle: Everyone with an account in this workspace.
  actions:
    - { label: Export, icon: download }
    - { label: New customer, variant: primary }
  columns:
    - { key: name, label: Name, kind: avatar }
    - { key: email, label: Email }
    - { key: plan, label: Plan }
    - { key: status, label: Status, kind: badge }
    - { key: actions, label: Actions, kind: actions }
  rows:
    - { name: Ada Lovelace, email: ada@example.com, plan: Pro, status: Active }
    - { name: Grace Hopper, email: grace@example.com, plan: Team, status: Active }
    - { name: Alan Turing, email: alan@example.com, plan: Free, status: Trial }
    - { name: Katherine Johnson, email: katherine@example.com, plan: Pro, status: Paused }
    - { name: Linus Torvalds, email: linus@example.com, plan: Team, status: Active }
  state: default
  emptyText: No customers match these filters.
  summary: Showing 1–5 of 48
  page: 1
  pages: 10
propHints:
  title: Page title
  subtitle: Line under the title
  actions: Page header actions ({ label, icon, variant, route })
  columns: Table columns ({ key, label, kind })
  rows: Table rows, keyed by column key
  state: "Table state: default | loading | empty"
  emptyText: Text the empty table shows
  summary: Result count next to the pagination
  page: Current page
  pages: Page count
root:
  id: data_page
  component: stack
  props: { gap: 16 }
  children:
    - id: header
      component: page_header
      props:
        title: "{{props.title}}"
        subtitle: "{{props.subtitle}}"
        actions: "{{props.actions}}"
    - id: filters
      slot: filters
      children:
        - id: filter_bar
          component: row
          props: { gap: 8, align: end }
          children:
            - id: search
              component: input
              size: { width: 280 }
              props: { inputType: search, placeholder: Search, icon: magnifying-glass }
            - id: status
              component: select
              size: { width: 160 }
              props: { placeholder: Any status, options: [Active, Trial, Paused] }
            - id: plan
              component: select
              size: { width: 160 }
              props: { placeholder: Any plan, options: [Free, Pro, Team] }
    - id: table
      component: table
      props:
        columns: "{{props.columns}}"
        rows: "{{props.rows}}"
        state: "{{props.state}}"
        emptyText: "{{props.emptyText}}"
    - id: footer
      component: row
      props: { gap: 16, justify: space-between, align: center }
      children:
        - id: count
          component: text
          props: { text: "{{props.summary}}", variant: meta }
        - id: pagination
          component: pagination
          props: { page: "{{props.page}}", pages: "{{props.pages}}" }
`,
};
