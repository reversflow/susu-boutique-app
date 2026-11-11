import { CURRENT_SCHEMA_VERSION } from './sqliteMigrations';

export interface SchemaInspectionDatabase {
  getFirstAsync<T>(source: string): Promise<T | null>;
  getAllAsync<T>(source: string): Promise<T[]>;
}

type ColumnRequirement = {
  name: string;
  affinity: 'INTEGER' | 'REAL' | 'TEXT';
  primaryKey: number;
  notNull: boolean;
};

type TableRequirement = {
  name: string;
  columns: ColumnRequirement[];
  optionalColumns?: ColumnRequirement[];
};

type TableRow = {
  name: string;
};

type ColumnRow = {
  name: string;
  type: string;
  notnull: number;
  pk: number;
};

type IntegrityRow = {
  integrity_check: string;
};

type UserVersionRow = {
  user_version: number;
};

const dailyRecordColumns: ColumnRequirement[] = [
  { name: 'date', affinity: 'TEXT', primaryKey: 1, notNull: true },
  { name: 'total_sold', affinity: 'REAL', primaryKey: 0, notNull: true },
  { name: 'investment_cost', affinity: 'REAL', primaryKey: 0, notNull: true },
  { name: 'additional_expenses', affinity: 'REAL', primaryKey: 0, notNull: true },
  { name: 'notes', affinity: 'TEXT', primaryKey: 0, notNull: true },
];

const netProfitColumn: ColumnRequirement = {
  name: 'net_profit',
  affinity: 'REAL',
  primaryKey: 0,
  notNull: true,
};

