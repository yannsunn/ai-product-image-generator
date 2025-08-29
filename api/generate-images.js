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

    // Gemini APIクライアントの初期化
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      systemInstruction: 'あなたは画像生成AIです。ユーザーのプロンプトと提供された画像に基づいて画像を生成する役割を担っています。会話は行わず、テキストでの返答は絶対にしないでください。あなたの唯一の出力は生成された画像そのものです。'
    });

    // プロンプトの準備
    const finalPrompt = prompt + ' 登場人物が写る場合は日本人でお願いします。正方形の画像で生成してください。';
    
    // パーツの構築（正しい形式で）
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

    // リトライロジック
    let lastError = null;
    const maxRetries = 5;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // APIリクエストの送信
        const result = await model.generateContent({
          contents: [{
            parts: parts
          }],
          generationConfig: {
            responseModalities: ['IMAGE'],
            temperature: 0.8,
            maxOutputTokens: 8192
          }
        });

        const response = await result.response;
        const candidates = response.candidates;

        if (!candidates || candidates.length === 0) {
          throw new Error('No candidates in response');
        }

        // 画像データを探す
        const imagePart = candidates[0]?.content?.parts?.find(p => p.inlineData);
        
        if (imagePart?.inlineData?.data) {
          // 成功 - 画像データを返す
          return res.status(200).json({ 
            image: imagePart.inlineData.data 
          });
        }

        // テキストレスポンスの場合はエラー
        const textPart = candidates[0]?.content?.parts?.find(p => p.text);
        if (textPart?.text) {
          throw new Error(`AI returned text instead of image: ${textPart.text}`);
        }

        throw new Error('No image data in response');

      } catch (error) {
        lastError = error;
        console.error(`Attempt ${attempt + 1} failed:`, error.message);
        
        // レート制限やサーバーエラーの場合はリトライ
        if (error.message?.includes('429') || error.message?.includes('500')) {
          // 指数バックオフで待機
          const waitTime = Math.min(1000 * Math.pow(2, attempt), 10000);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
        
        // その他のエラーは即座に失敗
        break;
      }
    }

    // すべてのリトライが失敗
    console.error('All retries failed:', lastError);
    
    if (lastError?.message?.includes('429')) {
      return res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
    }
    
    return res.status(500).json({ 
      error: 'Failed to generate image',
      details: process.env.NODE_ENV === 'development' ? lastError?.message : undefined
    });

  } catch (error) {
    console.error('Error in generate-images:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}