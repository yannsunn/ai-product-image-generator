import { GoogleGenerativeAI } from '@google/generative-ai';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

// 美しいグラデーション背景のパターン
const gradientPatterns = [
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
  'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
  'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)'
];

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

    // Gemini 2.0 Flash実験版で詳細な画像説明を生成
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        temperature: 0.9,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 2048
      }
    });

    // 詳細な画像説明を生成するプロンプト
    const systemPrompt = `あなたは商品写真のアートディレクターです。
    以下の形式で、商品画像の詳細な撮影プランを日本語で作成してください：

    【撮影コンセプト】
    シーンの全体的なコンセプトと狙い

    【構図とレイアウト】
    - 商品の配置
    - カメラアングル
    - 構図のバランス

    【照明と色調】
    - ライティングの設定
    - 色温度と雰囲気
    - 影の使い方

    【背景と小物】
    - 背景の設定
    - 使用する小物
    - 全体的な雰囲気作り

    【ターゲットへの訴求】
    - 想定するターゲット層
    - 購買意欲を高めるポイント`;

    const finalPrompt = `${prompt}
    
    上記のコンセプトに基づいて、日本のAmazonで販売する商品の魅力的な撮影プランを作成してください。`;
    
    // パーツの構築
    const parts = [
      { text: systemPrompt + '\n\n' + finalPrompt }
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

    console.log('Generating detailed image description...');
    
    // APIリクエストの送信
    const result = await model.generateContent({
      contents: [{
        parts: parts
      }]
    });

    const response = result.response;
    const description = response.text();

    if (!description) {
      throw new Error('No description generated');
    }

    console.log('Description generated successfully');

    // ランダムなグラデーションを選択
    const randomGradient = gradientPatterns[Math.floor(Math.random() * gradientPatterns.length)];

    // 美しいビジュアルカードとしてSVGを生成
    const svgImage = `
      <svg width="800" height="800" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
          </linearGradient>
          <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="4" stdDeviation="8" flood-opacity="0.15"/>
          </filter>
        </defs>
        
        <!-- 背景 -->
        <rect width="800" height="800" fill="url(#grad1)" opacity="0.1"/>
        
        <!-- メインカード -->
        <rect x="40" y="40" width="720" height="720" rx="20" fill="white" filter="url(#shadow)"/>
        
        <!-- ヘッダー -->
        <rect x="40" y="40" width="720" height="80" rx="20" fill="url(#grad1)"/>
        <text x="400" y="85" font-family="'Noto Sans JP', sans-serif" font-size="28" font-weight="bold" text-anchor="middle" fill="white">
          AI 撮影プラン
        </text>
        
        <!-- コンテンツエリア -->
        <foreignObject x="60" y="140" width="680" height="580">
          <div xmlns="http://www.w3.org/1999/xhtml" style="
            font-family: 'Noto Sans JP', -apple-system, BlinkMacSystemFont, sans-serif;
            font-size: 14px;
            line-height: 1.8;
            color: #333;
            padding: 20px;
            overflow-y: auto;
            height: 580px;
            white-space: pre-wrap;
            word-wrap: break-word;
          ">
            <style>
              div { 
                background: linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,1) 100%);
              }
              strong { 
                color: #5b21b6; 
                font-weight: 600; 
                display: block;
                margin-top: 16px;
                margin-bottom: 8px;
                font-size: 16px;
              }
            </style>
            ${description.replace(/【/g, '<strong>').replace(/】/g, '</strong>').replace(/\n/g, '<br/>')}
          </div>
        </foreignObject>
        
        <!-- フッター -->
        <text x="400" y="740" font-family="'Noto Sans JP', sans-serif" font-size="11" text-anchor="middle" fill="#666">
          ※ このプランを基に、実際の撮影または画像生成AIで商品画像を作成してください
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
    console.error('Error details:', error.message);
    
    if (error.message?.includes('429')) {
      return res.status(429).json({ 
        error: 'Rate limit exceeded',
        details: 'APIのレート制限に達しました。しばらく待ってから再試行してください。'
      });
    }
    
    return res.status(500).json({ 
      error: 'Failed to generate image',
      details: error.message || '画像プラン生成中にエラーが発生しました。'
    });
  }
}