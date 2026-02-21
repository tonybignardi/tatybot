const mongoose = require('mongoose');
const CustomCommand = require('./models/CustomCommand');
const CommandData = require('./models/CommandData');
require('dotenv').config();

async function checkData() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    console.log('🔌 Conectando ao MongoDB...');
    
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Conectado ao MongoDB\n');

    // Buscar comando #rank
    const rankCommand = await CustomCommand.findOne({ commandName: '#rank' });
    console.log('📋 Comando #rank:');
    console.log(rankCommand ? JSON.stringify(rankCommand.toObject(), null, 2) : 'NOT FOUND\n');

    // Buscar alguns registros de CommandData para #rank
    const rankData = await CommandData.find({ commandName: '#rank' }).limit(3);
    console.log(`\n📊 Primeiros 3 registros de CommandData para #rank (${rankData.length} encontrados):`);
    rankData.forEach((doc, i) => {
      console.log(`\n[${i + 1}] ${JSON.stringify(doc.toObject(), null, 2)}`);
    });

    // Mostrar todos os comandos
    const allCommands = await CustomCommand.find();
    console.log(`\n\n📝 TOTAL DE COMANDOS CUSTOMIZADOS: ${allCommands.length}`);
    allCommands.forEach(cmd => {
      console.log(`\n• ${cmd.commandName}`);
      console.log(`  data: ${cmd.data}`);
      console.log(`  contexto: ${cmd.contexto}`);
      console.log(`  adminOnly: ${cmd.adminOnly}`);
    });

    await mongoose.connection.close();
    console.log('\n\n✅ Conexão fechada');
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

checkData();
