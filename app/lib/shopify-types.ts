export type MoneySet = {
  shopMoney?: {
    amount?: string | null;
    currencyCode?: string | null;
  } | null;
};

export type Address = {
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  provinceCode?: string | null;
  province?: string | null;
  zip?: string | null;
  countryCodeV2?: string | null;
  country?: string | null;
};

export type ShopifyOrder = {
  id: string;
  name: string;
  createdAt?: string | null;
  displayFinancialStatus?: string | null;
  displayFulfillmentStatus?: string | null;
  currencyCode?: string | null;
  totalPriceSet?: MoneySet | null;
  totalReceivedSet?: MoneySet | null;
  customer?: {
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    numberOfOrders?: string | number | null;
  } | null;
  email?: string | null;
  shippingAddress?: Address | null;
  billingAddress?: Address | null;
  lineItems?: {
    nodes?: Array<{
      title?: string | null;
      variantTitle?: string | null;
      sku?: string | null;
      quantity?: number | null;
    }>;
  } | null;
  fulfillments?: Array<{
    status?: string | null;
    createdAt?: string | null;
    deliveredAt?: string | null;
    trackingInfo?: Array<{
      company?: string | null;
      number?: string | null;
      url?: string | null;
    }> | null;
  }> | null;
  transactions?: Array<{
    kind?: string | null;
    status?: string | null;
    processedAt?: string | null;
    amountSet?: MoneySet | null;
  }> | null;
  risks?: Array<{ recommendation?: string | null; message?: string | null }> | null;
};

export type ShopifyDispute = {
  id: string;
  legacyResourceId?: string | null;
  status?: string | null;
  reason?: string | null;
  initiatedAt?: string | null;
  evidenceDueBy?: string | null;
  evidenceSentOn?: string | null;
  amount?: {
    amount?: string | null;
    currencyCode?: string | null;
  } | null;
  order?: {
    id?: string | null;
    name?: string | null;
  } | null;
  evidence?: {
    id?: string | null;
  } | null;
};

export type ProofSummary = {
  sealed: boolean;
  imageCount: number;
};

export type ProofCaptureSummary = {
  status?: string | null;
  sealedAt?: string | Date | null;
  staffLabel?: string | null;
  stationLabel?: string | null;
  notes?: string | null;
};

export type ProofFileSummary = {
  id?: string;
  originalFilename?: string;
  filename?: string;
  mimeType?: string | null;
  byteSize?: number | null;
  sha256?: string | null;
  capturedAt?: string | Date | null;
  staffLabel?: string | null;
  stationLabel?: string | null;
  notes?: string | null;
};

export type AuditEventSummary = {
  action: string;
  actorType?: string | null;
  actorLabel?: string | null;
  createdAt?: string | Date | null;
  metadata?: unknown;
};
