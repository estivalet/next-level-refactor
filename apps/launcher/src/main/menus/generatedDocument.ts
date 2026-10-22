import type { MenuDocNode, MenuNode, MenuTree } from '@nextlevel/shared';

/**
 * The generated menu (FR-MENU-3) as editable document nodes: categories, systems and collections
 * of `buildMenuTree`'s tree, without its filter entries (they are generated again when resolved).
 * `name` stays the art key; a translated label becomes the display name.
 */
export function generatedNodes(
  tree: MenuTree,
  newId: () => string,
  translate: (labelKey: string) => string,
): MenuDocNode[] {
  const convert = (node: MenuNode): MenuDocNode | null => {
    const base = {
      id: newId(),
      name: node.name,
      displayName: node.labelKey ? translate(node.labelKey) : null,
      shortName: null,
      filterTabs: true,
      visible: true,
      children: [] as MenuDocNode[],
    };
    switch (node.type) {
      case 'category':
        return {
          ...base,
          type: 'category',
          refId: null,
          children: node.children.map(convert).filter((child) => child !== null),
        };
      case 'system':
        return { ...base, type: 'system', refId: node.systemId ?? null };
      case 'collection':
        return { ...base, type: 'collection', refId: String(node.collectionId) };
      case 'smartFilter':
        return { ...base, type: 'smartFilter', refId: String(node.smartFilterId) };
      case 'filter':
        return null;
    }
  };
  return tree.items.map(convert).filter((node) => node !== null);
}
