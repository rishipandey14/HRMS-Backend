const mongoose = require("mongoose");
const Update = require("./Update");

const taskSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    projectId: { type: String, ref: "Project", required: true },
    title: { type: String, required: true, trim: true },
    assignedTo: [{ type: String, ref: "User" }],
    status: {
      type: String,
      enum: ["Not Started", "In Progress", "Completed"],
      default: "Not Started",
      required: true,
    },
    assignedDate: { type: Date, default: Date.now },
    startingDate: Date,
    deadline: Date,
    createdBy: { type: String, ref: "User" },
    updatedBy: { type: String, ref: "User" },
  },
  { timestamps: true }
);

taskSchema.index({ projectId: 1 });
taskSchema.index({ status: 1 });
taskSchema.index({ deadline: 1 });

taskSchema.pre("save", function (next) {
  if (this.deadline && this.startingDate && this.deadline < this.startingDate) {
    return next(new Error("Deadline cannot be before starting date."));
  }
  // Removed assignedDate validation to allow historical task creation
  next();
});

taskSchema.pre("findOneAndDelete", async function (next) {
  try {
    const filter = this.getFilter();
    const task = await this.model.findOne(filter);
    if (task) {
      await Update.deleteMany({ taskId: task._id });
    }
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model("Task", taskSchema);
