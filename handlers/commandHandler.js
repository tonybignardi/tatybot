import GroupAdmin from '../models/GroupAdmin.js';
import CommandLog from '../models/CommandLog.js';

import CustomCommand from '../models/CustomCommand.js';
import CommandData from '../models/CommandData.js';
import UserName from '../models/UserName.js';
import { parseNaturalCommand, executeInterpretedCommand, analyzeCommandDefinition } from '../services/naturalLanguageProcessor.js';

class CommandHandler {
  static async handleCommand(msg, command, groupId, groupName) {
    const userId = msg.author;
    const userName = msg._data?.notifyName || msg.author;
    const messageBody = msg.body.trim();
    
    // Capturar idUsuarioRespondido e nomeUsuarioRespondido se a mensagem é uma resposta
    let idUsuarioRespondido = null;
    let nomeUsuarioRespondido = null;
    if (msg._data?.quotedParticipant) {
      idUsuarioRespondido = msg._data.quotedParticipant;
      // Tentar pegar o nome da mensagem citada
      nomeUsuarioRespondido = msg._data.quotedMsg?.notifyName || idUsuarioRespondido;
      console.log(`\n   ✅ Mensagem citada detectada!`);
      console.log(`   respondendo para: ${idUsuarioRespondido}`);
      console.log(`   nome do respondido: ${nomeUsuarioRespondido}`);
    } else {
      console.log(`\n   ℹ️ Nenhuma mensagem citada (usuario_respondido será null)`);
    }
    
    const logData = {
      groupId,
      groupName,
      userId,
      userName,
      command,
      message: msg.body,
      idUsuarioRespondido,
    };

    try {
      switch (command) {
        case '#admin':
          return await this.handleAdminCommand(msg, groupId, groupName, userId, userName, logData, idUsuarioRespondido, nomeUsuarioRespondido);

        case '#renunciar':
          return await this.handleResignCommand(msg, groupId, groupName, userId, userName, logData);

        case '#cmd':
          return await this.handleCustomCommand(msg, groupId, groupName, userId, userName, logData, false);

        case '#cmda':
          return await this.handleCustomCommand(msg, groupId, groupName, userId, userName, logData, true);

        case '#nome':
          return await this.handleNomeCommand(msg, groupId, groupName, userId, userName, messageBody, logData, idUsuarioRespondido, nomeUsuarioRespondido);

        default:
          // Verifica se é um comando customizado
          const customCmd = await CustomCommand.findOne({ groupId, commandName: command });
          if (customCmd) {
            // É um comando customizado - enviar para ChatGPT analisar
            console.log(`\n🤖 Comando customizado detectado: ${command}`);
            console.log(`   adminOnly: ${customCmd.adminOnly}`);
            console.log(`   Enviando para ChatGPT analisar...`);
            
            // Verificar se usuário é admin
            const groupAdmin = await GroupAdmin.findOne({ groupId });
            const isAdmin = groupAdmin && groupAdmin.admins.some((admin) => admin.userId === userId);
            console.log(`   isAdmin: ${isAdmin}`);
            console.log(`   idUsuarioRespondido: ${idUsuarioRespondido}`);
            console.log(`   nomeUsuarioRespondido: ${nomeUsuarioRespondido}`);
            
            // ⛔ BLOQUEAR ACESSO A COMANDOS ADMIN-ONLY
            if (customCmd.adminOnly && !isAdmin) {
              console.log(`\n⛔ ACESSO NEGADO: Comando ${command} é admin-only e ${userName} não é admin`);
              logData.status = 'error';
              logData.response = `${userName} tentou acessar comando admin-only ${command}`;
              await this.logCommand(logData);
              return `⛔ O comando ${command} é exclusivo para administradores do grupo!`;
            }
            
            return await this.handleNaturalLanguageCommand(msg, groupId, groupName, userId, userName, msg.body.trim(), logData, isAdmin, idUsuarioRespondido, nomeUsuarioRespondido);
          }

          await this.logCommand({ ...logData, status: 'unknown', response: 'Comando desconhecido' });
          return 'Comando desconhecido ❌';
      }
    } catch (error) {
      console.error(`Erro ao processar comando ${command}:`, error.message);
      await this.logCommand({ ...logData, status: 'error', response: error.message });
      return 'Erro ao processar comando 😔';
    }
  }

  static async handleAdminCommand(msg, groupId, groupName, userId, userName, logData, idUsuarioRespondido = null, nomeUsuarioRespondido = null) {
    let groupAdmin = await GroupAdmin.findOne({ groupId });

    // Se não existe registro do grupo, cria um novo
    if (!groupAdmin) {
      groupAdmin = new GroupAdmin({
        groupId,
        groupName,
        admins: [
          {
            userId,
            userName,
            phoneNumber: msg.author,
            assignedBy: 'sistema',
          },
        ],
        totalAdmins: 1,
      });

      await groupAdmin.save();
      logData.status = 'success';
      logData.response = `${userName} se tornou o primeiro admin do grupo 👑`;
      await this.logCommand(logData);
      return `✅ ${userName}, você é agora o admin deste grupo! 👑`;
    }

    // Se respondeu a alguém com #admin
    if (idUsuarioRespondido) {
      // Verifica se quem está respondendo é admin
      if (!groupAdmin.admins.some((admin) => admin.userId === userId)) {
        logData.status = 'error';
        logData.response = `${userName} tentou designar admin mas não é admin`;
        await this.logCommand(logData);
        return `⚠️ Apenas admins podem designar novos admins!`;
      }

      // Verifica se o designado já é admin
      if (groupAdmin.admins.some((admin) => admin.userId === idUsuarioRespondido)) {
        logData.status = 'error';
        logData.response = `Admin tentou designar ${nomeUsuarioRespondido} mas ele já é admin`;
        await this.logCommand(logData);
        return `ℹ️ @${nomeUsuarioRespondido} já é um admin deste grupo!`;
      }

      // Designa novo admin
      groupAdmin.admins.push({
        userId: idUsuarioRespondido,
        userName: nomeUsuarioRespondido,
        phoneNumber: idUsuarioRespondido,
        assignedBy: userId,
      });
      groupAdmin.totalAdmins += 1;
      await groupAdmin.save();

      logData.status = 'success';
      logData.response = `${userName} designou ${nomeUsuarioRespondido} como novo admin`;
      await this.logCommand(logData);
      return `✅ @${nomeUsuarioRespondido} agora é um admin deste grupo! 👑\n(Designado por @${userName})`;
    }

    // Se é admin tentando usar #admin sozinho
    if (groupAdmin.admins.some((admin) => admin.userId === userId)) {
      logData.status = 'error';
      logData.response = `${userName} é admin mas tentou usar #admin sem responder ninguém`;
      await this.logCommand(logData);
      return `ℹ️ @${userName} você já é um admin!\n\nPara designar outro admin, responda a mensagem dessa pessoa com #admin`;
    }

    // Se não é admin e não respondeu a ninguém
    logData.status = 'error';
    logData.response = `${userName} tentou usar #admin sem permissão`;
    await this.logCommand(logData);
    return `⚠️ Este grupo já tem admin(s)!\n\nAdmins atuais:\n${groupAdmin.admins.map((a) => `• ${a.userName}`).join('\n')}`;
  }

