const mongoose = require("mongoose");
const Task = require("./Task");

const projectSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    companyId: { type: String, ref: "Company", required: true },
    title: { type: String, required: true },
    participants: [{ type: String, ref: "User" }],
    description: String,
    startDate: Date,
    endDate: Date,
    createdBy: { type: String, ref: "User" },
    updatedBy: { type: String, ref: "User" },
  },
  { timestamps: true }
);

projectSchema.pre("findOneAndDelete", async function (next) {
  try {
    const filter = this.getFilter();
    const project = await this.model.findOne(filter);
    if (project) {
      const tasks = await Task.find({ projectId: project._id });
      for (const task of tasks) {
        await task.remove();
      }
    }
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model("Project", projectSchema);
