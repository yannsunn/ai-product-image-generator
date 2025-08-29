import { GoogleGenerativeAI } from '@google/generative-ai';

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
    const { files } = req.body;

    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }

    // 環境変数からAPIキーを取得
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('GEMINI_API_KEY is not set');
      return res.status(500).json({ error: 'API key configuration error' });
    }

    // Gemini APIクライアントの初期化
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash-exp',
      systemInstruction: 'あなたは日本のAmazonの商品ページを作成するプロのマーケティング担当者です。提供された商品画像を分析し、購買意欲を高めるような魅力的な商品紹介画像を生成するための、具体的なプロンプトを4つ提案してください。プロンプトは、商品の利用シーン、雰囲気、ターゲット顧客がイメージできるような内容にしてください。返答は必ずJSON形式の配列のみで、他のテキストは含めないでください。例: ["プロンプト1", "プロンプト2", "プロンプト3", "プロンプト4"]'
    });

    // プロンプトの作成
    const isCombined = files.length > 1;
    const textPrompt = isCombined 
      ? "ここに写っているすべての商品を組み合わせた、魅力的なシーンのプロンプトを4つ提案してください。" 
      : "この商品を分析して、プロンプトを4つ提案してください。";

    // パーツの構築
    const parts = [textPrompt];
    
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
        responseMimeType: 'application/json',
        temperature: 0.7,
        maxOutputTokens: 1000
      }
    });

    const response = await result.response;
    const text = response.text();
    
    // JSONパース
    let suggestions;
    try {
      suggestions = JSON.parse(text);
    } catch (parseError) {
      console.error('Failed to parse AI response:', text);
      return res.status(500).json({ error: 'Invalid response format from AI' });
    }

    // 配列チェック
    if (!Array.isArray(suggestions) || suggestions.length === 0) {
      return res.status(500).json({ error: 'AI did not return valid suggestions' });
    }

    // 成功レスポンス
    return res.status(200).json(suggestions);

  } catch (error) {
    console.error('Error in generate-prompts:', error);
    
    // エラーレスポンス
    if (error.message?.includes('429')) {
      return res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
    }
    
    return res.status(500).json({ 
      error: 'Failed to generate prompts',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}