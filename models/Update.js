const mongoose = require("mongoose");

const updateSchema = new mongoose.Schema(
  {
    taskId: { type: String, ref: "Task", required: true },
    date: { type: Date, required: true, default: Date.now },
    note: { type: String, default: "", trim: true, maxlength: 500 },
    status: {
      type: String,
      enum: ["Not Started", "In Progress", "Completed"],
      required: true,
    },
    createdBy: { type: String, ref: "User" },
    updatedBy: { type: String, ref: "User" },
  },
  { timestamps: true }
);

updateSchema.index({ taskId: 1 });
updateSchema.index({ date: 1 });

module.exports = mongoose.model("Update", updateSchema);
