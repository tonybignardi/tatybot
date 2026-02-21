import mongoose from 'mongoose';

const groupAdminSchema = new mongoose.Schema(
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
    admins: [
      {
        userId: String,
        userName: String,
        phoneNumber: String,
        assignedAt: {
          type: Date,
          default: Date.now,
        },
        assignedBy: String, // userId de quem designou
      },
    ],
    totalAdmins: {
      type: Number,
      default: 0,
    },
    counterConfigPlus: {
      limite: { type: Number, default: null },
      comando: { type: String, default: null }, // Ex: "#ok"
    },
    counterConfigMinus: {
      limite: { type: Number, default: null },
      comando: { type: String, default: null }, // Ex: "#notok"
    },
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

const GroupAdmin = mongoose.model('GroupAdmin', groupAdminSchema);

export default GroupAdmin;
