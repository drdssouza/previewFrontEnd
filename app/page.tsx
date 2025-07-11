'use client';

import { useState, useRef } from 'react';
import { 
  CloudArrowUpIcon, DocumentTextIcon, CodeBracketIcon, ClipboardDocumentIcon,
  PencilSquareIcon, ArrowDownTrayIcon, CheckCircleIcon, ExclamationTriangleIcon,
  EyeIcon, XMarkIcon
} from '@heroicons/react/24/outline';

type Step = 'upload' | 'code-review' | 'download';
type CodeLanguage = 'python' | 'java';

// Interfaces para tokens
interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  total: number;
}

interface TokenSummary {
  extraction?: TokenUsage;
  codeGeneration?: TokenUsage;
  bddGeneration?: TokenUsage;
  grandTotal: number;
}

// Componente para exibir tokens
interface TokenDisplayProps {
  summary: TokenSummary;
  showTitle?: boolean;
}

const TokenDisplay: React.FC<TokenDisplayProps> = ({ summary, showTitle = true }) => {
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('pt-BR').format(num);
  };

  const getStepIcon = (step: string) => {
    switch (step) {
      case 'extraction':
        return '📄';
      case 'codeGeneration':
        return '🖥️​';
      case 'bddGeneration':
        return '🧪';
      default:
        return '🔸';
    }
  };

  const getStepName = (step: string) => {
    switch (step) {
      case 'extraction':
        return 'Análise da História';
      case 'codeGeneration':
        return 'Geração de Código';
      case 'bddGeneration':
        return 'Geração de Testes';
      default:
        return step;
    }
  };

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
      {showTitle && (
        <div className="flex items-center mb-3">
          <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center mr-2">
            <span className="text-white text-xs font-bold">T</span>
          </div>
          <h3 className="text-sm font-semibold text-blue-900">Consumo de Tokens</h3>
        </div>
      )}

      <div className="space-y-2">
        {Object.entries(summary).map(([step, usage]) => {
          if (step === 'grandTotal' || !usage || typeof usage === 'number') return null;
          
          return (
            <div key={step} className="flex items-center justify-between bg-white bg-opacity-70 rounded-md px-3 py-2">
              <div className="flex items-center space-x-2">
                <span className="text-lg">{getStepIcon(step)}</span>
                <span className="text-sm font-medium text-gray-700">
                  {getStepName(step)}
                </span>
              </div>
              <div className="flex items-center space-x-4 text-xs">
                <div className="text-center">
                  <div className="text-gray-500">Entrada</div>
                  <div className="font-semibold text-gray-700">
                    {formatNumber(usage.input_tokens)}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-gray-500">Saída</div>
                  <div className="font-semibold text-gray-700">
                    {formatNumber(usage.output_tokens)}
                  </div>
                </div>
                <div className="text-center bg-blue-100 px-2 py-1 rounded">
                  <div className="text-blue-600 font-bold">
                    {formatNumber(usage.total)}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {summary.grandTotal > 0 && (
          <div className="border-t border-blue-200 pt-2 mt-3">
            <div className="flex items-center justify-between bg-blue-100 rounded-md px-3 py-2">
              <div className="flex items-center space-x-2">
                <span className="text-lg">🎯</span>
                <span className="text-sm font-bold text-blue-900">Total Geral</span>
              </div>
              <div className="text-lg font-bold text-blue-900">
                {formatNumber(summary.grandTotal)} tokens
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default function Home() {
  const [currentStep, setCurrentStep] = useState<Step>('upload');
  const [userStory, setUserStory] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [uploadedContextFile, setUploadedContextFile] = useState<File | null>(null);
  const [contextFileContent, setContextFileContent] = useState('');
  const [showFilePreview, setShowFilePreview] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<CodeLanguage | null>(null);
  const [generatedCode, setGeneratedCode] = useState('');
  const [editedCode, setEditedCode] = useState('');
  const [bddTest, setBddTest] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pollingStatus, setPollingStatus] = useState('');
  const [error, setError] = useState('');
  
  // Estados para tokens
  const [tokenSummary, setTokenSummary] = useState<TokenSummary>({ grandTotal: 0 });
  
  // Estados para preview de arquivos
  const [previewFile, setPreviewFile] = useState<{ content: string; name: string } | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const contextFileInputRef = useRef<HTMLInputElement>(null);

  // Função para calcular tokens
  const calculateTokenSummary = (extractedData?: any, codeData?: any, bddData?: any): TokenSummary => {
    const summary: TokenSummary = { grandTotal: 0 };

    if (extractedData?.input_tokens && extractedData?.output_tokens) {
      summary.extraction = {
        input_tokens: extractedData.input_tokens,
        output_tokens: extractedData.output_tokens,
        total: extractedData.input_tokens + extractedData.output_tokens
      };
      summary.grandTotal += summary.extraction.total;
    }

    if (codeData?.input_tokens && codeData?.output_tokens) {
      summary.codeGeneration = {
        input_tokens: codeData.input_tokens,
        output_tokens: codeData.output_tokens,
        total: codeData.input_tokens + codeData.output_tokens
      };
      summary.grandTotal += summary.codeGeneration.total;
    }

    if (bddData?.input_tokens && bddData?.output_tokens) {
      summary.bddGeneration = {
        input_tokens: bddData.input_tokens,
        output_tokens: bddData.output_tokens,
        total: bddData.input_tokens + bddData.output_tokens
      };
      summary.grandTotal += summary.bddGeneration.total;
    }

    return summary;
  };

  // Função para converter arquivo para base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = error => reject(error);
    });
  };

  // Função de validação de arquivo atualizada
  const validateFile = async (file: File): Promise<{ valid: boolean; error?: string }> => {
    try {
      const configResponse = await fetch('/api/generate-code', { method: 'GET' });
      const config = configResponse.ok ? await configResponse.json() : null;
      
      const maxSizeMB = config?.configuration?.maxFileSize ? 
        parseInt(config.configuration.maxFileSize.replace('MB', '')) : 5;
      const supportedTypes = config?.configuration?.supportedFileTypes || 
        ['.txt', '.doc', '.docx', '.pdf'];
      
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
      const fileSizeMB = file.size / (1024 * 1024);
      
      if (!supportedTypes.includes(fileExtension)) {
        return {
          valid: false,
          error: `Formato não suportado. Use: ${supportedTypes.join(', ')}`
        };
      }
      
      if (fileSizeMB > maxSizeMB) {
        return {
          valid: false,
          error: `Arquivo muito grande (máx: ${maxSizeMB}MB)`
        };
      }
      
      return { valid: true };
      
    } catch (error) {
      const allowedTypes = ['.txt', '.doc', '.docx', '.pdf'];
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
      
      if (!allowedTypes.includes(fileExtension)) {
        return {
          valid: false,
          error: 'Formato não suportado. Use .txt, .doc, .docx ou .pdf'
        };
      }
      
      if (file.size > 5 * 1024 * 1024) {
        return {
          valid: false,
          error: 'Arquivo muito grande (máx: 5MB)'
        };
      }
      
      return { valid: true };
    }
  };

  // Função pollS3File atualizada com configuração dinâmica
  const pollS3File = async (presignedUrl: string): Promise<string> => {
    let maxAttempts = 400;
    let interval = 2000;
    
    try {
      const configResponse = await fetch('/api/generate-code', { method: 'GET' });
      if (configResponse.ok) {
        const config = await configResponse.json();
        maxAttempts = Math.max(config.polling?.maxAttempts || 90, 90);
        interval = config.polling?.intervalMs || 2000;
      }
    } catch (error) {
      // Usar configurações padrão
    }
    
    setPollingStatus('Gerando código... Isso pode levar alguns minutos.');
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const contentResponse = await fetch(presignedUrl);
        
        if (contentResponse.ok) {
          setPollingStatus('Código gerado! Baixando resultado...');
          
          const content = await contentResponse.text();
          setPollingStatus('');
          return content;
        } else if (contentResponse.status === 404) {
          // Arquivo ainda não existe
        } else {
          console.error('Polling error:', contentResponse.status);
        }
        
        if (attempt % 15 === 0) {
          const timeElapsed = Math.floor((attempt * interval) / 1000);
          setPollingStatus(`Gerando código... (${timeElapsed}s decorridos)`);
        }
        
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, interval));
        }
        
      } catch (error) {
        console.error('Polling attempt failed:', attempt, error);
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, interval));
        }
      }
    }
    
    setPollingStatus('');
    throw new Error('Timeout: O processamento está demorando mais que o esperado. Tente novamente.');
  };

  const processFile = (file: File, type: 'story' | 'context') => {
    const allowedTypes = ['.txt', '.doc', '.docx', '.pdf'];
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    
    if (!allowedTypes.includes(fileExtension)) {
      setError('Formato não suportado. Use .txt, .doc, .docx ou .pdf');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Arquivo muito grande (máx: 5MB)');
      return;
    }

    if (type === 'story') {
      setUploadedFile(file);
    } else {
      setUploadedContextFile(file);
    }
    setError('');
    
    if (fileExtension === '.pdf') {
      if (type === 'story') {
        setFileContent('[Arquivo PDF - conteúdo será processado pela IA]');
      } else {
        setContextFileContent('[Arquivo PDF - conteúdo será processado pela IA]');
      }
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = (e.target?.result as string || '').trim();
      if (content.length > 1000000000) {
        setError('Conteúdo muito extenso (máx: 100k caracteres)');
        return;
      }
      if (type === 'story') {
        setFileContent(content);
      } else {
        setContextFileContent(content);
      }
    };
    reader.onerror = () => setError('Erro ao ler arquivo');
    reader.readAsText(file);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'story' | 'context') => {
    const file = e.target.files?.[0];
    if (file) processFile(file, type);
  };

  const toggleLanguageSelection = (language: CodeLanguage) => {
    if (selectedLanguage === language) {
      setSelectedLanguage(null);
    } else {
      setSelectedLanguage(language);
    }
  };

  const generateCode = async () => {
    const content = uploadedFile ? fileContent : userStory.trim();
    if (!content) {
      setError('Insira uma história de usuário ou faça upload de arquivo');
      return;
    }

    if (!selectedLanguage) {
      setError('Selecione uma linguagem de programação');
      return;
    }

    if (uploadedFile) {
      const validation = await validateFile(uploadedFile);
      if (!validation.valid) {
        setError(validation.error || 'Arquivo inválido');
        return;
      }
    }

    setIsLoading(true);
    setError('');
    setPollingStatus('Iniciando geração de código...');
    
    try {
      const requestId = crypto.randomUUID();
      
      let requestPayload: any = {
        language: selectedLanguage,
        requestId: requestId
      };

      if (uploadedFile) {
        const files = [];
        
        const mainFileBase64 = await fileToBase64(uploadedFile);
        files.push({
          name: uploadedFile.name,
          type: uploadedFile.type || 'text/plain',
          content: mainFileBase64,
          category: 'story'
        });

        if (uploadedContextFile && contextFileContent.trim()) {
          const contextValidation = await validateFile(uploadedContextFile);
          if (!contextValidation.valid) {
            setError(`Arquivo de contexto: ${contextValidation.error}`);
            return;
          }
          
          const contextFileBase64 = await fileToBase64(uploadedContextFile);
          files.push({
            name: uploadedContextFile.name,
            type: uploadedContextFile.type || 'text/plain',
            content: contextFileBase64,
            category: 'context'
          });
        }

        requestPayload = {
          ...requestPayload,
          inputType: "file",
          files: files,
          userStory: "",
          contexto: contextFileContent.trim()
        };

      } else {
        requestPayload = {
          ...requestPayload,
          inputType: "text", 
          userStory: content,
          contexto: contextFileContent.trim()
        };
      }

      const response = await fetch('/api/generate-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Falha na geração de código');
      }

      const presignedUrl = data.presignedUrl;
      if (!presignedUrl) {
        throw new Error('URL de monitoramento não foi fornecida');
      }

      setPollingStatus('Aguardando processamento...');

      const generatedContent = await pollS3File(presignedUrl);

      if (!generatedContent) {
        throw new Error('Código não foi gerado');
      }

      let parsedResult;
      try {
        parsedResult = JSON.parse(generatedContent);
        
        let extractedCode = '';
        
        if (parsedResult.frontendData?.formattedCode) {
          extractedCode = parsedResult.frontendData.formattedCode;
        } else if (parsedResult.frontendData?.code) {
          extractedCode = parsedResult.frontendData.code;
        } else if (parsedResult.code_generated?.code) {
          extractedCode = parsedResult.code_generated.code;
        } else if (parsedResult.generatedCode) {
          extractedCode = parsedResult.generatedCode;
        } else if (parsedResult.code) {
          extractedCode = parsedResult.code;
        } else if (typeof parsedResult === 'string') {
          extractedCode = parsedResult;
        } else {
          extractedCode = JSON.stringify(parsedResult, null, 2);
        }
        
        const cleanedCode = extractedCode
          .replace(/\\n/g, '\n')
          .replace(/\\t/g, '\t')
          .replace(/\\"/g, '"')
          .replace(/\\\\/g, '\\')
          .trim();
        
        setGeneratedCode(cleanedCode);
        setEditedCode(cleanedCode);

        // Calcular tokens após geração de código
        const newTokenSummary = calculateTokenSummary(
          parsedResult.extracted_data,
          parsedResult.code_generated
        );
        setTokenSummary(newTokenSummary);
        
      } catch (parseError) {
        const cleanedContent = generatedContent
          .replace(/\\n/g, '\n')
          .replace(/\\t/g, '\t')
          .trim();
        
        setGeneratedCode(cleanedContent);
        setEditedCode(cleanedContent);
      }
      
      setCurrentStep('code-review');
      setPollingStatus('');
      
    } catch (error) {
      console.error('Code generation error:', error);
      setError(error instanceof Error ? error.message : 'Erro ao gerar código. Tente novamente.');
      setPollingStatus('');
    } finally {
      setIsLoading(false);
    }
  };

  const generateBDD = async () => {
    if (!editedCode.trim()) {
      setError('Código é necessário para gerar testes BDD');
      return;
    }

    setIsLoading(true);
    setError('');
    setPollingStatus('Gerando testes BDD...');

    try {
      const response = await fetch('/api/generate-bdd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          code: editedCode, 
          language: selectedLanguage,
          requestId: crypto.randomUUID()
        }),
      });

      if (!response.ok) throw new Error('Erro ao gerar testes BDD');
      const data = await response.json();
      
      const presignedUrl = data.presignedUrl;
      if (!presignedUrl) {
        throw new Error('URL de monitoramento não foi fornecida');
      }

      const bddResult = await pollS3File(presignedUrl);
      
      let finalBddContent = '';
      try {
        const parsedResult = JSON.parse(bddResult);
        
        if (parsedResult.bdd_generated?.content) {
          finalBddContent = parsedResult.bdd_generated.content;
        } else if (parsedResult.bdd?.content) {
          finalBddContent = parsedResult.bdd.content;
        } else if (parsedResult.content) {
          finalBddContent = parsedResult.content;
        } else if (typeof parsedResult === 'string') {
          finalBddContent = parsedResult;
        } else {
          finalBddContent = bddResult;
        }

        // Atualizar tokens após geração de BDD
        const updatedTokenSummary = calculateTokenSummary(
          tokenSummary.extraction ? {
            input_tokens: tokenSummary.extraction.input_tokens,
            output_tokens: tokenSummary.extraction.output_tokens
          } : undefined,
          tokenSummary.codeGeneration ? {
            input_tokens: tokenSummary.codeGeneration.input_tokens,
            output_tokens: tokenSummary.codeGeneration.output_tokens
          } : undefined,
          parsedResult.bdd_generated
        );
        setTokenSummary(updatedTokenSummary);

      } catch (parseError) {
        finalBddContent = bddResult;
      }
      
      finalBddContent = finalBddContent.replace(/\\n/g, '\n');
      
      setBddTest(finalBddContent);
      setCurrentStep('download');
      setPollingStatus('');
      
    } catch (error) {
      console.error('BDD generation error:', error);
      setError(error instanceof Error ? error.message : 'Erro ao gerar testes BDD. Tente novamente.');
      setPollingStatus('');
    } finally {
      setIsLoading(false);
    }
  };

  const downloadFiles = async () => {
    const timestamp = new Date().toISOString().split('T')[0];
    const ext = selectedLanguage === 'python' ? 'py' : 'java';
    const fileName = selectedLanguage === 'python' ? 'generated_code' : 'GeneratedCode';
    
    try {
      // Tentar usar JSZip se disponível
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      
      // Adicionar arquivo de código
      zip.file(`${fileName}_${timestamp}.${ext}`, editedCode);
      
      // Adicionar arquivo de testes BDD
      zip.file(`test_${timestamp}.feature`, bddTest);
      
      // Gerar o ZIP e fazer download
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const zipUrl = URL.createObjectURL(zipBlob);
      const zipLink = document.createElement('a');
      zipLink.href = zipUrl;
      zipLink.download = `generated_project_${timestamp}.zip`;
      zipLink.click();
      URL.revokeObjectURL(zipUrl);
      
    } catch (error) {
      // Fallback: downloads separados se JSZip não estiver disponível
      const codeBlob = new Blob([editedCode], { type: 'text/plain' });
      const codeUrl = URL.createObjectURL(codeBlob);
      const codeLink = document.createElement('a');
      codeLink.href = codeUrl;
      codeLink.download = `${fileName}_${timestamp}.${ext}`;
      codeLink.click();
      URL.revokeObjectURL(codeUrl);

      // Pequeno delay para evitar conflito de downloads
      setTimeout(() => {
        const bddBlob = new Blob([bddTest], { type: 'text/plain' });
        const bddUrl = URL.createObjectURL(bddBlob);
        const bddLink = document.createElement('a');
        bddLink.href = bddUrl;
        bddLink.download = `test_${timestamp}.feature`;
        bddLink.click();
        URL.revokeObjectURL(bddUrl);
      }, 100);
    }
  };

  const resetFlow = () => {
    setCurrentStep('upload');
    setUserStory('');
    setUploadedFile(null);
    setFileContent('');
    setUploadedContextFile(null);
    setContextFileContent('');
    setPreviewFile(null);
    setSelectedLanguage(null);
    setGeneratedCode('');
    setEditedCode('');
    setBddTest('');
    setPollingStatus('');
    setError('');
    setTokenSummary({ grandTotal: 0 });
  };

  const steps = [
    { key: 'upload', label: 'História de Usuário', icon: DocumentTextIcon },
    { key: 'code-review', label: 'Código Gerado', icon: CodeBracketIcon },
    { key: 'download', label: 'Download', icon: ArrowDownTrayIcon }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
                <CodeBracketIcon className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Gerador de Código IA</h1>
                <p className="text-sm text-gray-600">Powered by AWS  & Developed by Compass UOL</p>
              </div>
            </div>
            <div className="flex items-center space-x-3 text-sm text-gray-500">
              <span>Desktop • Compass • AWS</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8 flex items-center justify-center space-x-8">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isActive = currentStep === step.key;
            const isCompleted = steps.findIndex(s => s.key === currentStep) > index;
            
            return (
              <div key={step.key} className="flex flex-col items-center">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 ${
                  isCompleted ? 'bg-green-500 border-green-500' :
                  isActive ? 'bg-blue-500 border-blue-500' : 'bg-gray-200 border-gray-300'
                }`}>
                  <Icon className={`h-6 w-6 ${isCompleted || isActive ? 'text-white' : 'text-gray-400'}`} />
                </div>
                <span className={`mt-2 text-sm font-medium ${
                  isActive ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-500'
                }`}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-400 mr-2" />
              <span className="text-red-700">{error}</span>
            </div>
          </div>
        )}

        {currentStep === 'upload' && (
          <div className="bg-white rounded-xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">História de Usuário</h2>
            
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    História de Usuário
                  </label>
                  
                  <div 
                    className="border-2 border-dashed rounded-lg p-6 transition-all cursor-pointer border-gray-300 hover:border-blue-400"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <div className="text-center">
                      <CloudArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
                      <div className="mt-4">
                        <button type="button" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                          Selecionar Arquivo
                        </button>
                        <p className="mt-2 text-sm text-gray-500">ou arraste e solte aqui</p>
                        <p className="text-xs text-gray-400">Formatos: .txt, .doc, .docx</p>
                      </div>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".txt,.doc,.docx"
                      onChange={(e) => handleFileUpload(e, 'story')}
                      className="hidden"
                    />
                  </div>

                  {uploadedFile && (
                    <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <DocumentTextIcon className="h-5 w-5 text-blue-600" />
                          <span className="text-sm text-blue-700 font-medium">{uploadedFile.name}</span>
                          <span className="text-xs text-blue-500">({(uploadedFile.size / 1024).toFixed(1)} KB)</span>
                        </div>
                        <div className="flex space-x-2">
                          {uploadedFile.name.toLowerCase().endsWith('.pdf') ? (
                            <span className="px-2 py-1 text-xs text-blue-600 bg-blue-100 rounded">
                              PDF será processado pela IA
                            </span>
                          ) : (
                            <button
                              onClick={() => setPreviewFile({ content: fileContent, name: uploadedFile.name })}
                              className="px-2 py-1 text-xs text-blue-600 bg-blue-100 rounded hover:bg-blue-200"
                            >
                              <EyeIcon className="h-3 w-3 inline mr-1" />Visualizar
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setUploadedFile(null);
                              setFileContent('');
                              if (fileInputRef.current) fileInputRef.current.value = '';
                            }}
                            className="text-xs text-blue-600 underline hover:text-blue-800"
                          >
                            Remover
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Contexto e Padronização
                  </label>
                  
                  <div 
                    className="border-2 border-dashed rounded-lg p-6 transition-all cursor-pointer border-gray-300 hover:border-blue-400"
                    onClick={() => contextFileInputRef.current?.click()}
                  >
                    <div className="text-center">
                      <CloudArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
                      <div className="mt-4">
                        <button type="button" className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700">
                          Adicionar Contexto
                        </button>
                        <p className="mt-2 text-sm text-gray-500">Opcional: padrões técnicos</p>
                        <p className="text-xs text-gray-400">Formatos: .txt, .doc, .docx</p>
                      </div>
                    </div>
                    <input
                      ref={contextFileInputRef}
                      type="file"
                      accept=".txt,.doc,.docx"
                      onChange={(e) => handleFileUpload(e, 'context')}
                      className="hidden"
                    />
                  </div>

                  {uploadedContextFile && (
                    <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-md">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <DocumentTextIcon className="h-5 w-5 text-gray-600" />
                          <span className="text-sm text-gray-700 font-medium">{uploadedContextFile.name}</span>
                          <span className="text-xs text-gray-500">({(uploadedContextFile.size / 1024).toFixed(1)} KB)</span>
                        </div>
                        <div className="flex space-x-2">
                          {uploadedContextFile.name.toLowerCase().endsWith('.pdf') ? (
                            <span className="px-2 py-1 text-xs text-gray-600 bg-gray-100 rounded">
                              PDF será processado pela IA
                            </span>
                          ) : (
                            <button
                              onClick={() => setPreviewFile({ content: contextFileContent, name: uploadedContextFile.name })}
                              className="px-2 py-1 text-xs text-gray-600 bg-gray-100 rounded hover:bg-gray-200"
                            >
                              <EyeIcon className="h-3 w-3 inline mr-1" />Visualizar
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setUploadedContextFile(null);
                              setContextFileContent('');
                              if (contextFileInputRef.current) contextFileInputRef.current.value = '';
                            }}
                            className="text-xs text-gray-600 underline hover:text-gray-800"
                          >
                            Remover
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {!uploadedFile && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ou escreva sua história de usuário
                  </label>
                  <textarea
                    value={userStory}
                    onChange={(e) => setUserStory(e.target.value)}
                    placeholder="Como usuário, quero..."
                    className="w-full h-32 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Selecione a linguagem de programação
                </label>
                <div className="grid grid-cols-2 gap-4">
                  {(['python', 'java'] as CodeLanguage[]).map((language) => (
                    <button
                      key={language}
                      onClick={() => toggleLanguageSelection(language)}
                      className={`p-4 border-2 rounded-lg transition-all ${
                        selectedLanguage === language
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="text-center">
                        <CodeBracketIcon className="h-8 w-8 mx-auto mb-2" />
                        <span className="font-medium capitalize">{language}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {pollingStatus && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-600 mr-2"></div>
                    <span className="text-yellow-700">{pollingStatus}</span>
                  </div>
                </div>
              )}

              <button
                onClick={generateCode}
                disabled={isLoading || (!userStory.trim() && !uploadedFile) || !selectedLanguage}
                className="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Gerando Código...
                  </div>
                ) : (
                  'Gerar Código'
                )}
              </button>
            </div>
          </div>
        )}

        {previewFile && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Preview: {previewFile.name}</h3>
                <button
                  onClick={() => setPreviewFile(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
              <div className="bg-gray-50 p-4 rounded-md overflow-y-auto max-h-96">
                <pre className="whitespace-pre-wrap text-sm">{previewFile.content}</pre>
              </div>
            </div>
          </div>
        )}

        {currentStep === 'code-review' && (
          <div className="bg-white rounded-xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Código Gerado</h2>
            
            <div className="space-y-6">
              {/*Mostrar tokens na etapa de code-review */}
              {tokenSummary.grandTotal > 0 && (
                <TokenDisplay summary={tokenSummary} />
              )}

              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-gray-700">
                    Código {selectedLanguage?.toUpperCase()}
                  </label>
                  <button
                    onClick={() => navigator.clipboard.writeText(editedCode)}
                    className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
                  >
                    <ClipboardDocumentIcon className="h-4 w-4 mr-1" />
                    Copiar
                  </button>
                </div>
                <textarea
                  value={editedCode}
                  onChange={(e) => setEditedCode(e.target.value)}
                  className="w-full h-96 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                />
              </div>

              <div className="flex space-x-4">
                <button
                  onClick={generateBDD}
                  disabled={isLoading}
                  className="flex-1 py-3 px-4 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:bg-gray-300 transition-colors"
                >
                  {isLoading ? 'Gerando Testes...' : 'Gerar Testes BDD'}
                </button>
                <button
                  onClick={resetFlow}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Reiniciar
                </button>
              </div>
            </div>
          </div>
        )}

        {currentStep === 'download' && (
          <div className="bg-white rounded-xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Downloads Prontos</h2>
            
            <div className="space-y-6">
              {/* Mostrar resumo completo de tokens na etapa final */}
              {tokenSummary.grandTotal > 0 && (
                <TokenDisplay summary={tokenSummary} />
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center mb-3">
                    <CodeBracketIcon className="h-6 w-6 text-blue-600 mr-2" />
                    <h3 className="font-medium">Código {selectedLanguage?.toUpperCase()}</h3>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">
                    Arquivo pronto para download
                  </p>
                  <div className="bg-gray-50 p-3 rounded text-xs font-mono max-h-32 overflow-y-auto">
                    {editedCode.substring(0, 200)}...
                  </div>
                </div>

                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center mb-3">
                    <CheckCircleIcon className="h-6 w-6 text-green-600 mr-2" />
                    <h3 className="font-medium">Testes BDD</h3>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">
                    Cenários de teste automatizados
                  </p>
                  <div className="bg-gray-50 p-3 rounded text-xs font-mono max-h-32 overflow-y-auto">
                    {bddTest.substring(0, 200)}...
                  </div>
                </div>
              </div>

              <div className="flex space-x-4">
                <button
                  onClick={downloadFiles}
                  className="flex-1 py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center"
                >
                  <ArrowDownTrayIcon className="h-5 w-5 mr-2" />
                  Baixar Projeto (.zip)
                </button>
                <button
                  onClick={resetFlow}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Nova Geração
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}