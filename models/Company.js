const mongoose = require("mongoose");
const User = require("./User");
const Project = require("./Project");
const Uptime = require("./Uptime");
// const Session = require("./Session");

const companySchema = new mongoose.Schema({
  _id: {
    type: String, // 6-digit string
    required: true,
  },
  companyName: String,
  email: String,
  address: String,
  companyType: String,
  password: String,
  logo: String,
  role: {
    type: String,
    default: "admin",
  },
}, { timestamps: true });

companySchema.index({ email: 1 }, { unique: true });
companySchema.index({ role: 1 });

companySchema.pre("findOneAndDelete", async function (next) {
  try {
    const filter = this.getFilter();
    const company = await this.model.findOne(filter);
    if (company) {
      const companyId = company._id;

      await User.deleteMany({ companyCode: companyId });

      await Project.deleteMany({ companyId });

      await Uptime.deleteMany({ companyId });

      // const Session = require('./Session');
      // await Session.deleteMany({ companyId });
    }
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model("Company", companySchema);
