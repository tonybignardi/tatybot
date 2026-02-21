import mongoose from 'mongoose';

const commandDataSchema = new mongoose.Schema(
  {
    groupId: {
      type: String,
      required: true,
      lowercase: true,
      index: true,
    },
    groupName: {
      type: String,
      default: 'N/A',
    },
    commandName: {
      type: String,
      required: true,
      lowercase: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    userName: {
      type: String,
      default: 'N/A',
    },
    // O dados (valores) executados no comando
    // Pode ser uma string simples ou um objeto com múltiplos valores
    // Exemplo string: "5"
    // Exemplo objeto: {tipo: "multiplo", valores: ["5", "10", "15"], original: "5 10 15"}
    dados: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    // Contexto do comando (ex: "km", "pontuação", "arrecadação")
    contexto: {
      type: String,
      required: true,
      index: true,
    },
    // Vinculo genérico com outras entidades (evento, mes, partida, arrecadação, etc)
    vinculo: {
      tipo: String, // "evento", "mes", "partida", "arrecadacao", etc
      id: String,   // ID da entidade
    },
    // Metadados adicionais
    metadados: {
      type: Map,
      of: String,
      default: new Map(),
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Índice composto para buscas rápidas
commandDataSchema.index({ groupId: 1, commandName: 1, contexto: 1 });
commandDataSchema.index({ groupId: 1, userId: 1, createdAt: -1 });

const CommandData = mongoose.model('CommandData', commandDataSchema);

export default CommandData;
