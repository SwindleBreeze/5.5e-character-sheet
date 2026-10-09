// A small accessibility check for the UI tests (plan §10.3, step 7.8). It covers the basics a
// screen reader depends on, without a dependency: every control has a name, images have alt
// text, ids are unique and the ids ARIA points at exist, headings don't skip levels, controls
// aren't nested in controls, and nothing focusable hides inside aria-hidden. Contrast and
// layout are not checked here (jsdom has no layout): tokens.test.ts covers contrast.
//
// dom-accessibility-api is what Testing Library uses to name elements for `getByRole`, so a
// name found here is the name the tests query by.

import { computeAccessibleName, getRole } from 'dom-accessibility-api';
import { expect } from 'vitest';

export interface A11yIssue {
  rule: string;
  message: string;
  element: Element;
}

/** Roles a player operates, which need a name to be told apart. */
const NAMED_ROLES = new Set([
  'button',
  'link',
  'checkbox',
  'radio',
  'switch',
  'tab',
  'textbox',
  'searchbox',
  'combobox',
  'listbox',
  'spinbutton',
  'slider',
  'menuitem',
  'menuitemcheckbox',
  'menuitemradio',
  'option',
  'progressbar',
  'meter',
  'dialog',
  'alertdialog',
  'tabpanel',
]);

/** Roles that can't hold another control. */
const INTERACTIVE_ROLES = new Set([
  'button',
  'link',
  'checkbox',
  'radio',
  'switch',
  'tab',
  'textbox',
  'searchbox',
  'combobox',
  'spinbutton',
  'slider',
  'menuitem',
  'option',
]);

const FOCUSABLE =
  'a[href], button, input:not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

const ID_REFS = ['aria-labelledby', 'aria-describedby', 'aria-controls', 'aria-owns'];

/** Out of the accessibility tree: hidden, inert, or under aria-hidden. */
function hidden(el: Element): boolean {
  return !!el.closest('[hidden], [inert], [aria-hidden="true"]');
}

function describe(el: Element): string {
  const html = el.outerHTML;
  return html.length > 160 ? `${html.slice(0, 160)}…` : html;
}

/** The accessibility issues under `root` (the whole page by default, sheets and toasts too). */
export function a11yIssues(root: Element = document.body): A11yIssue[] {
  const issues: A11yIssue[] = [];
  const add = (rule: string, element: Element, message: string) =>
    issues.push({ rule, element, message: `${message}: ${describe(element)}` });
  const all = [root, ...root.querySelectorAll('*')];
  const doc = root.ownerDocument;

  const ids = new Map<string, number>();
  for (const el of all) if (el.id) ids.set(el.id, (ids.get(el.id) ?? 0) + 1);
  for (const [id, count] of ids) {
    if (count > 1)
      add('duplicate-id', doc.getElementById(id)!, `id "${id}" is used ${count} times`);
  }

  let lastHeading = 0;
  for (const el of all) {
    for (const attr of ID_REFS) {
      for (const ref of el.getAttribute(attr)?.split(/\s+/).filter(Boolean) ?? []) {
        if (!doc.getElementById(ref)) add('aria-ref', el, `${attr} points at missing id "${ref}"`);
      }
    }
    if (el instanceof HTMLLabelElement && el.htmlFor && !doc.getElementById(el.htmlFor)) {
      add('label-for', el, `label for missing id "${el.htmlFor}"`);
    }
    if (hidden(el)) {
      // An open sheet hides the page behind it (data-aria-hidden) and keeps focus inside
      // itself, so the page's controls can't be reached there.
      const behindSheet = el.closest('[data-aria-hidden="true"]');
      const unreachable = el.closest('[hidden], [inert]') || behindSheet || isDisabled(el);
      if (el.matches(FOCUSABLE) && !unreachable) {
        add('aria-hidden-focus', el, 'focusable element inside aria-hidden');
      }
      continue;
    }

    const role = getRole(el);
    if (el instanceof HTMLImageElement && !el.hasAttribute('alt')) {
      add('image-alt', el, 'image without alt text');
    } else if (role === 'img' && !computeAccessibleName(el).trim()) {
      add('image-alt', el, 'image role without a name');
    }
    if (role && NAMED_ROLES.has(role) && !computeAccessibleName(el).trim()) {
      add('control-name', el, `${role} without an accessible name`);
    }
    if (role && INTERACTIVE_ROLES.has(role) && role !== 'option') {
      const inner = el.parentElement?.closest(
        'button, a[href], [role="button"], [role="link"], [role="checkbox"], [role="radio"], [role="tab"]',
      );
      if (inner && root.contains(inner)) add('nested-interactive', el, `${role} inside a control`);
    }
    if (role === 'heading') {
      const level = Number(el.getAttribute('aria-level') ?? el.tagName.slice(1)) || 2;
      if (lastHeading && level > lastHeading + 1) {
        add('heading-order', el, `heading level ${level} after level ${lastHeading}`);
      }
      lastHeading = level;
    }
  }
  return issues;
}

function isDisabled(el: Element): boolean {
  return (el as HTMLButtonElement).disabled === true;
}

/** Fails the test with every issue found under `root`. */
export function expectAccessible(root: Element = document.body): void {
  const issues = a11yIssues(root).map((i) => `[${i.rule}] ${i.message}`);
  expect(issues, issues.join('\n')).toEqual([]);
}
