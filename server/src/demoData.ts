import type { Property, ProviderInput } from './schemas.js';

export const demoProperties: Property[] = [
  { id:'demo-rent-1',title:'Casa familiar en Costa de Oro',transactionType:'rent',propertyType:'house',city:'Boca del Río',neighborhood:'Costa de Oro',price:32000,bedrooms:4,bathrooms:3.5,parking:2,landArea:260,constructionArea:285,floors:2,furnished:'unfurnished',yard:true,garden:true,pool:false,amenities:['seguridad','terraza','cuarto de servicio'],sourceName:'Catálogo demostrativo',sourceUrl:'#',verifiedAt:new Date().toISOString(),demo:true },
  { id:'demo-rent-2',title:'Departamento con alberca en Riviera Veracruzana',transactionType:'rent',propertyType:'apartment',city:'Alvarado',neighborhood:'Riviera Veracruzana',price:24500,bedrooms:3,bathrooms:2,parking:2,landArea:0,constructionArea:145,floors:1,furnished:'semi',yard:false,garden:false,pool:true,amenities:['elevador','gimnasio','seguridad','área social'],sourceName:'Catálogo demostrativo',sourceUrl:'#',verifiedAt:new Date().toISOString(),demo:true },
  { id:'demo-rent-3',title:'Casa compacta en Fraccionamiento Virginia',transactionType:'rent',propertyType:'house',city:'Boca del Río',neighborhood:'Virginia',price:18000,bedrooms:3,bathrooms:2.5,parking:1,landArea:150,constructionArea:175,floors:2,furnished:'unfurnished',yard:true,garden:false,pool:false,amenities:['estudio'],sourceName:'Catálogo demostrativo',sourceUrl:'#',demo:true },
  { id:'demo-buy-1',title:'Casa residencial en Lomas del Dorado',transactionType:'buy',propertyType:'house',city:'Boca del Río',neighborhood:'Lomas del Dorado',price:4850000,bedrooms:3,bathrooms:3,parking:2,landArea:220,constructionArea:245,floors:2,yard:true,garden:true,pool:false,amenities:['seguridad','casa club'],sourceName:'Catálogo demostrativo',sourceUrl:'#',demo:true },
  { id:'demo-buy-2',title:'Departamento frente al mar en Boca del Río',transactionType:'buy',propertyType:'apartment',city:'Boca del Río',neighborhood:'Mocambo',price:3650000,bedrooms:2,bathrooms:2,parking:2,landArea:0,constructionArea:118,floors:1,pool:true,yard:false,garden:false,amenities:['elevador','seguridad','gimnasio','vista al mar'],sourceName:'Catálogo demostrativo',sourceUrl:'#',demo:true },
  { id:'demo-buy-3',title:'Casa amplia en El Tejar',transactionType:'buy',propertyType:'house',city:'Medellín de Bravo',neighborhood:'El Tejar',price:2150000,bedrooms:4,bathrooms:2.5,parking:2,landArea:300,constructionArea:210,floors:2,yard:true,garden:true,pool:false,amenities:['estudio','bodega'],sourceName:'Catálogo demostrativo',sourceUrl:'#',demo:true },
];

export const demoProviders: ProviderInput[] = Array.from({ length: 10 }, (_, index) => ({
  id: `source-${index + 1}`,
  name: index === 0 ? 'Círculo Internacional' : `Fuente ${index + 1}`,
  baseUrl: index === 0 ? 'https://circulointernacional.com/home-page/properties/home' : '',
  enabled: index === 0,
}));
