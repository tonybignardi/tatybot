import CommandData from '../models/CommandData.js';
import CustomCommand from '../models/CustomCommand.js';
import CommandDataService from '../services/commandDataService.js';

/**
 * Handler para processamento de comandos customizados
 * Executa comandos criados pelos admins
 */
class DataQueryHandler {
  /**
   * Executar comando customizado indicado pela IA
   */
  static async executeCommand(commandName, dados, groupId, userId, userName, logData) {
    try {
      const customCmd = await CustomCommand.findOne({ groupId, commandName });

      if (!customCmd) {
        return {
          sucesso: false,
          mensagem: `Comando ${commandName} não encontrado`,
        };
      }

      // Salvar execução do comando
      const commandData = new CommandData({
        groupId,
        commandName,
        userId,
        userName,
        valor: dados || 'consulta',
      });

      await commandData.save();

      return {
        sucesso: true,
        comando: customCmd.commandName,
        instrucao: customCmd.data,
        dados: dados,
      };
    } catch (error) {
      console.error('Erro ao executar comando:', error.message);
      return {
        sucesso: false,
        mensagem: `Erro ao executar comando: ${error.message}`,
      };
    }
  }
}

export default DataQueryHandler;
