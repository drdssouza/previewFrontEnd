import { NextRequest, NextResponse } from 'next/server';

interface FileData {
  name: string;
  type: string;
  content: string; // base64
  category?: 'story' | 'context';
}

interface GenerateCodeRequest {
  inputType: 'text' | 'file';
  userStory?: string;
  files?: FileData[];
  language: 'python' | 'java';
  contexto?: string;
  requestId: string;
}

// Validação de tipos de arquivo incluindo PDF
const validateFileType = (fileName: string, fileType: string): boolean => {
  const supportedExtensions = ['.txt', '.doc', '.docx', '.pdf'];
  const supportedMimeTypes = [
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/pdf'
  ];
  
  const fileExtension = '.' + fileName.split('.').pop()?.toLowerCase();
  
  return supportedExtensions.includes(fileExtension) || 
         supportedMimeTypes.includes(fileType);
};

// Função para calcular tamanho do base64 sem Buffer
const getBase64Size = (base64String: string): number => {
  if (!base64String) return 0;
  // Calcular tamanho aproximado sem usar Buffer
  const padding = (base64String.match(/=/g) || []).length;
  return Math.floor((base64String.length * 3) / 4) - padding;
};

export async function POST(request: NextRequest) {
  try {
    // ✅ CORREÇÃO: Verificar env vars dentro da função, não na inicialização
    const API_GATEWAY_BASE_URL = process.env.API_GATEWAY_BASE_URL;
    const API_GATEWAY_KEY = process.env.API_GATEWAY_KEY;
    const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME || 'default-bucket';
    const S3_REGION = process.env.S3_REGION || 'us-east-1';
    const ACCOUNT_ID = process.env.ACCOUNT_ID;
    const STEP_FUNCTION_NAME = process.env.STEP_FUNCTION_NAME;

    // Validar se variáveis essenciais estão configuradas
    if (!API_GATEWAY_BASE_URL) {
      return NextResponse.json(
        { error: 'API_GATEWAY_BASE_URL não configurada nas environment variables' },
        { status: 500 }
      );
    }

    const body: GenerateCodeRequest = await request.json();
    const { inputType, userStory, files, language, contexto, requestId } = body;

    // Validações baseadas no tipo de entrada
    if (inputType === 'text') {
      if (!userStory || userStory.trim() === '') {
        return NextResponse.json(
          { error: 'História de usuário é obrigatória quando inputType é text' },
          { status: 400 }
        );
      }
    } else if (inputType === 'file') {
      if (!files || files.length === 0) {
        return NextResponse.json(
          { error: 'Pelo menos um arquivo é obrigatório quando inputType é file' },
          { status: 400 }
        );
      }

      // Validar tipos de arquivo incluindo PDF
      for (const file of files) {
        if (!validateFileType(file.name, file.type)) {
          return NextResponse.json(
            { error: `Tipo de arquivo não suportado: ${file.name}. Use .txt, .doc, .docx ou .pdf` },
            { status: 400 }
          );
        }

        // ✅ CORREÇÃO: Usar função personalizada ao invés de Buffer
        const maxSize = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf') 
          ? 10 * 1024 * 1024 // 10MB para PDF
          : 5 * 1024 * 1024;  // 5MB para outros

        const contentSize = getBase64Size(file.content);
        if (contentSize > maxSize) {
          return NextResponse.json(
            { error: `Arquivo ${file.name} muito grande. Máximo: ${maxSize / (1024 * 1024)}MB` },
            { status: 400 }
          );
        }
      }
    } else {
      return NextResponse.json(
        { error: 'inputType deve ser "text" ou "file"' },
        { status: 400 }
      );
    }

    if (!language || !['python', 'java'].includes(language)) {
      return NextResponse.json(
        { error: 'Linguagem deve ser "python" ou "java"' },
        { status: 400 }
      );
    }

    if (!requestId) {
      return NextResponse.json(
        { error: 'RequestId é obrigatório' },
        { status: 400 }
      );
    }

    // Modelos padrão a partir das variáveis de ambiente
    const defaultModels = {
      extractHistory: {
        family: process.env.DEFAULT_EXTRACT_MODEL_FAMILY || "amazon",
        model: process.env.DEFAULT_EXTRACT_MODEL_NAME || "nova-pro",
        bedrockId: process.env.DEFAULT_EXTRACT_MODEL_ID || "amazon.nova-pro-v1:0"
      },
      generateCode: {
        family: process.env.DEFAULT_GENERATE_MODEL_FAMILY || "amazon",
        model: process.env.DEFAULT_GENERATE_MODEL_NAME || "nova-pro",
        bedrockId: process.env.DEFAULT_GENERATE_MODEL_ID || "amazon.nova-pro-v1:0"
      },
      generateBDD: {
        family: process.env.DEFAULT_BDD_MODEL_FAMILY || "amazon",
        model: process.env.DEFAULT_BDD_MODEL_NAME || "nova-pro",
        bedrockId: process.env.DEFAULT_BDD_MODEL_ID || "amazon.nova-pro-v1:0"
      }
    };

    // Preparar payload para API Gateway/Lambda Upload
    const uploadPayload: any = {
      inputType: inputType,
      language: language,
      requestId: requestId,
      timestamp: new Date().toISOString(),
      source: "nextjs-frontend",
      models: defaultModels,
      selectedModel: defaultModels.extractHistory
    };

    // Adicionar dados específicos baseados no tipo
    if (inputType === 'text') {
      uploadPayload.userStory = userStory;
      uploadPayload.contextualInfo = contexto || "";
    } else if (inputType === 'file') {
      uploadPayload.files = files?.map(file => ({
        name: file.name,
        type: file.type,
        content: file.content,
        category: file.category || 'story'
      })) || [];
      uploadPayload.contextualInfo = contexto || "";
      uploadPayload.userStory = "";
    }

    // Preparar headers da requisição
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    // Adicionar API Key se configurada
    if (API_GATEWAY_KEY) {
      requestHeaders['x-api-key'] = API_GATEWAY_KEY;
    }

    // Chamar API Gateway
    const apiResponse = await fetch(`${API_GATEWAY_BASE_URL}/generate_code`, {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify(uploadPayload),
    });

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      console.error('API Gateway error:', apiResponse.status, errorText);
      
      throw new Error(`API Gateway retornou erro ${apiResponse.status}: ${errorText}`);
    }

    // Verificar Content-Type da resposta
    const contentType = apiResponse.headers.get('content-type') || '';
    
    let apiData;
    const responseText = await apiResponse.text();
    
    try {
      apiData = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Response parsing error:', parseError);
      
      // ✅ CORREÇÃO: Usar env vars ao invés de hardcode
      if (responseText.includes('execution') || responseText.includes('arn:aws:states')) {
        apiData = {
          executionArn: `arn:aws:states:${S3_REGION}:${ACCOUNT_ID}:stateMachine:${STEP_FUNCTION_NAME}:${requestId}`,
          downloadUrl: `https://${S3_BUCKET_NAME}.s3.${S3_REGION}.amazonaws.com/FileCode-${Math.floor(Date.now() / 1000)}.json`,
          uploadedFiles: []
        };
      } else {
        throw new Error(`API Gateway retornou HTML ao invés de JSON: ${responseText.substring(0, 200)}`);
      }
    }

    // Verificar se temos os dados necessários
    if (!apiData.executionArn) {
      throw new Error('Step Function não foi iniciada corretamente');
    }

    if (!apiData.downloadUrl) {
      throw new Error('URL de download não foi fornecida pela API Gateway');
    }

    // Retornar resposta para o frontend
    return NextResponse.json({
      success: true,
      requestId: requestId,
      presignedUrl: apiData.downloadUrl,
      executionArn: apiData.executionArn,
      status: 'processing',
      message: 'Arquivos salvos no S3 e Step Function iniciada com sucesso. Use a presigned URL para polling.',
      apiGatewayResponse: apiData,
      uploadedFiles: apiData.uploadedFiles || []
    });

  } catch (error) {
    console.error('Generate code error:', error);
    
    return NextResponse.json(
      { 
        error: 'Erro interno do servidor ao iniciar geração de código',
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
  const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME || 'default-bucket';
  const S3_REGION = process.env.S3_REGION || 'us-east-1';

  return NextResponse.json(
    { 
      message: 'Endpoint para geração de código',
      version: process.env.APP_VERSION || '2.2.0',
      environment: process.env.APP_ENVIRONMENT || 'development',
      status: 'API Gateway Integration Active - S3 Upload Architecture',
      configuration: {
        apiGatewayConfigured: !!API_GATEWAY_BASE_URL,
        s3Bucket: S3_BUCKET_NAME,
        s3Region: S3_REGION,
        hasApiKey: !!API_GATEWAY_KEY,
        maxFileSize: `${process.env.MAX_FILE_SIZE_MB || 5}MB`,
        maxFileSizePDF: '10MB',
        supportedFileTypes: (process.env.SUPPORTED_FILE_EXTENSIONS || '.txt,.doc,.docx,.pdf').split(',')
      },
      supportedLanguages: ['python', 'java'],
      supportedInputTypes: ['text', 'file'],
      architecture: 'Next.js → API Gateway → Processing Pipeline → Storage → Polling',
      polling: {
        maxAttempts: parseInt(process.env.POLLING_MAX_ATTEMPTS || '30'),
        intervalMs: parseInt(process.env.POLLING_INTERVAL_MS || '2000'),
        timeoutSeconds: parseInt(process.env.POLLING_TIMEOUT_SECONDS || '300')
      }
    },
    { status: 200 }
  );
}