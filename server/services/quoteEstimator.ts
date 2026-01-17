import Anthropic from '@anthropic-ai/sdk';
import { db } from '../db';
import { costLibraryItems, costCategories } from '@shared/schema';

const DEFAULT_MODEL = "claude-sonnet-4-20250514";

interface RoomMeasurements {
  length?: number;
  width?: number;
  height?: number;
  area?: number;
  notes?: string;
}

interface EstimateRequest {
  scopeOfWorks: string;
  measurements: RoomMeasurements;
  images?: Array<{
    data: string;
    mimeType: string;
  }>;
  roomType?: string;
}

interface SuggestedLineItem {
  name: string;
  description: string;
  quantity: number;
  unit: string;
  unitCost: number;
  total: number;
  category: string;
  confidence: number;
  libraryItemId?: string;
  reasoning: string;
}

interface EstimateResponse {
  suggestedItems: SuggestedLineItem[];
  summary: string;
  totalEstimate: number;
  notes: string[];
}

export class QuoteEstimatorService {
  private anthropic: Anthropic;

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  async generateEstimate(request: EstimateRequest): Promise<EstimateResponse> {
    console.log('🤖 Starting AI quote estimation...');
    
    const libraryItems = await db.select().from(costLibraryItems);
    const categories = await db.select().from(costCategories);
    
    const categoryMap = new Map(categories.map(c => [c.id, c.name]));
    
    const libraryContext = libraryItems.map(item => ({
      id: item.id,
      name: item.name,
      description: item.description,
      unit: item.unit,
      unitCost: item.defaultUnitCost,
      category: categoryMap.get(item.categoryId || '') || 'Uncategorized',
    }));

    const { length, width, height, area, notes } = request.measurements;
    const calculatedArea = area || (length && width ? length * width : undefined);
    const wallArea = length && width && height 
      ? 2 * height * (length + width) 
      : undefined;
    const perimeter = length && width ? 2 * (length + width) : undefined;

    const measurementContext = `
Room Measurements:
- Length: ${length ? `${length}m` : 'Not provided'}
- Width: ${width ? `${width}m` : 'Not provided'}
- Height: ${height ? `${height}m` : 'Not provided'}
- Floor Area: ${calculatedArea ? `${calculatedArea.toFixed(2)}m²` : 'Not calculated'}
- Wall Area: ${wallArea ? `${wallArea.toFixed(2)}m²` : 'Not calculated'}
- Perimeter: ${perimeter ? `${perimeter.toFixed(2)}m` : 'Not calculated'}
${notes ? `- Additional Notes: ${notes}` : ''}
`;

    const prompt = `You are a construction estimator helping to create a quote for building/renovation work.

SCOPE OF WORKS:
${request.scopeOfWorks}

${measurementContext}

COST LIBRARY (available items with their rates):
${JSON.stringify(libraryContext, null, 2)}

TASK:
Based on the scope of works, room measurements, and available cost library items, generate a list of line items for a quote estimate.

RULES:
1. Use measurements to calculate realistic quantities (e.g., floor area for flooring, wall area for painting)
2. Match work items to the cost library when possible - use the exact ID and rate
3. If no matching library item exists, suggest a reasonable item with estimated cost
4. Be conservative with quantities - round up slightly for waste/contingency
5. Include all trades and materials mentioned in the scope
6. For labour, estimate hours based on typical trade rates (e.g., carpenter $65-85/hr)
7. Group related items logically

Return a JSON object with this structure:
{
  "suggestedItems": [
    {
      "name": "Item name",
      "description": "What this covers",
      "quantity": 10.5,
      "unit": "m2" or "hour" or "each" or "lm" or "m",
      "unitCost": 85.00,
      "total": 892.50,
      "category": "Labour" or "Materials" or "Sub-trades" or "Other",
      "confidence": 0.85,
      "libraryItemId": "id-from-library-or-null",
      "reasoning": "Brief explanation of how quantity was calculated"
    }
  ],
  "summary": "Brief summary of the estimate",
  "totalEstimate": 5000.00,
  "notes": ["Important considerations", "Assumptions made", "Items that may need clarification"]
}

Be practical and realistic. This is an estimate to give the user a starting point - they will review and adjust.`;

    const messages: Anthropic.MessageParam[] = [{
      role: "user",
      content: request.images && request.images.length > 0
        ? [
            { type: "text", text: prompt },
            ...request.images.map(img => ({
              type: "image" as const,
              source: {
                type: "base64" as const,
                media_type: (img.mimeType === 'image/jpg' ? 'image/jpeg' : img.mimeType) as "image/jpeg" | "image/png",
                data: img.data,
              },
            })),
          ]
        : prompt,
    }];

    console.log('🖼️ Sending request to AI with', request.images?.length || 0, 'images');

    const response = await this.anthropic.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: 4096,
      messages,
    });

    const textContent = response.content[0];
    if (textContent.type !== 'text') {
      throw new Error('Unexpected response type from AI');
    }

    let result: EstimateResponse;
    try {
      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      const parsed = JSON.parse(jsonMatch[0]);
      
      if (!Array.isArray(parsed.suggestedItems)) {
        parsed.suggestedItems = [];
      }
      
      result = {
        suggestedItems: parsed.suggestedItems,
        summary: parsed.summary || 'AI-generated estimate',
        totalEstimate: 0,
        notes: Array.isArray(parsed.notes) ? parsed.notes : [],
      };
    } catch (parseError) {
      console.error('Failed to parse AI response:', textContent.text);
      throw new Error('Failed to parse AI estimation response');
    }

    result.suggestedItems = result.suggestedItems
      .filter(item => item && typeof item === 'object')
      .map(item => {
        const quantity = Number(item.quantity) || 1;
        const unitCost = Number(item.unitCost) || 0;
        return {
          name: String(item.name || 'Unknown item'),
          description: String(item.description || ''),
          quantity,
          unit: String(item.unit || 'each'),
          unitCost,
          total: Number((quantity * unitCost).toFixed(2)),
          category: String(item.category || 'Other'),
          confidence: Number(item.confidence) || 0.5,
          libraryItemId: item.libraryItemId || undefined,
          reasoning: String(item.reasoning || ''),
        };
      });

    result.totalEstimate = result.suggestedItems.reduce((sum, item) => sum + item.total, 0);

    console.log(`✅ AI generated ${result.suggestedItems.length} line items, total: $${result.totalEstimate.toFixed(2)}`);

    return result;
  }
}

export const quoteEstimator = new QuoteEstimatorService();
