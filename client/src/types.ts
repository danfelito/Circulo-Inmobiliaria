export type TransactionType = 'rent' | 'buy';
export type PropertyType = 'house' | 'apartment' | 'land';

export type LeadForm = {
  transactionType: TransactionType; fullName: string; email: string; phone: string; tenants?: number; hasPets: boolean; petDetails: string; moveInDate: string; contractMonths?: number; propertyType: PropertyType; furnished?: 'furnished' | 'semi' | 'unfurnished' | 'indifferent'; floors: '1' | '2' | '3' | 'indifferent'; bedrooms: number; bathrooms: number; parking: number; yard: boolean; garden: boolean; pool: boolean; amenities: string[]; invoiceRequired?: boolean; guarantee?: 'guarantor' | 'legal_policy' | 'deposit' | 'advice'; delivery?: 'presale' | 'immediate' | 'indifferent'; paymentMethod?: 'credit' | 'cash' | 'mixed'; creditPreapproved?: boolean; creditAmount?: number; landAreaMin?: number; constructionAreaMin?: number; city: string; neighborhood1: string; neighborhood2: string; neighborhood3: string; budgetMin: number; budgetMax: number; essentialText: string; desirableText: string; comments: string; privacyAccepted: boolean; contactAccepted: boolean; website: string;
};

export type Match = { id:string; title:string; transactionType:TransactionType; propertyType:PropertyType; city:string; neighborhood:string; price:number; bedrooms:number; bathrooms:number; parking:number; landArea:number; constructionArea:number; pool:boolean; garden:boolean; yard:boolean; amenities:string[]; sourceName:string; sourceUrl:string; demo:boolean; matchScore:number; reasons:string[]; gaps:string[]; availabilityLabel:string; };

export type SearchResponse = { leadId:string; duplicate:boolean; analysisSource:'openai'|'deterministic'; metrics:{completeness:number; rigidity:string; contradictions:string[]}; analysis:{viability:'high'|'medium'|'low'|'insufficient_data'; headline:string; explanation:string; pressurePoints:string[]; suggestions:string[]; advisorSummary:string}; matches:Match[]; externalSearchLinks:{name:string;url:string}[]; message:string; disclaimer:string; };

export type Provider = { id:string; name:string; baseUrl:string; integrationType:'authorized_api'|'csv_feed'|'json_feed'|'search_link'|'manual'; enabled:boolean; };