  static async handleResignCommand(msg, groupId, groupName, userId, userName, logData) {
    const groupAdmin = await GroupAdmin.findOne({ groupId });

    if (!groupAdmin || !groupAdmin.admins.some((admin) => admin.userId === userId)) {
      logData.status = 'error';
      logData.response = `${userName} tentou renunciar mas não é admin`;
      await this.logCommand(logData);
      return `⚠️ Você não é um admin deste grupo!`;
    }

    // Remove o admin
    groupAdmin.admins = groupAdmin.admins.filter((admin) => admin.userId !== userId);
    groupAdmin.totalAdmins -= 1;
    await groupAdmin.save();

    logData.status = 'success';
    logData.response = `${userName} renunciou ao cargo de admin`;
    await this.logCommand(logData);
    return `✅ @${userName} saiu do cargo de admin!\n\nAdmins restantes: ${groupAdmin.totalAdmins > 0 ? groupAdmin.admins.map((a) => `@${a.userName}`).join(', ') : 'Nenhum admin no momento'}`;
  }

  static async handleNomeCommand(msg, groupId, groupName, userId, userName, messageBody, logData, idUsuarioRespondido = null, nomeUsuarioRespondido = null) {
    // Extrair o novo nome da mensagem: #nome NONONOVO
    const nomeMatch = messageBody.match(/^#nome\s+(.*)/i);
    const nomeNovo = nomeMatch ? nomeMatch[1].trim() : '';

    // Se houver resposta, usar o ID e nome respondido
    const userIdTarget = idUsuarioRespondido || userId;
    const userNameTarget = nomeUsuarioRespondido || userName;
    
    console.log(`\n👤 handleNomeCommand:`);
    console.log(`   userId executor: ${userId}`);
    console.log(`   idUsuarioRespondido: ${idUsuarioRespondido}`);
    console.log(`   userIdTarget: ${userIdTarget}`);
    console.log(`   userNameTarget: ${userNameTarget}`);
    console.log(`   nomeNovo: ${nomeNovo || '(vazio)'}`);

    if (!nomeNovo) {
      // Se não houver nome, mostrar nome atual
      const userNameRecord = await UserName.findOne({ userId: userIdTarget });
      const nomeAtual = userNameRecord ? userNameRecord.nomePersonalizado : userNameTarget;
      
      logData.status = 'success';
      logData.response = `Mostrando nome de ${userNameTarget}`;
      await this.logCommand(logData);
      return `👤 Nome registrado: ${nomeAtual}`;
    }

    // Validar comprimento do nome
    if (nomeNovo.length > 50) {
      logData.status = 'error';
      logData.response = `Tentou definir nome muito longo (>50 chars)`;
      await this.logCommand(logData);
      return `⚠️ O nome não pode ter mais de 50 caracteres!`;
    }

    // Salvar ou atualizar nome
    let userNameRecord = await UserName.findOne({ userId: userIdTarget });
    
    if (!userNameRecord) {
      userNameRecord = new UserName({
        userId: userIdTarget,
        nomePersonalizado: nomeNovo,
        nomeOriginal: userNameTarget,
      });
    } else {
      userNameRecord.nomePersonalizado = nomeNovo;
    }

    await userNameRecord.save();

    logData.status = 'success';
    logData.response = `Nome definido para ${userNameTarget}: ${nomeNovo}`;
    await this.logCommand(logData);
    
    const mensagem = idUsuarioRespondido 
      ? `✅ Nome de ${userNameTarget} foi alterado para: ${nomeNovo} 👤`
      : `✅ Pronto! Seu nome foi definido como: ${nomeNovo}\n\nAgora você aparecerá assim em todos os comandos! 👤`;
    
    return mensagem;
  }

  static async handleConfigCounterPlus(msg, groupId, groupName, userId, userName, messageBody, logData) {
    // Validar se é admin
    const groupAdmin = await GroupAdmin.findOne({ groupId });
    
    if (!groupAdmin || !groupAdmin.admins.some((admin) => admin.userId === userId)) {
      logData.status = 'error';
      logData.response = `${userName} tentou configurar contador + mas não é admin`;
      await this.logCommand(logData);
      return `⛔ Apenas administradores podem configurar contadores!`;
    }

    // Parse: #cmda #conf+ {limite} {comando}
    const match = messageBody.match(/^#cmda\s+#conf\+\s+(\d+)\s+(#\w+)(?:\s+(.*))?/i);
    
    if (!match) {
      return `❌ Formato inválido!\n\nUse: #cmda #conf+ {limite} {comando}\n\nExemplo: #cmda #conf+ 5 #ok\n\nIsso significa: Quando + chegar a 5 curtidas, execute #ok`;
    }

    const limite = parseInt(match[1]);
    const comando = match[2].toLowerCase();
    const descricao = match[3] || '';

    console.log(`\n⚙️ Configurando contador +:`);
    console.log(`   Limite: ${limite}`);
    console.log(`   Comando: ${comando}`);

    // Atualizar no banco
    if (!groupAdmin.counterConfigPlus) {
      groupAdmin.counterConfigPlus = {};
    }
    groupAdmin.counterConfigPlus.limite = limite;
    groupAdmin.counterConfigPlus.comando = comando;

    await groupAdmin.save();

    logData.status = 'success';
    logData.response = `Configurado contador + para limite ${limite} e comando ${comando}`;
    await this.logCommand(logData);

    return `✅ Configuração do contador + atualizada!\n\n👍 Limite: ${limite}\n🎯 Comando: ${comando}\n\nQuando uma mensagem com + atingir ${limite} curtidas, ${comando} será executado!`;
  }

  static async handleConfigCounterMinus(msg, groupId, groupName, userId, userName, messageBody, logData) {
    // Validar se é admin
    const groupAdmin = await GroupAdmin.findOne({ groupId });
    
    if (!groupAdmin || !groupAdmin.admins.some((admin) => admin.userId === userId)) {
      logData.status = 'error';
      logData.response = `${userName} tentou configurar contador - mas não é admin`;
      await this.logCommand(logData);
      return `⛔ Apenas administradores podem configurar contadores!`;
    }

    // Parse: #cmda #conf- {limite} {comando}
    const match = messageBody.match(/^#cmda\s+#conf-\s+(\d+)\s+(#\w+)(?:\s+(.*))?/i);
    
    if (!match) {
      return `❌ Formato inválido!\n\nUse: #cmda #conf- {limite} {comando}\n\nExemplo: #cmda #conf- 3 #notok\n\nIsso significa: Quando - chegar a 3 curtidas, execute #notok`;
    }

    const limite = parseInt(match[1]);
    const comando = match[2].toLowerCase();
    const descricao = match[3] || '';

    console.log(`\n⚙️ Configurando contador -:`);
    console.log(`   Limite: ${limite}`);
    console.log(`   Comando: ${comando}`);

    // Atualizar no banco
    if (!groupAdmin.counterConfigMinus) {
      groupAdmin.counterConfigMinus = {};
    }
    groupAdmin.counterConfigMinus.limite = limite;
    groupAdmin.counterConfigMinus.comando = comando;

    await groupAdmin.save();

    logData.status = 'success';
    logData.response = `Configurado contador - para limite ${limite} e comando ${comando}`;
    await this.logCommand(logData);

    return `✅ Configuração do contador - atualizada!\n\n👎 Limite: ${limite}\n🎯 Comando: ${comando}\n\nQuando uma mensagem com - atingir ${limite} curtidas, ${comando} será executado!`;
  }

  static async handleCustomCommand(msg, groupId, groupName, userId, userName, logData, adminOnly = false) {
    // Extrair nome do comando e dados
    const commandPattern = adminOnly ? /^#cmda\s+(#\w+)(?:\s+(.*))?/i : /^#cmd\s+(#\w+)(?:\s+(.*))?/i;
    const commandMatch = msg.body.match(commandPattern);
    
    // Se não houver argumento, listar todos
    if (!commandMatch) {
      const cmdType = adminOnly ? '#cmda' : '#cmd';
      const allCommands = await CustomCommand.find({ groupId });
      const filteredCommands = adminOnly 
        ? allCommands.filter(c => c.adminOnly)
        : allCommands.filter(c => !c.adminOnly);
      
      if (filteredCommands.length === 0) {
        logData.status = 'success';
        logData.response = `Listando comandos (lista vazia)`;
        await this.logCommand(logData);
        const typeLabel = adminOnly ? 'admin' : 'todos';
        return `📋 Comandos para ${typeLabel}:\n\n(Nenhum comando criado ainda)\n\nAdmins podem criar com: ${cmdType} #nome [descrição]`;
      }

      const commandsList = filteredCommands
        .map((cmd, idx) => `${idx + 1}. ${cmd.commandName}\n   ${cmd.data}\n   Contexto: ${cmd.contexto || 'geral'}`)
        .join('\n\n');

      logData.status = 'success';
      logData.response = `Listando comandos (${filteredCommands.length} encontrados)`;
      await this.logCommand(logData);
      const typeLabel = adminOnly ? 'admin' : 'para todos';
      return `📋 Comandos ${typeLabel} (${filteredCommands.length}):\n\n${commandsList}`;
    }

    // Verificar se o usuário é admin para criar/editar comandos
    const groupAdmin = await GroupAdmin.findOne({ groupId });
    
    if (!groupAdmin || !groupAdmin.admins.some((admin) => admin.userId === userId)) {
      logData.status = 'error';
      logData.response = `${userName} tentou criar/editar comando mas não é admin`;
      await this.logCommand(logData);
      const cmdType = adminOnly ? '#cmda' : '#cmd';
      return `⛔ Apenas administradores do grupo podem criar/editar comandos!\n\nDigite: ${cmdType} #nome [dados]\nExemplo: ${cmdType} #horario Nosso horário é 9h-18h`;
    }

    const commandName = commandMatch[1].toLowerCase(); // #nome
    const data = commandMatch[2] ? commandMatch[2].trim() : '';

    // TRATAMENTO ESPECIAL PARA #conf+ E #conf-
    if (adminOnly && (commandName === '#conf+' || commandName === '#conf-')) {
      if (commandName === '#conf+') {
        if (!data) {
          // Mostrar configuração atual de +
          if (!groupAdmin.counterConfigPlus || !groupAdmin.counterConfigPlus.limite) {
            logData.status = 'success';
            logData.response = `Mostrando config de contador +`;
            await this.logCommand(logData);
            return `📊 Configuração do contador +:\n\n(não configurado)\n\nUse: #cmda #conf+ {limite} {comando}\nExemplo: #cmda #conf+ 5 #ok`;
          }
          logData.status = 'success';
          logData.response = `Mostrando config de contador +`;
          await this.logCommand(logData);
          return `📊 Configuração do contador +:\n\n👍 Limite: ${groupAdmin.counterConfigPlus.limite}\n🎯 Comando: ${groupAdmin.counterConfigPlus.comando}\n\nPara alterar, use: #cmda #conf+ {novo_limite} {novo_comando}`;
        }
        // Editar configuração
        return await this.handleConfigCounterPlus(msg, groupId, groupName, userId, userName, msg.body, logData);
      } else if (commandName === '#conf-') {
        if (!data) {
          // Mostrar configuração atual de -
          if (!groupAdmin.counterConfigMinus || !groupAdmin.counterConfigMinus.limite) {
            logData.status = 'success';
            logData.response = `Mostrando config de contador -`;
            await this.logCommand(logData);
            return `📊 Configuração do contador -:\n\n(não configurado)\n\nUse: #cmda #conf- {limite} {comando}\nExemplo: #cmda #conf- 3 #notok`;
          }
          logData.status = 'success';
          logData.response = `Mostrando config de contador -`;
          await this.logCommand(logData);
          return `📊 Configuração do contador -:\n\n👎 Limite: ${groupAdmin.counterConfigMinus.limite}\n🎯 Comando: ${groupAdmin.counterConfigMinus.comando}\n\nPara alterar, use: #cmda #conf- {novo_limite} {novo_comando}`;
        }
        // Editar configuração
        return await this.handleConfigCounterMinus(msg, groupId, groupName, userId, userName, msg.body, logData);
      }
    }

    if (!data) {
      // Se não houver dados, mostra o comando
      const customCmd = await CustomCommand.findOne({ groupId, commandName });
      
      if (!customCmd || !customCmd.data) {
        logData.status = 'success';
        logData.response = `Mostrando comando ${commandName} (vazio)`;
        await this.logCommand(logData);
        const cmdType = adminOnly ? '#cmda' : '#cmd';
        return `📝 Comando ${commandName}:\n\n(não configurado)\n\nUse: ${cmdType} ${commandName} [dados]`;
      }

      logData.status = 'success';
      logData.response = `Mostrando comando ${commandName}`;
      await this.logCommand(logData);
      return `📝 Comando ${commandName}:\n\n${customCmd.data}`;
    }

    // Salvar ou atualizar comando
    let customCmd = await CustomCommand.findOne({ groupId, commandName });
    
    // Analisar a instrução do comando
    const analise = await this.analisarRequerimentoUsuarioRespondido(data);
    const { requerUsuarioRespondido, tipoComando, camposSalvados, validacao } = analise;
    
    // 🤖 NOVO: Chamar ChatGPT para analisar a definição e detectar UPSERT
    console.log(`\n🤖 Chamando ChatGPT para analisar definição do comando...`);
    const analiseDefinicao = await analyzeCommandDefinition(data);
    const { upsertBy } = analiseDefinicao;
    console.log(`✅ ChatGPT análise: upsertBy = ${JSON.stringify(upsertBy)}`);
    
    // Normalizar tipoComando para insert/list/delete (minúscula)
    const tipoNormalizado = (tipoComando || 'insert').toLowerCase().replace('ção', '').replace('gem', '');
    const tipoFinal = tipoNormalizado.includes('list') ? 'list' : (tipoNormalizado.includes('del') ? 'delete' : 'insert');
    
    // Validar comando de inserção
    if (tipoComando === 'inserção' && validacao === 'avisoInsercaoSemCampos') {
      logData.status = 'error';
      logData.response = `Erro ao criar comando: inserção sem campos marcados`;
      await this.logCommand(logData);
      return `⚠️ Comando de INSERÇÃO detectado, mas SEM CAMPOS marcados com $!\n\nExemplo correto:\n"Insira o mês ($mes) e ano ($ano) da sua meta";\n\nReescreva o comando marcando os campos com $.`;
    }
    
    if (!customCmd) {
      customCmd = new CustomCommand({
        groupId,
        commandName,
        data,
        adminOnly,
        tipoComando: tipoFinal,
        requerUsuarioRespondido,
        camposSalvados: camposSalvados || [],
        upsertBy: upsertBy || [],
        createdBy: userId,
        updatedBy: userId,
      });
    } else {
      customCmd.data = data;
      customCmd.adminOnly = adminOnly;
      customCmd.tipoComando = tipoFinal;
      customCmd.requerUsuarioRespondido = requerUsuarioRespondido;
      customCmd.camposSalvados = camposSalvados || [];
      customCmd.upsertBy = upsertBy || [];
      customCmd.updatedBy = userId;
    }

    await customCmd.save();

    logData.status = 'success';
    logData.response = `Comando ${commandName} criado/atualizado por ${userName}`;
    await this.logCommand(logData);
    
    // Montar mensagem de confirmação
    let tipoRequisito = requerUsuarioRespondido ? '(requer usuário respondido)' : '(usa próprio usuário)';
    let camposInfo = camposSalvados && camposSalvados.length > 0 
      ? `\n📦 Campos salvos: ${camposSalvados.map(c => `$${c}`).join(', ')}`
      : '';
    let upsertInfo = upsertBy && upsertBy.length > 0
      ? `\n🔄 UPSERT por: ${upsertBy.join(', ')}`
      : '';
    
    return `✅ Comando ${commandName} salvo! ${tipoRequisito}${camposInfo}${upsertInfo}\n\n📝 ${data}`;
  }

  static async executeCustomCommand(msg, command, groupId, groupName, userId, userName, messageBody, logData) {
    // Extrair dados após o comando
    // Exemplo: "#add dados aqui" -> dados = "dados aqui"
    const dataMatch = messageBody.match(/^#\w+\s*(.*)/);
    const dados = dataMatch ? dataMatch[1].trim() : '';

    // Buscar comando no banco
    const customCmd = await CustomCommand.findOne({ groupId, commandName: command });

    if (!customCmd) {
      logData.status = 'error';
      logData.response = `Comando ${command} não encontrado`;
      await this.logCommand(logData);
      return `❌ Comando ${command} não foi configurado ainda.\n\nPeça ao admin para criar com: #comando ${command} [instruções]`;
    }

    // Se não houver dados, exibe o que o comando faz
    if (!dados) {
      logData.status = 'success';
      logData.response = `Exibindo instrução do comando ${command}`;
      await this.logCommand(logData);
      return `📝 O comando ${command} faz:\n\n${customCmd.data}`;
    }

    // Se houver dados, executa o comando e salva na tabela
    try {
      // Preparar dados - se houver múltiplos valores, salvar como objeto
      let valorParaSalvar = dados;
      
      // Detectar múltiplos valores: números separados por espaço, vírgula, ou ponto-vírgula
      const multiplosValoresMatch = dados.match(/(\d+(?:[.,]\d+)?)/g);
      
      if (multiplosValoresMatch && multiplosValoresMatch.length > 1) {
        // Múltiplos valores encontrados - salvar como objeto com array
        console.log(`✅ Detectados ${multiplosValoresMatch.length} valores para ${command}`);
        valorParaSalvar = {
          tipo: 'multiplo',
          valores: multiplosValoresMatch.map(v => v.replace(',', '.')),
          original: dados
        };
      }

      // Determinar o ID do usuário a salvar: se comando requer resposta, usar idUsuarioRespondido
      let idUsuarioRespondido = null;
      if (msg._data?.quotedParticipant) {
        idUsuarioRespondido = msg._data.quotedParticipant;
      }
      
      const userIdToSave = customCmd.requerUsuarioRespondido && idUsuarioRespondido 
        ? idUsuarioRespondido 
        : userId;
      const userNameToSave = customCmd.requerUsuarioRespondido && idUsuarioRespondido 
        ? `[respondendo: ${userName}]`
        : userName;

      console.log(`💾 Salvando CommandData:`);
      console.log(`   requerUsuarioRespondido: ${customCmd.requerUsuarioRespondido}`);
      console.log(`   idUsuarioRespondido disponível: ${!!idUsuarioRespondido}`);
      console.log(`   userId executor: ${userId}`);
      console.log(`   userIdToSave: ${userIdToSave} ${customCmd.requerUsuarioRespondido ? '(respondido)' : '(próprio)'}`);
      console.log(`   upsertBy: ${JSON.stringify(customCmd.upsertBy)}`);

      // ✅ NOVO: Verificar se é UPSERT ou INSERT
      if (customCmd.upsertBy && customCmd.upsertBy.length > 0) {
        // UPSERT: Construir filtro com base nos campos especificados
        console.log(`\n🔄 UPSERT MODE ATIVADO`);
        
        const filtro = {
          groupId,
          commandName: command,
          userId: userIdToSave
        };
        
        // Adicionar campos do upsertBy ao filtro (ex: mes, ano)
        // Se valorParaSalvar for objeto com as chaves (dados estruturado)
        if (typeof valorParaSalvar === 'object' && valorParaSalvar.tipo !== 'multiplo') {
          // Dados estruturado: adicionar valores específicos ao filtro
          for (const field of customCmd.upsertBy) {
            if (valorParaSalvar[field]) {
              filtro[`dados.${field}`] = valorParaSalvar[field];
              console.log(`   Filtro adicional: dados.${field} = ${valorParaSalvar[field]}`);
            }
          }
        }
        
        console.log(`   Filtro final: ${JSON.stringify(filtro)}`);
        
        // Executar UPSERT
        const resultado = await CommandData.findOneAndUpdate(
          filtro,
          {
            $set: {
              groupId,
              groupName,
              commandName: command,
              userId: userIdToSave,
              userName: userNameToSave,
              dados: valorParaSalvar,
              contexto: customCmd.contexto,
              updatedAt: new Date(),
            },
            $setOnInsert: {
              vinculo: { tipo: null, id: null },
              createdAt: new Date(),
            }
          },
          { upsert: true, new: true }
        );
        
        console.log(`   ✅ UPSERT executado - ${resultado ? 'atualizado' : 'criado novo'}`);
      } else {
        // INSERT: Sempre criar novo registro (comportamento anterior)
        console.log(`\n➕ INSERT MODE ATIVADO`);
        
        const commandData = new CommandData({
          groupId,
          groupName,
          commandName: command,
          userId: userIdToSave,
          userName: userNameToSave,
          dados: valorParaSalvar,
          contexto: customCmd.contexto,
          vinculo: {
            tipo: null,
            id: null,
          },
        });

        await commandData.save();
        console.log(`   ✅ INSERT executado`);
      }

      logData.status = 'success';
      logData.response = `Executado comando ${command} com dados: ${dados}`;
      await this.logCommand(logData);
      
      return `✅ Comando ${command} executado!\n\n📋 Instruções:\n${customCmd.data}\n\n💾 Dados armazenados:\n${dados}\n\n📊 Contexto: ${customCmd.contexto}`;
    } catch (error) {
      console.error('Erro ao salvar dados do comando:', error.message);
      logData.status = 'error';
      logData.response = `Erro ao salvar dados: ${error.message}`;
      await this.logCommand(logData);
      return `❌ Erro ao armazenar dados. Tente novamente.`;
    }
  }

  static async handleNaturalLanguageCommand(msg, groupId, groupName, userId, userName, messageBody, logData, isAdmin, idUsuarioRespondido, nomeUsuarioRespondido) {
    try {
      console.log('\n🔵 INICIANDO handleNaturalLanguageCommand');
      console.log(`   mensagem: ${messageBody}`);
      console.log(`   groupId: ${groupId}`);
      console.log(`   👤 idUsuarioRespondido DETECTADO: ${idUsuarioRespondido ? `✅ ${idUsuarioRespondido}` : '❌ (null/undefined)'}`);
      console.log(`   👤 nomeUsuarioRespondido: ${nomeUsuarioRespondido || '(vazio)'}`);
      
      // Preparar dados do usuário para a IA
      const userData = {
        idUsuario: userId,
        userName: userName,
        isAdmin: isAdmin,
        dados: messageBody,
        data: new Date().toISOString(),
        vinculo: null,
        nomeUsuarioRespondido: nomeUsuarioRespondido || null,  // Adicionar para uso posterior
      };

      // Processar comando com IA
      console.log('\n📡 Chamando parseNaturalCommand...');
      const parsed = await parseNaturalCommand(messageBody, groupId, userData);

      console.log('\n📝 Resposta de parseNaturalCommand:');
      console.log(`   parsed é null? ${parsed === null}`);
      console.log(`   parsed é undefined? ${parsed === undefined}`);
      if (parsed) {
        console.log(`   parsed.entendeu: ${parsed.entendeu}`);
        console.log(`   parsed.erro: ${parsed.erro}`);
        console.log(`   parsed.explicacao: ${parsed.explicacao}`);
        console.log(`   JSON completo: ${JSON.stringify(parsed, null, 2)}`);
      }

      // PRIMEIRO: Verificar se houve erro (ex: DENY para falta de permissão)
      // Isso precisa estar ANTES de checar entendeu, pois DENY também tem entendeu: false
      if (parsed && parsed.erro) {
        logData.status = 'error';
        
        if (parsed.erro === 'DENY') {
          console.log('\n⛔ ERRO DENY DETECTADO:');
          console.log(`   Explicação: ${parsed.explicacao}`);
          console.log(`   Confiança: ${parsed.confianca}`);
          const mensagem = `⛔ ${parsed.explicacao || 'Acesso negado'}`;
          console.log(`   ✅ RETORNANDO PARA USUÁRIO: ${mensagem}`);
          logData.response = mensagem;
          await this.logCommand(logData);
          return mensagem;
        }
        
        if (parsed.erro === 'NOT_FOUND') {
          console.log('\n❌ ERRO NOT_FOUND DETECTADO:');
          console.log(`   Explicação: ${parsed.explicacao}`);
          console.log(`   Confiança: ${parsed.confianca}`);
          const mensagem = `❌ ${parsed.explicacao || 'Comando não encontrado'}`;
          logData.response = mensagem;
          await this.logCommand(logData);
          return mensagem;
        }
        
        console.log(`\n❌ ERRO GENÉRICO DETECTADO: ${parsed.erro}`);
        console.log(`   Explicação: ${parsed.explicacao}`);
        const mensagem = `❌ ${parsed.explicacao || `Erro: ${parsed.erro}`}`;
        logData.response = mensagem;
        await this.logCommand(logData);
        return mensagem;
      }

      // DEPOIS: Verificar se não entendeu o comando
      if (!parsed || !parsed.entendeu) {
        console.log('\n⚠️ BLOCO: entendeu === false');
        console.log(`   parsed existe? ${!!parsed}`);
        if (parsed) {
          console.log(`   entendeu: ${parsed.entendeu}`);
          console.log(`   explicacao: ${parsed.explicacao}`);
          console.log(`   erro: ${parsed.erro}`);
          console.log(`   confianca: ${parsed.confianca}`);
        }
        
        // Montar a mensagem para o usuário com a explicação
        let mensagemErro = '❌ ';
        console.log('\n   🔍 BUSCANDO EXPLICACAO:');
        if (parsed?.explicacao) {
          console.log(`      ✅ Usando parsed.explicacao: "${parsed.explicacao}"`);
          mensagemErro += parsed.explicacao;
        } else if (parsed?.erro) {
          console.log(`      ✅ Usando parsed.erro: "${parsed.erro}"`);
          mensagemErro += `Erro: ${parsed.erro}`;
        } else {
          console.log(`      ❌ Nenhum campo encontrado, usando mensagem genérica`);
          mensagemErro += 'Não consegui interpretar seu comando. Tente ser mais específico.';
        }
        
        console.log(`\n   ✅ MENSAGEM FINAL PARA USUÁRIO: "${mensagemErro}"`);
        logData.status = 'error';
        logData.response = mensagemErro;
        await this.logCommand(logData);
        return mensagemErro;
      }

      // ✅ NOVO: VALIDAR requerUsuarioRespondido ANTES de processar (baseado no MongoDB)
      // Mas APENAS para INSERT/DELETE, não para LIST (que é apenas leitura)
      const acao = parsed.acao || 'inserir';
      
      if (parsed.comando && (acao === 'inserir' || acao === 'deletar')) {
        const customCmd = await CustomCommand.findOne({ groupId, commandName: parsed.comando });
        if (customCmd && customCmd.requerUsuarioRespondido) {
          console.log(`\n🔍 Validando requerUsuarioRespondido para comando ${parsed.comando} (ação: ${acao}):`);
          console.log(`   requerUsuarioRespondido: ${customCmd.requerUsuarioRespondido}`);
          console.log(`   idUsuarioRespondido: ${idUsuarioRespondido}`);
          
          // Se o comando exige resposta mas usuário não respondeu a ninguém, rejeitar
          if (!idUsuarioRespondido) {
            console.log(`   ❌ REJEITADO: Comando exige resposta mas usuario_respondido é null`);
            const mensagem = `❌ Este comando exige que você responda a uma mensagem de alguém no grupo! Responda e tente novamente.`;
            logData.status = 'error';
            logData.response = mensagem;
            await this.logCommand(logData);
            return mensagem;
          }
          
          // ✅ SE TEM RESPOSTA: Trocar userData.idUsuario e userData.userName para o do usuário respondido
          console.log(`   ✅ VALIDADO: Usuário respondeu. Trocando idUsuario e userName para o respondido`);
          console.log(`      idUsuario (executor): ${userData.idUsuario}`);
          console.log(`      idUsuario (respondido): ${idUsuarioRespondido}`);
          console.log(`      userName (executor): ${userData.userName}`);
          console.log(`      userName (respondido): ${userData.nomeUsuarioRespondido}`);
          userData.idUsuario = idUsuarioRespondido;  // Trocar para ID do respondido
          userData.userName = userData.nomeUsuarioRespondido || `User_${idUsuarioRespondido.substring(0, 8)}`;  // Nome respondido ou fallback
        }
      } else {
        console.log(`\n📊 Ação é LIST - Nenhuma validação de resposta necessária`);
      }
      
      // Verificar o tipo de ação que ChatGPT quer executar
      // const acao = parsed.acao || 'inserir';  // Já definido acima
      
      // Se é uma LISTAGEM/CONSULTA com queryMongoDB, executar a query
      if (acao === 'listar' && parsed.queryMongoDB) {
        console.log('📊 Ação LISTAR com QueryMongoDB detectada');
        console.log(`   Query (antes de substituir): `, JSON.stringify(parsed.queryMongoDB, null, 2));
        
        // ✅ NOVO: Substituir placeholders na query (ex: ${groupId})
        const queryFinal = JSON.parse(
          JSON.stringify(parsed.queryMongoDB).replace(/\$\{groupId\}/g, groupId)
        );
        
        console.log(`   Query (depois de substituir): `, JSON.stringify(queryFinal, null, 2));
        console.log(`   Processamento: ${parsed.processamento}`);
        
        try {
          // Executar a aggregation pipeline com query final substituída
          const resultados = await CommandData.aggregate(queryFinal);
          console.log(`   Resultados encontrados: ${resultados.length}`);
          resultados.forEach((r, idx) => {
            console.log(`      [${idx + 1}] ${JSON.stringify(r)}`);
          });
          
          let mensagemFinal = '';
          
          if (resultados.length === 0) {
            mensagemFinal = '📭 Nenhum dado encontrado para este comando.';
          } else {
            // NOVO: Usar templates se fornecido pelo ChatGPT
            if (parsed.template && parsed.template.repeticoes) {
              console.log('🎨 Usando templates de formatação (repeticoes + cabecalho e rodape opcionais)');
              
              const { cabecalho, repeticoes, rodape } = parsed.template;
              let linhas = [];
              
              // Adicionar cabecalho (uma vez) - OPCIONAL
              if (cabecalho && cabecalho.trim()) {
                console.log(`   ✅ Template cabecalho: ${cabecalho.substring(0, 50)}...`);
                linhas.push(cabecalho);
              } else if (!cabecalho) {
                console.log('   ⏭️  Sem cabecalho');
              }
              
              // Processar cada resultado com o template repeticoes
              let somador = 0;  // Soma total dos "total"
              let contador = resultados.length;  // Quantidade de linhas
              console.log(`\n   Template substitution:`);
              console.log(`      Template repeticoes: ${repeticoes}`);
              console.log(`      Template rodape: ${rodape || '(vazio)'}`);
              
              resultados.forEach((item, idx) => {
                // Preparar dados para substituição no template
                let template = repeticoes;
                let processedItem = { ...item };
                
                console.log(`\n      🔍 [${idx + 1}] ANTES de achatar:`, JSON.stringify(processedItem));
                
                // ✅ NOVO: Achatar _id se for um objeto (vem do $group com múltiplos campos)
                if (processedItem._id && typeof processedItem._id === 'object') {
                  console.log(`         Achatando _id estruturado:`, JSON.stringify(processedItem._id));
                  // Copiar todos os campos de _id para processedItem
                  Object.assign(processedItem, processedItem._id);
                }
                
                // Achatar dados estruturados se _id for string simples
                if (processedItem.dados && typeof processedItem.dados === 'object') {
                  console.log(`         Achatando dados estruturados:`, JSON.stringify(processedItem.dados));
                  // Copiar todos os campos de dados para processedItem
                  Object.assign(processedItem, processedItem.dados);
                }
                
                // Se o resultado veio de um $group com _id STRING, renomear para nome (padrão de rankings simples)
                if (processedItem._id && typeof processedItem._id === 'string' && !processedItem.nome) {
                  processedItem.nome = processedItem._id;
                }
                
                // Se item.total é um número, somar para totalizador
                if (item.total !== undefined) {
                  somador += item.total;
                  console.log(`      [${idx + 1}] total=${item.total} | somador acumulado=${somador}`);
                }
                
                // Converter createdAt para formato legível
                if (item.createdAt) {
                  const date = new Date(item.createdAt);
                  processedItem.data = date.toLocaleDateString('pt-BR');
                  processedItem.hora = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                  processedItem.dataHora = `${processedItem.data} ${processedItem.hora}`;
                }
                
                // Adicionar posição numerada (começa em 1) - SEM cifrão!
                processedItem.ordem = idx + 1;
                
                console.log(`         DEPOIS de achatar:`, JSON.stringify(processedItem));
                console.log(`         Template: ${template}`);
                
                // Substituir placeholders no template
                let linhaFormatada = template;
                for (const [key, value] of Object.entries(processedItem)) {
                  // Substituir tanto {campo} quanto {$campo}
                  const placeholderSem = `{${key}}`;
                  const placeholderCom = `{$${key}}`;
                  const valueStr = String(value);
                  // Usar split/join ao invés de RegExp para evitar problemas com $ em regex
                  linhaFormatada = linhaFormatada.split(placeholderSem).join(valueStr);
                  linhaFormatada = linhaFormatada.split(placeholderCom).join(valueStr);
                }
                
                console.log(`         Resultado: ${linhaFormatada}`);
                linhas.push(linhaFormatada);
              });
              
              // Processar rodape com totalizadores - OPCIONAL
              if (rodape && rodape.trim()) {
                console.log(`   Rodape substitution:`);
                console.log(`      $somador = ${somador}`);
                console.log(`      $contador = ${contador}`);
                let rodapeFormatado = rodape;
                // Substituir totalizadores (usar split/join para evitar problemas com $)
                const somadorStr = String(somador);
                const contadorStr = String(contador);
                rodapeFormatado = rodapeFormatado.split('{somador}').join(somadorStr);
                rodapeFormatado = rodapeFormatado.split('{$somador}').join(somadorStr);
                rodapeFormatado = rodapeFormatado.split('{contador}').join(contadorStr);
                rodapeFormatado = rodapeFormatado.split('{$contador}').join(contadorStr);
                linhas.push(rodapeFormatado);
              } else if (!rodape) {
                console.log('   ⏭️  Sem rodape');
              }
              
              mensagemFinal = linhas.join('\n');
            } else {
              // FALLBACK: Lógica anterior (sem templates)
              console.log('📝 Templates não fornecidos, usando formatação padrão');
              const processamento = parsed.processamento || '';
              
              // Detectar tipo de resultado pela agregação ou pelo comando
              if (processamento.includes('ranking') && resultados[0]._id && resultados[0].total) {
                // Ranking com totais agrupados
                mensagemFinal = `🏆 RANKING\n\n`;
                resultados.forEach((item, idx) => {
                  mensagemFinal += `${idx + 1}. ${item._id}: ${item.total}\n`;
                });
              } else if (resultados[0]._id === null && resultados[0].total) {
                // Resultado único com soma/agregação
                mensagemFinal = `📊 Total: ${resultados[0].total}`;
              } else if ((processamento.includes('listar') || processamento.includes('numerado')) && Array.isArray(resultados)) {
                // Lista de items - pode ser meus dados ou registros pessoais
                mensagemFinal = '';
                resultados.forEach((item, idx) => {
                  if (item.dados !== undefined) {
                    // Item com dados - formatação para meus km ou similares
                    const data = item.createdAt ? new Date(item.createdAt).toLocaleDateString('pt-BR') : '';
                    const hora = item.createdAt ? new Date(item.createdAt).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'}) : '';
                    mensagemFinal += `${idx + 1}. ${data} ${hora ? '- ' + hora : ''} - ${item.dados}km\n`;
                  } else {
                    // Item sem dados específico - mostrar de forma legível
                    mensagemFinal += `${idx + 1}. ${Object.entries(item).map(([k, v]) => `${k}: ${v}`).join(', ')}\n`;
                  }
                });
              } else {
                // Fallback: mostrar de forma legível sem JSON bruto
                mensagemFinal = `📋 RESULTADOS:\n\n`;
                resultados.forEach((item, idx) => {
                  const itemStr = Object.entries(item)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(' | ');
                  mensagemFinal += `${idx + 1}. ${itemStr}\n`;
                });
              }
            }
          }
          
          logData.status = 'success';
          logData.response = mensagemFinal;
          await this.logCommand(logData);
          
          return mensagemFinal;
        } catch (error) {
          console.error('❌ Erro ao executar query MongoDB:', error.message);
          logData.status = 'error';
          logData.response = `Erro ao executar query: ${error.message}`;
          await this.logCommand(logData);
          return `❌ Erro ao consultar dados: ${error.message}`;
        }
      }
      
      // Se é LISTAR mas não tem queryMongoDB, retornar erro
      if (acao === 'listar' && !parsed.queryMongoDB) {
        console.log('❌ Ação LISTAR mas sem queryMongoDB');
        logData.status = 'error';
        logData.response = 'ChatGPT deve retornar queryMongoDB para ações de LISTAR';
        await this.logCommand(logData);
        return `❌ Erro: ChatGPT deve construir a query MongoDB para listar dados`;
      }

      // Se é INSERÇÃO ou outro tipo, processar comando customizado
      const comandoParaExecutar = parsed.comando; // ex: "#add"
      const dadosDoComando = parsed.dados;

      // Buscar o comando customizado
      const customCmd = await CustomCommand.findOne({ groupId, commandName: comandoParaExecutar });

      if (!customCmd) {
        logData.status = 'error';
        logData.response = `Comando ${comandoParaExecutar} não encontrado`;
        await this.logCommand(logData);
        return `❌ Comando ${comandoParaExecutar} não foi configurado.`;
      }

      // Salvar os dados do comando (para INSERÇÃO)
      if (acao === 'inserir') {
        // Preparar dados - se houver múltiplos valores, salvar como objeto
        let valorParaSalvar = dadosDoComando || 'consulta';
        
        console.log(`📦 Tipo de dado recebido: ${typeof valorParaSalvar}`);
        console.log(`   Dado: ${JSON.stringify(valorParaSalvar)}`);
        
        // Se o ChatGPT retornou um objeto estruturado (com campos como {mes, ano, meta})
        if (typeof valorParaSalvar === 'object' && valorParaSalvar !== null) {
          // Já é um objeto estruturado, limpar cada campo
          console.log(`✅ Objeto estruturado detectado com campos: ${Object.keys(valorParaSalvar).join(', ')}`);
          
          // Limpar cada valor do objeto
          const valorLimpo = {};
          for (const [chave, valor] of Object.entries(valorParaSalvar)) {
            if (typeof valor === 'string') {
              valorLimpo[chave] = this.limparValor(valor);
              console.log(`   Limpeza ${chave}: "${valor}" → "${valorLimpo[chave]}"`);
            } else {
              valorLimpo[chave] = valor;
            }
          }
          valorParaSalvar = valorLimpo;
        } 
        // Se é string, tentar detectar múltiplos valores
        else if (typeof valorParaSalvar === 'string') {
          // Primeiro limpar a string de unidades óbvias
          const valorLimpo = this.limparValor(valorParaSalvar);
          const multiplosValoresMatch = valorLimpo.match(/(\d+(?:\.\d+)?)/g);
          
          if (multiplosValoresMatch && multiplosValoresMatch.length > 1) {
            // Múltiplos valores encontrados - salvar como objeto com array
            console.log(`✅ Detectados ${multiplosValoresMatch.length} valores para ${comandoParaExecutar}`);
            valorParaSalvar = {
              tipo: 'multiplo',
              valores: multiplosValoresMatch,
              original: dadosDoComando
            };
          } else {
            // Valor único limpo
            valorParaSalvar = valorLimpo;
          }
        }

        // NOVO: Se o comando tem camposSalvados específicos, converter para objeto estruturado
        if (customCmd.camposSalvados && customCmd.camposSalvados.length > 0) {
          console.log(`📦 Comando tem campos específicos: ${customCmd.camposSalvados.join(', ')}`);
          
          // Se ainda é string ou múltiplo, converter para objeto com campos
          if (typeof valorParaSalvar === 'string' || (typeof valorParaSalvar === 'object' && valorParaSalvar.tipo === 'multiplo')) {
            console.log(`   ℹ️ Convertendo para objeto estruturado...`);
            
            let valores = [];
            if (typeof valorParaSalvar === 'string') {
              // String: limpar e extrair números
              const limpo = this.limparValor(valorParaSalvar);
              valores = limpo.match(/(\d+(?:\.\d+)?)/g) || [limpo];
            } else if (valorParaSalvar.tipo === 'multiplo') {
              // Já é múltiplo
              valores = valorParaSalvar.valores;
            }
            
            // Mapear valores aos campos
            const valorEstruturado = {};
            customCmd.camposSalvados.forEach((campo, idx) => {
              valorEstruturado[campo] = valores[idx] || '';
              console.log(`   ${campo}: "${valorEstruturado[campo]}"`);
            });
            
            valorParaSalvar = valorEstruturado;
          }
        }

        // ✅ SIMPLIFICADO: userData.idUsuario e userData.userName já foram ajustados na validação se necessário
        console.log(`💾 Salvando CommandData:`);
        console.log(`   userId: ${userData.idUsuario}`);
        console.log(`   userName: ${userData.userName}`);

        const commandData = new CommandData({
          groupId,
          groupName,
          commandName: comandoParaExecutar,
          userId: userData.idUsuario,
          userName: userData.userName,
          dados: valorParaSalvar,
          contexto: customCmd.contexto,
        });

        await commandData.save();
      }

      // Log do comando bem-sucedido
      logData.status = 'success';
      logData.response = `${parsed.explicacao} (confiança: ${(parsed.confianca * 100).toFixed(0)}%)`;
      await this.logCommand(logData);

      // Formatar resposta para INSERÇÃO
      const resposta = `
✅ Entendi sua solicitação!

📝 ${parsed.explicacao}
💾 Executando: ${comandoParaExecutar}

📋 Qual é o comando:
${customCmd.data}

${dadosDoComando ? `💾 Dados armazenados: ${typeof dadosDoComando === 'object' ? JSON.stringify(dadosDoComando) : dadosDoComando}` : ''}
      `.trim();

      return resposta;
    } catch (error) {
      console.error('Erro ao processar comando em linguagem natural:', error.message);
      logData.status = 'error';
      logData.response = error.message;
      await this.logCommand(logData);
      return '😔 Erro ao processar seu comando. Tente novamente.';
    }
  }

  static async logCommand(logData) {
    try {
      const log = new CommandLog(logData);
      await log.save();
    } catch (error) {
      console.error('Erro ao registrar comando:', error.message);
    }
  }

  static async analisarRequerimentoUsuarioRespondido(instrucao) {
    try {
      const prompt = `Analise APENAS esta instrução e responda com JSON:

"${instrucao}"

RETORNE APENAS ESTE JSON:
{
  "tipoComando": "insert|list|delete",
  "requerUsuarioRespondido": true/false,
  "camposSalvados": ["campo1", "campo2"],
  "validacao": "ok|avisoInsercaoSemCampos"
}

REGRAS SIMPLES:
- tipoComando: "insert" (adiciona), "list" (mostra), "delete" (remove)
- requerUsuarioRespondido: true se menciona "usuário respondido", "pessoa respondida", false se menciona "para você", "seus dados"
- camposSalvados: extraia campos com $ (ex: $mes, $ano → ["mes", "ano"])
- validacao: "avisoInsercaoSemCampos" se tipoComando=insert MAS sem campos com $, senão "ok"

Exemplo:
{
  "tipoComando": "insert",
  "requerUsuarioRespondido": false,
  "camposSalvados": ["mes", "ano"],
  "validacao": "ok"
}`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          max_tokens: 200,
        }),
      });

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '{}';
      const resultado = JSON.parse(content);
      
      console.log(`🔍 Análise do comando:`);
      console.log(`   Tipo: ${resultado.tipoComando}`);
      console.log(`   Requer usuário respondido: ${resultado.requerUsuarioRespondido}`);
      console.log(`   Campos: ${JSON.stringify(resultado.camposSalvados)}`);
      console.log(`   Validação: ${resultado.validacao}`);
      
      return resultado;
    } catch (error) {
      console.error('❌ Erro ao analisar comando:', error.message);
      // Por segurança, retorna objeto com defaults seguros
      return {
        tipoComando: 'desconhecido',
        requerUsuarioRespondido: false,
        camposSalvados: [],
        temMarcadores: false,
        validacao: 'ok',
        motivo: 'Erro na análise'
      };
    }
  }

