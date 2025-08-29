import { GoogleGenerativeAI } from '@google/generative-ai';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req, res) {
  // CORSヘッダーの設定
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // OPTIONSリクエストの処理
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // POSTメソッドのみ許可
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Image generation API called');
    const { prompt, files } = req.body;

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'No prompt provided' });
    }

    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }

    // 環境変数からAPIキーを取得
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('GEMINI_API_KEY is not set in environment variables');
      return res.status(500).json({ error: 'API key configuration error. Please set GEMINI_API_KEY in Vercel environment variables.' });
    }
    console.log('API key found for image generation');

    // Gemini APIクライアントの初期化（プロンプトから画像記述を生成）
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      systemInstruction: `あなたは商品画像の詳細な説明を生成する専門家です。
      ユーザーのプロンプトと商品画像を基に、その商品を使用した魅力的なシーンの詳細な描写を日本語で生成してください。
      描写には以下を含めてください：
      1. 商品の具体的な使用シーン
      2. 背景や環境の詳細
      3. 光の当たり方や色調
      4. 商品の配置や構図
      5. 全体的な雰囲気やムード
      
      回答はプレーンテキストで、説明文のみを返してください。`
    });

    // プロンプトの準備
    const finalPrompt = `次のコンセプトで商品画像のシーンを詳細に描写してください: ${prompt}
    登場人物が写る場合は日本人の設定でお願いします。
    正方形の構図を想定して描写してください。`;
    
    // パーツの構築
    const parts = [
      { text: finalPrompt }
    ];
    
    // 画像データを追加
    for (const file of files) {
      parts.push({
        inlineData: {
          mimeType: file.mimeType,
          data: file.base64
        }
      });
    }

    // APIリクエストの送信
    const result = await model.generateContent({
      contents: [{
        parts: parts
      }],
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 1000
      }
    });

    const response = await result.response;
    const description = response.text();

    if (!description) {
      throw new Error('No description generated');
    }

    // プレースホルダー画像データを生成（SVGで説明文を表示）
    const svgImage = `
      <svg width="800" height="800" xmlns="http://www.w3.org/2000/svg">
        <rect width="800" height="800" fill="#f0f0f0"/>
        <text x="400" y="50" font-family="Arial, sans-serif" font-size="20" font-weight="bold" text-anchor="middle" fill="#333">
          生成されたシーン説明
        </text>
        <foreignObject x="50" y="100" width="700" height="650">
          <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: Arial, sans-serif; font-size: 16px; line-height: 1.8; color: #333; padding: 20px; background: white; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            ${description.replace(/\n/g, '<br/>')}
          </div>
        </foreignObject>
        <text x="400" y="780" font-family="Arial, sans-serif" font-size="12" text-anchor="middle" fill="#666">
          ※ これは画像生成の説明です。実際の画像生成にはImagenやDALL-E等の画像生成AIが必要です
        </text>
      </svg>
    `;

    // SVGをBase64エンコード
    const base64Image = Buffer.from(svgImage).toString('base64');

    // 成功レスポンス
    return res.status(200).json({ 
      image: base64Image,
      description: description
    });

  } catch (error) {
    console.error('Error in generate-images:', error);
    console.error('Error stack:', error.stack);
    
    if (error.message?.includes('429')) {
      return res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
    }
    
    return res.status(500).json({ 
      error: 'Failed to generate image description',
      details: error.message || 'Unknown error occurred'
    });
  }
}