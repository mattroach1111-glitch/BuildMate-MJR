import Anthropic from '@anthropic-ai/sdk';

const DEFAULT_MODEL_STR = "claude-sonnet-4-20250514";

export class DocumentProcessor {
  private anthropic: Anthropic;

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  async processDocumentEmail(data: {
    fileData: string;
    fileName: string;
    mimeType: string;
  }) {
    try {
      console.log(`🤖 Processing document with AI: ${data.fileName}`);

      // Convert PDF to image if needed
      let imageData = data.fileData;
      let mediaType = data.mimeType;

      if (data.mimeType === 'application/pdf') {
        try {
          const { convertPdfToImage } = await import('../utils/pdfConverter');
          const imageBuffer = await convertPdfToImage(Buffer.from(data.fileData, 'base64'));
          imageData = imageBuffer.toString('base64');
          mediaType = 'image/jpeg';
          console.log(`📄 Converted PDF to image for AI processing`);
        } catch (pdfError) {
          console.error('PDF conversion error:', pdfError);
          return { error: 'Failed to convert PDF for processing' };
        }
      }

      const prompt = `
        Analyze this document image and extract expense/invoice information.
        
        IMPORTANT: The image may be rotated/sideways - rotate mentally if needed to read it correctly.
        
        Return a JSON object with these fields:
        - vendor: The company/vendor name (look for business name, logo, or header)
        - amount: The FINAL TOTAL amount from the invoice (see instructions below)
        - description: Brief description of the goods/services
        - date: Invoice/document date in YYYY-MM-DD format (e.g., 2025-12-30)
        - category: One of: "materials", "sub_trades", "other_costs", "tip_fees"
        - confidence: Your confidence level (0.0 to 1.0)
        
        CRITICAL INSTRUCTIONS FOR AMOUNT EXTRACTION:
        - Extract the FINAL INVOICE TOTAL only - the grand total that the customer must pay
        - Look for labels like: "TOTAL INC TAX", "TOTAL INCLUDING GST", "GRAND TOTAL", "AMOUNT DUE", "TOTAL PAID", "BALANCE DUE", "Docket Total", "Invoice Total"
        - DO NOT extract "Unit Price" or "Rate" - these are per-unit costs, not the total
        - DO NOT extract individual line item amounts or subtotals before tax
        - DO NOT add up items yourself - find the final total on the document
        - If multiple totals exist, choose the one labeled as TOTAL or DOCKET TOTAL
        - Return the amount as a number without currency symbols or commas
        
        SPECIAL INSTRUCTIONS FOR TIP FEE / WASTE DISPOSAL RECEIPTS:
        - Look for "Docket Total" - this is the final amount to extract
        - Ignore "Unit Price" (e.g., $300.00/tonne) - this is NOT the total
        - The actual total is usually much smaller based on weight (Net WT × Unit Price)
        - Vendor is often a Council (e.g., "Glenorchy City Council", "Hobart City Council")
        - Description should mention waste type (e.g., "Mixed Waste", "Green Waste", "Demolition")
        
        DATE EXTRACTION:
        - Look for labels like "Date Out", "Date", "Invoice Date", "Tax Invoice"
        - Convert to YYYY-MM-DD format (e.g., "30-Dec-2025" becomes "2025-12-30")
        - Day must be 1-31, Month must be 1-12 - validate the date is realistic
        
        For category classification:
        - "materials": Building supplies, hardware, lumber, concrete, paint, flooring, etc.
        - "sub_trades": Subcontractor services, electrician, plumber, tiler, etc.
        - "other_costs": General expenses, equipment rental, permits, etc.
        - "tip_fees": Waste disposal, dump fees, rubbish removal, Council tips, transfer stations
        
        If you cannot extract clear information, set confidence to 0.0.
        Always return valid JSON.
      `;

      // Ensure we have a valid media type
      if (!['image/jpeg', 'image/png', 'image/jpg'].includes(mediaType)) {
        console.error(`Invalid media type for AI processing: ${mediaType}`);
        return { error: `Unsupported image format: ${mediaType}` };
      }

      // Normalize media type
      const normalizedMediaType = mediaType === 'image/jpg' ? 'image/jpeg' : mediaType;

      console.log(`🖼️ Sending ${normalizedMediaType} image to AI for processing`);

      const response = await this.anthropic.messages.create({
        model: DEFAULT_MODEL_STR,
        max_tokens: 1024,
        messages: [{
          role: "user",
          content: [
            {
              type: "text",
              text: prompt
            },
            {
              type: "image",
              source: {
                type: "base64",
                media_type: normalizedMediaType as "image/jpeg" | "image/png",
                data: imageData
              }
            }
          ]
        }]
      });

      const textContent = response.content[0];
      if (textContent.type !== 'text') {
        throw new Error('Unexpected response type from AI');
      }

      let extractedData;
      try {
        extractedData = JSON.parse(textContent.text);
      } catch (parseError) {
        console.error('Failed to parse AI response as JSON:', textContent.text);
        // Try to extract JSON from the response if it's wrapped in markdown or other text
        const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            extractedData = JSON.parse(jsonMatch[0]);
          } catch (secondParseError) {
            return { error: 'AI response was not valid JSON' };
          }
        } else {
          return { error: 'AI response was not valid JSON' };
        }
      }

