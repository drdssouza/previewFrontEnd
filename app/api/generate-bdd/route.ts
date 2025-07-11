import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // ✅ CORREÇÃO: Mover env vars para dentro da função
    const API_GATEWAY_BASE_URL = process.env.API_GATEWAY_BASE_URL;
    const API_GATEWAY_KEY = process.env.API_GATEWAY_KEY;

    // Validar se variáveis essenciais estão configuradas
    if (!API_GATEWAY_BASE_URL) {
      return NextResponse.json(
        { error: 'API_GATEWAY_BASE_URL não configurada nas environment variables' },
        { status: 500 }
      );
    }

    const { code, language, requestId } = await request.json();
    
    if (!code || code.trim() === '') {
      return NextResponse.json(
        { error: 'Código é obrigatório para gerar testes BDD' },
        { status: 400 }
      );
    }

    if (!language || !['python', 'java'].includes(language)) {
      return NextResponse.json(
        { error: 'Linguagem deve ser "python" ou "java"' },
        { status: 400 }
      );
    }

    // Preparar payload para Step Function BDD (fluxo simplificado)
    const stepFunctionPayload = {
      requestId: requestId || `bdd_${Date.now()}`,
      filename: `file_bdd${Math.floor(Date.now() / 1000)}.json`,
      start_timestamp: Date.now(),
      
      // Dados mínimos necessários para a lambda
      configuration: {},
      user_data: { 
        language: language,
        user_history: `Código fornecido para geração de testes BDD:\n\n${code}`
      },
      
      // Simular dados de extração (será usado o user_history)
      extracted_data: {
        content: `Código ${language.toUpperCase()} para teste:\n\n${code}`,
        contentLength: code.length,
        wordCount: code.split(/\s+/).length,
        extractedAt: new Date().toISOString()
      },
      
      // Dados do código (sem s3Key - será processado internamente)
      code_generated: {
        language: language,
        code: code,
        codeLength: code.length,
        linesOfCode: code.split('\n').length,
        generatedAt: new Date().toISOString()
      },
      
      // Flag para indicar fluxo simplificado
      simplified_flow: true,
      source: 'generate_bdd_frontend'
    };

    // Preparar headers da requisição
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    // Adicionar API Key se configurada
    if (API_GATEWAY_KEY) {
      requestHeaders['x-api-key'] = API_GATEWAY_KEY;
    }

    const response = await fetch(`${API_GATEWAY_BASE_URL}/generate_bdd`, {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify(stepFunctionPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Gateway BDD error:', response.status, errorText);
      throw new Error(`API Gateway retornou erro ${response.status}: ${errorText}`);
    }

    // Verificar Content-Type da resposta
    const contentType = response.headers.get('content-type') || '';
    
    let data;
    const responseText = await response.text();
    
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('BDD response parsing error:', parseError);
      throw new Error(`API Gateway retornou HTML ao invés de JSON: ${responseText.substring(0, 200)}`);
    }
    
    if (!data.downloadUrl) {
      throw new Error('URL de monitoramento não foi fornecida pela API Gateway');
    }

    // Verificar se temos os dados necessários
    if (!data.executionArn) {
      throw new Error('Step Function não foi iniciada corretamente');
    }

    return NextResponse.json({
      presignedUrl: data.downloadUrl,
      executionArn: data.executionArn,
      requestId: stepFunctionPayload.requestId,
      status: 'processing',
      message: 'Step Function BDD iniciada. Use a presignedUrl para polling.',
      apiGatewayResponse: data
    });

  } catch (error) {
    console.error('Generate BDD error:', error);
    
    return NextResponse.json(
      { 
        error: 'Erro interno do servidor ao iniciar geração de testes BDD',
        details: error instanceof Error ? error.message : 'Erro desconhecido',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  // ✅ CORREÇÃO: Env vars dentro da função
  const API_GATEWAY_BASE_URL = process.env.API_GATEWAY_BASE_URL;
  const API_GATEWAY_KEY = process.env.API_GATEWAY_KEY;

  return NextResponse.json(
    { 
      message: 'Endpoint para geração de testes BDD',
      version: '4.0.0',
      status: 'Step Functions + S3 Polling + Bedrock Integration',
      configuration: {
        apiGatewayConfigured: !!API_GATEWAY_BASE_URL,
        hasApiKey: !!API_GATEWAY_KEY
      },
      architecture: 'API Gateway -> Step Function BDD -> generate_bdd_teste (Bedrock) -> S3 -> presigned URL',
      requiredPayload: {
        code: 'string (código para gerar testes)',
        language: 'python | java',
        requestId: 'string (opcional)'
      },
      endpoints: {
        POST: '/api/generate-bdd - Inicia Step Function BDD e retorna presignedUrl para polling'
      }
    },
    { status: 200 }
  );
}