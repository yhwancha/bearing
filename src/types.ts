/* Domain model. Everything the customs paperwork needs lives here. */

/** Customs authority the order is declared to. Singapore first; other hubs follow the same shape. */
export type Jurisdiction = 'SG'
export type Currency = 'SGD' | 'USD'

/** How Singapore Customs treats an item that goes on board. */
export type SgClass =
  | 'sea_store_paid' // duty/GST-paid, not controlled → no permit, monthly statement only
  | 'sea_store_unpaid' // duty/GST unpaid → TradeNet OUT permit (APS)
  | 'dutiable_liquor' // spirits, wine, beer → permit + approved vessel + daily ration
  | 'dutiable_tobacco' // cigarettes, cigars, tobacco → permit + approved vessel + daily ration
  | 'controlled' // controlled by a Competent Authority → CA approval, then OUT (DRT)
  | 'ship_spare_install' // parts installed on the ship → not sea stores, GST applies

/** Which daily ration a dutiable item counts against. */
export type RationKind = 'cigarettes' | 'tobacco' | 'cigars' | 'spirits' | 'wine' | 'beer'

export type VesselType = 'cargo' | 'passenger' | 'oil_rig' | 'dredge' | 'fishing' | 'supply' | 'tug' | 'other'

export interface Agency {
  id: string
  name: string
  /** Mail domain, used to recognise the sender of a pasted email. */
  domain: string
}

export interface Product {
  id: string
  sku: string
  name: string
  /** Pack size as declared, e.g. "25 kg", "70 cl × 1", "200 sticks". */
  spec: string
  unit: string
  hs: string
  category: string
  /** Supplier's price per unit in SGD. */
  price: number
  sgClass?: SgClass
  /** Competent Authority for controlled items, e.g. "SFA". */
  controlAuthority?: string
  rationKind?: RationKind
  /** Ration units in one unit of this product: sticks per carton, bottles per case, grams per pouch… */
  rationUnitQty?: number
}

/** Maps an agency's wording to a product. Applied by code, never by the model. */
export interface Rule {
  id: string
  /** Upper-case keyword tokens that must appear in order. `*` is a wildcard inside a token. */
  pattern: string[]
  /** Agency the rule belongs to; null = any agency. */
  agencyId: string | null
  productId: string
  source: 'seed' | 'approved'
  createdAt: string
}

/** A classification the model (or the offline heuristic) suggests for an unknown line. */
export interface Proposal {
  id: string
  orderId: string
  agencyId: string
  desc: string
  pattern: string[]
  /** Existing product to link to, if the suggestion matches one. */
  productId?: string
  draft: Omit<Product, 'id' | 'sku' | 'price'> & { price?: number }
  rationale: string
  source: 'ai' | 'heuristic'
  status: 'pending' | 'approved' | 'rejected'
  createdAt: string
}

export interface VesselInfo {
  name: string
  imo?: string
  /** Flag state (vessel nationality). Required on a sea-stores permit. */
  flag?: string
  type?: VesselType
  crew?: number
  /** Days until the next port of call. Rations are counted per crew per day of the voyage. */
  voyageDays?: number
  /** Berth or anchorage, e.g. "Western Anchorage". */
  location?: string
  eta?: string
}

export interface OrderLine {
  idx: number
  raw: string
  desc: string
  qty: number
  /** Unit as written in the order, e.g. BAG, CTN, BTL. */
  orderUnit: string
  /** Item code the buyer used, e.g. an IMPA code from the ship's requisition. */
  code?: string
}

export type LineState = 'rule' | 'proposed' | 'unknown'

/** An order line after rules are applied. */
export interface ResolvedLine extends OrderLine {
  state: LineState
  ruleId?: string
  proposalId?: string
  productId?: string
  name?: string
  spec?: string
  unit?: string
  hs?: string
  sgClass?: SgClass
  controlAuthority?: string
  rationKind?: RationKind
  rationUnitQty?: number
  unitPrice?: number
}

export interface RationCheck {
  kind: RationKind
  /** In ration units: sticks, grams, bottles or cans. */
  requested: number
  /** crew × voyage days × daily ration */
  allowed: number
  ok: boolean
  lines: number[]
}

export type DeclarationType = 'APS' | 'DRT'

/** One TradeNet permit to file. Sea stores go on APS; controlled duty-paid stores on a separate DRT. */
export interface PermitGroup {
  declarationType: DeclarationType
  lines: number[]
}

/** The Singapore filing split for one order, frozen when the user confirms it. */
export interface SgDeclaration {
  lines: ResolvedLine[]
  /** Lines that need a TradeNet permit. */
  permitLines: number[]
  /** Duty-paid, uncontrolled lines: no permit, monthly statement only. */
  statementOnly: number[]
  /** Installed spares: not sea stores. */
  excluded: number[]
  /** Competent Authority → approval confirmed */
  caChecks: Record<string, boolean>
  rations: RationCheck[]
  messageType: 'OUT'
  permits: PermitGroup[]
  confirmedAt?: string
  tradenetPermitNo?: string
}

export interface Delivery {
  at: string
  receivedBy: string
  /** Line idx → quantity actually delivered */
  checked: Record<number, number>
}

export type OrderStatus = 'new' | 'review' | 'ready' | 'filed' | 'delivered'

export interface Order {
  id: string
  ref: string
  agencyId: string
  receivedAt: string
  subject: string
  raw: string
  vessel: VesselInfo
  lines: OrderLine[]
  jurisdiction: Jurisdiction
  currency: Currency
  readSource: 'ai' | 'heuristic'
  /** Set when the declaration is confirmed (frozen split). */
  decl?: SgDeclaration
  /** Competent Authority approvals ticked off while preparing. */
  caChecks?: Record<string, boolean>
  delivery?: Delivery
}

export interface Workspace {
  name: string
  uen: string
}

export interface State {
  version: 1
  workspace: Workspace
  agencies: Agency[]
  products: Product[]
  rules: Rule[]
  proposals: Proposal[]
  orders: Order[]
  /** Set once the user edits anything, so the demo is not re-seeded under them. */
  touched: boolean
}
