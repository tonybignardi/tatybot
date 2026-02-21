import mongoose from 'mongoose';
import dotenv from 'dotenv';
import GroupAdmin from './models/GroupAdmin.js';
import CommandLog from './models/CommandLog.js';

dotenv.config();

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/whatsapp-bot';
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Conectado ao MongoDB\n');
  } catch (error) {
    console.error('❌ Erro ao conectar:', error.message);
    process.exit(1);
  }
};

const showMenu = () => {
  console.log('\n=== GERENCIADOR DE DADOS ===');
  console.log('1 - Listar todos os grupos com admins');
  console.log('2 - Listar logs de comandos');
  console.log('3 - Buscar grupo específico');
  console.log('4 - Deletar grupo');
  console.log('5 - Sair');
  process.stdout.write('Escolha uma opção: ');
};

const readline = async (question) => {
  process.stdout.write(question);
  return new Promise((resolve) => {
    process.stdin.once('data', (data) => {
      resolve(data.toString().trim());
    });
  });
};

const listGroups = async () => {
  const groups = await GroupAdmin.find();
  if (groups.length === 0) {
    console.log('\n📭 Nenhum grupo registrado ainda');
    return;
  }

  console.log('\n📊 Grupos registrados:');
  groups.forEach((group, index) => {
    console.log(`\n${index + 1}. ${group.groupName} (${group.groupId})`);
    console.log(`   Total de admins: ${group.totalAdmins}`);
    group.admins.forEach((admin) => {
      console.log(`   • ${admin.userName} (@${admin.phoneNumber})`);
    });
  });
};

const listLogs = async () => {
  const logs = await CommandLog.find().sort({ createdAt: -1 }).limit(20);
  if (logs.length === 0) {
    console.log('\n📭 Nenhum log registrado ainda');
    return;
  }

  console.log('\n📜 Últimos 20 comandos:');
  logs.forEach((log, index) => {
    console.log(
      `${index + 1}. ${log.groupName} - ${log.command} - ${log.status} - ${new Date(log.createdAt).toLocaleString()}`
    );
    console.log(`   Usuário: ${log.userName}`);
    console.log(`   Resposta: ${log.response}`);
  });
};

const searchGroup = async () => {
  const groupName = await readline('\nNome do grupo: ');
  const group = await GroupAdmin.findOne({ groupName: { $regex: groupName, $options: 'i' } });

  if (!group) {
    console.log('❌ Grupo não encontrado');
    return;
  }

  console.log(`\n✅ Grupo encontrado: ${group.groupName}`);
  console.log(`   ID: ${group.groupId}`);
  console.log(`   Criado em: ${new Date(group.createdAt).toLocaleString()}`);
  console.log(`   Total de admins: ${group.totalAdmins}`);
  console.log('   Admins:');
  group.admins.forEach((admin) => {
    console.log(`   • ${admin.userName} (@${admin.phoneNumber})`);
  });
};

const deleteGroup = async () => {
  const groupName = await readline('\nNome do grupo a deletar: ');
  const result = await GroupAdmin.deleteOne({ groupName: { $regex: groupName, $options: 'i' } });

  if (result.deletedCount === 0) {
    console.log('❌ Grupo não encontrado');
  } else {
    console.log('✅ Grupo deletado com sucesso');
  }
};

const main = async () => {
  await connectDB();

  let running = true;
  while (running) {
    showMenu();
    const option = await readline('');

    switch (option) {
      case '1':
        await listGroups();
        break;
      case '2':
        await listLogs();
        break;
      case '3':
        await searchGroup();
        break;
      case '4':
        await deleteGroup();
        break;
      case '5':
        running = false;
        console.log('\n👋 Até logo!');
        break;
      default:
        console.log('❌ Opção inválida');
    }
  }

  await mongoose.connection.close();
  process.exit(0);
};

main();
