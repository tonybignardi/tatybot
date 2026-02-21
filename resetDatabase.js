import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// Importar todos os modelos
import CommandData from './models/CommandData.js';
import CustomCommand from './models/CustomCommand.js';
import GroupAdmin from './models/GroupAdmin.js';
import GroupContext from './models/GroupContext.js';
import CommandLog from './models/CommandLog.js';
import UserName from './models/UserName.js';

async function resetDatabase() {
  try {
    console.log('\n🔴 INICIANDO RESET DO BANCO DE DADOS...\n');
    
    // Conectar ao MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/wathstaty');
    console.log('✅ Conectado ao MongoDB');

    // Listar e limpar cada collection
    const collections = [
      { name: 'CommandData', model: CommandData },
      { name: 'CustomCommand', model: CustomCommand },
      { name: 'GroupAdmin', model: GroupAdmin },
      { name: 'GroupContext', model: GroupContext },
      { name: 'CommandLog', model: CommandLog },
      { name: 'UserName', model: UserName },
    ];

    for (const collection of collections) {
      try {
        const count = await collection.model.countDocuments();
        await collection.model.deleteMany({});
        console.log(`🗑️  ${collection.name}: ${count} registros deletados`);
      } catch (error) {
        console.warn(`⚠️  Erro ao limpar ${collection.name}: ${error.message}`);
      }
    }

    console.log('\n✅ BANCO DE DADOS RESETADO COM SUCESSO!\n');
    
  } catch (error) {
    console.error('\n❌ ERRO ao resetar banco de dados:');
    console.error(error.message);
    process.exit(1);
  } finally {
    // Desconectar do MongoDB
    await mongoose.disconnect();
    console.log('🔌 Desconectado do MongoDB\n');
    process.exit(0);
  }
}

// Executar
resetDatabase();
