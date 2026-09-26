/**
 * Which component types a reference may point to. One source for the validator (flat form) and the
 * tree authoring schema, where these become part of the grammar so a model can't get them wrong.
 */
export const REFERENCE_TYPES: Record<string, string[]> = {
  "Card.media": ["Media"],
  "Card.children": ["Text", "Metric", "DetailList", "Group", "Media", "Status", "Toggle", "Action", "ActionBar", "Tag", "Identity", "Progress", "Rating", "Code", "ActionMenu"],
  "Collection.empty": ["Status"],
  "Table.empty": ["Status"],
  "Status.action": ["Action", "ActionBar"],
  "Form.aside": ["DetailList", "Card", "Group"],
  "FilterPanel.children": ["Choice", "RangeInput", "Toggle", "DateInput", "TextInput", "Rating", "ColorInput"],
  "FilterPanel.results": ["Collection", "Table"],
  "ActionBar.children": ["Action"],
  "Confirm.summary": ["DetailList"],
  "Table.toolbar": ["ActionBar"],
  "Table.bulkActions": ["ActionBar"],
  "Table.rowActions": ["ActionBar"],
  "Table.detail": ["DetailList", "Group", "Card", "Text", "Metric", "Status", "Media", "Collection"],
  "Collection.bulkActions": ["ActionBar"],
  "Table.search": ["TextInput"],
  "Surface.actions": ["ActionBar"],
  "Panel.children": ["Section", "Group", "Text", "Metric", "DetailList", "Media", "Status", "Form", "Choice", "TextInput", "Toggle", "DateInput", "RangeInput", "Collection", "Table", "Tree", "Tag", "Identity", "Progress", "Rating", "Code", "FileInput", "ColorInput", "CodeInput", "Disclosure", "Views", "Card"],
  "Panel.actions": ["ActionBar"],
  "ActionMenu.children": ["Action"],
  "ActionMenu.primary": ["Action"],
};
