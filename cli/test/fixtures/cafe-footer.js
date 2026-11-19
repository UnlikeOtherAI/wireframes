'use strict';

// What the iPad app wrote for "add a footer" on a cafe site: a std.site_footer
// with every optional part left empty, after a booking form in the main stack.
// The header and hero lines are the same habit applied to those patterns.

const CAFE_FOOTER = {
  id: 'footer',
  use: 'std.site_footer',
  role: 'contentinfo',
  slots: { social: [] },
  props: {
    brand: 'The Cozy Corner Cafe',
    tagline: '',
    copyright: '© The Cozy Corner Cafe. All rights reserved.',
    productLinks: [],
    companyLinks: [],
    resourceLinks: [],
  },
};

const CAFE_HEADER = {
  id: 'header', use: 'std.site_header', slots: { actions: [] },
  props: { brand: 'The Cozy Corner Cafe', items: [], signIn: '', cta: '' },
};

const CAFE_HERO = {
  id: 'hero', use: 'std.hero',
  props: { eyebrow: '', title: 'Fresh coffee every morning', text: '', primaryAction: '', secondaryAction: '' },
};

const BOOKING_FORM = {
  id: 'booking', component: 'form', children: [
    { id: 'name', component: 'input', props: { label: 'Name' } },
    { id: 'book', component: 'button', props: { label: 'Book Table' } },
  ],
};

module.exports = { CAFE_FOOTER, CAFE_HEADER, CAFE_HERO, BOOKING_FORM };
