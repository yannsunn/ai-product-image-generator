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

    // Gemini 2.0 Flash実験版で画像生成
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        temperature: 1.0,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 8192,
        responseMimeType: 'image/jpeg'
      }
    });

    // プロンプトの準備（日本語で詳細な指示）
    const finalPrompt = `${prompt}
    
    重要な指示：
    - 商品を魅力的に見せる高品質な画像を生成してください
    - 正方形（1:1）のアスペクト比で生成してください
    - 明るく清潔感のある照明を使用してください
    - 商品の特徴がよく分かるような構図にしてください
    - 日本のEコマース（Amazon）に適したスタイルで生成してください
    - 人物が含まれる場合は日本人の設定でお願いします`;
    
    // パーツの構築
    const parts = [
      { text: finalPrompt }
    ];
    
    // 参考画像データを追加
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
    const maxRetries = 3;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        console.log(`Attempt ${attempt + 1} to generate image`);
        
        // APIリクエストの送信
        const result = await model.generateContent(parts);
        const response = result.response;
        
        // レスポンスから画像データを取得
        if (response.candidates && response.candidates.length > 0) {
          const candidate = response.candidates[0];
          
          // inlineDataとして画像が返される場合
          if (candidate.content && candidate.content.parts) {
            for (const part of candidate.content.parts) {
              if (part.inlineData && part.inlineData.data) {
                console.log('Image generated successfully');
                return res.status(200).json({ 
                  image: part.inlineData.data
                });
              }
            }
          }
          
          // テキストが返された場合（エラー）
          const textContent = response.text();
          if (textContent) {
            console.error('Model returned text instead of image:', textContent);
            throw new Error('画像生成に失敗しました。モデルがテキストを返しました。');
          }
        }
        
        throw new Error('画像データが見つかりませんでした');

      } catch (error) {
        lastError = error;
        console.error(`Attempt ${attempt + 1} failed:`, error.message);
        
        // レート制限の場合はリトライ
        if (error.message?.includes('429') && attempt < maxRetries - 1) {
          const waitTime = Math.min(2000 * Math.pow(2, attempt), 10000);
          console.log(`Waiting ${waitTime}ms before retry`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
        
        // その他のエラーまたは最終試行の場合
        if (attempt === maxRetries - 1) {
          break;
        }
      }
    }

    // すべてのリトライが失敗
    console.error('All retries failed:', lastError);
    
    // エラーメッセージの詳細化
    if (lastError?.message?.includes('429')) {
      return res.status(429).json({ 
        error: 'Rate limit exceeded. Please try again later.',
        details: 'APIのレート制限に達しました。しばらく待ってから再試行してください。'
      });
    }
    
    if (lastError?.message?.includes('responseMimeType')) {
      return res.status(500).json({ 
        error: 'Image generation not supported',
        details: '現在のAPIキーまたはモデルでは画像生成がサポートされていません。'
      });
    }
    
    return res.status(500).json({ 
      error: 'Failed to generate image',
      details: lastError?.message || '画像生成中にエラーが発生しました。'
    });

  } catch (error) {
    console.error('Error in generate-images:', error);
    console.error('Error stack:', error.stack);
    
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message || 'Unknown error occurred'
    });
  }
}