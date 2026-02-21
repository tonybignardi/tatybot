const mongoose = require('mongoose');
const CustomCommand = require('./models/CustomCommand');
const CommandData = require('./models/CommandData');
require('dotenv').config();

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    // 1. Ver comando #rank
    console.log('=== COMANDO #rank ===');
    const rankCmd = await CustomCommand.findOne({ commandName: '#rank' });
    if (rankCmd) {
      console.log('✅ Encontrado!');
      console.log('  commandName:', rankCmd.commandName);
      console.log('  data:', rankCmd.data);
      console.log('  contexto:', rankCmd.contexto);
      console.log('  adminOnly:', rankCmd.adminOnly);
    } else {
      console.log('❌ Não encontrado');
    }

    // 2. Ver dados de CommandData para #rank
    console.log('\n=== DADOS PARA #rank ===');
    const data = await CommandData.find({ commandName: '#rank' }).limit(5);
    console.log(`Total: ${data.length}`);
    data.forEach((d, i) => {
      console.log(`\n[${i+1}]`);
      console.log('  groupId:', d.groupId);
      console.log('  commandName:', d.commandName);
      console.log('  userName:', d.userName);
      console.log('  valor:', d.valor);
      console.log('  contexto:', d.contexto);
      console.log('  createdAt:', d.createdAt);
    });

    // 3. Ver todos os comandos
    console.log('\n=== TODOS OS COMANDOS ===');
    const allCmds = await CustomCommand.find();
    console.log(`Total: ${allCmds.length}`);
    allCmds.forEach(cmd => {
      console.log(`\n${cmd.commandName}`);
      console.log(`  ${cmd.data.substring(0, 60)}...`);
    });

    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('ERRO:', err.message);
    process.exit(1);
  }
})();
