#!/usr/bin/env node
/**
 * Generate a dineug ERD Editor v3 document from Strapi content-type schemas.
 * Output: docs/schema/curr.erd.json
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const API_DIR = path.join(ROOT, "src/api");
const OUT_FILE = path.join(ROOT, "docs/schema/curr.erd.json");

const SCHEMA_URL =
  "https://raw.githubusercontent.com/dineug/erd-editor/main/json-schema/schema.json";

const ColumnOption = {
  autoIncrement: 1,
  primaryKey: 2,
  unique: 4,
  notNull: 8,
};
const ColumnUIKey = { primaryKey: 1, foreignKey: 2 };
const RelationshipType = { ZeroOne: 2, ZeroN: 4, OneOnly: 8, OneN: 16 };
const StartRelationshipType = { ring: 1, dash: 2 };
const Direction = { left: 1, right: 2, top: 4, bottom: 8 };
const OrderType = { ASC: 1, DESC: 2 };

const Show = {
  tableComment: 1,
  columnComment: 2,
  columnDataType: 4,
  columnDefault: 8,
  columnAutoIncrement: 16,
  columnPrimaryKey: 32,
  columnUnique: 64,
  columnNotNull: 128,
  relationship: 256,
};

const CLUSTER_COLOR = {
  organization: "#4A90D9",
  member: "#4A90D9",
  membership: "#4A90D9",
  "membership-type": "#4A90D9",
  "account-category": "#7B68A6",
  account: "#7B68A6",
  receipt: "#3D8B6E",
  transaction: "#3D8B6E",
  "transaction-type": "#3D8B6E",
  "currency-category": "#C9A227",
  "currency-type": "#C9A227",
  "currency-rate": "#C9A227",
};

const now = Date.now();
const meta = () => ({ updateAt: now, createAt: now });

const MIN_W = 60;
const MAX_COMMENT_W = 300;

function textWidth(text, { max } = {}) {
  const value = String(text || "");
  const width = Math.max(MIN_W, Math.ceil(value.length * 8.4) + 10);
  return max ? Math.min(width, max) : width;
}

function uid(parts) {
  return parts.join("__");
}

function loadSchemas() {
  const schemas = [];
  for (const apiName of fs.readdirSync(API_DIR).sort()) {
    const schemaPath = path.join(
      API_DIR,
      apiName,
      "content-types",
      apiName,
      "schema.json"
    );
    if (!fs.existsSync(schemaPath)) continue;
    const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
    schemas.push({ apiName, schema });
  }
  return schemas;
}

function mapDataType(attr) {
  switch (attr.type) {
    case "string":
      return attr.maxLength ? `VARCHAR(${attr.maxLength})` : "VARCHAR(255)";
    case "text":
      return "TEXT";
    case "email":
      return "VARCHAR(255)";
    case "uid":
      return attr.maxLength ? `VARCHAR(${attr.maxLength})` : "VARCHAR(255)";
    case "decimal": {
      if (attr.precision && attr.scale) {
        return `DECIMAL(${attr.precision},${attr.scale})`;
      }
      return "DECIMAL";
    }
    case "integer":
      return "INTEGER";
    case "biginteger":
      return "BIGINT";
    case "float":
      return "DOUBLE PRECISION";
    case "boolean":
      return "BOOLEAN";
    case "datetime":
      return "TIMESTAMPTZ";
    case "date":
      return "DATE";
    case "time":
      return "TIME";
    case "json":
      return "JSONB";
    case "enumeration":
      return `ENUM(${(attr.enum || []).map((v) => `'${v}'`).join(",")})`;
    case "media":
      return "media";
    default:
      return (attr.type || "TEXT").toUpperCase();
  }
}

function commentFor(attr, fallback = "") {
  return (attr.metadatas && attr.metadatas.description) || fallback;
}

function columnOptions({ pk, fk, unique, notNull, autoIncrement }) {
  let options = 0;
  if (autoIncrement) options |= ColumnOption.autoIncrement;
  if (pk) options |= ColumnOption.primaryKey;
  if (unique) options |= ColumnOption.unique;
  if (notNull) options |= ColumnOption.notNull;
  let keys = 0;
  if (pk) keys |= ColumnUIKey.primaryKey;
  if (fk) keys |= ColumnUIKey.foreignKey;
  return { options, keys };
}

function makeColumn({
  tableId,
  name,
  comment,
  dataType,
  defaultValue = "",
  pk = false,
  fk = false,
  unique = false,
  notNull = false,
  autoIncrement = false,
}) {
  const id = uid(["col", tableId.replace(/^tbl__/, ""), name]);
  const { options, keys } = columnOptions({
    pk,
    fk,
    unique,
    notNull,
    autoIncrement,
  });
  return {
    id,
    tableId,
    name,
    comment,
    dataType,
    default: defaultValue,
    options,
    ui: {
      keys,
      widthName: textWidth(name),
      widthComment: textWidth(comment, { max: MAX_COMMENT_W }),
      widthDataType: textWidth(dataType),
      widthDefault: textWidth(defaultValue),
    },
    meta: meta(),
  };
}

function estimateTableWidth(table, columns) {
  const header = 24 + table.ui.widthName + table.ui.widthComment;
  const maxName = Math.max(...columns.map((c) => c.ui.widthName), MIN_W);
  const maxType = Math.max(...columns.map((c) => c.ui.widthDataType), MIN_W);
  const maxDef = Math.max(...columns.map((c) => c.ui.widthDefault), MIN_W);
  const maxCom = Math.max(...columns.map((c) => c.ui.widthComment), MIN_W);
  const body = 24 + 22 + maxName + maxType + 72 + maxDef + maxCom;
  return Math.max(header, body, 220);
}

function estimateTableHeight(columnCount) {
  return 46 + columnCount * 26;
}

function targetCollection(target, schemasByUid) {
  const schema = schemasByUid[target];
  if (!schema) return null;
  return schema.collectionName;
}

function isOwningRelation(attr) {
  if (attr.type !== "relation") return false;
  // Inverse sides are mappedBy; skip them so each FK is drawn once.
  if (attr.mappedBy) return false;
  return (
    attr.relation === "manyToOne" ||
    attr.relation === "oneToOne" ||
    attr.relation === "manyToMany"
  );
}

function main() {
  const loaded = loadSchemas();
  if (!loaded.length) {
    throw new Error(`No Strapi schemas found under ${API_DIR}`);
  }

  const schemasByUid = {};
  for (const { schema } of loaded) {
    const uidKey = `api::${schema.info.singularName}.${schema.info.singularName}`;
    schemasByUid[uidKey] = schema;
  }

  const tableEntities = {};
  const tableColumnEntities = {};
  const relationshipEntities = {};
  const indexEntities = {};
  const indexColumnEntities = {};
  const memoEntities = {};

  const tablesByCollection = {};
  const pkByCollection = {};
  const columnsByTable = {};
  const pendingRels = [];
  const pendingIndexes = [];

  for (const { schema } of loaded) {
    const collection = schema.collectionName;
    const tableId = uid(["tbl", collection]);
    const singular = schema.info.singularName;
    const comment = schema.info.description || schema.info.displayName || "";
    const color = CLUSTER_COLOR[singular] || "";

    const columns = [];
    const add = (col) => {
      columns.push(col);
      tableColumnEntities[col.id] = col;
    };

    const idCol = makeColumn({
      tableId,
      name: "id",
      comment: "Strapi row primary key",
      dataType: "INTEGER",
      pk: true,
      notNull: true,
      autoIncrement: true,
    });
    add(idCol);
    pkByCollection[collection] = idCol.id;

    add(
      makeColumn({
        tableId,
        name: "document_id",
        comment: "Strapi 5 document identifier",
        dataType: "VARCHAR(255)",
        unique: true,
        notNull: true,
      })
    );
    pendingIndexes.push({
      tableId,
      collection,
      columnName: "document_id",
      unique: true,
    });

    for (const [attrName, attr] of Object.entries(schema.attributes)) {
      if (attr.type === "relation") {
        if (!isOwningRelation(attr)) continue;
        const target = schemasByUid[attr.target];
        if (!target) continue;
        const fkName = `${attrName}_id`;
        const oneToOne = attr.relation === "oneToOne";
        add(
          makeColumn({
            tableId,
            name: fkName,
            comment: commentFor(attr, `FK → ${target.collectionName}.id`),
            dataType: "INTEGER",
            fk: true,
            unique: oneToOne,
            notNull: Boolean(attr.required),
          })
        );
        pendingRels.push({
          fromCollection: collection,
          fkName,
          toCollection: target.collectionName,
          relation: attr.relation,
          required: Boolean(attr.required),
          attrName,
        });
        if (oneToOne) {
          pendingIndexes.push({
            tableId,
            collection,
            columnName: fkName,
            unique: true,
          });
        }
        continue;
      }

      if (attr.type === "media") {
        add(
          makeColumn({
            tableId,
            name: attrName,
            comment: commentFor(
              attr,
              `Media (${(attr.allowedTypes || []).join(", ") || "file"})`
            ),
            dataType: "media",
            notNull: Boolean(attr.required),
          })
        );
        continue;
      }

      const unique = Boolean(attr.unique) || attr.type === "uid";
      add(
        makeColumn({
          tableId,
          name: attrName,
          comment: commentFor(attr),
          dataType: mapDataType(attr),
          notNull: Boolean(attr.required),
          unique,
        })
      );
      if (unique) {
        pendingIndexes.push({
          tableId,
          collection,
          columnName: attrName,
          unique: true,
        });
      }
    }

    add(
      makeColumn({
        tableId,
        name: "created_at",
        comment: "Row created at",
        dataType: "TIMESTAMPTZ",
        notNull: true,
      })
    );
    add(
      makeColumn({
        tableId,
        name: "updated_at",
        comment: "Row updated at",
        dataType: "TIMESTAMPTZ",
        notNull: true,
      })
    );

    if (schema.options && schema.options.draftAndPublish) {
      add(
        makeColumn({
          tableId,
          name: "published_at",
          comment: "Draft & publish timestamp",
          dataType: "TIMESTAMPTZ",
        })
      );
    }

    const columnIds = columns.map((c) => c.id);
    const table = {
      id: tableId,
      name: collection,
      comment,
      columnIds,
      seqColumnIds: [...columnIds],
      ui: {
        x: 0,
        y: 0,
        zIndex: 1,
        widthName: textWidth(collection),
        widthComment: textWidth(comment, { max: MAX_COMMENT_W }),
        color,
      },
      meta: meta(),
    };

    table._width = estimateTableWidth(table, columns);
    table._height = estimateTableHeight(columns.length);
    tableEntities[tableId] = table;
    tablesByCollection[collection] = table;
    columnsByTable[tableId] = columns;
  }

  // Layout: domain clusters, left-to-right then top-to-bottom.
  const layout = [
    ["organizations", "memberships", "members", "membership_types"],
    ["account_categories", "accounts", "receipts", "transaction_types"],
    ["currency_categories", "currency_types", "currency_rates", "transactions"],
  ];
  const layoutOrder = layout.flat();
  const originX = 80;
  const originY = 80;
  const gapX = 90;
  const gapY = 110;
  let y = originY;
  for (const row of layout) {
    let x = originX;
    let rowHeight = 0;
    let z = 1;
    for (const collection of row) {
      const table = tablesByCollection[collection];
      if (!table) continue;
      table.ui.x = x;
      table.ui.y = y;
      table.ui.zIndex = z++;
      x += table._width + gapX;
      rowHeight = Math.max(rowHeight, table._height);
    }
    y += rowHeight + gapY;
  }

  function columnId(collection, name) {
    return uid(["col", collection, name]);
  }

  function tableBox(collection) {
    const t = tablesByCollection[collection];
    return {
      x: t.ui.x,
      y: t.ui.y,
      w: t._width,
      h: t._height,
      cx: t.ui.x + t._width / 2,
      cy: t.ui.y + t._height / 2,
    };
  }

  function edgePoint(box, direction) {
    switch (direction) {
      case Direction.left:
        return { x: box.x, y: box.cy, direction };
      case Direction.right:
        return { x: box.x + box.w, y: box.cy, direction };
      case Direction.top:
        return { x: box.cx, y: box.y, direction };
      case Direction.bottom:
        return { x: box.cx, y: box.y + box.h, direction };
      default:
        return { x: box.cx, y: box.cy, direction };
    }
  }

  function pickDirections(fromCollection, toCollection) {
    if (fromCollection === toCollection) {
      return { startDir: Direction.top, endDir: Direction.right };
    }
    const a = tableBox(toCollection); // one / PK side (start)
    const b = tableBox(fromCollection); // many / FK side (end)
    const dx = b.cx - a.cx;
    const dy = b.cy - a.cy;
    if (Math.abs(dx) >= Math.abs(dy)) {
      if (dx >= 0) return { startDir: Direction.right, endDir: Direction.left };
      return { startDir: Direction.left, endDir: Direction.right };
    }
    if (dy >= 0) return { startDir: Direction.bottom, endDir: Direction.top };
    return { startDir: Direction.top, endDir: Direction.bottom };
  }

  for (const rel of pendingRels) {
    const id = uid(["rel", rel.fromCollection, rel.attrName]);
    const startTableId = uid(["tbl", rel.toCollection]);
    const endTableId = uid(["tbl", rel.fromCollection]);
    const { startDir, endDir } = pickDirections(
      rel.fromCollection,
      rel.toCollection
    );
    const start = edgePoint(tableBox(rel.toCollection), startDir);
    const end = edgePoint(tableBox(rel.fromCollection), endDir);

    const oneToOne = rel.relation === "oneToOne";
    const relationshipType = oneToOne
      ? rel.required
        ? RelationshipType.OneOnly
        : RelationshipType.ZeroOne
      : rel.required
        ? RelationshipType.OneN
        : RelationshipType.ZeroN;

    relationshipEntities[id] = {
      id,
      identification: false,
      relationshipType,
      startRelationshipType: StartRelationshipType.ring,
      start: {
        tableId: startTableId,
        columnIds: [pkByCollection[rel.toCollection]],
        x: start.x,
        y: start.y,
        direction: start.direction,
      },
      end: {
        tableId: endTableId,
        columnIds: [columnId(rel.fromCollection, rel.fkName)],
        x: end.x,
        y: end.y,
        direction: end.direction,
      },
      meta: meta(),
    };
  }

  for (const idx of pendingIndexes) {
    const id = uid(["idx", idx.collection, idx.columnName]);
    const indexColumnId = uid(["idxcol", idx.collection, idx.columnName]);
    indexEntities[id] = {
      id,
      name: `uq_${idx.collection}_${idx.columnName}`,
      tableId: idx.tableId,
      indexColumnIds: [indexColumnId],
      seqIndexColumnIds: [indexColumnId],
      unique: Boolean(idx.unique),
      meta: meta(),
    };
    indexColumnEntities[indexColumnId] = {
      id: indexColumnId,
      indexId: id,
      columnId: columnId(idx.collection, idx.columnName),
      orderType: OrderType.ASC,
      meta: meta(),
    };
  }

  const memoId = "memo__legend";
  memoEntities[memoId] = {
    id: memoId,
    value: [
      "CURR — Strapi 5 content types",
      "Source: src/api/**/schema.json",
      "",
      "Blue: community  ·  Purple: accounts",
      "Green: ledger  ·  Gold: currency",
      "",
      "Owning-side FKs only (mappedBy omitted).",
      "document_id is the Strapi 5 document key.",
      "published_at only when draftAndPublish is on.",
    ].join("\n"),
    ui: {
      x: 80,
      y: y + 20,
      width: 420,
      height: 210,
      zIndex: 1,
      color: "",
    },
    meta: meta(),
  };

  const sizes = {};
  for (const [id, table] of Object.entries(tableEntities)) {
    sizes[id] = { w: table._width, h: table._height };
    delete table._width;
    delete table._height;
  }

  const doc = {
    $schema: SCHEMA_URL,
    version: "3.0.0",
    settings: {
      width: 5000,
      height: 3500,
      scrollTop: 0,
      scrollLeft: 0,
      originX: 0,
      originY: 0,
      zoomLevel: 0.7,
      show:
        Show.tableComment |
        Show.columnComment |
        Show.columnDataType |
        Show.columnDefault |
        Show.columnAutoIncrement |
        Show.columnPrimaryKey |
        Show.columnUnique |
        Show.columnNotNull |
        Show.relationship,
      database: 16, // PostgreSQL
      databaseName: "curr",
      canvasType: "ERD",
      language: 16, // TypeScript
      tableNameCase: 1, // none
      columnNameCase: 1, // none
      bracketType: 2, // doubleQuote
      relationshipDataTypeSync: true,
      relationshipOptimization: true,
      columnOrder: [1, 2, 4, 8, 16, 32, 64],
      maxWidthComment: 300,
      ignoreSaveSettings: 0,
    },
    doc: {
      tableIds: layoutOrder
        .map((collection) => uid(["tbl", collection]))
        .filter((id) => tableEntities[id]),
      relationshipIds: Object.keys(relationshipEntities),
      indexIds: Object.keys(indexEntities),
      memoIds: [memoId],
    },
    collections: {
      tableEntities,
      tableColumnEntities,
      relationshipEntities,
      indexEntities,
      indexColumnEntities,
      memoEntities,
    },
  };

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, `${JSON.stringify(doc, null, 2)}\n`);
  console.log(
    `Wrote ${path.relative(ROOT, OUT_FILE)} ` +
      `(${doc.doc.tableIds.length} tables, ` +
      `${doc.doc.relationshipIds.length} relationships, ` +
      `${Object.keys(tableColumnEntities).length} columns)`
  );
  for (const collection of layoutOrder) {
    const t = tablesByCollection[collection];
    if (!t) continue;
    const size = sizes[t.id];
    console.log(
      `  ${collection.padEnd(22)} x=${String(t.ui.x).padStart(4)} y=${String(t.ui.y).padStart(4)} ` +
        `w=${size.w} h=${size.h}`
    );
  }
}

main();
