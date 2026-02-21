import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';
import dotenv from 'dotenv';
import connectDB from './config/database.js';
import CommandHandler from './handlers/commandHandler.js';
import UserName from './models/UserName.js';
import MessageCounter from './models/MessageCounter.js';

dotenv.config();

// Inicializar banco de dados
await connectDB();

// Inicializar cliente WhatsApp
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  },
});

// QR Code
client.on('qr', (qr) => {
  console.log('📱 Escaneie o QR code abaixo com seu WhatsApp para conectar:\n');
  qrcode.generate(qr, { small: true });
});

// Bot pronto
client.on('ready', () => {
  console.log('✅ Bot conectado e pronto para usar!');
  console.log('🤖 Gerenciador de Demandas ativo\n');
  console.log('Comandos de Admin:');
  console.log('  #admin - Designar admin do grupo');
  console.log('  #renunciar - Sair do cargo de admin');
  console.log('  #grupo - Mostrar informações do grupo');
  console.log('  #comando #nome [instrução] - Criar/editar comando\n');
  
  console.log('Como usar:');
  console.log('  1. Admin cria comandos: #comando #add registrar km percorrido');
  console.log('  2. Qualquer um usa em linguagem natural: "quanto de km foi registrado?"');
  console.log('  3. IA entende e executa o comando apropriado\n');
  
  console.log('Ou use direto o comando: #add 5');
});

// Mensagens recebidas
client.on('message', async (msg) => {
  try {
    const messageBody = msg.body.trim();
    const userId = msg.author;
    let userName = msg._data?.notifyName || msg.author;

    // Buscar nome personalizado se existir
    const userNameRecord = await UserName.findOne({ userId });
    if (userNameRecord) {
      userName = userNameRecord.nomePersonalizado;
    }

    // Log de TODAS as mensagens
    console.log(`\n📬 Mensagem recebida: "${messageBody}"`);
    console.log(`   ID: ${msg.id.id}`);
    console.log(`   Usuário: ${userName} (${userId})`);

    // Apenas processa mensagens de grupo
    const chat = await msg.getChat();
    console.log(`   É grupo: ${chat.isGroup}`);
    
    if (!chat.isGroup) {
      console.log(`⏭️  Ignorado (não é grupo)`);
      return;
    }

    const groupId = chat.id._serialized;
    const groupName = chat.name;
    console.log(`   Grupo: ${groupName}`);

    // Verificar se começa com + ou - (contador)
    const isCounter = messageBody.startsWith('+') || messageBody.startsWith('-');
    if (isCounter) {
      const tipo = messageBody[0]; // + ou -
      const conteudo = messageBody.slice(1).trim(); // Conteúdo sem o + ou -
      
      console.log(`📊 Mensagem de contador detectada!`);
      console.log(`   Tipo: ${tipo}`);
      console.log(`   Conteúdo: ${conteudo}`);

      // Salvar no banco
      const counter = new MessageCounter({
        groupId,
        messageId: msg.id.id,
        userId,
        userName,
        conteudo,
        tipo,
        contador: 0,
      });

      try {
        await counter.save();
        console.log(`✅ Contador salvo no banco!`);
      } catch (err) {
        console.error(`❌ Erro ao salvar contador: ${err.message}`);
      }

      return; // Não processa como comando
    }

    // Verifica se começa com hashtag
    const command = CommandHandler.extractCommand(messageBody);
    
    console.log(`   Comando detectado: ${command || 'nenhum'}`);

    if (command) {
      // Comando com hashtag
      console.log(`✅ Processando comando: ${command}`);

      // Processa o comando
      const response = await CommandHandler.handleCommand(msg, command, groupId, groupName);

      // Envia resposta
      if (response) {
        console.log(`📤 Enviando resposta...`);
        msg.reply(response, msg.from, { mentions: [msg.from] });
      }
    } else {
      // Verificar se tem quote (está respondendo alguém)
      const hasQuote = msg.hasQuotedMsg;
      console.log(`   Tem quote: ${hasQuote}`);

      // Se não é comando e não está respondendo ninguém, ignora
      if (!hasQuote) {
        console.log(`⏭️  Ignorado (mensagem pura, sem comando e sem quote)`);
        return;
      }

      // Pegar dados de quem está sendo respondido
      let idUsuarioRespondido = null;
      if (hasQuote) {
        try {
          const quotedMsg = await msg.getQuotedMessage();
          idUsuarioRespondido = quotedMsg.author;
          console.log(`   Respondendo para: ${idUsuarioRespondido}`);
        } catch (err) {
          console.log(`   Erro ao pegar mensagem citada: ${err.message}`);
        }
      }

      // Tentar processar como linguagem natural se houver comandos no grupo
      const GroupAdmin = (await import('./models/GroupAdmin.js')).default;
      const groupAdmin = await GroupAdmin.findOne({ groupId });
      const CustomCommand = (await import('./models/CustomCommand.js')).default;
      const customCommands = await CustomCommand.find({ groupId });
      
      // Se houver comandos cadastrados no grupo, tenta processar com IA
      if (customCommands.length > 0) {
        // Verificar se é admin
        const isAdmin = groupAdmin && groupAdmin.admins.some((admin) => admin.userId === userId);

        console.log(`\n🤖 Tentando processar com IA (ChatGPT)`);
        console.log(`   Grupo: ${groupName}`);
        console.log(`   Usuário: ${userName}`);
        console.log(`   É admin: ${isAdmin}`);
        console.log(`   Comandos disponíveis: ${customCommands.length}`);
        console.log(`   Mensagem do usuário: "${messageBody}"`);

        const logData = {
          groupId,
          groupName,
          userId,
          userName,
          command: '[linguagem-natural]',
          message: messageBody,
          idUsuarioRespondido,
        };

        const response = await CommandHandler.handleNaturalLanguageCommand(
          msg,
          groupId,
          groupName,
          userId,
          userName,
          messageBody,
          logData,
          isAdmin,
          idUsuarioRespondido
        );

        if (response) {
          console.log(`\n📤 Enviando resposta...`);
          msg.reply(response, msg.from, { mentions: [msg.from] });
        }
      } else {
        console.log(`\n⏭️  Ignorado (sem comandos customizados no grupo)`);
      }
    }
  } catch (error) {
    console.error('Erro ao processar mensagem:', error.message);
    if (error.stack) console.error(error.stack);
  }
});