  static limparValor(valor) {
    if (typeof valor !== 'string') return valor;
    
    // 1. Remover unidades comuns no final (km, kg, m, L, %, R$, etc)
    let limpo = valor.replace(/\s*(km|km\/h|m|cm|mm|kg|g|l|ml|%|r\$|\$|€|¥|pts|pontos|dias|horas|minutos|segundos)\s*$/gi, '').trim();
    
    // 2. Remover símbolos monetários no início ou durante o valor
    limpo = limpo.replace(/^\s*r\$\s*|^\s*\$\s*|^\s*€\s*|^\s*¥\s*/gi, '').trim();
    
    // 3. Remover espaços desnecessários dentro do número (ex: "2 026" → "2026")
    limpo = limpo.replace(/\s+/g, '');
    
    // 4. Normalizar separador decimal (vírgula para ponto)
    limpo = limpo.replace(/,/g, '.');
    
    // 5. Remover caracteres especiais que não sejam números, ponto ou hífen
    // Mantém: números, ponto decimal, hífen para negativos
    limpo = limpo.replace(/[^\d\.\-]/g, '');
    
    console.log(`   🧹 Limpeza de valor: "${valor}" → "${limpo}"`);
    return limpo;
  }

  static extractCommand(messageBody) {
    const match = messageBody.match(/^(#\w+)/);
    const result = match ? match[1].toLowerCase() : null;
    console.log(`   [extractCommand] Input: "${messageBody}" | Resultado: ${result}`);
    return result;
  }
}

export default CommandHandler;
