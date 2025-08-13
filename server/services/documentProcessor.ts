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
        
        Return a JSON object with these fields:
        - vendor: The company/vendor name
        - amount: The total amount as a number (extract from any currency format)
        - description: Brief description of the goods/services
        - date: Invoice/document date in YYYY-MM-DD format
        - category: One of: "materials", "sub_trades", "other_costs", "tip_fees"
        - confidence: Your confidence level (0.0 to 1.0)
        
        For category classification:
        - "materials": Building supplies, hardware, lumber, concrete, etc.
        - "sub_trades": Subcontractor services, electrician, plumber, etc.
        - "other_costs": General expenses, equipment rental, permits, etc.
        - "tip_fees": Waste disposal, dump fees, rubbish removal
        
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
      return { error: error.message || 'Failed to process document' };
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
        
        Return a JSON object with these fields:
        - jobAddress: The job site address
        - clientName: Client or customer name
        - projectName: Project description or name
        - laborEntries: Array of labor entries with {employeeName, date (YYYY-MM-DD), hours, rate, description}
        - materials: Array of materials with {description, quantity, rate, vendor?, date?}
        - subTrades: Array of sub-trades with {description, cost, vendor?, date?}
        - otherCosts: Array of other costs with {description, cost, vendor?, date?}
        - tipFees: Array of tip fees with {description, cost, date?}
        - totalCost: Total estimated job cost
        - startDate: Project start date (YYYY-MM-DD)
        - endDate: Project completion date (YYYY-MM-DD)
        - confidence: Your confidence level (0.0 to 1.0)
        
        Extract dates in YYYY-MM-DD format. If no date is available, use null.
        For labor entries, extract individual employee time entries.
        For materials/subtrades/costs, include vendor names when available.
        Calculate reasonable rates from totals if individual rates aren't specified.
        
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
        
        Return a JSON object with these fields:
        - vendor: The company/vendor name
        - amount: The total amount as a number
        - description: Brief description of goods/services
        - date: Invoice/document date in YYYY-MM-DD format
        - category: One of "materials", "sub_trades", "other_costs", "tip_fees"
        - confidence: Your confidence level (0.0 to 1.0)
        
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
}