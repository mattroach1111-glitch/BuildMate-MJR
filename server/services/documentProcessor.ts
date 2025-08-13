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
      return { error: (error as Error).message || 'Failed to process document' };
    }
  }

  async analyzeCompleteJobSheet(documentURL: string, contentType: string) {
    try {
      console.log(`🤖 Analyzing complete job sheet: ${documentURL}`);

      // Download the document
      let documentData: Buffer;
      try {
        const response = await fetch(documentURL);
        if (!response.ok) {
          throw new Error(`Failed to fetch document: ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        documentData = Buffer.from(arrayBuffer);
      } catch (fetchError) {
        console.error('Error downloading document:', fetchError);
        throw new Error('Failed to download document for analysis');
      }

      // Convert PDF to image if needed
      let imageData: string;
      let mediaType: string;

      if (contentType === 'application/pdf') {
        try {
          const imageBuffer = await this.convertPdfToImage(documentData);
          imageData = imageBuffer.toString('base64');
          mediaType = 'image/jpeg';
          console.log(`📄 Converted PDF to image for job sheet analysis`);
        } catch (pdfError) {
          console.error('PDF conversion error:', pdfError);
          throw new Error('Failed to convert PDF for analysis');
        }
      } else {
        imageData = documentData.toString('base64');
        mediaType = contentType;
      }

      const prompt = `
        Analyze this job cost sheet document image and extract comprehensive job information.
        
        Return a JSON object with these fields:
        - jobAddress: The job site address (look for address fields, property location)
        - clientName: The client or customer name
        - projectName: Project or job description
        - jobDate: Job date in YYYY-MM-DD format (look for date fields, invoice date, job date)
        - laborEntries: Array of labor entries with fields: description, hours, rate, amount
        - materials: Array of materials with fields: description, supplier, amount, date
        - subTrades: Array of subcontractor work with fields: description, supplier, amount, date  
        - otherCosts: Array of other expenses with fields: description, supplier, amount, date
        - tipFees: Array of tip/dump fees with fields: description, amount, date
        - builderMargin: Builder margin percentage or amount
        - totalCost: Total job cost
        - confidence: Your confidence level (0.0 to 1.0)
        
        Extract dates in YYYY-MM-DD format. Look carefully for:
        - Job dates, invoice dates, quote dates
        - Material purchase dates
        - Labor work dates
        
        If you cannot extract clear information, set confidence to 0.0.
        Always return valid JSON.
      `;

      const response = await this.anthropic.messages.create({
        model: DEFAULT_MODEL_STR,
        max_tokens: 2048,
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

      console.log(`✅ Job sheet analysis complete:`, extractedData);

      return {
        jobAddress: extractedData.jobAddress || "Address Not Found",
        clientName: extractedData.clientName || "Client Not Found",
        projectName: extractedData.projectName || extractedData.jobAddress || "Project Not Found",
        jobDate: extractedData.jobDate || new Date().toISOString().split('T')[0],
        laborEntries: extractedData.laborEntries || [],
        materials: extractedData.materials || [],
        subTrades: extractedData.subTrades || [],
        otherCosts: extractedData.otherCosts || [],
        tipFees: extractedData.tipFees || [],
        builderMargin: extractedData.builderMargin || 0,
        totalCost: extractedData.totalCost || 0,
        confidence: extractedData.confidence || 0.5
      };

    } catch (error) {
      console.error('Error analyzing job sheet:', error);
      throw error;
    }
  }

  async analyzeExpenseDocument(fileData: string, mimeType: string) {
    // This just delegates to the existing processDocumentEmail method
    return this.processDocumentEmail({
      fileData,
      fileName: 'expense-document',
      mimeType
    });
  }

  async convertPdfToImage(pdfBuffer: Buffer): Promise<Buffer> {
    try {
      const { convertPdfToImage } = await import('../utils/pdfConverter');
      return await convertPdfToImage(pdfBuffer);
    } catch (error) {
      console.error('PDF conversion error:', error);
      throw error;
    }
  }
}