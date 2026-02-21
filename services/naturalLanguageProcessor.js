import OpenAI from 'openai';
import CustomCommand from '../models/CustomCommand.js';
import fs from 'fs';
import path from 'path';

let openai = null;

function getOpenAIClient() {
  if (!openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY não está configurada no .env');
    }
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openai;
}

/**
 * Salva o prompt e resposta em um arquivo txt
 * @param {string} prompt - O prompt enviado ao GPT
 * @param {string} resposta - A resposta recebida do GPT
 */
function salvarPromptResposta(prompt, resposta) {
  try {
    const timestamp = new Date().toLocaleString('pt-BR');
    const conteudo = `TIMESTAMP: ${timestamp}
================================================================================

PROMPT ENVIADO AO CHATGPT:
================================================================================
${prompt}

================================================================================
RESPOSTA DO CHATGPT:
================================================================================
${resposta}

================================================================================
`;
    
    const caminhoArquivo = path.join(process.cwd(), 'prompt.txt');
    fs.writeFileSync(caminhoArquivo, conteudo, 'utf-8');
    console.log(`✅ Prompt e resposta salvos em: ${caminhoArquivo}`);
  } catch (error) {
    console.warn(`⚠️ Erro ao salvar prompt.txt: ${error.message}`);
  }
}

/**
 * Constrói a seção INSERT do prompt dinamicamente
 */
function buildInsertPromptSection(camposSalvos) {
  let section = `
1. INSERIR - Quando usuário quer adicionar dados
Você retorna os dados que serão inseridos no MongoDB.

⚠️ IMPORTANTE SOBRE "DADOS":
- Se o usuário passa UM valor simples: "dados": "5"  → Salvo como string (LIMPO: sem unidades!)
- Se o usuário passa MÚLTIPLOS valores (ex: "5 10 15" ou "5km, 10km, 15km"): 
  → Salvo automaticamente como objeto {tipo: "multiplo", valores: [...], original: "..."}
  → IMPORTANTE: Remova UNIDADES antes de retornar! "5km 10km 15km" → ["5", "10", "15"]
- SEMPRE RETORNE também "dados_vetor" como um array contendo os valores extraídos E LIMPOS:
  → Se um valor: "dados_vetor": ["5"] (não ["5km"])
  → Se múltiplos: "dados_vetor": ["5", "10", "15"] (não ["5km", "10km", "15km"])

🔧 REGRAS DE LIMPEZA UNIVERSAL:
- Remova unidades: km, m, kg, km/h, R$, %, etc.
- Remova espaços desnecessários
- Mantenha apenas números, pontos (.) e hífens (-) onde apropriado
- Para valores monetários, use ponto como separador decimal: "100,50" → "100.50"`;

  if (camposSalvos && camposSalvos.length > 0) {
    const camposFormatados = camposSalvos.map(c => `$${c}`).join(', ');
    section += `

⚠️ CAMPOS ESPECÍFICOS A SALVAR (identificados com $):
Este comando TEM campos específicos a salvar: [${camposFormatados}]

🔧 REGRAS CRÍTICAS DE LIMPEZA DE DADOS:
1. REMOVA UNIDADES: "60km" → "60", "150m" → "150", "25kg" → "25", "3.5L" → "3.5"
2. REMOVA CARACTERES ESPECIAIS: Mantenha apenas números, pontos (.) e hífens (-) quando necessário
3. REMOVA ESPAÇOS DESNECESSÁRIOS: "2 026" → "2026", " 60 " → "60"
4. PARA DATAS/MÊS: Mantenha apenas números: "fevereiro" → consulte contexto, "02" → "02"
5. PARA VALORES MONETÁRIOS: Remova símbolos de moeda: "R$ 100,50" → "100.50" (use ponto, não vírgula)
6. TIPO DE DADO: Se campo é "mes", o valor deve ser 1-12; se é "ano" deve ser 4 dígitos, se é "meta/valor" deve ser número puro
7. NUNCA salve: unidades, símbolos, caracteres especiais desnecessários - isso pode quebrar queries MongoDB futuras!`;
  }

  section += `

🔴 CRÍTICO - DETECTAR UPSERT (Inserir OU Atualizar):
Se a descrição menciona "altera", "atualiza", "modifica" + menciona em quais campos fazer a busca:

EXEMPLO:
  Descrição: "adiciona um registro para meta com $mes, $ano, $meta OU ALTERA a $meta se o registro com $ano e $mes já existir"
  → É UPSERT! Buscar por: mes, ano | Atualizar: meta
  → Retorne OBRIGATORIAMENTE um campo: "upsertBy": ["mes", "ano"]

SE A DESCRIÇÃO MENCIONA ALTERA/ATUALIZA:
- Identifique QUAIS CAMPOS são a chave para buscar (normalmente antes de "já existir/já salvo/etc")
- Retorne: "upsertBy": ["campo1", "campo2"]
- Se não conseguir extrair, deixe "upsertBy": []

SE A DESCRIÇÃO NÃO menciona ALTERA/ATUALIZA:
- É simplesmente INSERT: "upsertBy": []

EXEMPLO CORRETO (UPSERT):
{
  "acao": "inserir",
  "comando": "#nome",
  "dados": "valor a inserir",
  "dados_vetor": ["valor1", "valor2", ...],
  "upsertBy": ["mes", "ano"],
  "explicacao": "Descrição do que vai ser inserido/atualizado",
  "confianca": 0.95,
  "erro": null,
  "entendeu": true
}

EXEMPLO CORRETO (INSERT apenas):
{
  "acao": "inserir",
  "comando": "#nome",
  "dados": "valor a inserir",
  "dados_vetor": ["valor1"],
  "upsertBy": [],
  "explicacao": "Descrição do que vai ser inserido",
  "confianca": 0.95,
  "erro": null,
  "entendeu": true
}`;

  return section;
}

