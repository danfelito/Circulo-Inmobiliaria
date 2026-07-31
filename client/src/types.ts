export type TransactionType = 'rent' | 'buy';
export type PropertyType = 'house' | 'apartment' | 'land' | 'retail' | 'office' | 'warehouse' | 'ranch';

export type LeadForm = {
  transactionType: TransactionType; fullName: string; email: string; phone: string; tenants?: number; hasPets: boolean; petDetails: string; moveInDate: string; contractMonths?: number; propertyType: PropertyType; furnished?: 'furnished' | 'semi' | 'unfurnished' | 'indifferent'; floors: '1' | '2' | '3' | 'indifferent'; bedrooms: number; bathrooms: number; parking: number; yard: boolean; garden: boolean; pool: boolean; amenities: string[]; invoiceRequired?: boolean; guarantee?: 'guarantor' | 'legal_policy' | 'deposit' | 'advice'; delivery?: 'presale' | 'immediate' | 'indifferent'; paymentMethod?: 'credit' | 'cash' | 'mixed'; creditPreapproved?: boolean; creditAmount?: number; landAreaMin?: number; constructionAreaMin?: number; city: string; neighborhood1: string; neighborhood2: string; neighborhood3: string; budgetMin: number; budgetMax: number; essentialText: string; desirableText: string; comments: string; privacyAccepted: boolean; contactAccepted: boolean; website: string;
};

export type PropertyMatch = {
  id: string;
  title: string;
  transactionType: TransactionType;
  propertyType: PropertyType;
  city: string;
  neighborhood: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  parking: number;
  landArea: number;
  constructionArea: number;
  yard: boolean;
  garden: boolean;
  pool: boolean;
  amenities: string[];
  sourceName: string;
  sourceUrl: string;
  verifiedAt?: string;
  demo: boolean;
  matchScore: number;
  reasons: string[];
  gaps: string[];
  availabilityLabel: string;
};

export type SearchResponse = {
  leadId: string;
  duplicate: boolean;
  analysisSource: 'openai' | 'deterministic';
  metrics: { completeness: number; rigidity: string; contradictions: string[] };
  analysis: { viability: 'high' | 'medium' | 'low' | 'insufficient_data'; headline: string; explanation: string; pressurePoints: string[]; suggestions: string[]; advisorSummary: string; };
  matchCount: number;
  matches: PropertyMatch[];
  sourcesConsulted: number;
  confirmationRequired: boolean;
  confirmationSent: boolean;
  emailSent: boolean;
  emailWarning?: string;
  message: string;
  disclaimer: string;
};

export type ConfirmationResponse = {
  confirmed: boolean;
  emailSent: boolean;
  duplicate?: boolean;
  selectedPropertyIds: string[];
  message: string;
};

export type Provider = { id: string; name: string; baseUrl: string; enabled: boolean; };

export type ProviderCheck = {
  id: string;
  name: string;
  url: string;
  host: string;
  enabled: boolean;
  reachable: boolean;
  readable: boolean;
  statusCode?: number;
  contentType?: string;
  charactersRead?: number;
  message: string;
};