// Listener de reações (curtidas/descurtidas)
client.on('message_reaction', async (reacao) => {
  try {
    console.log(`\n⭐ REAÇÃO DETECTADA!`);
    console.log(`   Estrutura do evento:`, JSON.stringify(reacao, null, 2));
    
    // Determinar se é remoção ou adição
    // A reação pode ser uma string vazia se removida, ou ter um emoji
    const isRemoved = !reacao.reaction || reacao.reaction.trim() === '';
    const emoji = reacao.reaction || '❌';
    
    console.log(`   Emoji: ${emoji}`);
    console.log(`   Removida: ${isRemoved}`);
    console.log(`   Mensagem ID: ${reacao.msgId?.id}`);

    // Buscar o contador no banco
    const messageId = reacao.msgId?.id;
    if (!messageId) {
      console.log(`⏭️  Não consegui extrair ID da mensagem`);
      return;
    }

    const counter = await MessageCounter.findOne({ messageId });

    if (!counter) {
      console.log(`⏭️  Nenhum contador encontrado para essa mensagem`);
      return;
    }

    console.log(`✅ Contador encontrado!`);
    console.log(`   Conteúdo: ${counter.conteudo}`);
    console.log(`   Contador atual: ${counter.contador}`);

    // Incrementar ou decrementar
    let counterAnterior = counter.contador;
    if (isRemoved) {
      // Removeu a reação = decrementar
      counter.contador = Math.max(0, counter.contador - 1);
      console.log(`⬇️  Decrementando: ${counter.contador}`);
    } else {
      // Adicionou reação = incrementar
      counter.contador += 1;
      console.log(`⬆️  Incrementando: ${counter.contador}`);
    }

    counter.updatedAt = new Date();
    await counter.save();

    console.log(`✅ Contador atualizado: ${counter.contador}`);

    // Verificar se atingiu o limite para executar comando automático
    const GroupAdmin = (await import('./models/GroupAdmin.js')).default;
    const groupAdmin = await GroupAdmin.findOne({ groupId: counter.groupId });

    if (!groupAdmin) {
      console.log(`⏭️  Nenhuma configuração de grupo encontrada`);
      return;
    }

    let config = null;
    let tipo = null;

    if (counter.tipo === '+' && groupAdmin.counterConfigPlus) {
      config = groupAdmin.counterConfigPlus;
      tipo = '+';
    } else if (counter.tipo === '-' && groupAdmin.counterConfigMinus) {
      config = groupAdmin.counterConfigMinus;
      tipo = '-';
    }

    if (!config || !config.limite || !config.comando) {
      console.log(`⏭️  Nenhuma configuração de limite para tipo "${counter.tipo}"`);
      return;
    }

    console.log(`\n🎯 Verificando limite:`);
    console.log(`   Tipo: ${tipo}`);
    console.log(`   Limite configurado: ${config.limite}`);
    console.log(`   Contador atual: ${counter.contador}`);
    console.log(`   Já foi executado: ${counter.executed}`);

    // Verificar se atingiu o limite (e não era executado ainda)
    if (counter.contador === config.limite && !counter.executed) {
      console.log(`\n🚀 LIMITE ATINGIDO! Executando comando: ${config.comando}`);

      try {
        // Buscar o chat usando o groupId armazenado no counter
        let chat = null;
        try {
          chat = await client.getChatById(counter.groupId);
        } catch (err) {
          console.warn(`⚠️ Erro ao buscar chat por groupId, tentando alternativa...`);
          // Se falhar, tentar buscar a partir de uma conversa existente
          const chats = await client.getChats();
          chat = chats.find(c => c.id._serialized === counter.groupId);
        }

        if (!chat) {
          throw new Error(`Não conseguiu encontrar o chat do grupo`);
        }

        // Construir o comando a executar com o conteúdo da mensagem
        // Exemplo: "#ok 5 kms" se o comando é #ok e o conteúdo é "5 kms"
        const comandoComConteudo = `${config.comando} ${counter.conteudo}`;

        console.log(`   Chat: ${chat.name}`);
        console.log(`   Comando a executar: "${comandoComConteudo}"`);

        // Simular uma mensagem sendo enviada para processar o comando
        // Criar um objeto mock de mensagem
        // Camuflar como se é uma resposta à mensagem original
        const msgAutomatica = {
          id: { id: `auto_${Date.now()}` },
          author: counter.userId,
          _data: {
            notifyName: counter.userName,
            quotedParticipant: counter.userId,  // Simular que é uma resposta
            quotedMsg: {
              notifyName: counter.userName
            }
          },
          from: counter.userId,
          body: comandoComConteudo,
          idUsuarioRespondido: counter.userId,
          nomeUsuarioRespondido: counter.userName,
          getChat: async () => chat,
          getQuotedMessage: async () => null,
          hasQuotedMsg: false,
          reply: async (response) => {
            console.log(`   Resposta automática: "${response}"`);
            // Enviar a resposta no chat
            try {
              await chat.sendMessage(response);
            } catch (err) {
              console.error(`   Erro ao enviar resposta: ${err.message}`);
            }
          }
        };

        // Executar o comando via CommandHandler
        const CommandHandler = (await import('./handlers/commandHandler.js')).default;
        const groupId = chat.id._serialized;
        const groupName = chat.name;

        const response = await CommandHandler.handleCommand(msgAutomatica, config.comando, groupId, groupName);
        if (response) {
          await msgAutomatica.reply(response);
        }

        console.log(`✅ Comando executado com sucesso!`);

        // Marcar como executado para evitar múltiplas execuções
        counter.executed = true;
        await counter.save();
        console.log(`📌 Comando marcado como executado para evitar re-execução`);
      } catch (err) {
        console.error(`❌ Erro ao executar comando automático: ${err.message}`);
      }
    }
  } catch (error) {
    console.error(`❌ Erro ao processar reação: ${error.message}`);
    if (error.stack) console.error(error.stack);
  }
});

// Eventos de erro
client.on('auth_failure', (msg) => {
  console.error('❌ Falha na autenticação:', msg);
});

client.on('disconnected', (reason) => {
  console.log('⚠️ Bot desconectado:', reason);
});

// Inicializar cliente
client.initialize();
