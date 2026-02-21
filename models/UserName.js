import mongoose from 'mongoose';

const userNameSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  nomePersonalizado: {
    type: String,
    required: true,
  },
  nomeOriginal: {
    type: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Atualiza updatedAt antes de salvar
userNameSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

export default mongoose.model('UserName', userNameSchema);
