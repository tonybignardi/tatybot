import mongoose from 'mongoose';

const commandLogSchema = new mongoose.Schema(
  {
    groupId: String,
    groupName: String,
    userId: String,
    userName: String,
    command: String,
    message: String,
    status: {
      type: String,
      enum: ['success', 'error', 'unknown'],
      default: 'success',
    },
    response: String,
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: false }
);

const CommandLog = mongoose.model('CommandLog', commandLogSchema);

export default CommandLog;
