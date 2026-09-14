import { CatalystEvent } from '../types';

export function getScheduledCatalysts(dateStr?: string): CatalystEvent[] {
  // Returns scheduled catalysts for the desk brief
  const baseDate = dateStr || new Date().toISOString().split('T')[0];
  
  return [
    {
      id: 'cat-1',
      timeUTC: '12:30 UTC',
      timeEST: '08:30 AM EST',
      category: 'MACRO',
      event: 'US Core CPI (Consumer Price Index) MoM / YoY',
      impact: 'HIGH',
      consensus: '0.2% MoM / 2.9% YoY',
      previous: '0.2% MoM / 2.9% YoY',
      notes: 'High volatility driver. Core print >= 0.3% triggers hawkish rate pricing and USD strength, pressuring risk assets. Invalidation trigger for pre-market setups.'
    },
    {
      id: 'cat-2',
      timeUTC: '14:00 UTC',
      timeEST: '10:00 AM EST',
      category: 'MACRO',
      event: 'University of Michigan Consumer Sentiment & Inflation Expectations',
      impact: 'MEDIUM',
      consensus: '68.5',
      previous: '67.9',
      notes: 'Intraday flow catalyst. Watch 1-year and 5-year inflation expectations for sudden spikes affecting bond yields.'
    },
    {
      id: 'cat-3',
      timeUTC: '18:00 UTC',
      timeEST: '02:00 PM EST',
      category: 'CENTRAL_BANK',
      event: 'FOMC Member Speech (Fed Vice Chair on Monetary Policy)',
      impact: 'HIGH',
      consensus: 'Neutral / Data-dependent',
      previous: 'N/A',
      notes: 'Comments on terminal policy rate and quantitative tightening trajectory will drive late US session liquidity.'
    },
    {
      id: 'cat-4',
      timeUTC: '08:00 UTC',
      timeEST: '04:00 AM EST',
      category: 'CRYPTO_SPECIFIC',
      event: 'Deribit Weekly / Intraday Options Expiry & Futures Settlement',
      impact: 'MEDIUM',
      consensus: 'N/A',
      previous: 'N/A',
      notes: 'Pin risk around Max Pain strikes. Gamma decay typically accelerates responsive mean reversion into 08:00 UTC.'
    }
  ];
}