function requirementsForVersion(version: number): TableRequirement[] {
  const dailyColumns = [...dailyRecordColumns];
  const dailyOptionalColumns: ColumnRequirement[] = [];

  if (version >= 3) {
    dailyColumns.push({ name: 'profit_percent', affinity: 'REAL', primaryKey: 0, notNull: true });
    if (version === 3) {
      dailyOptionalColumns.push(netProfitColumn);
    } else {
      dailyColumns.push(netProfitColumn);
    }
  }

  if (version >= 7) {
    dailyColumns.push({ name: 'dataphone_sales', affinity: 'REAL', primaryKey: 0, notNull: true });
  }

  const tables: TableRequirement[] = [
    {
      name: 'daily_records',
      columns: dailyColumns,
      optionalColumns: dailyOptionalColumns,
    },
  ];

  if (version >= 2) {
    const adjustmentColumns: ColumnRequirement[] = [
      { name: 'id', affinity: 'INTEGER', primaryKey: 1, notNull: false },
      { name: 'date', affinity: 'TEXT', primaryKey: 0, notNull: true },
      { name: 'amount', affinity: 'REAL', primaryKey: 0, notNull: true },
      { name: 'note', affinity: 'TEXT', primaryKey: 0, notNull: true },
    ];

    if (version >= 8) {
      adjustmentColumns.push(
        { name: 'supplier_id', affinity: 'INTEGER', primaryKey: 0, notNull: false },
        { name: 'type', affinity: 'TEXT', primaryKey: 0, notNull: true },
      );
    }

    tables.push({ name: 'investment_adjustments', columns: adjustmentColumns });
  }

  if (version >= 5) {
    tables.push(
      {
        name: 'holidays',
        columns: [
          { name: 'date', affinity: 'TEXT', primaryKey: 1, notNull: true },
          { name: 'name', affinity: 'TEXT', primaryKey: 0, notNull: true },
          { name: 'type', affinity: 'TEXT', primaryKey: 0, notNull: true },
        ],
      },
      {
        name: 'app_meta',
        columns: [
          { name: 'key', affinity: 'TEXT', primaryKey: 1, notNull: true },
          { name: 'value', affinity: 'TEXT', primaryKey: 0, notNull: true },
        ],
      },
    );
  }

  if (version >= 6) {
    tables.push({
      name: 'suppliers',
      columns: [
        { name: 'id', affinity: 'INTEGER', primaryKey: 1, notNull: false },
        { name: 'name', affinity: 'TEXT', primaryKey: 0, notNull: true },
        { name: 'phone', affinity: 'TEXT', primaryKey: 0, notNull: true },
        { name: 'notes', affinity: 'TEXT', primaryKey: 0, notNull: true },
        { name: 'created_at', affinity: 'TEXT', primaryKey: 0, notNull: true },
      ],
    });
  }

  if (version >= 10) {
    const storePriceGroupColumns: ColumnRequirement[] = [
      { name: 'id', affinity: 'INTEGER', primaryKey: 1, notNull: false },
      { name: 'category_id', affinity: 'INTEGER', primaryKey: 0, notNull: true },
      { name: 'price_cents', affinity: 'INTEGER', primaryKey: 0, notNull: true },
      { name: 'stock_units', affinity: 'INTEGER', primaryKey: 0, notNull: true },
      { name: 'sort_order', affinity: 'INTEGER', primaryKey: 0, notNull: true },
      { name: 'is_active', affinity: 'INTEGER', primaryKey: 0, notNull: true },
    ];
    if (version >= 11) {
      storePriceGroupColumns.push({
        name: 'photo_data_url',
        affinity: 'TEXT',
        primaryKey: 0,
        notNull: true,
      });
    }

    const storeSalesColumns: ColumnRequirement[] = [
      { name: 'id', affinity: 'INTEGER', primaryKey: 1, notNull: false },
      { name: 'sold_at', affinity: 'TEXT', primaryKey: 0, notNull: true },
      { name: 'total_cents', affinity: 'INTEGER', primaryKey: 0, notNull: true },
    ];
    const storeSaleItemColumns: ColumnRequirement[] = [
      { name: 'id', affinity: 'INTEGER', primaryKey: 1, notNull: false },
      { name: 'sale_id', affinity: 'INTEGER', primaryKey: 0, notNull: true },
      { name: 'price_group_id', affinity: 'INTEGER', primaryKey: 0, notNull: true },
      { name: 'units_sold', affinity: 'INTEGER', primaryKey: 0, notNull: true },
      { name: 'unit_price_cents', affinity: 'INTEGER', primaryKey: 0, notNull: true },
      { name: 'total_cents', affinity: 'INTEGER', primaryKey: 0, notNull: true },
    ];
    if (version >= 12) {
      storeSalesColumns.push(
        { name: 'request_id', affinity: 'TEXT', primaryKey: 0, notNull: false },
        { name: 'request_payload', affinity: 'TEXT', primaryKey: 0, notNull: false },
      );
      storeSaleItemColumns.push({
        name: 'base_unit_price_cents', affinity: 'INTEGER', primaryKey: 0, notNull: true,
      });
    }

    const stockMovementColumns: ColumnRequirement[] = [
      { name: 'id', affinity: 'INTEGER', primaryKey: 1, notNull: false },
      { name: 'price_group_id', affinity: 'INTEGER', primaryKey: 0, notNull: true },
      { name: 'movement_type', affinity: 'TEXT', primaryKey: 0, notNull: true },
      { name: 'units_delta', affinity: 'INTEGER', primaryKey: 0, notNull: true },
      { name: 'supplier_id', affinity: 'INTEGER', primaryKey: 0, notNull: false },
      { name: 'sale_id', affinity: 'INTEGER', primaryKey: 0, notNull: false },
      { name: 'note', affinity: 'TEXT', primaryKey: 0, notNull: true },
      { name: 'created_at', affinity: 'TEXT', primaryKey: 0, notNull: true },
    ];
    if (version >= 13) {
      storeSaleItemColumns.push({
        name: 'cost_total_cents', affinity: 'INTEGER', primaryKey: 0, notNull: false,
      });
      stockMovementColumns.push(
        { name: 'cost_total_cents', affinity: 'INTEGER', primaryKey: 0, notNull: false },
        { name: 'charged_total_cents', affinity: 'INTEGER', primaryKey: 0, notNull: false },
      );
      tables.push({
        name: 'store_stock_lots',
        columns: [
          { name: 'id', affinity: 'INTEGER', primaryKey: 1, notNull: false },
          { name: 'price_group_id', affinity: 'INTEGER', primaryKey: 0, notNull: true },
          { name: 'received_units', affinity: 'INTEGER', primaryKey: 0, notNull: true },
          { name: 'remaining_units', affinity: 'INTEGER', primaryKey: 0, notNull: true },
          { name: 'unit_cost_cents', affinity: 'INTEGER', primaryKey: 0, notNull: false },
          { name: 'created_at', affinity: 'TEXT', primaryKey: 0, notNull: true },
        ],
      });
    }

    tables.push(
      {
        name: 'store_categories',
        columns: [
          { name: 'id', affinity: 'INTEGER', primaryKey: 1, notNull: false },
          { name: 'name', affinity: 'TEXT', primaryKey: 0, notNull: true },
          { name: 'sort_order', affinity: 'INTEGER', primaryKey: 0, notNull: true },
          { name: 'is_active', affinity: 'INTEGER', primaryKey: 0, notNull: true },
        ],
      },
      {
        name: 'store_price_groups',
        columns: storePriceGroupColumns,
      },
      {
        name: 'store_sales',
        columns: storeSalesColumns,
      },
      {
        name: 'store_sale_items',
        columns: storeSaleItemColumns,
      },
      {
        name: 'store_stock_movements',
        columns: stockMovementColumns,
      },
    );
  }

  return tables;
}

