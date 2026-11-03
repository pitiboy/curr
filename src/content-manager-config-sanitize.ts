import { contentTypes } from '@strapi/utils';

const { getTimestamps, getCreatorFields, constants } = contentTypes;
const { PUBLISHED_AT_ATTRIBUTE, ID_ATTRIBUTE, DOC_ID_ATTRIBUTE } = constants;

const NON_LISTABLES = new Set([
  'json',
  'password',
  'richtext',
  'dynamiczone',
  'blocks',
]);

const LISTABLE_RELATIONS = new Set([
  'oneToOne',
  'oneToMany',
  'manyToOne',
  'manyToMany',
]);

export type LayoutAttribute = {
  type?: string;
  relation?: string;
  relationType?: string;
  visible?: boolean;
};

/** Minimal content-type / component shape used by CM layout validation. */
export type LayoutSchema = {
  uid?: string;
  attributes?: Record<string, LayoutAttribute>;
  config?: {
    attributes?: Record<string, { hidden?: boolean }>;
  };
};

export type EditLayoutCell = {
  name?: string;
  size?: number;
  [key: string]: unknown;
};

export type ConfigurationLayouts = {
  edit?: EditLayoutCell[][];
  list?: string[];
  [key: string]: unknown;
};

export type ConfigurationBody = {
  layouts?: ConfigurationLayouts;
  [key: string]: unknown;
};

export type SanitizeLayoutsResult = {
  body: ConfigurationBody;
  stripped: string[];
};

function isHidden(schema: LayoutSchema, name: string): boolean {
  return schema.config?.attributes?.[name]?.hidden === true;
}

function relationKind(attribute: LayoutAttribute): string | undefined {
  return attribute.relationType ?? attribute.relation;
}

/**
 * Mirrors content-manager `hasEditableAttribute`: attribute must exist and be
 * visible in the edit form (not system timestamp / id / publishedAt / creator).
 */
export function isEditableLayoutAttribute(
  schema: LayoutSchema,
  name: string,
): boolean {
  const attributes = schema.attributes ?? {};
  if (!(name in attributes)) {
    return false;
  }
  if (isHidden(schema, name)) {
    return false;
  }
  if (name === ID_ATTRIBUTE || name === DOC_ID_ATTRIBUTE) {
    return false;
  }
  if (name === PUBLISHED_AT_ATTRIBUTE) {
    return false;
  }
  if (getTimestamps(schema as never).includes(name)) {
    return false;
  }
  if (getCreatorFields(schema as never).includes(name)) {
    return false;
  }
  return true;
}

/**
 * Mirrors content-manager `isListable` (timestamps may appear in list layouts).
 */
export function isListableLayoutAttribute(
  schema: LayoutSchema,
  name: string,
): boolean {
  const attributes = schema.attributes ?? {};
  const attribute = attributes[name];
  if (!attribute) {
    return false;
  }
  if (isHidden(schema, name)) {
    return false;
  }
  if (attribute.type && NON_LISTABLES.has(attribute.type)) {
    return false;
  }
  if (attribute.type === 'relation') {
    const kind = relationKind(attribute);
    if (!kind || !LISTABLE_RELATIONS.has(kind)) {
      return false;
    }
  }
  return true;
}

/**
 * Drop edit/list layout entries that CM yup would reject, so Configure the view
 * can save even when the Admin UI still sends system or removed fields.
 */
export function sanitizeConfigurationLayouts(
  body: ConfigurationBody,
  schema: LayoutSchema,
): SanitizeLayoutsResult {
  const layouts = body.layouts;
  if (!layouts || typeof layouts !== 'object') {
    return { body, stripped: [] };
  }

  const stripped = new Set<string>();
  const next: ConfigurationLayouts = { ...layouts };

  if (Array.isArray(layouts.edit)) {
    next.edit = layouts.edit
      .map((row) => {
        if (!Array.isArray(row)) {
          return [];
        }
        return row.filter((cell) => {
          const name = cell?.name;
          if (typeof name !== 'string') {
            stripped.add(String(name));
            return false;
          }
          if (!isEditableLayoutAttribute(schema, name)) {
            stripped.add(name);
            return false;
          }
          return true;
        });
      })
      .filter((row) => row.length > 0);
  }

  if (Array.isArray(layouts.list)) {
    next.list = layouts.list.filter((name) => {
      if (typeof name !== 'string' || !isListableLayoutAttribute(schema, name)) {
        stripped.add(String(name));
        return false;
      }
      return true;
    });
  }

  return {
    body: { ...body, layouts: next },
    stripped: [...stripped],
  };
}
