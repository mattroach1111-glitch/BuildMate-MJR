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
        console.error('Failed to parse AI response as JSON:', textContent.text);
        return { error: 'AI response was not valid JSON' };
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
}