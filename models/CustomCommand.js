import mongoose from 'mongoose';

const customCommandSchema = new mongoose.Schema(
  {
    groupId: {
      type: String,
      required: true,
      lowercase: true,
    },
    commandName: {
      type: String,
      required: true,
      lowercase: true,
    },
    description: {
      type: String,
      default: '',
    },
    data: {
      type: String,
      default: '',
    },
    // Contexto/categoria do dado armazenado (ex: "km", "pontuação", "arrecadação")
    contexto: {
      type: String,
      required: true,
      default: 'generico',
    },
    // Tipo de dado esperado (numero, texto, moeda, etc)
    tipoDado: {
      type: String,
      enum: ['numero', 'texto', 'moeda', 'percentual', 'booleano', 'data'],
      default: 'texto',
    },
    // Campo para indicar se o comando é restrito a admin
    adminOnly: {
      type: Boolean,
      default: false,
    },
    // Flag indicando se o comando requer um usuário respondido (via REPLY)
    // true = comando trabalha com dados de quem foi respondido
    // false = comando trabalha com dados do próprio usuário
    requerUsuarioRespondido: {
      type: Boolean,
      default: false,
    },
    // Tipo do comando: insert (salva dados), list (consulta dados), delete (remove dados)
    tipoComando: {
      type: String,
      enum: ['insert', 'list', 'delete'],
      default: 'insert',
    },
    // Lista de campos que devem ser salvos (extraído dos $ na instrução)
    // Exemplo: ["mes", "ano", "meta"] para comando #metames
    camposSalvados: {
      type: [String],
      default: [],
    },
    // Campo para indicar se usa UPSERT (atualizar se existir) ou INSERT (sempre novo)
    // Se vazio [] = INSERT sempre novo
    // Se preenchido ex: ["mes", "ano"] = UPSERT buscando por groupId + userId + mes + ano
    upsertBy: {
      type: [String],
      default: [],
    },
    createdBy: String, // userId de quem criou
    updatedBy: String, // userId de quem atualizou por último
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Índice composto para unicidade de comando por grupo
customCommandSchema.index({ groupId: 1, commandName: 1 }, { unique: true });
customCommandSchema.index({ groupId: 1, contexto: 1 });

const CustomCommand = mongoose.model('CustomCommand', customCommandSchema);

export default CustomCommand;
