import mongoose from 'mongoose';

const messageCounterSchema = new mongoose.Schema({
  groupId: { type: String, required: true },
  messageId: { type: String, required: true, unique: true },
  userId: { type: String, required: true },
  userName: { type: String, required: true },
  conteudo: { type: String, required: true },
  tipo: { type: String, enum: ['+', '-'], required: true }, // + ou -
  contador: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

export default mongoose.model('MessageCounter', messageCounterSchema);