/**
 * Constrói a seção LIST do prompt dinamicamente
 */
function buildListPromptSection() {
  return `
2. LISTAR/CONSULTAR - Quando usuário quer ver dados
IMPORTANTE: Você NÃO acessa o MongoDB! Você constrói a QUERY que o servidor vai executar.

⚠️ TIPO LIST: Este comando NÃO salva dados novos. Ele CONSULTA dados já salvos no MongoDB por comandos INSERT.

🔴 CRÍTICO - QUAL COMANDO USAR NA QUERY:
A descrição do comando acima pode mencionar outro comando (ex: "lista as #metames").
SE A DESCRIÇÃO MENCIONA UM COMANDO (#XXXX):
  → VOCÊ OBRIGATORIAMENTE USA ESSE COMANDO NA QUERY
  → EXTRAI exatamente o #COMANDO que está escrito na descrição
  → NÃO usa o comando atual, SEMPRE usa o mencionado na descrição
  
EXEMPLO:
  Descrição: "lista todas as #metames com $mes, $ano, $meta"
  → Você VÊ: #metames
  → Você USA na query: {"$match": {"commandName": "#metames", ...}}
  → Você NÃO usa: #metas (o comando atual)

SE A DESCRIÇÃO NÃO menciona outro comando:
  → Use o próprio comando como commandName

Para LISTAGENS de múltiplos resultados ou rankings, você DEVE retornar 3 templates:
- cabecalho: Texto que aparece uma vez no início (ex: título com emojis)
- repeticoes: Template que se repete para CADA resultado (com placeholders como {nome}, {valor})
- rodape: Texto que aparece uma vez no final (ex: soma/total com emojis)

🔴 CRÍTICO - TEMPLATE USA PLACEHOLDERS!
O template SEMPRE usa placeholders {campo}.

ERRADO:
{
  "repeticoes": "1. João - 100km\n2. Maria - 95km"  ❌ ERRADO!
}

CORRETO:
{
  "repeticoes": "{$ordem}. {nome} - {total}km"  ✅ CERTO! Placeholders!
}

O servidor vai substituir {$ordem}, {nome}, {total} pelos valores de cada resultado.

Sempre retorne:
{
  "acao": "listar",
  "comando": "#nome",
  "queryMongoDB": [...aggregation pipeline...],
  "template": {
    "cabecalho": "...",
    "repeticoes": "... {$ordem} ... {campo1} ... {campo2} ...",
    "rodape": "..."
  },
  "processamento": "Instrução sobre como processar os dados",
  "explicacao": "O que será mostrado ao usuário",
  "confianca": 0.95,
  "erro": null,
  "entendeu": true
}

REGRAS PARA QUERIES MONGODB:
1. SEMPRE filtre por groupId no primeiro $match! Isso evita trazer dados de outros grupos.
2. SEMPRE filtre por commandName na query! Veja regra CRÍTICA acima.
3. Se o comando tem campos específicos ($km, $mes, etc), use $dados.NOMECAMPO na aggregation
4. Se o comando NÃO tem campos, use $dados direto
5. SEMPRE use $convert para conversão numérica segura: {"$convert": {"input": "$dados", "to": "double", "onError": 0}}
6. ⚠️ NÃO use operações de ARRAY ($indexOfArray, $pull, $push) em campos STRING!
   - Exemplo ERRADO: "$indexOfArray": ["$commandName", "#tag"] → commandName é STRING!
   - Se precisa de ordem, USE {$ordem} no template, NÃO na query

⚠️ NOMES DOS USUÁRIOS:
- SE A DESCRIÇÃO MENCIONA "nome" ou "nome personalizado" ou "display name":
  → Use $lookup para trazer nomes personalizados da tabela UserName
  → {"$lookup": {"from": "usernames", "localField": "userId", "foreignField": "userId", "as": "userInfo"}}
  → {"$addFields": {"nome": {"$cond": [{"$gt": [{"$size": "$userInfo"}, 0]}, {"$arrayElemAt": ["$userInfo.nomePersonalizado", 0]}, "$userName"]}}}
  
- SE A DESCRIÇÃO NÃO MENCIONA "nome":
  → Use apenas "$userName" diretamente (sem lookup)
  → Simplifique a query omitindo $lookup e $addFields

6. O campo deve retornar um array com objetos contendo pelo menos um campo "total" para cálculo de {$somador}

EXEMPLOS:

A) Se descrição NÃO menciona nome (USE APENAS $userName):
[
  {"$match": {"groupId": "\${groupId}", "commandName": "#comando"}},
  {"$group": {"_id": "$userName", "total": {"$sum": {"$convert": {"input": "$dados", "to": "double", "onError": 0}}}}},
  {"$sort": {"total": -1}},
  {"$limit": 10}
]

B) Se descrição MENCIONA nome (USE LOOKUP E $addFields):
[
  {"$match": {"groupId": "\${groupId}", "commandName": "#comando"}},
  {"$lookup": {"from": "usernames", "localField": "userId", "foreignField": "userId", "as": "userInfo"}},
  {"$addFields": {"nome": {"$cond": [{"$gt": [{"$size": "$userInfo"}, 0]}, {"$arrayElemAt": ["$userInfo.nomePersonalizado", 0]}, "$userName"]}}},
  {"$group": {"_id": "$nome", "total": {"$sum": {"$convert": {"input": "$dados", "to": "double", "onError": 0}}}}},
  {"$sort": {"total": -1}},
  {"$limit": 10}
]

🔴 CRÍTICO - SE A DESCRIÇÃO MENCIONA CAMPOS ESPECÍFICOS COMO $km ou $mes ou $ano:
A descrição do comando pode mencionar campos específicos (ex: "total de $km corrido", "soma de $mes").
QUANDO ISSO ACONTECE:
  → SEMPRE use "$dados.NOMECAMPO" na aggregation (NEM "$dados" sozinho)
  → EXEMPLO: Se descrição diz "$total de $km", use: "$convert": {"input": "$dados.km", "to": "double"}
  → Se descrição diz "$mes" e "$ano", use: "$dados.mes" e "$dados.ano"

EXEMPLO C - Descrição menciona $km (USE $dados.km):
[
  {"$match": {"groupId": "\${groupId}", "commandName": "#comando"}},
  {"$lookup": {"from": "usernames", "localField": "userId", "foreignField": "userId", "as": "userInfo"}},
  {"$addFields": {"nome": {"$cond": [{"$gt": [{"$size": "$userInfo"}, 0]}, {"$arrayElemAt": ["$userInfo.nomePersonalizado", 0]}, "$userName"]}}},
  {"$group": {"_id": "$nome", "total": {"$sum": {"$convert": {"input": "$dados.km", "to": "double", "onError": 0}}}}},
  {"$sort": {"total": -1}},
  {"$limit": 10}
]

CAMPOS ESPECIAIS:
- {$contador} = quantidade de linhas retornadas (calculado automaticamente)
- {$somador} = soma de todos os "total" retornados (calculado automaticamente)
- {$ordem} = posição numerada 1, 2, 3... (usado em repeticoes) - NÃO CALCULE ISTO NA QUERY!
- {nome} ou {userName}, {total}, {qualquer_campo} = campos retornados da query

⚠️ ATENÇÃO - TEMPLATE SEMPRE USA PLACEHOLDERS:
Seu template SEMPRE deve retornar placeholders tipo {$ordem}, {mes}, {ano}, {meta}
O servidor faz a substituição automática dos placeholders.

EXEMPLOS CORRETOS:
- "repeticoes": "{$ordem}. {mes} - {ano} - {meta}"
- "repeticoes": "👤 {nome}: {total}km"
- "rodape": "Total: {$somador}km"

EXEMPLOS ERRADOS (NUNCA FAÇA):
- "repeticoes": "1. Janeiro - 100km"  ❌ ERRADO!
- "template": "João: 50, Maria: 75"  ❌ Não substitua aqui!

🔴 CRÍTICO - NÃO USE $indexOfArray, $position, ou funções de array em campos STRING:
Se você PRECISAR exibir posição/ordem:
  → NÃO tente calcular na query usando $indexOfArray, $position, etc
  → DEIXE O TEMPLATE FAZER ISSO automaticamente com {$ordem}
  → O servidor calcula a ordem dos resultados
  
ERRADO:
{
  "$project": {
    "ordem": {"$add": [1, {"$indexOfArray": ["$commandName", "#tag"]}]},  ❌ ERRADO!
    "campo1": "$dados.campo"
  }
}

CORRETO:
{
  "$project": {
    "campo1": "$dados.campo"
  }
}
// No template, use: "{$ordem}. {campo1}"
`;
}

