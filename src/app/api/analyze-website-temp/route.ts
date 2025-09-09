import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { content } = await request.json();
    
    if (!content) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    console.log('🤖 Starting temporary AI analysis');

    // AI Analysis using OpenAI (same as client dashboard)
    const analysisResult = await analyzeWebsiteContent(content);

    console.log('✅ AI analysis completed successfully');

    return NextResponse.json({
      success: true,
      analysis: analysisResult
    });

  } catch (error: unknown) {
    console.error('💥 Error in temporary AI analysis:', error);
    return NextResponse.json({ 
      error: 'AI analysis failed', 
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

async function analyzeWebsiteContent(content: string) {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
                 content: `You are an expert business analyst. Analyze the provided website content and extract the 5 essential brand information fields. Return ONLY a valid JSON object with the following structure:

{
  "company_name": "The official company/business name (e.g., 'Acme Corp', 'TechStart Inc', 'Local Bakery')",
  "company_description": "2-3 sentence description of what the company does and their mission",
  "value_proposition": "Their unique selling point or main benefit they provide to customers",
  "brand_tone": "Detected writing style (professional, casual, playful, authoritative, innovative, etc.)",
  "target_audience": "Who they serve (e.g., 'SMB owners', 'Gen Z consumers', 'Enterprise clients')"
}

Be concise and accurate. If information is unclear, use reasonable inference based on the content. Focus only on these 5 fields - do not extract any other information.`
          },
          {
            role: 'user',
            content: `Analyze this website content and extract the business information:\n\n${content}`
          }
        ],
        temperature: 0.3,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const analysisText = data.choices[0]?.message?.content;

    if (!analysisText) {
      throw new Error('No analysis content received from OpenAI');
    }

    // Parse the JSON response - handle both raw JSON and markdown-formatted JSON
    let analysis;
    try {
      // First try to extract JSON from markdown code blocks
      const jsonMatch = analysisText.match(/```json\s*([\s\S]*?)\s*```/);
      const jsonText = jsonMatch ? jsonMatch[1] : analysisText;
      
      // Parse the extracted JSON
      analysis = JSON.parse(jsonText.trim());
    } catch (parseError) {
      console.error('❌ JSON parsing failed:', parseError);
      console.error('Raw AI response:', analysisText);
      throw new Error(`Failed to parse AI response as JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
    }
    
    // Validate the structure
           const requiredFields = ['company_name', 'company_description', 'value_proposition', 'brand_tone', 'target_audience'];
    for (const field of requiredFields) {
      if (!analysis[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    return analysis;

  } catch (error) {
    console.error('❌ AI analysis failed:', error);
    throw new Error(`AI analysis failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}