      console.log(`✅ AI extraction successful:`, extractedData);

      return {
        vendor: extractedData.vendor || 'Unknown Vendor',
        amount: parseFloat(extractedData.amount) || 0,
        description: extractedData.description || data.fileName,
        date: extractedData.date || new Date().toISOString().split('T')[0],
        category: extractedData.category || 'other_costs',
        confidence: extractedData.confidence || 0.5
      };

    } catch (error) {
      console.error('Error processing document with AI:', error);
      return { error: error instanceof Error ? error.message : 'Failed to process document' };
    }
  }

  async analyzeCompleteJobSheet(documentURL: string, mimeType: string) {
    try {
      console.log(`🤖 Analyzing complete job sheet: ${documentURL}`);
      
      // Download document from object storage
      const ObjectStorageService = (await import('../objectStorage')).ObjectStorageService;
      const objectStorageService = new ObjectStorageService();
      
      const normalizedPath = objectStorageService.normalizeObjectEntityPath(documentURL);
      const objectFile = await objectStorageService.getObjectEntityFile(normalizedPath);
      
      // Get file data
      const stream = objectFile.createReadStream();
      const chunks: Buffer[] = [];
      
      await new Promise((resolve, reject) => {
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('end', resolve);
        stream.on('error', reject);
      });
      
      const fileBuffer = Buffer.concat(chunks);
      let imageData = fileBuffer.toString('base64');
      let mediaType = mimeType;

      // Convert PDF to image if needed
      if (mimeType === 'application/pdf') {
        try {
          const { convertPdfToImage } = await import('../utils/pdfConverter');
          const imageBuffer = await convertPdfToImage(fileBuffer);
          imageData = imageBuffer.toString('base64');
          mediaType = 'image/jpeg';
          console.log(`📄 Converted job sheet PDF to image for AI processing`);
        } catch (pdfError) {
          console.error('PDF conversion error:', pdfError);
          throw new Error('Failed to convert PDF for processing');
        }
      }

      const prompt = `
        Analyze this complete job cost sheet document and extract ALL information to create a new job.
        
        CRITICAL: For materials, look for a materials list that shows items with dollar amounts.
        Each line format is typically: "Item description [dollar amount] [vendor] [date]"
        For example: "Flooring tas oak, framing pine 234 Clennetts 6/8"
        
        For materials entries, put the DOLLAR AMOUNT in the "quantity" field and set "rate" to null.
        Do NOT try to calculate quantity × rate. Use the exact dollar amount shown.
        
        Return a JSON object with these fields:
        - jobAddress: The job site address
        - clientName: Client or customer name  
        - projectName: Project description or name
        - laborEntries: Array of labor entries with {employeeName, date (YYYY-MM-DD), hours, rate, description}
        - materials: Array of materials with {description, quantity (PUT DOLLAR AMOUNT HERE), rate (SET TO NULL), vendor?, date?}
        - subTrades: Array of sub-trades with {description, cost, vendor?, date?}
        - otherCosts: Array of other costs with {description, cost, vendor?, date?}
        - tipFees: Array of tip fees with {description, cost, date?}
        
        CRITICAL RULES:
        - Do NOT extract GST, tax, VAT, or any tax amounts as cost items
        - Do NOT extract "total" amounts or "sub-total" amounts as cost items  
        - Do NOT extract the final invoice total as a cost item
        - Only extract actual materials, labor, sub-trades, and legitimate expenses
        - Skip any line that contains "GST", "tax", "total", "sub-total", "invoice total"
        
        If you see "GST $425.20" or "Total inc gst $4,677.20" - DO NOT extract these.
        - totalCost: Total estimated job cost
        - startDate: Project start date (YYYY-MM-DD)
        - endDate: Project completion date (YYYY-MM-DD)
        - confidence: Your confidence level (0.0 to 1.0)
        
        MATERIALS EXTRACTION EXAMPLES:
        If you see "Flooring tas oak, framing pine 234 Clennetts 6/8":
        {"description": "Flooring tas oak, framing pine", "quantity": 234, "rate": null, "vendor": "Clennetts", "date": null}
        
        If you see "hinges x 7 53 Clennetts 8/8":
        {"description": "hinges x 7", "quantity": 53, "rate": null, "vendor": "Clennetts", "date": null}
        
        Extract ALL materials from the materials list section. Look for multiple pages.
        Always return valid JSON.
      `;

      // Ensure valid media type
      if (!['image/jpeg', 'image/png'].includes(mediaType)) {
        throw new Error(`Unsupported media type: ${mediaType}`);
      }

      console.log(`🖼️ Sending ${mediaType} job sheet to AI for analysis`);

      const response = await this.anthropic.messages.create({
        model: DEFAULT_MODEL_STR,
        max_tokens: 4096,
        messages: [{
          role: "user",
          content: [
            {
              type: "text",
              text: prompt
            },
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType as "image/jpeg" | "image/png",
                data: imageData
              }
            }
          ]
        }]
      });

      const textContent = response.content[0];
      if (textContent.type !== 'text') {
        throw new Error('Unexpected response type from AI');
      }

      let extractedData;
      try {
        extractedData = JSON.parse(textContent.text);
      } catch (parseError) {
        console.error('Failed to parse AI response as JSON:', textContent.text);
        // Try to extract JSON from the response if it's wrapped in markdown
        const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            extractedData = JSON.parse(jsonMatch[0]);
          } catch (secondParseError) {
            throw new Error('AI response was not valid JSON');
          }
        } else {
          throw new Error('AI response was not valid JSON');
        }
      }

      console.log(`✅ Job sheet analysis successful:`, JSON.stringify(extractedData, null, 2));

      return {
        jobAddress: extractedData.jobAddress || 'Unknown Address',
        clientName: extractedData.clientName || 'Unknown Client',
        projectName: extractedData.projectName || extractedData.jobAddress || 'Unknown Project',
        laborEntries: extractedData.laborEntries || [],
        materials: extractedData.materials || [],
        subTrades: extractedData.subTrades || [],
        otherCosts: extractedData.otherCosts || [],
        tipFees: extractedData.tipFees || [],
        totalCost: parseFloat(extractedData.totalCost) || 0,
        startDate: extractedData.startDate || null,
        endDate: extractedData.endDate || null,
        confidence: extractedData.confidence || 0.5
      };

    } catch (error) {
      console.error('Error analyzing complete job sheet:', error);
      throw error;
    }
  }

  async analyzeExpenseDocument(documentURL: string, mimeType: string) {
    try {
      console.log(`🤖 Analyzing expense document: ${documentURL}`);
      
      // Download document from object storage
      const ObjectStorageService = (await import('../objectStorage')).ObjectStorageService;
      const objectStorageService = new ObjectStorageService();
      
      const normalizedPath = objectStorageService.normalizeObjectEntityPath(documentURL);
      const objectFile = await objectStorageService.getObjectEntityFile(normalizedPath);
      
      // Get file data
      const stream = objectFile.createReadStream();
      const chunks: Buffer[] = [];
      
      await new Promise((resolve, reject) => {
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('end', resolve);
        stream.on('error', reject);
      });
      
      const fileBuffer = Buffer.concat(chunks);
      let imageData = fileBuffer.toString('base64');
      let mediaType = mimeType;

      // Convert PDF to image if needed
      if (mimeType === 'application/pdf') {
        try {
          const { convertPdfToImage } = await import('../utils/pdfConverter');
          const imageBuffer = await convertPdfToImage(fileBuffer);
          imageData = imageBuffer.toString('base64');
          mediaType = 'image/jpeg';
          console.log(`📄 Converted expense PDF to image for AI processing`);
        } catch (pdfError) {
          console.error('PDF conversion error:', pdfError);
          throw new Error('Failed to convert PDF for processing');
        }
      }

      const prompt = `
        Analyze this expense document/invoice and extract the information.
        
        IMPORTANT: The image may be rotated/sideways - rotate mentally if needed to read it correctly.
        
        Return a JSON object with these fields:
        - vendor: The company/vendor name (look for business name, logo, or header)
        - amount: The FINAL TOTAL amount as a number (see instructions below)
        - description: Brief description of goods/services
        - date: Invoice/document date in YYYY-MM-DD format (e.g., 2025-12-30)
        - category: One of "materials", "sub_trades", "other_costs", "tip_fees"
        - confidence: Your confidence level (0.0 to 1.0)
        
        CRITICAL AMOUNT INSTRUCTIONS:
        - Find the FINAL TOTAL - labels like "Docket Total", "Total Inc GST", "Grand Total", "Amount Due"
        - DO NOT extract "Unit Price" or "Rate" - these are per-unit costs, not the total
        - For tip fees, look for "Docket Total" - this is usually the smallest dollar amount
        
        SPECIAL INSTRUCTIONS FOR TIP FEE / WASTE DISPOSAL RECEIPTS:
        - Look for "Docket Total" - this is the final amount to extract
        - Ignore "Unit Price" (e.g., $300.00/tonne) - this is NOT the total
        - Vendor is often a Council (e.g., "Glenorchy City Council")
        - Description should mention waste type (e.g., "Mixed Waste", "Green Waste")
        
        DATE EXTRACTION:
        - Convert dates to YYYY-MM-DD format (e.g., "30-Dec-2025" becomes "2025-12-30")
        - Validate: Day 1-31, Month 1-12
        
        Always return valid JSON.
      `;

      console.log(`🖼️ Sending ${mediaType} expense document to AI for analysis`);

      const response = await this.anthropic.messages.create({
        model: DEFAULT_MODEL_STR,
        max_tokens: 1024,
        messages: [{
          role: "user",
          content: [
            {
              type: "text",
              text: prompt
            },
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType as "image/jpeg" | "image/png",
                data: imageData
              }
            }
          ]
        }]
      });

      const textContent = response.content[0];
      if (textContent.type !== 'text') {
        throw new Error('Unexpected response type from AI');
      }

      let extractedData;
      try {
        extractedData = JSON.parse(textContent.text);
      } catch (parseError) {
        console.error('Failed to parse AI expense response:', textContent.text);
        const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            extractedData = JSON.parse(jsonMatch[0]);
          } catch (secondParseError) {
            throw new Error('AI response was not valid JSON');
          }
        } else {
          throw new Error('AI response was not valid JSON');
        }
      }

      console.log(`✅ Expense analysis successful:`, extractedData);

      return {
        vendor: extractedData.vendor || 'Unknown Vendor',
        amount: parseFloat(extractedData.amount) || 0,
        description: extractedData.description || 'Unknown',
        date: extractedData.date || new Date().toISOString().split('T')[0],
        category: extractedData.category || 'other_costs',
        confidence: extractedData.confidence || 0.5
      };

    } catch (error) {
      console.error('Error analyzing expense document:', error);
      throw error;
    }
  }

  async convertPdfToImage(pdfBuffer: Buffer): Promise<Buffer> {
    try {
      const { convertPdfToImage } = await import('../utils/pdfConverter');
      return await convertPdfToImage(pdfBuffer);
    } catch (error) {
      console.error('Error converting PDF to image:', error);
      throw error;
    }
  }

  async extractCostsFromDocument(fileContent: string, fileType: string): Promise<{
    rawText: string;
    items: Array<{
      description: string;
      quantity: number;
      unit: string;
      unitCost: number;
      category: string;
      notes?: string;
    }>;
  }> {
    try {
      console.log(`🤖 Extracting costs from document (type: ${fileType})`);

      let imageData = fileContent;
      let mediaType = fileType;

      if (fileType === 'application/pdf') {
        try {
          const { convertPdfToImage } = await import('../utils/pdfConverter');
          const imageBuffer = await convertPdfToImage(Buffer.from(fileContent, 'base64'));
          imageData = imageBuffer.toString('base64');
          mediaType = 'image/jpeg';
        } catch (pdfError) {
          console.error('PDF conversion error:', pdfError);
          throw new Error('Failed to convert PDF for processing');
        }
      }

      const prompt = `
        Analyze this document and extract all line items with pricing information.
        This could be a quote, invoice, scope of work, or price list.
        
        Extract each item as a cost/price entry. Return a JSON object with:
        {
          "rawText": "A brief summary of what this document contains",
          "items": [
            {
              "description": "Item description",
              "quantity": 1,
              "unit": "each" or "m2" or "hours" or "lm" or other unit,
              "unitCost": 123.45,
              "category": "materials" or "labor" or "sub_trades" or "equipment" or "other",
              "notes": "Any relevant notes about the item"
            }
          ]
        }
        
        Guidelines:
        - Extract ALL line items you can find with pricing
        - Use realistic units (each, m2, lm, hours, days, etc.)
        - Category should be: materials, labor, sub_trades, equipment, or other
        - If quantity is not specified, assume 1
        - Include any relevant notes about specifications or conditions
        - Return valid JSON only
      `;

      const normalizedMediaType = mediaType === 'image/jpg' ? 'image/jpeg' : mediaType;

      const response = await this.anthropic.messages.create({
        model: DEFAULT_MODEL_STR,
        max_tokens: 4096,
        messages: [{
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image",
              source: {
                type: "base64",
                media_type: normalizedMediaType as "image/jpeg" | "image/png",
                data: imageData
              }
            }
          ]
        }]
      });

      const textContent = response.content[0];
      if (textContent.type !== 'text') {
        throw new Error('Unexpected response type from AI');
      }

      let extractedData;
      try {
        extractedData = JSON.parse(textContent.text);
      } catch (parseError) {
        const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          extractedData = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('AI response was not valid JSON');
        }
      }

      console.log(`✅ Extracted ${extractedData.items?.length || 0} cost items`);

      return {
        rawText: extractedData.rawText || 'Document processed',
        items: extractedData.items || []
      };

    } catch (error) {
      console.error('Error extracting costs from document:', error);
      throw error;
    }
  }

  async suggestQuoteItems(
    projectDescription: string,
    projectAddress: string,
    libraryItems: any[],
    recentHistory: any[]
  ): Promise<Array<{
    description: string;
    quantity: number;
    unit: string;
    unitCost: number;
    confidence: number;
    reason: string;
    libraryItemId?: string;
  }>> {
    try {
      console.log(`🤖 Generating AI quote suggestions for: ${projectDescription}`);

      // Build context from library items
      const libraryContext = libraryItems.slice(0, 50).map(item => ({
        id: item.id,
        name: item.name,
        unit: item.unit,
        cost: item.defaultUnitCost,
        usageCount: item.usageCount
      }));

      // Build pricing history context
      const historyContext = recentHistory.slice(0, 30).map(h => ({
        item: h.itemName,
        unitCost: h.unitCost,
        quantity: h.quantity
      }));

      const prompt = `
        You are a construction quoting assistant. Based on the project description and available cost data, suggest line items for a quote.
        
        PROJECT DESCRIPTION: ${projectDescription}
        PROJECT ADDRESS: ${projectAddress || 'Not specified'}
        
        AVAILABLE COST LIBRARY ITEMS:
        ${JSON.stringify(libraryContext, null, 2)}
        
        RECENT PRICING HISTORY:
        ${JSON.stringify(historyContext, null, 2)}
        
        Generate 5-15 suggested line items for this project. For each item:
        1. If a matching library item exists, use its ID and pricing
        2. If not, suggest reasonable pricing based on construction industry standards
        3. Estimate realistic quantities based on the project description
        
        Return a JSON array:
        [
          {
            "description": "Item description",
            "quantity": 1,
            "unit": "each",
            "unitCost": 100.00,
            "confidence": 0.8,
            "reason": "Why this item is suggested",
            "libraryItemId": "id-if-from-library-or-null"
          }
        ]
        
        Return valid JSON array only.
      `;

      const response = await this.anthropic.messages.create({
        model: DEFAULT_MODEL_STR,
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }]
      });

      const textContent = response.content[0];
      if (textContent.type !== 'text') {
        throw new Error('Unexpected response type from AI');
      }

      let suggestions;
      try {
        suggestions = JSON.parse(textContent.text);
      } catch (parseError) {
        const jsonMatch = textContent.text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          suggestions = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('AI response was not valid JSON');
        }
      }

      console.log(`✅ Generated ${suggestions.length} quote suggestions`);

      return suggestions;

    } catch (error) {
      console.error('Error generating quote suggestions:', error);
      throw error;
    }
  }
}