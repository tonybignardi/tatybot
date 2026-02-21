import mongoose from 'mongoose';

const groupContextSchema = new mongoose.Schema(
  {
    groupId: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    groupName: {
      type: String,
      default: 'Sem nome',
    },
    context: {
      type: String,
      default: '',
    },
    updatedBy: String, // userId de quem atualizou
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

const GroupContext = mongoose.model('GroupContext', groupContextSchema);

export default GroupContext;