/**
 * Constrói a seção DELETE do prompt dinamicamente
 */
function buildDeletePromptSection() {
  return `
3. DELETAR - Quando usuário quer remover dados
{
  "acao": "deletar",
  "comando": "#nome",
  "filtro": {campo: valor},
  "explicacao": "O que será deletado",
  "confianca": 0.95,
  "erro": null,
  "entendeu": true
}`;
}

/**
 * Constrói o prompt principal dinâmico baseado no tipoComando
 */
function buildDynamicPrompt(tipoComando, commandInfo, camposSalvos, groupId, userData, userMessage) {
  // Validação de tipo
  const tipoNormalizado = (tipoComando || 'insert').toLowerCase();
  const ehInsert = tipoNormalizado.includes('insert');
  const ehList = tipoNormalizado.includes('list');
  const ehDelete = tipoNormalizado.includes('delete');

  let prompt = `Você é um interpretador de APENAS os comandos customizados criados pelo admin do grupo.

IMPORTANTE: Você NÃO administra os comandos fixos (#admin, #renunciar, #grupo, #comando).
Você APENAS interpreta comandos criados pelo admin e listados abaixo.

${ehList ? `ℹ️ TIPO: LIST/CONSULTA - Este é um comando de LISTAGEM/CONSULTA.
Você NÃO vai receber dados para salvar. Você vai construir uma QUERY para consultar dados no MongoDB.
` : ''}

COMANDO QUE O USUÁRIO ESTA EXECUTANDO:
${commandInfo}`;

  // Se é LIST, extrair qual comando debe ser usado
  if (ehList) {
    const comandoMencionadoMatch = commandInfo.match(/(lista|consulta|mostra|filtra|exibe)\s+(?:todos?|todas?|um?|uma?|os?|as?|todas|alguns?)?\s*(#\w+)/i);
    if (comandoMencionadoMatch) {
      const comandoParaQuery = comandoMencionadoMatch[2];
      prompt += `

🔴 INSTRUÇÃO CRÍTICA:
A descrição menciona o comando: ${comandoParaQuery}
Na query MongoDB, você DEVE usar: "commandName": "${comandoParaQuery}"
NÃO use o comando atual - use EXCLUSIVAMENTE: ${comandoParaQuery}`;
    }
  }

  prompt += `

DADOS DO USUÁRIO:
{
  "groupId": "${groupId}",
  "usuario": "${userData.userName}",
  "idUsuario": "${userData.idUsuario}",
  "isAdmin": ${userData.isAdmin},
  "data": "${userData.data}",
  "vinculo": "${userData.vinculo || 'null'}"
}

TIPOS DE AÇÕES POSSÍVEIS:`;

  // Adicionar APENAS a seção relevante ao tipo
  if (ehInsert) {
    prompt += `\n${buildInsertPromptSection(camposSalvos)}`;
  } else if (ehList) {
    prompt += `\n${buildListPromptSection()}`;
  } else if (ehDelete) {
    prompt += `\n${buildDeletePromptSection()}`;
  } else {
    // Tipo desconhecido: incluir all (insert + list + delete) como fallback
    prompt += `\n${buildInsertPromptSection(camposSalvos)}`;
    prompt += `\n${buildListPromptSection()}`;
    prompt += `\n${buildDeletePromptSection()}`;
  }

  // Base de dados e estrutura (sempre necessária para queries)
  prompt += `

ESTRUTURA DO MONGODB (CommandData):
Cada registro tem esses campos:
- groupId: string (ID do grupo - SEMPRE use para filtrar!)
- commandName: string (nome do comando ex: #add, #rank)
- userId: string (ID do usuário que executou)
- userName: string (nome do usuário padrão do WhatsApp)
- dados: string ou objeto (▼ VER ABAIXO)
- contexto: string (contexto do comando ex: "km", "pontuação")
- createdAt: date (timestamp automático)
- vinculo: object optional - REFERENCIA PARA OUTRO REGISTRO COMMANDDATA

⚠️ ESTRUTURA DO CAMPO "dados":
SE O COMANDO TEM CAMPOS ESPECÍFICOS (ex: $km, $mes, $ano):
  → dados é um OBJETO com os nomes dos campos
  → Exemplo: dados: { "km": "50", "mes": "02", "ano": "2026" }
  → Na query: Use "$dados.km", "$dados.mes", etc

SE O COMANDO NÃO TEM CAMPOS ESPECÍFICOS:
  → dados é uma STRING
  → Exemplo: dados: "150"
  → Na query: Use "$dados" direto

`;

  // Adicionar seção de estrutura JSON e mensagem do user
  prompt += `ESTRUTURA DO MONGODB (UserName - Nomes Personalizados):
Cada registro tem: userId, nomePersonalizado, nomeOriginal, createdAt

MENSAGEM DO USUÁRIO:
"${userMessage}"

Responda APENAS com JSON válido.`;

  return prompt;
}

/**
 * Processa comando em linguagem natural usando OpenAI
 * @param {string} userMessage - Mensagem do usuário
 * @param {string} groupId - ID do grupo
 * @param {object} userData - Dados do usuário { idUsuario, data, vinculo?, isAdmin }
 * @returns {object} Interpretação do comando
 */
export async function parseNaturalCommand(userMessage, groupId, userData) {
  try {
    console.log('\n🔴 INICIANDO parseNaturalCommand');
    console.log(`   userMessage: ${userMessage}`);
    console.log(`   groupId: ${groupId}`);
    


    // Detectar qual comando o usuário está tentando executar
    const commandMatch = userMessage.match(/#(\w+)/);
    const detectedCommand = commandMatch ? `#${commandMatch[1]}` : null;
    console.log(`🎯 Comando detectado na mensagem: ${detectedCommand || 'nenhum'}`);

    // Buscar o comando específico que o usuário está tentando executar
    let commandInfo = 'Nenhum comando customizado detectado';
    let camposSalvos = [];
    let tipoComando = 'insert'; // Default
    
    if (detectedCommand) {
      const cmd = await CustomCommand.findOne({ groupId, commandName: detectedCommand });
      if (cmd) {
        commandInfo = `${cmd.commandName}: ${cmd.data} | Contexto: ${cmd.contexto}`;
        camposSalvos = cmd.camposSalvados || [];
        tipoComando = cmd.tipoComando || 'insert'; // Ler o tipo do comando
        console.log(`✅ Comando encontrado: ${commandInfo}`);
        console.log(`   Tipo: ${tipoComando}`);
        console.log(`   Campos salvos: ${JSON.stringify(camposSalvos)}`);
      } else {
        console.log(`❌ Comando ${detectedCommand} não existe neste grupo`);
      }
    } else {
      // Se não detectar comando na mensagem, buscar todos para referência
      console.log('📋 Nenhum comando detectado, listando todos disponíveis para referência...');
      const customCommands = await CustomCommand.find({ groupId });
      if (customCommands.length > 0) {
        commandInfo = `Comandos disponíveis:\n${customCommands.map(cmd => `- ${cmd.commandName}: ${cmd.data} | Contexto: ${cmd.contexto}`).join('\n')}`;
      }
    }

    // Preparar dados para o prompt
    const vinculo = userData.vinculo || 'null';
    
    console.log(`📋 Dados do usuário para o ChatGPT:`);
    console.log(`   idUsuario: ${userData.idUsuario}`);
    console.log(`   userName: ${userData.userName}`);
    console.log(`   isAdmin: ${userData.isAdmin}`);
    
    // Construir o prompt dinamicamente baseado no tipo do comando
    const prompt = buildDynamicPrompt(
      tipoComando,
      commandInfo,
      camposSalvos,
      groupId,
      userData,
      userMessage
    );

    // Log do prompt construído
   console.log('\n🤖 PROMPT CONSTRUÍDO (primeiras 500 chars):');
    console.log('═'.repeat(80));
    console.log(prompt.substring(0, 500) + '...');
    console.log('═'.repeat(80));

    console.log('\n🔗 Conectando ao OpenAI...');
    console.log(`   API Key configurada: ${process.env.OPENAI_API_KEY ? 'SIM' : 'NÃO'}`);
    console.log(`   Modelo: ${process.env.OPENAI_MODEL || 'gpt-4o-mini'}`);
    
    const response = await getOpenAIClient().chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    });

    console.log('✅ Resposta recebida do OpenAI!');
    const content = response.choices[0].message.content.trim();
    
    // Salvar prompt e resposta em arquivo
    salvarPromptResposta(prompt, content);
    
    console.log('\n📨 RESPOSTA DO CHATGPT (RAW):');
    console.log('═'.repeat(80));
    console.log(content);
    console.log('═'.repeat(80));
    
    // Tentar fazer parse do JSON
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      // Se falhar, tentar extrair JSON da resposta
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('❌ Falha ao extrair JSON da resposta');
        console.error(`Resposta recebida:\n${content}`);
        return {
          entendeu: false,
          erro: 'PARSE_ERROR',
          explicacao: 'Não consegui interpretar a resposta da IA. Tente novamente.',
          confianca: 0
        };
      }
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch (parseError) {
        console.error('❌ JSON inválido na resposta');
        console.error(`Erro ao parsear JSON extraído: ${parseError.message}`);
        console.error(`JSON extraído:\n${jsonMatch[0]}`);
        return {
          entendeu: false,
          erro: 'PARSE_ERROR',
          explicacao: 'A resposta da IA tinha um formato inválido. Tente novamente.',
          confianca: 0
        };
      }
    }
    
    console.log('\n✅ JSON PARSEADO:');
    console.log(JSON.stringify(parsed, null, 2));
    
    // Validar estrutura básica
    if (!parsed.entendeu) {
      console.log(`\n⚠️ ChatGPT retornou entendeu: false`);
      console.log(`   erro: ${parsed.erro}`);
      console.log(`   explicacao: ${parsed.explicacao}`);
      console.log(`   confianca: ${parsed.confianca}`);
    }
    
    // Validar confiança mínima
    if (parsed.confianca < 0.5) {
      console.warn(`⚠️ Confiança baixa (${parsed.confianca}): comando ignorado`);
      console.warn(`💡 Aumentar threshold ou revisar resposta do ChatGPT`);
      return {
        entendeu: false,
        erro: 'LOW_CONFIDENCE',
        explicacao: 'Não tenho certeza o suficiente sobre este comando. Tente ser mais específico.',
        confianca: parsed.confianca
      };
    }
    
    if (parsed.confianca < 0.7) {
      console.warn(`⚠️ Confiança média (${parsed.confianca}): processando mesmo assim...`);
    }

    // Log final com um resumo
    console.log('\n✅ RETORNANDO PARSED:');
    console.log(`   entendeu: ${parsed.entendeu}`);
    console.log(`   acao: ${parsed.acao}`);
    console.log(`   comando: ${parsed.comando}`);
    console.log(`   erro: ${parsed.erro || '(nenhum)'}`);
    console.log(`   explicacao: ${parsed.explicacao || '(nenhuma)'}`);

    return parsed;
  } catch (error) {
    console.error('\n❌ ERRO ao processar comando com IA:');
    console.error(`   Mensagem: ${error.message}`);
    if (error.response?.data) {
      console.error('   Detalhes da API:', error.response.data);
    }
    console.error(error.stack);
    
    // Retornar um objeto de erro estruturado ao invés de null
    console.log('\n⚠️ RETORNANDO ERRO ESTRUTURADO:');
    const errorResponse = {
      entendeu: false,
      erro: 'ERROR', 
      explicacao: `Erro ao processar: ${error.message}`,
      confianca: 0
    };
    console.log(JSON.stringify(errorResponse, null, 2));
    return errorResponse;
  }
}

