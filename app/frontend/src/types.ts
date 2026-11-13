export type Role = "admin" | "editor" | "player";

export interface User {
  id: number;
  login: string;
  name: string;
  role: Role;
}

export interface MeResponse {
  user: User | null;
  csrf: string | null;
}

export interface NavItem {
  id?: string;
  path?: string;
  title: string;
  url?: string;
  type?: string;
  status?: string;
  secret?: boolean;
  sub?: string;
  children?: NavItem[];
}

export interface NavSection {
  id: string;
  title: string;
  url?: string;
  children?: NavItem[];
}

export interface Backlink {
  path: string;
  title: string;
  url: string;
}

export interface RelLink {
  pred: string;
  note: string;
  name: string;
  path: string;
  type: string;
  url: string;
}

export interface EntityCard {
  id: number;
  type: string;
  type_label: string;
  slug: string;
  name: string;
  data: Record<string, unknown>;
  tags: string[];
  portret: string;
  vazby_out: RelLink[];
  vazby_in: RelLink[];
  sheet?: any;
  sheet_error?: string;
}

export interface PageData {
  path: string;
  title: string;
  type: string;
  type_label: string;
  status: string;
  secret: boolean;
  has_dm: boolean;
  html: string;
  dm_html: string;
  toc: { level: number; title: string; slug: string }[];
  meta: Record<string, unknown>;
  backlinks: { odkazy: Backlink[]; vazby: Backlink[]; zminky: Backlink[] };
  entity: EntityCard | null;
  battles: { id: string; name: string; status: string }[];
  map_place: { nazev: string; x: number; y: number; typ: string; jistota: string } | null;
  children?: { path: string; title: string; status: string; url: string; secret: boolean }[];
  raw?: string;
  editable: boolean;
  can_view_dm: boolean;
}

export interface BattleSummary {
  id: string;
  name: string;
  status: string;
  kampan: string;
  kampane?: string[];
  quest: string;
  sezeni: string;
  map_ref: string;
  kola: number;
  ucastnici: { nazev: string; strana: string; hp: number; max: number; mrtvy: boolean }[];
  shared: boolean;
  updated_at: string;
  version: number;
}

export interface SearchResult {
  q: string;
  groups: Record<string, Array<Record<string, unknown>>>;
}

export interface CatalogItem {
  id?: number;
  key?: string;
  path?: string;
  url?: string;
  name: string;
  [k: string]: unknown;
}
