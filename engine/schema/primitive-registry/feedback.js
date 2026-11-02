'use strict';

const feedbackPrimitives = [
  {
    name: 'alert',
    family: 'feedback',
    frame: 'S',
    summary: 'Banner or inline alert. Variants differ by glyph and edge weight, never by hue.',
    props: {
      text: { type: 'string', primary: true },
      title: { type: 'string' },
      variant: { enum: ['info', 'success', 'warning', 'error', 'neutral'] },
      icon: { type: 'string' },
      dismissible: { type: 'boolean' },
      inline: { type: 'boolean' },
    },
    aliases: { banner: 'alert', callout: 'alert' },
    example: '- alert: { title: Trial ends soon, text: 3 days left, variant: warning }',
  },
];

module.exports = { feedbackPrimitives };