/**
 * Executa uma ação interpretada pela IA
 * @param {object} parsed - Objeto retornado por parseNaturalCommand
 * @param {string} groupId - ID do grupo
 * @param {object} userData - Dados do usuário
 * @returns {object} Resultado da execução
 */
export async function executeInterpretedCommand(parsed, groupId, userData) {
  if (!parsed || !parsed.entendeu) {
    return {
      sucesso: false,
      mensagem: parsed?.explicacao || 'Não consegui interpretar seu comando. Tente ser mais específico.',
    };
  }

  const { comando, dados, explicacao, confianca } = parsed;

  try {
    // Retornar os dados para o handler processar o comando
    return {
      sucesso: true,
      comando: comando,
      dados: dados,
      explicacao: explicacao,
      confianca: confianca,
      idUsuario: userData.idUsuario,
      data: userData.data,
      vinculo: userData.vinculo,
    };
  } catch (error) {
    console.error('Erro ao executar comando:', error.message);
    return {
      sucesso: false,
      mensagem: `Erro ao processar comando: ${error.message}`,
    };
  }
}

/**
 * Analisa a definição de um comando para detectar UPSERT/INSERT
 * @param {string} commandDescription - Descrição do comando em linguagem natural
 * @returns {object} { upsertBy: [], explicacao: "" }
 */
