import { describe, expect, it } from 'vitest';
import { WEBHOOK_ACTIONS, WEBHOOK_SOURCES } from '../integrations';
import { WEBHOOK_TEMPLATES, webhookFromTemplate } from '../webhookTemplates';
import he from '../../../resources/l10n/he.json';
import en from '../../../resources/l10n/en.json';

describe('webhook templates (INT-04)', () => {
  it('use only events the database sends, and samples that match them', () => {
    WEBHOOK_TEMPLATES.forEach((template) => {
      template.events.forEach((event) => {
        const [source, action] = event.split('.');
        expect(WEBHOOK_SOURCES).toContain(source);
        expect(WEBHOOK_ACTIONS).toContain(action);
      });
      expect(template.events).toContain(template.sample.event);
      if (template.filter) {
        const [, key] = template.filter.field.split('.');
        expect(template.sample.data[key]).toBe(template.filter.value);
      }
    });
  });

  it('has a name and a description in Hebrew and English', () => {
    WEBHOOK_TEMPLATES.forEach(({ id }) => {
      [he, en].forEach((strings) => {
        expect(strings[`webhookTemplate_${id}`]).toBeTruthy();
        expect(strings[`webhookTemplate_${id}Description`]).toBeTruthy();
      });
    });
  });

  it('prefills the webhook form, leaving the URL to paste', () => {
    const form = webhookFromTemplate(WEBHOOK_TEMPLATES[0], (key) => key);
    expect(form).toEqual({
      name: 'webhookTemplate_incidentToMonday',
      url: '',
      events: ['incidents.insert'],
      active: true,
    });
  });
});
