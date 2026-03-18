// AST Definitions

export type FilterOperator = 
  | '_eq' | '_neq' | '_gt' | '_gte' | '_lt' | '_lte'
  | '_in' | '_nin' | '_contains' | '_starts_with'
  | '_null' | '_nnull' | '_empty' | '_nempty';

export type LogicalOperator = '_and' | '_or';

export interface FilterNode {
  [key: string]: any; // Recursive structure
}

export interface SortNode {
  field: string;
  direction: 'asc' | 'desc';
}

export interface PaginationNode {
  limit?: number;
  offset?: number;
  page?: number;
}

export interface DeepNode {
  [relation: string]: {
    _filter?: FilterNode;
    _sort?: SortNode[];
    _limit?: number;
    _offset?: number;
  };
}

export type MetaField = 'filter_count' | 'total_count';

export interface MetaNode {
  filter_count?: boolean;
  total_count?: boolean;
}

export interface QueryContext {
  collection: string;
  query: Record<string, any>; // Raw query params
}

export interface ParsedQuery {
  filter: FilterNode;
  sort: SortNode[];
  pagination: PaginationNode;
  fields: string[]; // List of fields to select/populate
  deep: DeepNode;
  meta: MetaNode;
  // TODO: Aggregation
  aggregate?: {
    count?: string[]; // Fields to count, or ['*']
  };
}