export async function analyzeCommandDefinition(commandDescription) {
  try {
    console.log('\n🔍 ANALISANDO DEFINIÇÃO DO COMANDO');
    console.log(`   Descrição: "${commandDescription}"`);
    
    const prompt = `Você é um analisador de comandos customizados.

Analise a descrição abaixo e DETERMINE SE É INSERT OU UPSERT:

DESCRIÇÃO:
"${commandDescription}"

REGRAS:
1. Se a descrição menciona "altera", "atualiza", "modifica", "sobrescreve" + menciona QUAIS campos são chave para busca:
   → É UPSERT
   → Identifique os campos que serão a chave (normalmente menciona "se o registro com $campo1 e $campo2 já existir")
   → Extraia apenas os nomes dos campos (sem o $)
   → Retorne: "upsertBy": ["campo1", "campo2"]

2. Se a descrição menciona APENAS inserir/adicionar (sem alteração):
   → É INSERT
   → Retorne: "upsertBy": []

IMPORTANTE:
- Procure por keywords: "ou altera", "ou modifica", "já existir", "se registrado"
- Extraia os nomes dos campos ANTES dessas keywords (ex: "$ano e $mes" → ["ano", "mes"])
- Remova o símbolo $ dos nomes

Retorne APENAS um JSON:
{
  "tipo": "insert | upsert",
  "upsertBy": ["campo1", "campo2"] ou [],
  "explicacao": "Resumo breve do que foi detectado",
  "confianca": 0.95
}`;

    console.log('\n📤 Enviando para ChatGPT...');
    const response = await getOpenAIClient().chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 500,
    });

    const content = response.choices[0].message.content.trim();
    console.log('\n📨 RESPOSTA DO CHATGPT:');
    console.log('═'.repeat(80));
    console.log(content);
    console.log('═'.repeat(80));
    
    // Tentar fazer parse
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn('⚠️ Não consegui extrair JSON');
        return { upsertBy: [], explicacao: 'Não foi possível analisar' };
      }
      parsed = JSON.parse(jsonMatch[0]);
    }

    console.log('\n✅ ANÁLISE CONCLUÍDA:');
    console.log(`   Tipo: ${parsed.tipo}`);
    console.log(`   upsertBy: ${JSON.stringify(parsed.upsertBy)}`);
    console.log(`   Explicação: ${parsed.explicacao}`);

    return {
      upsertBy: parsed.upsertBy || [],
      explicacao: parsed.explicacao
    };
  } catch (error) {
    console.error('❌ Erro ao analisar definição do comando:', error.message);
    return { upsertBy: [], explicacao: 'Erro ao analisar' };
  }
}

export default {
  parseNaturalCommand,
  executeInterpretedCommand,
  analyzeCommandDefinition,
};
