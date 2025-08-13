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

  async analyzeCompleteJobSheet(documentURL: string, contentType: string = 'application/pdf') {
    try {
      console.log(`🤖 Analyzing complete job sheet: ${documentURL}`);

      // Use object storage service to get the document
      const { ObjectStorageService } = await import('../objectStorage');
      const objectStorageService = new ObjectStorageService();
      
      // Convert the full URL to a normalized path
      const normalizedPath = objectStorageService.normalizeObjectEntityPath(documentURL);
      console.log(`🔍 Job sheet normalized path: ${normalizedPath}`);
      
      // Get the object file
      const objectFile = await objectStorageService.getObjectEntityFile(normalizedPath);
      
      // Download the file content
      const [documentBuffer] = await objectFile.download();
      let imageData: string;
      let mediaType = contentType;

      // Convert PDF to image if needed
      if (contentType === 'application/pdf') {
        try {
          const { convertPdfToImage } = await import('../utils/pdfConverter');
          const imageBuffer = await convertPdfToImage(Buffer.from(documentBuffer));
          imageData = imageBuffer.toString('base64');
          mediaType = 'image/jpeg';
          console.log(`📄 Converted PDF to image for AI analysis`);
        } catch (pdfError) {
          console.error('PDF conversion error:', pdfError);
          throw new Error('Failed to convert PDF for processing');
        }
      } else {
        imageData = Buffer.from(documentBuffer).toString('base64');
      }

      const prompt = `
        Analyze this complete job sheet/cost summary document and extract ALL job information.
        
        Return a JSON object with these fields:
        - jobAddress: The job/property address
        - clientName: The client/customer name
        - laborEntries: Array of labor entries with {employeeName: string, hours: number, hourlyRate: number}
        - materials: Array of material costs with {description: string, amount: number}
        - subTrades: Array of subcontractor costs with {description: string, amount: number}
        - tipFees: Array of tip/dump fees with {description: string, amount: number}
        - otherCosts: Array of other costs with {description: string, amount: number}
        - confidence: Your confidence level (0.0 to 1.0)
        
        Extract ALL itemized costs, labor hours, and rates accurately. 
        If any section is empty, return an empty array.
        Ensure all monetary amounts are numbers, not strings.
        If you cannot extract clear information, set confidence to 0.0.
        Always return valid JSON.
      `;

      // Ensure we have a valid media type
      if (!['image/jpeg', 'image/png', 'image/jpg'].includes(mediaType)) {
        throw new Error(`Unsupported image format: ${mediaType}`);
      }

      // Normalize media type
      const normalizedMediaType = mediaType === 'image/jpg' ? 'image/jpeg' : mediaType;

      console.log(`🖼️ Sending ${normalizedMediaType} image to AI for job sheet analysis`);

      const response_ai = await this.anthropic.messages.create({
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
                media_type: normalizedMediaType as "image/jpeg" | "image/png",
                data: imageData
              }
            }
          ]
        }]
      });

      const aiResponse = response_ai.content[0].text;
      console.log(`🤖 AI Response for job sheet:`, aiResponse);

      let extractedData;
      try {
        extractedData = JSON.parse(aiResponse);
      } catch (parseError) {
        console.error('Failed to parse AI response as JSON:', parseError);
        // Try to extract JSON from markdown code blocks or wrapped text
        let jsonContent = aiResponse;
        
        // Remove markdown code blocks
        if (aiResponse.includes('```json')) {
          const jsonMatch = aiResponse.match(/```json\s*([\s\S]*?)\s*```/);
          if (jsonMatch) {
            jsonContent = jsonMatch[1];
          }
        } else if (aiResponse.includes('```')) {
          const jsonMatch = aiResponse.match(/```\s*([\s\S]*?)\s*```/);
          if (jsonMatch) {
            jsonContent = jsonMatch[1];
          }
        } else {
          // Fallback to finding JSON object
          const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            jsonContent = jsonMatch[0];
          }
        }
        
        try {
          extractedData = JSON.parse(jsonContent);
        } catch (secondParseError) {
          console.error('Second JSON parse failed:', secondParseError);
          throw new Error('AI response was not valid JSON');
        }
      }

      // Validate and normalize the extracted data
      return {
        jobAddress: extractedData.jobAddress || '',
        clientName: extractedData.clientName || '',
        laborEntries: extractedData.laborEntries || [],
        materials: extractedData.materials || [],
        subTrades: extractedData.subTrades || [],
        tipFees: extractedData.tipFees || [],
        otherCosts: extractedData.otherCosts || [],
        confidence: extractedData.confidence || 0.5
      };

    } catch (error) {
      console.error('Error analyzing job sheet with AI:', error);
      throw error;
    }
  }

  async analyzeExpenseDocument(documentURL: string, contentType: string = 'application/pdf') {
    try {
      console.log(`🤖 Analyzing expense document: ${documentURL}`);

      // Use object storage service to get the document
      const { ObjectStorageService } = await import('../objectStorage');
      const objectStorageService = new ObjectStorageService();
      
      // Convert the full URL to a normalized path
      const normalizedPath = objectStorageService.normalizeObjectEntityPath(documentURL);
      console.log(`🔍 Expense document normalized path: ${normalizedPath}`);
      
      // Get the object file
      const objectFile = await objectStorageService.getObjectEntityFile(normalizedPath);
      
      // Download the file content
      const [documentBuffer] = await objectFile.download();
      let imageData: string;
      let mediaType = contentType;

      // Convert PDF to image if needed
      if (contentType === 'application/pdf') {
        try {
          const { convertPdfToImage } = await import('../utils/pdfConverter');
          const imageBuffer = await convertPdfToImage(documentBuffer);
          imageData = imageBuffer.toString('base64');
          mediaType = 'image/jpeg';
          console.log(`📄 Converted PDF to image for AI analysis`);
        } catch (pdfError) {
          console.error('PDF conversion error:', pdfError);
          throw new Error('Failed to convert PDF for processing');
        }
      } else {
        imageData = documentBuffer.toString('base64');
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
        throw new Error(`Unsupported image format: ${mediaType}`);
      }

      // Normalize media type
      const normalizedMediaType = mediaType === 'image/jpg' ? 'image/jpeg' : mediaType;

      console.log(`🖼️ Sending ${normalizedMediaType} image to AI for expense analysis`);

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

      const aiResponse = response.content[0].text;
      console.log(`🤖 AI Response for expense:`, aiResponse);

      let extractedData;
      try {
        extractedData = JSON.parse(aiResponse);
      } catch (parseError) {
        console.error('Failed to parse AI response as JSON:', parseError);
        // Try to extract JSON from markdown code blocks or wrapped text
        let jsonContent = aiResponse;
        
        // Remove markdown code blocks
        if (aiResponse.includes('```json')) {
          const jsonMatch = aiResponse.match(/```json\s*([\s\S]*?)\s*```/);
          if (jsonMatch) {
            jsonContent = jsonMatch[1];
          }
        } else if (aiResponse.includes('```')) {
          const jsonMatch = aiResponse.match(/```\s*([\s\S]*?)\s*```/);
          if (jsonMatch) {
            jsonContent = jsonMatch[1];
          }
        } else {
          // Fallback to finding JSON object
          const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            jsonContent = jsonMatch[0];
          }
        }
        
        try {
          extractedData = JSON.parse(jsonContent);
        } catch (secondParseError) {
          console.error('Second JSON parse failed:', secondParseError);
          throw new Error('AI response was not valid JSON');
        }
      }

      // Validate and normalize the extracted data
      return {
        vendor: extractedData.vendor || 'Unknown Vendor',
        amount: parseFloat(extractedData.amount) || 0,
        description: extractedData.description || 'Unknown Description',
        date: extractedData.date || new Date().toISOString().split('T')[0],
        category: extractedData.category || 'other_costs',
        confidence: extractedData.confidence || 0.5
      };

    } catch (error) {
      console.error('Error analyzing expense document with AI:', error);
      throw error;
    }
  }
}