// The package ships types, but its "exports" map doesn't point at them; these are the two
// functions the accessibility check uses.
declare module 'dom-accessibility-api' {
  export function computeAccessibleName(root: Element): string;
  export function getRole(element: Element): string | null;
}
