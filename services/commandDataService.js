import CommandData from '../models/CommandData.js';

/**
 * Serviço para gerenciar dados de comandos
 */
export class CommandDataService {
  /**
   * Buscar todos os dados de um comando em um grupo
   */
  static async getCommandData(groupId, commandName, contexto = null) {
    const filter = {
      groupId,
      commandName: commandName.toLowerCase(),
    };

    if (contexto) {
      filter.contexto = contexto.toLowerCase();
    }

    return await CommandData.find(filter).sort({ createdAt: -1 });
  }

  /**
   * Buscar dados de um usuário específico
   */
  static async getUserCommandData(groupId, userId, contexto = null) {
    const filter = {
      groupId,
      userId,
    };

    if (contexto) {
      filter.contexto = contexto.toLowerCase();
    }

    return await CommandData.find(filter).sort({ createdAt: -1 });
  }

  /**
   * Buscar dados por contexto em um grupo
   */
  static async getDataByContext(groupId, contexto) {
    return await CommandData.find({
      groupId,
      contexto: contexto.toLowerCase(),
    }).sort({ createdAt: -1 });
  }

  /**
   * Buscar dados com vinculação
   */
  static async getDataByVinculo(groupId, vinculoTipo, vinculoId) {
    return await CommandData.find({
      groupId,
      'vinculo.tipo': vinculoTipo,
      'vinculo.id': vinculoId,
    }).sort({ createdAt: -1 });
  }

  /**
   * Buscar dados em um período
   */
  static async getDataByDateRange(groupId, dataInicio, dataFim) {
    return await CommandData.find({
      groupId,
      createdAt: {
        $gte: new Date(dataInicio),
        $lte: new Date(dataFim),
      },
    }).sort({ createdAt: -1 });
  }

  /**
   * Somar valores de um comando (útil para contextos numéricos)
   */
  static async sumCommandValues(groupId, commandName, contexto = null) {
    const conditions = {
      groupId,
      commandName: commandName.toLowerCase(),
    };

    if (contexto) {
      conditions.contexto = contexto.toLowerCase();
    }

    const result = await CommandData.aggregate([
      { $match: conditions },
      {
        $group: {
          _id: null,
          total: { $sum: { $toDouble: '$valor' } },
          count: { $sum: 1 },
          media: { $avg: { $toDouble: '$valor' } },
        },
      },
    ]);

    return result.length > 0
      ? result[0]
      : { total: 0, count: 0, media: 0 };
  }

  /**
   * Obter estatísticas por usuário
   */
  static async getStatsByUser(groupId, commandName) {
    return await CommandData.aggregate([
      {
        $match: {
          groupId,
          commandName: commandName.toLowerCase(),
        },
      },
      {
        $group: {
          _id: '$userId',
          userName: { $first: '$userName' },
          total: { $sum: { $toDouble: '$valor' } },
          count: { $sum: 1 },
          ultima: { $max: '$createdAt' },
        },
      },
      { $sort: { total: -1 } },
    ]);
  }

  /**
   * Deletar dados de um comando
   */
  static async deleteCommandData(id) {
    return await CommandData.findByIdAndDelete(id);
  }

  /**
   * Atualizar vinculação de um dado
   */
  static async updateVinculo(id, vinculoTipo, vinculoId) {
    return await CommandData.findByIdAndUpdate(
      id,
      {
        vinculo: {
          tipo: vinculoTipo,
          id: vinculoId,
        },
      },
      { new: true }
    );
  }
}

export default CommandDataService;
