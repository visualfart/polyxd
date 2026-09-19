/**
 * Which component types a reference may point to. One source for the validator (flat form) and the
 * tree authoring schema, where these become part of the grammar so a model can't get them wrong.
 */
export const REFERENCE_TYPES: Record<string, string[]> = {
  "Card.media": ["Media"],
  "Card.children": ["Text", "Metric", "DetailList", "Group", "Media", "Status"],
  "Collection.empty": ["Status"],
  "Table.empty": ["Status"],
  "Status.action": ["Action"],
  "ActionBar.children": ["Action"],
  "Confirm.summary": ["DetailList"],
};