function assertColumnMatches(tableName: string, row: ColumnRow, expected: ColumnRequirement): void {
  if (
    row.type.toUpperCase() !== expected.affinity ||
    row.pk !== expected.primaryKey ||
    (row.notnull === 1) !== expected.notNull
  ) {
    throw new Error(`La tabla ${tableName} no tiene la columna esperada ${expected.name}`);
  }
}

async function readUserVersion(database: SchemaInspectionDatabase): Promise<number> {
  const version = await database.getFirstAsync<UserVersionRow>('PRAGMA user_version;');
  return version?.user_version ?? 0;
}

export async function validateBackupDatabase(
  database: SchemaInspectionDatabase,
): Promise<number> {
  const integrity = await database.getFirstAsync<IntegrityRow>('PRAGMA integrity_check;');
  if (integrity?.integrity_check !== 'ok') {
    throw new Error('La copia no superó la comprobación de integridad');
  }

  const version = await readUserVersion(database);
  if (!Number.isInteger(version) || version < 1 || version > CURRENT_SCHEMA_VERSION) {
    throw new Error('La copia usa una versión de esquema no compatible');
  }

  const requirements = requirementsForVersion(version);
  const expectedTableNames = new Set(requirements.map((table) => table.name));
  const tableRows = await database.getAllAsync<TableRow>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%';",
  );

  if (tableRows.some((table) => !expectedTableNames.has(table.name))) {
    throw new Error('La copia contiene tablas ajenas a Susu’s Boutique');
  }

  if (tableRows.length !== expectedTableNames.size) {
    throw new Error('La copia no contiene todas las tablas requeridas');
  }

  for (const table of requirements) {
    const rows = await database.getAllAsync<ColumnRow>(`PRAGMA table_info(${table.name});`);
    const expectedColumns = new Map(table.columns.map((column) => [column.name, column]));
    const optionalColumns = new Map(
      (table.optionalColumns ?? []).map((column) => [column.name, column]),
    );

    if (rows.some((column) => !expectedColumns.has(column.name) && !optionalColumns.has(column.name))) {
      throw new Error(`La tabla ${table.name} contiene columnas no compatibles`);
    }

    if (rows.length < expectedColumns.size || rows.length > expectedColumns.size + optionalColumns.size) {
      throw new Error(`La tabla ${table.name} no tiene la forma esperada`);
    }

    for (const [name, expected] of expectedColumns) {
      const row = rows.find((column) => column.name === name);
      if (!row) {
        throw new Error(`La tabla ${table.name} no tiene la columna requerida ${name}`);
      }
      assertColumnMatches(table.name, row, expected);
    }

    for (const [name, expected] of optionalColumns) {
      const row = rows.find((column) => column.name === name);
      if (row) {
        assertColumnMatches(table.name, row, expected);
      }
    }
  }

  if (version === CURRENT_SCHEMA_VERSION) {
    const identity = await database.getFirstAsync<{ value: string }>(
      "SELECT value FROM app_meta WHERE key = 'schema_identity';",
    );
    if (identity?.value !== 'susu-boutique') {
      throw new Error('La copia no pertenece a Susu’s Boutique');
    }
  }

  return version;
}
